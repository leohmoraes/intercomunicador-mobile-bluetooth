import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Radio,
  Lock,
  Unlock,
  Volume2,
  VolumeX,
  Zap,
  Activity,
  Sliders,
  Sparkles,
  Wifi,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { DeviceRole, RogerBeepType, AudioProfileType, AudioSettings } from '../types/intercom';
import { audioEngine } from '../utils/audioEngine';
import { p2pManager } from '../utils/p2pManager';

interface PhoneDeviceProps {
  role: DeviceRole;
  deviceName: string;
  isStandalone?: boolean;
  channel: number;
  onChannelChange?: (ch: number) => void;
  isPartnerTransmitting?: boolean;
  partnerName?: string;
  onTransmitChange?: (isTransmitting: boolean, settings: AudioSettings) => void;
}

const CHANNELS = [
  { id: 1, freq: '462.5625 MHz', subtone: '67.0 Hz' },
  { id: 2, freq: '462.5875 MHz', subtone: '71.9 Hz' },
  { id: 3, freq: '462.6125 MHz', subtone: '77.0 Hz' },
  { id: 4, freq: '462.6375 MHz', subtone: '82.5 Hz' },
  { id: 5, freq: '462.6625 MHz', subtone: '88.5 Hz' },
  { id: 6, freq: '462.6875 MHz', subtone: '94.8 Hz' },
  { id: 7, freq: '462.7125 MHz', subtone: '100.0 Hz' },
  { id: 8, freq: '467.5625 MHz', subtone: '103.5 Hz' },
];

