import React, { useState, useEffect } from 'react';
import { PhoneDevice } from './PhoneDevice';
import { PairingModal } from './PairingModal';
import { p2pManager } from '../utils/p2pManager';
import { audioEngine } from '../utils/audioEngine';
import { QrCode, Wifi, Users, Music, Activity, Volume2, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { AudioSettings } from '../types/intercom';

export const SingleDeviceIntercom: React.FC = () => {
  const [roomId, setRoomId] = useState<string>('7392');
  const [channel, setChannel] = useState<number>(1);
  const [isPairingOpen, setIsPairingOpen] = useState<boolean>(false);
  const [peerCount, setPeerCount] = useState<number>(0);
  const [partnerTransmitting, setPartnerTransmitting] = useState<boolean>(false);
  const [partnerDeviceName, setPartnerDeviceName] = useState<string>('Celular 2');
  const [connectionStatus, setConnectionStatus] = useState<string>('connecting');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState<boolean>(false);
  const [speakerTested, setSpeakerTested] = useState<boolean>(false);

  // Read URL query parameter for channel/room code if opened via QR code or shared link
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlChannel = params.get('channel');
      if (urlChannel) {
        setRoomId(urlChannel);
      }
    }
  }, []);

  // Set up P2P Manager
  useEffect(() => {
    p2pManager.setCallbacks({
      onPeerConnected: (peerId, name) => {
        setPeerCount((c) => c + 1);
        setPartnerDeviceName(name || 'Celular Remoto');
      },
      onPeerDisconnected: () => {
        setPeerCount((c) => Math.max(0, c - 1));
        setPartnerTransmitting(false);
      },
      onVoiceStart: () => {
        setPartnerTransmitting(true);
      },
      onVoiceData: () => {
        setPartnerTransmitting(true);
      },
      onVoiceStop: () => {
        setPartnerTransmitting(false);
      },
      onLatencyUpdate: (ms) => {
        setLatencyMs(ms);
      },
      onStatusChange: (st) => {
        setConnectionStatus(st);
      },
    });

    p2pManager.joinRoom(roomId, 'Meu Celular');
  }, [roomId]);

  const handleRoomChange = (newRoom: string) => {
    setRoomId(newRoom);
    p2pManager.joinRoom(newRoom, 'Meu Celular');
  };

  const handleTransmitChange = (isTx: boolean, settings: AudioSettings) => {
    if (isTx) {
      p2pManager.transmitStart(channel, settings.profile, settings.rogerBeep);
    } else {
      p2pManager.transmitStop(channel, settings.rogerBeep);
    }
  };

  const handleToggleMusic = () => {
    audioEngine.init();
    const playing = audioEngine.toggleBackgroundMusic();
    setIsMusicPlaying(playing);
  };

  const handleTestSpeaker = async () => {
    await audioEngine.unlockMobileAudio();
    audioEngine.playRogerBeep('tactical');
    setSpeakerTested(true);
    setTimeout(() => setSpeakerTested(false), 2000);
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      {/* P2P Connectivity & Pairing Banner */}
      <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              peerCount > 0
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
            }`}>
              <Wifi className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                <span>Canal PIN #{roomId}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                  peerCount > 0
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {peerCount > 0 ? `${peerCount} Celular Pareado` : 'Aguardando 2º Celular'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-2">
                <span>{peerCount > 0 ? `Conectado com ${partnerDeviceName}` : 'Abra o link no outro aparelho'}</span>
                {latencyMs !== null && (
                  <span className="font-mono text-emerald-400">Ping: {latencyMs}ms</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleMusic}
              title="Música de Fundo para testar Ducking"
              className={`p-2 rounded-xl border transition-colors ${
                isMusicPlaying
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 animate-pulse'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
              }`}
            >
              <Music className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsPairingOpen(true)}
              className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-colors shadow-sm"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Parear</span>
            </button>
          </div>
        </div>

        {/* Quick Protocol & Audio Test Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Protocolo:</span>
            <span className="font-mono text-slate-200">
              {connectionStatus === 'webrtc_connected'
                ? 'WebRTC P2P (Direto)'
                : connectionStatus === 'connected'
                ? 'WebSocket Relay (Nuvem)'
                : 'P2P Offline (LAN)'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleTestSpeaker}
            className="text-[10px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 transition-colors"
          >
            <Volume2 className="w-3 h-3" />
            <span>{speakerTested ? 'Tocando Som!' : 'Testar Alto-Falante'}</span>
          </button>
        </div>
      </div>

      {/* Main Handheld Device */}
      <PhoneDevice
        role="standalone"
        deviceName="Meu Intercomunicador"
        isStandalone={true}
        channel={channel}
        onChannelChange={(ch) => setChannel(ch)}
        isPartnerTransmitting={partnerTransmitting}
        partnerName={partnerDeviceName}
        onTransmitChange={handleTransmitChange}
      />

      {/* Pairing Modal */}
      <PairingModal
        isOpen={isPairingOpen}
        onClose={() => setIsPairingOpen(false)}
        roomId={roomId}
        onRoomChange={handleRoomChange}
        status={connectionStatus}
        peerCount={peerCount}
      />
    </div>
  );
};
