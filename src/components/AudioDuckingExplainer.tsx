import React, { useState, useEffect, useRef } from 'react';
import { Music, Volume2, VolumeX, Zap, Play, Square, Activity, Sliders, ShieldCheck } from 'lucide-react';
import { audioEngine } from '../utils/audioEngine';

export const AudioDuckingExplainer: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isDuckingActive, setIsDuckingActive] = useState<boolean>(false);
  const [duckingDepth, setDuckingDepth] = useState<number>(0.85); // 85% drop
  const [releaseMs, setReleaseMs] = useState<number>(600);
  const [voiceSimulated, setVoiceSimulated] = useState<boolean>(false);
  const [bgVolumeMeter, setBgVolumeMeter] = useState<number>(50); // visual representation

  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    intervalRef.current = window.setInterval(() => {
      const isDucked = audioEngine.getIsDucked();
      setIsDuckingActive(isDucked);

      if (audioEngine.isMusicPlaying()) {
        if (isDucked) {
          // Attenuated volume
          setBgVolumeMeter(Math.round(50 * (1 - duckingDepth)));
        } else {
          // Normal music volume with slight flutter
          setBgVolumeMeter(50 + Math.floor(Math.sin(Date.now() / 200) * 8));
        }
      } else {
        setBgVolumeMeter(0);
      }
    }, 50);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [duckingDepth]);

  const handleToggleMusic = () => {
    audioEngine.init();
    const playing = audioEngine.toggleBackgroundMusic();
    setIsPlaying(playing);
  };

  const handleTestVoiceTrigger = () => {
    audioEngine.init();
    setVoiceSimulated(true);

    // Apply ducking
    audioEngine.applyAudioDucking(true, duckingDepth);
    audioEngine.playSquelch('open');

    audioEngine.playSimulatedVoice('Atenção: transmissão prioritária de voz com áudio ducking ativo. Câmbio.', () => {
      audioEngine.playSquelch('close');
      audioEngine.playRogerBeep('tactical');
      audioEngine.releaseAudioDucking(true, releaseMs);
      setVoiceSimulated(false);
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Overview header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              Atenuação Inteligente de Áudio (Audio Ducking)
            </h2>
            <p className="text-xs text-slate-400">
              Prioridade acústica inteligente para ouvir transmissões sem pausar reprodutores externos.
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mt-3">
          Quando você ouve música (Spotify, podcasts, YouTube) ou usa fones de ouvido no trânsito/trabalho, 
          o intercomunicador <strong>atenua instantaneamente o volume de segundo plano</strong> assim que uma mensagem de voz chega ou você aperta o PTT. Assim que a transmissão termina com o Roger Beep, a música volta suavemente ao volume original.
        </p>

        {/* Interactive Ducking Playground */}
        <div className="mt-6 p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Music className="w-5 h-5 text-amber-400" />
              <span className="text-sm font-semibold text-slate-200">
                Simulador de Música de Fundo (Lo-Fi)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleMusic}
                className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold transition-all ${
                  isPlaying
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-950'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
              >
                {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                <span>{isPlaying ? 'Pausar Música de Fundo' : 'Tocar Música Lo-Fi'}</span>
              </button>

              <button
                type="button"
                onClick={handleTestVoiceTrigger}
                disabled={voiceSimulated}
                className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold transition-all ${
                  voiceSimulated
                    ? 'bg-red-950 border border-red-500 text-red-300 animate-pulse'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md shadow-emerald-950'
                }`}
              >
                <Activity className="w-4 h-4" />
                <span>{voiceSimulated ? 'Voz Falando...' : 'Falar Frase (Ativar Ducking)'}</span>
              </button>
            </div>
          </div>

          {/* Visual Ducking Volume Monitor */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-400 font-medium">Nível do Áudio de Fundo (Volume):</span>
              <span className="font-mono text-amber-400 font-bold">
                {isDuckingActive ? `${bgVolumeMeter}% (ATENUADO -${Math.round(duckingDepth * 100)}%)` : `${bgVolumeMeter}%`}
              </span>
            </div>

            <div className="w-full h-4 bg-slate-900 rounded-full border border-slate-800 p-0.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-150 ${
                  isDuckingActive
                    ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]'
                    : 'bg-gradient-to-r from-emerald-500 to-amber-400'
                }`}
                style={{ width: `${Math.max(5, bgVolumeMeter * 2)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5">
              <span>0% (Silêncio)</span>
              <span className={isDuckingActive ? 'text-amber-400 font-semibold' : ''}>
                {isDuckingActive ? '⚡ Ducking em Ação: Música rebaixada' : 'Reprodução Normal'}
              </span>
              <span>100% (Normal)</span>
            </div>
          </div>

          {/* Controls: Depth & Release */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-800">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Intensidade do Ducking:</span>
                <span className="font-mono text-amber-400 font-bold">{Math.round(duckingDepth * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="0.95"
                step="0.05"
                value={duckingDepth}
                onChange={(e) => setDuckingDepth(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block mt-0.5">
                Quanto mais alto, mais baixo o volume da música durante a fala.
              </span>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Velocidade de Retorno (Release):</span>
                <span className="font-mono text-amber-400 font-bold">{releaseMs}ms</span>
              </div>
              <input
                type="range"
                min="200"
                max="1500"
                step="50"
                value={releaseMs}
                onChange={(e) => setReleaseMs(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block mt-0.5">
                Tempo suave para a música voltar ao normal após o Roger Beep.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Architecture Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl">
          <h4 className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Compatibilidade com Fones e Mídia
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Funciona com fones Bluetooth (TWS, capacetes intercom moto, fones com fio e alto-falantes de carro). 
            Prioriza o canal de comunicação para que nenhuma instrução ou alerta seja perdido no ruído ambiente.
          </p>
        </div>

        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl">
          <h4 className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            Curva de Envelope Suave
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Em vez de cortes abruptos ou ruídos de estalo, os nós de ganho do Web Audio aplicam curvas de transição logarítmicas de 35ms (attack) e liberação gradual, sem estragar a experiência musical.
          </p>
        </div>
      </div>
    </div>
  );
};
