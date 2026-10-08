import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 3000;

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: '15mb' }));

  // WebSocket signaling server for P2P Intercom pairing
  const wss = new WebSocketServer({ server, path: '/ws' });

  interface PeerClient {
    ws?: WebSocket;
    roomId: string;
    peerId: string;
    deviceName: string;
    lastSeen: number;
  }

  const clients = new Map<string, PeerClient>(); // key: peerId
  const wsToPeerId = new Map<WebSocket, string>();
  
  // Message queue for HTTP polling fallback
  const messageQueues = new Map<string, Array<Record<string, unknown>>>(); // key: peerId

  const queueMessageForPeer = (targetPeerId: string, msg: Record<string, unknown>) => {
    if (!messageQueues.has(targetPeerId)) {
      messageQueues.set(targetPeerId, []);
    }
    const q = messageQueues.get(targetPeerId)!;
    q.push(msg);
    if (q.length > 50) q.shift(); // keep last 50
  };

  const broadcastToRoom = (senderPeerId: string, roomId: string, msg: Record<string, unknown>, targetPeerId?: string) => {
    for (const [peerId, client] of clients.entries()) {
      if (peerId !== senderPeerId && client.roomId === roomId) {
        if (!targetPeerId || targetPeerId === peerId) {
          // Send via WebSocket if open
          if (client.ws && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify(msg));
          }
          // Also buffer in queue for HTTP polling peers
          queueMessageForPeer(peerId, msg);
        }
      }
    }
  };

  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        
        if (msg.type === 'join') {
          const peerId = msg.peerId;
          const roomId = msg.roomId || '7392';
          const deviceName = msg.deviceName || 'Celular Remoto';

          clients.set(peerId, {
            ws,
            roomId,
            peerId,
            deviceName,
            lastSeen: Date.now(),
          });
          wsToPeerId.set(ws, peerId);

          // Tell the joining peer about all existing peers in the room
          for (const [otherId, client] of clients.entries()) {
            if (otherId !== peerId && client.roomId === roomId) {
              ws.send(JSON.stringify({
                type: 'peer-joined',
                peerId: otherId,
                deviceName: client.deviceName,
                roomId,
              }));

              // Notify the other peer of the new peer
              if (client.ws && client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(JSON.stringify({
                  type: 'peer-joined',
                  peerId,
                  deviceName,
                  roomId,
                }));
              }
            }
          }
        } else if (msg.type === 'signal' || msg.type === 'voice-data' || msg.type === 'voice-start' || msg.type === 'voice-stop' || msg.type === 'ping' || msg.type === 'pong') {
          const senderId = msg.senderId || wsToPeerId.get(ws);
          if (!senderId) return;
          const sender = clients.get(senderId);
          const roomId = sender ? sender.roomId : (msg.roomId || '7392');

          broadcastToRoom(senderId, roomId, { ...msg, fromPeerId: senderId }, msg.targetPeerId);
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      const peerId = wsToPeerId.get(ws);
      if (peerId) {
        const client = clients.get(peerId);
        if (client) {
          broadcastToRoom(peerId, client.roomId, {
            type: 'peer-left',
            peerId,
          });
          clients.delete(peerId);
        }
        wsToPeerId.delete(ws);
        messageQueues.delete(peerId);
      }
    });
  });

  // --- HTTP SIGNALING FALLBACK ENDPOINTS ---
  app.post('/api/signaling/join', (req, res) => {
    const { peerId, roomId, deviceName } = req.body;
    if (!peerId || !roomId) {
      return res.status(400).json({ error: 'Missing peerId or roomId' });
    }

    const existing = clients.get(peerId);
    clients.set(peerId, {
      ws: existing?.ws,
      roomId,
      peerId,
      deviceName: deviceName || 'Celular Remoto',
      lastSeen: Date.now(),
    });

    // Notify room peers
    broadcastToRoom(peerId, roomId, {
      type: 'peer-joined',
      peerId,
      deviceName: deviceName || 'Celular Remoto',
      roomId,
    });

    // Return list of peers already in room
    const peersInRoom: Array<{ peerId: string; deviceName: string }> = [];
    for (const [otherId, client] of clients.entries()) {
      if (otherId !== peerId && client.roomId === roomId) {
        peersInRoom.push({ peerId: otherId, deviceName: client.deviceName });
      }
    }

    res.json({ status: 'ok', peers: peersInRoom });
  });

  app.post('/api/signaling/send', (req, res) => {
    const { senderId, roomId, targetPeerId, payload } = req.body;
    if (!senderId || !roomId || !payload) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    broadcastToRoom(senderId, roomId, { ...payload, fromPeerId: senderId }, targetPeerId);
    res.json({ status: 'sent' });
  });

  app.get('/api/signaling/poll', (req, res) => {
    const peerId = req.query.peerId as string;
    if (!peerId) return res.status(400).json({ error: 'Missing peerId' });

    const q = messageQueues.get(peerId) || [];
    messageQueues.set(peerId, []); // drain queue

    // Update last seen
    const client = clients.get(peerId);
    if (client) client.lastSeen = Date.now();

    res.json({ messages: q });
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', onlinePeers: clients.size });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Intercom Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