export const PhoneDevice: React.FC<PhoneDeviceProps> = ({
  role,
  deviceName,
  isStandalone = false,
  channel = 1,
  onChannelChange,
  isPartnerTransmitting = false,
  partnerName = 'Parceiro',
  onTransmitChange,
}) => {
  const [settings, setSettings] = useState<AudioSettings>({
    volume: 0.9,
    micGain: 1.5,
    profile: 'hq_clean',
    squelchEnabled: true,
    squelchSensitivity: 0.8,
    rogerBeep: 'tactical',
    pttLocked: false,
    voxEnabled: false,
    voxThreshold: 30,
    voxDelayMs: 700,
    duckingEnabled: true,
    duckingLevel: 0.85,
    duckingReleaseMs: 600,
  });

  const [isTransmitting, setIsTransmitting] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [micAudioSource, setMicAudioSource] = useState<'mic' | 'test1' | 'test2' | 'tone'>(
    isStandalone ? 'mic' : 'test1'
  );
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [voxTripped, setVoxTripped] = useState(false);
  const [pttHoldTimer, setPttHoldTimer] = useState<number>(0);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [micReady, setMicReady] = useState(false);

  const voxTimeoutRef = useRef<number | null>(null);
  const pttIntervalRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const partnerTxStateRef = useRef(isPartnerTransmitting);

  // Check audio context status
  useEffect(() => {
    setAudioUnlocked(audioEngine.isAudioUnlocked());
  }, []);

  // Synchronize incoming partner transmission (Receiving mode RX)
  useEffect(() => {
    if (isPartnerTransmitting && !isTransmitting) {
      setIsReceiving(true);
      if (settings.squelchEnabled) {
        audioEngine.playSquelch('open');
      }
      if (settings.duckingEnabled) {
        audioEngine.applyAudioDucking(true, settings.duckingLevel);
      }
    } else if (!isPartnerTransmitting && partnerTxStateRef.current) {
      setIsReceiving(false);
      if (settings.squelchEnabled) {
        audioEngine.playSquelch('close');
      }
      audioEngine.playRogerBeep(settings.rogerBeep);
      if (settings.duckingEnabled) {
        audioEngine.releaseAudioDucking(true, settings.duckingReleaseMs);
      }
    }
    partnerTxStateRef.current = isPartnerTransmitting;
  }, [isPartnerTransmitting, isTransmitting, settings]);

  // Audio level meter loop
  useEffect(() => {
    let active = true;

    const updateMeter = () => {
      if (!active) return;

      if (isTransmitting) {
        if (micAudioSource === 'mic') {
          const micVal = audioEngine.getMicLevel();
          setCurrentLevel(micVal);

          if (settings.voxEnabled) {
            if (micVal >= settings.voxThreshold) {
              setVoxTripped(true);
              if (voxTimeoutRef.current) {
                window.clearTimeout(voxTimeoutRef.current);
                voxTimeoutRef.current = null;
              }
            } else if (voxTripped && !voxTimeoutRef.current) {
              voxTimeoutRef.current = window.setTimeout(() => {
                setVoxTripped(false);
                stopTransmit();
              }, settings.voxDelayMs);
            }
          }
        } else {
          const simulatedVal = Math.min(95, Math.floor(40 + Math.sin(Date.now() / 90) * 35 + Math.random() * 20));
          setCurrentLevel(simulatedVal);
        }
      } else if (isReceiving) {
        const rxVal = audioEngine.getRxLevel();
        setCurrentLevel(rxVal > 0 ? rxVal : Math.min(85, Math.floor(45 + Math.cos(Date.now() / 110) * 30)));
      } else {
        setCurrentLevel((prev) => Math.max(0, prev - 8));
      }

      animFrameRef.current = requestAnimationFrame(updateMeter);
    };

    animFrameRef.current = requestAnimationFrame(updateMeter);

    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isTransmitting, isReceiving, micAudioSource, settings.voxEnabled, settings.voxThreshold, settings.voxDelayMs, voxTripped]);

  // Handle VOX auto-triggering when in standby
  useEffect(() => {
    if (!settings.voxEnabled || isTransmitting || isReceiving) return;

    const intervalId = window.setInterval(() => {
      if (micAudioSource === 'mic') {
        const level = audioEngine.getMicLevel();
        if (level >= settings.voxThreshold) {
          startTransmit(true);
        }
      }
    }, 80);

    return () => clearInterval(intervalId);
  }, [settings.voxEnabled, isTransmitting, isReceiving, micAudioSource, settings.voxThreshold]);

  const handleUnlockMobileAudio = async () => {
    const ok = await audioEngine.unlockMobileAudio();
    if (ok) setAudioUnlocked(true);
    const stream = await audioEngine.setupMicrophone();
    if (stream) setMicReady(true);
  };

  // START TRANSMITTING (TX)
  const startTransmit = async (isVoxTrigger = false) => {
    if (isReceiving) return;
    if (isTransmitting) return;

    await handleUnlockMobileAudio();
    audioEngine.triggerHaptic('press');

    if (settings.squelchEnabled) {
      audioEngine.playSquelch('open');
    }

    if (settings.duckingEnabled) {
      audioEngine.applyAudioDucking(true, settings.duckingLevel);
    }

    audioEngine.updateMicProfile(settings.profile, settings.micGain);

    setIsTransmitting(true);
    setPttHoldTimer(0);

    pttIntervalRef.current = window.setInterval(() => {
      setPttHoldTimer((t) => t + 1);
    }, 1000);

    if (onTransmitChange) {
      onTransmitChange(true, settings);
    }

    // Real microphone recording & audio chunk transmission
    if (micAudioSource === 'mic') {
      audioEngine.startVoiceRecording((chunkBase64) => {
        p2pManager.transmitVoiceChunk(chunkBase64);
      });
    } else if (micAudioSource === 'test1') {
      audioEngine.playSimulatedVoice(`${deviceName} para rádio parceiro, mensagem de teste, câmbio.`);
    } else if (micAudioSource === 'test2') {
      audioEngine.playSimulatedVoice(`Atenção equipe, canal ${channel} operacional e verificado. Câmbio.`);
    } else if (micAudioSource === 'tone') {
      audioEngine.playTestTone(1000, 2.5);
    }
  };

  // STOP TRANSMITTING (TX)
  const stopTransmit = () => {
    if (!isTransmitting) return;

    if (pttIntervalRef.current) {
      clearInterval(pttIntervalRef.current);
      pttIntervalRef.current = null;
    }

    // Stop real microphone recorder
    if (micAudioSource === 'mic') {
      audioEngine.stopVoiceRecording();
    }

    setIsTransmitting(false);
    setPttHoldTimer(0);
    setVoxTripped(false);

    audioEngine.triggerHaptic('release');

    if (settings.squelchEnabled) {
      audioEngine.playSquelch('close');
    }
    audioEngine.playRogerBeep(settings.rogerBeep);

    if (settings.duckingEnabled) {
      audioEngine.releaseAudioDucking(true, settings.duckingReleaseMs);
    }

    if (onTransmitChange) {
      onTransmitChange(false, settings);
    }
  };

  const handlePttDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (settings.pttLocked) {
      setSettings((s) => ({ ...s, pttLocked: false }));
      stopTransmit();
      return;
    }
    startTransmit();
  };

  const handlePttUp = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (settings.pttLocked) return;
    stopTransmit();
  };

  const togglePttLock = () => {
    const nextLocked = !settings.pttLocked;
    setSettings((s) => ({ ...s, pttLocked: nextLocked }));
    if (nextLocked) {
      startTransmit();
    } else {
      stopTransmit();
    }
  };

  const handleChannelSelect = (newCh: number) => {
    if (onChannelChange) onChannelChange(newCh);
  };

  const handleSetupMic = async () => {
    setMicAudioSource('mic');
    await handleUnlockMobileAudio();
  };

  const currentChannelInfo = CHANNELS.find((c) => c.id === channel) || CHANNELS[0];

  return (
    <div className={`relative flex flex-col bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-4 sm:p-5 select-none transition-all ${
      isTransmitting ? 'ring-2 ring-red-500/50 border-red-500/40 shadow-red-950/20' : isReceiving ? 'ring-2 ring-emerald-500/50 border-emerald-500/40 shadow-emerald-950/20' : ''
    }`}>
      {/* --- MOBILE AUDIO UNLOCK BANNER (CRUCIAL FOR SMARTPHONES) --- */}
      {!audioUnlocked && (
        <button
          type="button"
          onClick={handleUnlockMobileAudio}
          className="mb-3 w-full py-2 px-3 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-semibold flex items-center justify-center gap-2 animate-pulse hover:bg-amber-500/30 transition-all"
        >
          <Volume2 className="w-4 h-4 text-amber-400" />
          <span>Toque aqui para ativar áudio e microfone</span>
        </button>
      )}

      {/* --- TOP HARDWARE ACCENTS: Antenna & Status LEDs --- */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="w-4 h-6 bg-slate-800 border border-slate-700 rounded-t-sm flex items-center justify-center">
            <div className="w-1.5 h-full bg-slate-700"></div>
          </div>
          <div>
            <div className="text-[11px] font-semibold tracking-wider text-slate-300 uppercase">
              {deviceName}
            </div>
            <div className="text-[10px] text-slate-500">
              {role === 'alfa' ? 'Base Primária' : role === 'bravo' ? 'Unidade Remota' : 'Canal P2P Ativo'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center">
            <div
              className={`w-2.5 h-2.5 rounded-full transition-all duration-150 ${
                isTransmitting ? 'bg-red-500 shadow-md shadow-red-500' : 'bg-red-950/80 border border-red-900/60'
              }`}
            />
            <span className="text-[9px] font-medium text-slate-400 mt-0.5">TX</span>
          </div>

          <div className="flex flex-col items-center">
            <div
              className={`w-2.5 h-2.5 rounded-full transition-all duration-150 ${
                isReceiving ? 'bg-emerald-400 shadow-md shadow-emerald-400' : 'bg-emerald-950/80 border border-emerald-900/60'
              }`}
            />
            <span className="text-[9px] font-medium text-slate-400 mt-0.5">RX</span>
          </div>

          <div className="flex flex-col items-center">
            <div
              className={`w-2.5 h-2.5 rounded-full transition-all duration-150 ${
                settings.voxEnabled ? (voxTripped ? 'bg-amber-400 shadow-md shadow-amber-400' : 'bg-amber-600') : 'bg-slate-800'
              }`}
            />
            <span className="text-[9px] font-medium text-slate-400 mt-0.5">VOX</span>
          </div>

          <div className="flex flex-col items-center">
            <div
              className={`w-2.5 h-2.5 rounded-full transition-all duration-150 ${
                settings.pttLocked ? 'bg-cyan-400 shadow-md shadow-cyan-400' : 'bg-slate-800'
              }`}
            />
            <span className="text-[9px] font-medium text-slate-400 mt-0.5">LOCK</span>
          </div>
        </div>
      </div>

      {/* --- BACKLIT LCD DOT-MATRIX SCREEN --- */}
      <div className="mt-3 relative rounded-xl bg-amber-950/30 border-2 border-amber-900/40 p-3.5 shadow-inner overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/[0.04] to-transparent pointer-events-none" />

        <div className="flex items-center justify-between font-mono text-[11px] text-amber-400/90 tracking-wide pb-1.5 border-b border-amber-900/30">
          <div className="flex items-center gap-1.5 font-bold">
            <Radio className="w-3.5 h-3.5 text-amber-400" />
            <span>CH-{String(channel).padStart(2, '0')}</span>
            <span className="text-amber-500/60">·</span>
            <span className="text-[10px] text-amber-500/80">CTCSS {currentChannelInfo.subtone}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-amber-400/80">P2P: OPUS HQ</span>
            <span>BAT 98%</span>
          </div>
        </div>

        <div className="my-2.5 flex items-baseline justify-between">
          <div>
            <div className="font-mono text-xl sm:text-2xl font-bold tracking-tight text-amber-300">
              {currentChannelInfo.freq}
            </div>
            <div className="text-[10px] font-mono uppercase text-amber-400/70 mt-0.5 flex items-center gap-1.5">
              <span>{settings.profile === 'hq_clean' ? 'HQ Cristalino' : settings.profile === 'boost_amplified' ? 'Voz Amplificada' : 'Filtro Walkie'}</span>
              <span>·</span>
              <span>{settings.rogerBeep !== 'none' ? `Beep: ${settings.rogerBeep}` : 'Sem Beep'}</span>
            </div>
          </div>

          <div className="text-right">
            {isTransmitting ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-950/80 border border-red-600/70 text-red-400 rounded text-xs font-mono font-bold animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                TX ATIVO ({pttHoldTimer}s)
              </div>
            ) : isReceiving ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/80 border border-emerald-500/70 text-emerald-400 rounded text-xs font-mono font-bold">
                <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
                RX RECEBENDO
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-950/40 border border-amber-900/50 text-amber-500/80 rounded text-[11px] font-mono">
                STANDBY PRONTO
              </div>
            )}
          </div>
        </div>

        {settings.duckingEnabled && (
          <div className="flex items-center justify-between text-[10px] font-mono text-amber-400/75 py-1 border-t border-amber-900/30">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              Ducking ({Math.round(settings.duckingLevel * 100)}% Atenuação)
            </span>
            <span className={isTransmitting || isReceiving ? 'text-red-400 font-bold' : 'text-amber-500/60'}>
              {isTransmitting || isReceiving ? 'MÍDIA REBAIXADA' : 'Mídia Normal'}
            </span>
          </div>
        )}

        {/* LED VU METER DISPLAY */}
        <div className="mt-2 pt-2 border-t border-amber-900/30">
          <div className="flex items-center justify-between text-[9px] font-mono text-amber-400/60 mb-1">
            <span>VU METER (NÍVEL DE VOZ)</span>
            <span>{currentLevel > 0 ? `${currentLevel}%` : '0dB'}</span>
          </div>
          <div className="grid grid-cols-20 gap-0.5 h-3 bg-amber-950/60 p-0.5 rounded border border-amber-900/50">
            {Array.from({ length: 20 }).map((_, idx) => {
              const segmentThreshold = (idx + 1) * 5;
              const isActive = currentLevel >= segmentThreshold;
              let barColor = 'bg-slate-800/60';
              if (isActive) {
                if (idx < 14) barColor = 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]';
                else if (idx < 17) barColor = 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]';
                else barColor = 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]';
              }
              return <div key={idx} className={`h-full rounded-[1px] transition-colors duration-75 ${barColor}`} />;
            })}
          </div>
        </div>
      </div>

      {/* --- QUICK CHANNELS SELECTOR BAR --- */}
      <div className="mt-3 flex items-center justify-between gap-1 overflow-x-auto py-1">
        {CHANNELS.map((ch) => (
          <button
            key={ch.id}
            type="button"
            onClick={() => handleChannelSelect(ch.id)}
            className={`flex-1 min-w-[36px] py-1 text-xs font-mono font-medium rounded transition-colors ${
              channel === ch.id
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700/80'
            }`}
          >
            {ch.id}
          </button>
        ))}
      </div>

      {/* --- TACTICAL PUSH-TO-TALK BUTTON SECTION --- */}
      <div className="my-4 flex flex-col items-center">
        <div className="relative w-full max-w-[280px]">
          {isTransmitting && (
            <div className="absolute inset-0 rounded-2xl bg-red-500/20 animate-ping pointer-events-none" />
          )}

          <button
            type="button"
            onMouseDown={handlePttDown}
            onMouseUp={handlePttUp}
            onTouchStart={handlePttDown}
            onTouchEnd={handlePttUp}
            className={`w-full h-24 rounded-2xl flex flex-col items-center justify-center gap-1.5 font-bold tracking-wider uppercase transition-all duration-150 select-none shadow-lg active:scale-[0.98] ${
              isTransmitting
                ? 'bg-gradient-to-b from-red-600 to-red-700 text-white shadow-red-900/40 ring-4 ring-red-500/40'
                : isReceiving
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-80'
                : 'bg-gradient-to-b from-slate-800 to-slate-850 hover:from-slate-750 hover:to-slate-800 text-slate-200 border-2 border-slate-700 shadow-slate-950/60'
            }`}
            disabled={isReceiving}
          >
            <div className="flex items-center gap-2">
              <Mic className={`w-6 h-6 ${isTransmitting ? 'animate-bounce text-white' : 'text-slate-400'}`} />
              <span className="text-lg">
                {isTransmitting ? 'TRANSMITINDO' : settings.pttLocked ? 'PTT TRAVADO (MÃOS LIVRES)' : 'SEGURE P/ FALAR'}
              </span>
            </div>
            <span className="text-[11px] font-normal tracking-normal normal-case text-slate-400">
              {isTransmitting
                ? settings.pttLocked
                  ? 'Clique p/ destravar PTT Lock'
                  : 'Solte o botão para encerrar'
                : 'Aperte e segure (PTT) ou ative PTT Lock'}
            </span>
          </button>
        </div>

        <div className="w-full grid grid-cols-2 gap-2 mt-3">
          <button
            type="button"
            onClick={togglePttLock}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
              settings.pttLocked
                ? 'bg-cyan-950/80 border-cyan-500/70 text-cyan-300 shadow-sm shadow-cyan-950'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-750'
            }`}
          >
            {settings.pttLocked ? <Lock className="w-3.5 h-3.5 text-cyan-400" /> : <Unlock className="w-3.5 h-3.5 text-slate-400" />}
            <span>{settings.pttLocked ? 'PTT Lock: ATIVO' : 'Trava PTT (Lock)'}</span>
          </button>

          <button
            type="button"
            onClick={() => setSettings((s) => ({ ...s, voxEnabled: !s.voxEnabled }))}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
              settings.voxEnabled
                ? 'bg-amber-950/80 border-amber-500/70 text-amber-300 shadow-sm shadow-amber-950'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-750'
            }`}
          >
            <Activity className={`w-3.5 h-3.5 ${settings.voxEnabled ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`} />
            <span>{settings.voxEnabled ? 'VOX: LIGADO' : 'VOX (Voz Auto)'}</span>
          </button>
        </div>
      </div>

      {/* --- QUICK VOICE TEST OR REAL MIC SELECTOR --- */}
      <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="font-medium text-slate-300 flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5 text-amber-400" />
            Fonte do Áudio:
          </span>
          {micReady && (
            <span className="text-[10px] text-emerald-400">Microfone Real Pronto</span>
          )}
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          <button
            type="button"
            onClick={handleSetupMic}
            className={`py-1.5 px-2 rounded font-medium text-[11px] truncate transition-colors ${
              micAudioSource === 'mic'
                ? 'bg-emerald-600 text-white font-bold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Mic Real
          </button>
          <button
            type="button"
            onClick={() => setMicAudioSource('test1')}
            className={`py-1.5 px-2 rounded font-medium text-[11px] truncate transition-colors ${
              micAudioSource === 'test1'
                ? 'bg-amber-600 text-white font-bold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Voz Teste 1
          </button>
          <button
            type="button"
            onClick={() => setMicAudioSource('test2')}
            className={`py-1.5 px-2 rounded font-medium text-[11px] truncate transition-colors ${
              micAudioSource === 'test2'
                ? 'bg-amber-600 text-white font-bold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Voz Teste 2
          </button>
          <button
            type="button"
            onClick={() => setMicAudioSource('tone')}
            className={`py-1.5 px-2 rounded font-medium text-[11px] truncate transition-colors ${
              micAudioSource === 'tone'
                ? 'bg-amber-600 text-white font-bold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Tom 1kHz
          </button>
        </div>
      </div>

      {/* --- RETRACTABLE ADVANCED SETTINGS ACCORDION --- */}
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
          className="w-full flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs transition-colors"
        >
          <span className="flex items-center gap-1.5 font-medium">
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            Parâmetros de Áudio, VOX, Squelch & Ducking
          </span>
          {showSettingsDrawer ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showSettingsDrawer && (
          <div className="mt-2 p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-3.5 text-xs text-slate-300">
            <div>
              <label className="block text-slate-400 text-[11px] font-medium mb-1">
                Perfil de Áudio (Qualidade e Filtros):
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'hq_clean', label: 'Voz HQ Limpa' },
                  { id: 'tactical_walkie', label: 'Filtro Walkie' },
                  { id: 'boost_amplified', label: 'Amplificado +12dB' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSettings((s) => ({ ...s, profile: p.id as AudioProfileType }));
                      audioEngine.updateMicProfile(p.id as AudioProfileType, settings.micGain);
                    }}
                    className={`py-1 px-2 rounded text-[11px] font-medium transition-colors ${
                      settings.profile === p.id
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-750'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-slate-400 font-medium">Sensibilidade VOX (Limiar):</span>
                <span className="font-mono text-amber-400">{settings.voxThreshold}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="80"
                value={settings.voxThreshold}
                onChange={(e) => setSettings((s) => ({ ...s, voxThreshold: Number(e.target.value) }))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                <span>Mais sensível (fala baixa)</span>
                <span>Menos sensível (evita ruídos)</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Som de Abertura (Squelch):</label>
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !settings.squelchEnabled;
                    setSettings((s) => ({ ...s, squelchEnabled: nextVal }));
                    if (nextVal) audioEngine.playSquelch('open');
                  }}
                  className={`w-full py-1.5 px-2 rounded text-[11px] font-medium transition-colors ${
                    settings.squelchEnabled ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {settings.squelchEnabled ? 'Squelch Ativo' : 'Squelch Desligado'}
                </button>
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Roger Beep (Tom Final):</label>
                <select
                  value={settings.rogerBeep}
                  onChange={(e) => {
                    const beep = e.target.value as RogerBeepType;
                    setSettings((s) => ({ ...s, rogerBeep: beep }));
                    audioEngine.playRogerBeep(beep);
                  }}
                  className="w-full py-1.5 px-2 rounded bg-slate-800 border border-slate-700 text-slate-200 text-[11px]"
                >
                  <option value="tactical">Militar Tático</option>
                  <option value="quindar">NASA Quindar</option>
                  <option value="classic">Bipe Clássico</option>
                  <option value="chirp">Chirp Rápido</option>
                  <option value="none">Nenhum</option>
                </select>
              </div>
            </div>

            <div className="pt-1 border-t border-slate-800/80">
              <div className="flex items-center justify-between mb-1 text-[11px]">
                <span className="text-slate-400 font-medium">Atenuação Inteligente (Ducking):</span>
                <button
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, duckingEnabled: !s.duckingEnabled }))}
                  className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    settings.duckingEnabled ? 'bg-emerald-900/60 text-emerald-300' : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {settings.duckingEnabled ? 'Ligado' : 'Desligado'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.4"
                  max="0.95"
                  step="0.05"
                  value={settings.duckingLevel}
                  onChange={(e) => setSettings((s) => ({ ...s, duckingLevel: Number(e.target.value) }))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <span className="font-mono text-amber-400 text-[11px] shrink-0">
                  {Math.round(settings.duckingLevel * 100)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
