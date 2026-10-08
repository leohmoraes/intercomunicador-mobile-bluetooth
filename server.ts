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

  app.use(express.json());

  // WebSocket signaling server for P2P Intercom pairing
  const wss = new WebSocketServer({ server, path: '/ws' });

  interface PeerClient {
    ws: WebSocket;
    roomId: string;
    peerId: string;
    deviceName: string;
  }

  const clients = new Map<WebSocket, PeerClient>();

  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        
        if (msg.type === 'join') {
          clients.set(ws, {
            ws,
            roomId: msg.roomId || 'global-ch1',
            peerId: msg.peerId,
            deviceName: msg.deviceName || 'Intercom Device',
          });

          // Notify others in room
          const currentClient = clients.get(ws)!;
          for (const [otherWs, client] of clients.entries()) {
            if (otherWs !== ws && client.roomId === currentClient.roomId && otherWs.readyState === WebSocket.OPEN) {
              // Notify existing peer of new peer
              otherWs.send(JSON.stringify({
                type: 'peer-joined',
                peerId: currentClient.peerId,
                deviceName: currentClient.deviceName,
              }));
              // Notify new peer of existing peer
              ws.send(JSON.stringify({
                type: 'peer-joined',
                peerId: client.peerId,
                deviceName: client.deviceName,
              }));
            }
          }
        } else if (msg.type === 'signal' || msg.type === 'voice-chunk' || msg.type === 'ptt-state') {
          // Forward signaling or voice payload to peers in same room
          const sender = clients.get(ws);
          if (!sender) return;

          for (const [otherWs, client] of clients.entries()) {
            if (otherWs !== ws && client.roomId === sender.roomId && otherWs.readyState === WebSocket.OPEN) {
              if (!msg.targetPeerId || msg.targetPeerId === client.peerId) {
                otherWs.send(JSON.stringify({
                  ...msg,
                  fromPeerId: sender.peerId,
                }));
              }
            }
          }
        }
      } catch (err) {
        console.error('Error parsing WS message:', err);
      }
    });

    ws.on('close', () => {
      const sender = clients.get(ws);
      if (sender) {
        clients.delete(ws);
        for (const [otherWs, client] of clients.entries()) {
          if (client.roomId === sender.roomId && otherWs.readyState === WebSocket.OPEN) {
            otherWs.send(JSON.stringify({
              type: 'peer-left',
              peerId: sender.peerId,
            }));
          }
        }
      }
    });
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
