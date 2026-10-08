export type RogerBeepType = 'quindar' | 'tactical' | 'classic' | 'chirp' | 'none';
export type AudioProfileType = 'hq_clean' | 'tactical_walkie' | 'boost_amplified';
export type DeviceRole = 'alfa' | 'bravo' | 'standalone';

export interface AudioSettings {
  volume: number; // 0 to 1
  micGain: number; // 1 to 4 (boost)
  profile: AudioProfileType;
  squelchEnabled: boolean;
  squelchSensitivity: number; // 0 to 1
  rogerBeep: RogerBeepType;
  pttLocked: boolean;
  voxEnabled: boolean;
  voxThreshold: number; // 1 to 100
  voxDelayMs: number; // hold time before cutting
  duckingEnabled: boolean;
  duckingLevel: number; // 0.1 to 0.9 (attenuation factor, default 0.85 = 85% drop)
  duckingReleaseMs: number; // release time in ms
}

export interface IntercomChannel {
  id: number;
  name: string;
  frequency: string;
  subtone: string;
}

export interface DeviceState {
  id: string;
  name: string;
  role: DeviceRole;
  channel: number;
  subtone: number;
  isTransmitting: boolean; // TX
  isReceiving: boolean; // RX
  isMuted: boolean;
  isPttLocked: boolean;
  isVoxActive: boolean;
  micLevel: number; // 0 to 100
  rxLevel: number; // 0 to 100
  batteryLevel: number;
  rssi: number; // dBm signal
  settings: AudioSettings;
  audioSource: 'mic' | 'test_voice' | 'tone';
  peerConnected: boolean;
}

export interface P2PVoiceMessage {
  type: 'voice-start' | 'voice-data' | 'voice-stop' | 'ping' | 'pong';
  senderId: string;
  channel: number;
  subtone: number;
  audioBlob?: string; // base64 or arraybuffer representation for chunks
  timestamp: number;
  profile: AudioProfileType;
  rogerBeep: RogerBeepType;
}
