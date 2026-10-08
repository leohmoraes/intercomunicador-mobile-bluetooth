import { AudioProfileType, RogerBeepType } from '../types/intercom';
import { audioEngine } from './audioEngine';

export interface P2PEventCallbacks {
  onPeerConnected?: (peerId: string, peerName: string) => void;
  onPeerDisconnected?: (peerId: string) => void;
  onVoiceStart?: (senderId: string, channel: number, profile: AudioProfileType, rogerBeep: RogerBeepType) => void;
  onVoiceData?: (senderId: string, audioBase64: string) => void;
  onVoiceStop?: (senderId: string, channel: number, rogerBeep: RogerBeepType) => void;
  onLatencyUpdate?: (latencyMs: number) => void;
  onStatusChange?: (status: 'disconnected' | 'connecting' | 'connected' | 'webrtc_connected' | 'offline_broadcast') => void;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

class P2PManager {
  private localPeerId: string = 'dev-' + Math.random().toString(36).substring(2, 7);
  private deviceName: string = 'Celular ' + Math.floor(10 + Math.random() * 89);
  private roomId: string = '7392';
  private ws: WebSocket | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private callbacks: P2PEventCallbacks = {};
  private status: 'disconnected' | 'connecting' | 'connected' | 'webrtc_connected' | 'offline_broadcast' = 'disconnected';
  private pingInterval: number | null = null;
  private pollingInterval: number | null = null;
  private lastPingSent: number = 0;
  private peerConnections = new Map<string, RTCPeerConnection>();
  private remoteAudioElements = new Map<string, HTMLAudioElement>();
  private isHttpPollingActive = false;

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

  private setupBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        if (this.broadcastChannel) this.broadcastChannel.close();
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

    this.setupBroadcastChannel();
    this.connectWebSocket();
    this.setupHttpFallback();
  }

