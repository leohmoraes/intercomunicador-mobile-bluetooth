import { AudioProfileType, RogerBeepType } from '../types/intercom';

export interface P2PEventCallbacks {
  onPeerConnected?: (peerId: string, peerName: string) => void;
  onPeerDisconnected?: (peerId: string) => void;
  onVoiceStart?: (senderId: string, channel: number, profile: AudioProfileType, rogerBeep: RogerBeepType) => void;
  onVoiceData?: (senderId: string, audioData: Float32Array | ArrayBuffer | string) => void;
  onVoiceStop?: (senderId: string, channel: number, rogerBeep: RogerBeepType) => void;
  onLatencyUpdate?: (latencyMs: number) => void;
  onStatusChange?: (status: 'disconnected' | 'connecting' | 'connected' | 'offline_broadcast') => void;
}

class P2PManager {
  private localPeerId: string = 'dev-' + Math.random().toString(36).substring(2, 7);
  private deviceName: string = 'Celular 1';
  private roomId: string = '7392';
  private ws: WebSocket | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private callbacks: P2PEventCallbacks = {};
  private status: 'disconnected' | 'connecting' | 'connected' | 'offline_broadcast' = 'disconnected';
  private pingInterval: number | null = null;
  private lastPingSent: number = 0;
  private isSimulatorMode = false;

  constructor() {
    this.setupBroadcastChannel();
  }

  public setCallbacks(cbs: P2PEventCallbacks) {
    this.callbacks = { ...this.callbacks, ...cbs };
  }

  public getLocalPeerId(): string {
    return this.localPeerId;
  }

  public getRoomId(): string {
    return this.roomId;
  }

  public getStatus(): string {
    return this.status;
  }

  // Set up 100% offline BroadcastChannel for inter-device/inter-tab communication
  private setupBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel(`intercom_p2p_channel_${this.roomId}`);
        this.broadcastChannel.onmessage = (event) => {
          this.handleIncomingPayload(event.data);
        };
      } catch (err) {
        console.warn('BroadcastChannel not supported:', err);
      }
    }
  }

  public joinRoom(newRoomId: string, deviceName?: string) {
    this.roomId = newRoomId.trim();
    if (deviceName) this.deviceName = deviceName;

    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = new BroadcastChannel(`intercom_p2p_channel_${this.roomId}`);
      this.broadcastChannel.onmessage = (event) => {
        this.handleIncomingPayload(event.data);
      };
    }

    this.connectWebSocket();
  }

  public connectWebSocket() {
    if (typeof window === 'undefined') return;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.status = 'connecting';
    this.callbacks.onStatusChange?.('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.status = 'connected';
        this.callbacks.onStatusChange?.('connected');

        // Register room
        this.sendToWs({
          type: 'join',
          roomId: this.roomId,
          peerId: this.localPeerId,
          deviceName: this.deviceName,
        });

        this.startPingLoop();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'peer-joined') {
            this.callbacks.onPeerConnected?.(data.peerId, data.deviceName);
          } else if (data.type === 'peer-left') {
            this.callbacks.onPeerDisconnected?.(data.peerId);
          } else {
            this.handleIncomingPayload(data);
          }
        } catch (err) {
          console.error('Error in WS message parse:', err);
        }
      };

      this.ws.onerror = () => {
        // Fallback to offline BroadcastChannel mode
        this.status = 'offline_broadcast';
        this.callbacks.onStatusChange?.('offline_broadcast');
      };

      this.ws.onclose = () => {
        this.status = 'offline_broadcast';
        this.callbacks.onStatusChange?.('offline_broadcast');
        this.stopPingLoop();
      };
    } catch {
      this.status = 'offline_broadcast';
      this.callbacks.onStatusChange?.('offline_broadcast');
    }
  }

  private handleIncomingPayload(msg: Record<string, unknown>) {
    if (!msg || msg.senderId === this.localPeerId) return;

    if (msg.type === 'voice-start') {
      this.callbacks.onVoiceStart?.(
        msg.senderId as string,
        (msg.channel as number) || 1,
        (msg.profile as AudioProfileType) || 'hq_clean',
        (msg.rogerBeep as RogerBeepType) || 'tactical'
      );
    } else if (msg.type === 'voice-data') {
      this.callbacks.onVoiceData?.(
        msg.senderId as string,
        msg.audioData as Float32Array | ArrayBuffer | string
      );
    } else if (msg.type === 'voice-stop') {
      this.callbacks.onVoiceStop?.(
        msg.senderId as string,
        (msg.channel as number) || 1,
        (msg.rogerBeep as RogerBeepType) || 'tactical'
      );
    } else if (msg.type === 'ping') {
      this.broadcastPayload({
        type: 'pong',
        senderId: this.localPeerId,
        targetId: msg.senderId,
        originalTimestamp: msg.timestamp,
      });
    } else if (msg.type === 'pong' && msg.targetId === this.localPeerId) {
      const roundtrip = Date.now() - (msg.originalTimestamp as number);
      this.callbacks.onLatencyUpdate?.(Math.round(roundtrip / 2));
    }
  }

  private sendToWs(payload: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private broadcastPayload(payload: Record<string, unknown>) {
    // Send via WebSocket if connected
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        ...payload,
        roomId: this.roomId,
        senderId: this.localPeerId,
      }));
    }

    // Also broadcast via BroadcastChannel for offline tabs
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          ...payload,
          roomId: this.roomId,
          senderId: this.localPeerId,
        });
      } catch {
        // Safe ignore
      }
    }
  }

  // Transmit start of voice
  public transmitStart(channel: number, profile: AudioProfileType, rogerBeep: RogerBeepType) {
    this.broadcastPayload({
      type: 'voice-start',
      channel,
      profile,
      rogerBeep,
      timestamp: Date.now(),
    });
  }

  // Transmit voice data chunks
  public transmitData(audioData: unknown) {
    this.broadcastPayload({
      type: 'voice-data',
      audioData,
      timestamp: Date.now(),
    });
  }

  // Transmit end of voice
  public transmitStop(channel: number, rogerBeep: RogerBeepType) {
    this.broadcastPayload({
      type: 'voice-stop',
      channel,
      rogerBeep,
      timestamp: Date.now(),
    });
  }

  private startPingLoop() {
    this.stopPingLoop();
    this.pingInterval = window.setInterval(() => {
      this.lastPingSent = Date.now();
      this.broadcastPayload({
        type: 'ping',
        timestamp: this.lastPingSent,
      });
    }, 4000);
  }

  private stopPingLoop() {
    if (this.pingInterval) {
      window.clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

export const p2pManager = new P2PManager();