  public connectWebSocket() {
    if (typeof window === 'undefined') return;

    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
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
            // Initiate WebRTC connection to peer
            this.initiateWebRTCConnection(data.peerId);
          } else if (data.type === 'peer-left') {
            this.callbacks.onPeerDisconnected?.(data.peerId);
            this.cleanupPeer(data.peerId);
          } else {
            this.handleIncomingPayload(data);
          }
        } catch (err) {
          console.error('Error in WS message parse:', err);
        }
      };

      this.ws.onerror = () => {
        this.startHttpPolling();
      };

      this.ws.onclose = () => {
        this.startHttpPolling();
      };
    } catch {
      this.startHttpPolling();
    }
  }

  // HTTP Fallback Signaling for environments where WebSockets might be blocked
  private async setupHttpFallback() {
    try {
      const res = await fetch('/api/signaling/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          peerId: this.localPeerId,
          roomId: this.roomId,
          deviceName: this.deviceName,
        }),
      });
      const data = await res.json();
      if (data.peers && Array.isArray(data.peers)) {
        for (const peer of data.peers) {
          this.callbacks.onPeerConnected?.(peer.peerId, peer.deviceName);
          this.initiateWebRTCConnection(peer.peerId);
        }
      }
    } catch {
      // Safe fallback
    }
  }

  private startHttpPolling() {
    if (this.isHttpPollingActive) return;
    this.isHttpPollingActive = true;
    this.status = 'offline_broadcast';
    this.callbacks.onStatusChange?.('offline_broadcast');

    if (this.pollingInterval) clearInterval(this.pollingInterval);
    this.pollingInterval = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/signaling/poll?peerId=${this.localPeerId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.messages && Array.isArray(data.messages)) {
            for (const msg of data.messages) {
              this.handleIncomingPayload(msg);
            }
          }
        }
      } catch {
        // Safe poll retry
      }
    }, 600);
  }

  // --- WEBRTC PEER CONNECTION IMPLEMENTATION ---
  private async initiateWebRTCConnection(targetPeerId: string) {
    if (this.peerConnections.has(targetPeerId)) return;
    if (targetPeerId <= this.localPeerId) {
      // Tie breaker: only the peer with lexicographically smaller ID creates the offer
      return;
    }

    const pc = this.createPeerConnection(targetPeerId);
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
      });
      await pc.setLocalDescription(offer);

      this.broadcastPayload({
        type: 'webrtc-signal',
        targetPeerId,
        signalType: 'offer',
        sdp: offer,
      });
    } catch (err) {
      console.warn('WebRTC offer creation error:', err);
    }
  }

  private createPeerConnection(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.peerConnections.set(peerId, pc);

    // Attach local microphone audio track if already captured
    const stream = audioEngine.getMicStream();
    if (stream) {
      stream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.broadcastPayload({
          type: 'webrtc-signal',
          targetPeerId: peerId,
          signalType: 'candidate',
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      // Remote audio stream received
      if (event.streams && event.streams[0]) {
        let audioEl = this.remoteAudioElements.get(peerId);
        if (!audioEl) {
          audioEl = document.createElement('audio');
          audioEl.autoplay = true;
          audioEl.style.display = 'none';
          document.body.appendChild(audioEl);
          this.remoteAudioElements.set(peerId, audioEl);
        }
        audioEl.srcObject = event.streams[0];
        audioEl.play().catch(() => {});
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        this.status = 'webrtc_connected';
        this.callbacks.onStatusChange?.('webrtc_connected');
      }
    };

    return pc;
  }

  private cleanupPeer(peerId: string) {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }
    const el = this.remoteAudioElements.get(peerId);
    if (el) {
      el.srcObject = null;
      el.remove();
      this.remoteAudioElements.delete(peerId);
    }
  }

  private async handleIncomingPayload(msg: Record<string, unknown>) {
    if (!msg || msg.senderId === this.localPeerId) return;

    if (msg.type === 'voice-start') {
      this.callbacks.onVoiceStart?.(
        msg.senderId as string,
        (msg.channel as number) || 1,
        (msg.profile as AudioProfileType) || 'hq_clean',
        (msg.rogerBeep as RogerBeepType) || 'tactical'
      );
    } else if (msg.type === 'voice-data') {
      const audioBase64 = msg.audioBase64 as string;
      if (audioBase64) {
        this.callbacks.onVoiceData?.(msg.senderId as string, audioBase64);
        // Play the audio chunk directly through AudioEngine speaker pipeline
        audioEngine.playReceivedAudioChunk(audioBase64);
      }
    } else if (msg.type === 'voice-stop') {
      this.callbacks.onVoiceStop?.(
        msg.senderId as string,
        (msg.channel as number) || 1,
        (msg.rogerBeep as RogerBeepType) || 'tactical'
      );
    } else if (msg.type === 'webrtc-signal' && msg.targetPeerId === this.localPeerId) {
      const senderId = msg.senderId as string;
      let pc = this.peerConnections.get(senderId);
      if (!pc) {
        pc = this.createPeerConnection(senderId);
      }

      if (msg.signalType === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp as RTCSessionDescriptionInit));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.broadcastPayload({
          type: 'webrtc-signal',
          targetPeerId: senderId,
          signalType: 'answer',
          sdp: answer,
        });
      } else if (msg.signalType === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp as RTCSessionDescriptionInit));
      } else if (msg.signalType === 'candidate') {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate as RTCIceCandidateInit));
        } catch (err) {
          console.warn('Error adding ICE candidate:', err);
        }
      }
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
    const enriched = {
      ...payload,
      roomId: this.roomId,
      senderId: this.localPeerId,
    };

    // 1. Send via WebSocket if open
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(enriched));
    } else {
      // Send via HTTP signaling fallback
      fetch('/api/signaling/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: this.localPeerId,
          roomId: this.roomId,
          targetPeerId: payload.targetPeerId,
          payload: enriched,
        }),
      }).catch(() => {});
    }

    // 2. Broadcast via BroadcastChannel (for offline tabs/windows)
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(enriched);
      } catch {}
    }
  }

  // Transmit start of voice
  public transmitStart(channel: number, profile: AudioProfileType, rogerBeep: RogerBeepType) {
    // Enable WebRTC audio tracks
    this.peerConnections.forEach((pc) => {
      pc.getSenders().forEach((sender) => {
        if (sender.track && sender.track.kind === 'audio') {
          sender.track.enabled = true;
        }
      });
    });

    this.broadcastPayload({
      type: 'voice-start',
      channel,
      profile,
      rogerBeep,
      timestamp: Date.now(),
    });
  }

  // Transmit audio chunk (Opus/WebM/PCM base64)
  public transmitVoiceChunk(audioBase64: string) {
    this.broadcastPayload({
      type: 'voice-data',
      audioBase64,
      timestamp: Date.now(),
    });
  }

  // Transmit end of voice
  public transmitStop(channel: number, rogerBeep: RogerBeepType) {
    // Mute WebRTC audio tracks
    this.peerConnections.forEach((pc) => {
      pc.getSenders().forEach((sender) => {
        if (sender.track && sender.track.kind === 'audio') {
          sender.track.enabled = false;
        }
      });
    });

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
