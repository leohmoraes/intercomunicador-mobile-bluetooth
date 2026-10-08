import React, { useState, useEffect } from 'react';
import { PhoneDevice } from './PhoneDevice';
import { audioEngine } from '../utils/audioEngine';
import { Music, Play, Square, Volume2, Zap, ArrowRightLeft, Sparkles, CheckCircle2 } from 'lucide-react';
import { AudioSettings } from '../types/intercom';

export const DualDeviceSimulator: React.FC = () => {
  const [channel, setChannel] = useState<number>(1);
  const [alfaTransmitting, setAlfaTransmitting] = useState<boolean>(false);
  const [bravoTransmitting, setBravoTransmitting] = useState<boolean>(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState<boolean>(false);
  const [activeTabMobile, setActiveTabMobile] = useState<'both' | 'alfa' | 'bravo'>('both');
  const [automatedTestRunning, setAutomatedTestRunning] = useState<boolean>(false);

  // Background Lo-Fi music toggle for testing Ducking
  const handleToggleMusic = () => {
    audioEngine.init();
    const playing = audioEngine.toggleBackgroundMusic();
    setIsMusicPlaying(playing);
  };

  // Run automated 2-way dialog test to demonstrate the experience in 1 click
  const runAutomatedDialogueTest = () => {
    if (automatedTestRunning) return;
    setAutomatedTestRunning(true);
    audioEngine.init();

    // 1. Alfa transmits
    setAlfaTransmitting(true);
    audioEngine.playSimulatedVoice('Alfa para Bravo, teste de comunicação tática no canal um, câmbio.', () => {
      setAlfaTransmitting(false);

      // Short delay, then Bravo replies
      setTimeout(() => {
        setBravoTransmitting(true);
        audioEngine.playSimulatedVoice('Bravo na escuta Alfa, áudio recebido em alto e bom som com ducking perfeito. Câmbio final.', () => {
          setBravoTransmitting(false);
          setAutomatedTestRunning(false);
        });
      }, 900);
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Action & Testing Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-amber-400" />
            Simulador de Dois Dispositivos (Lado a Lado)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Comunicação ponto-a-ponto instantânea em tela única com PTT Lock, VOX, Squelch e Atenuação Inteligente de Áudio.
          </p>
        </div>

        {/* Quick Simulator Utilities */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Background Music for Ducking Test */}
          <button
            type="button"
            onClick={handleToggleMusic}
            className={`flex items-center gap-2 py-2 px-3.5 rounded-xl text-xs font-semibold border transition-all ${
              isMusicPlaying
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-sm shadow-amber-950 animate-pulse'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
            }`}
          >
            <Music className="w-4 h-4 text-amber-400" />
            <span>{isMusicPlaying ? 'Parar Música de Fundo' : 'Tocar Música de Fundo (Testar Ducking)'}</span>
          </button>

          {/* Automated 2-Way Voice Test */}
          <button
            type="button"
            onClick={runAutomatedDialogueTest}
            disabled={automatedTestRunning}
            className={`flex items-center gap-2 py-2 px-3.5 rounded-xl text-xs font-semibold border transition-all ${
              automatedTestRunning
                ? 'bg-emerald-950 border-emerald-500 text-emerald-300 animate-pulse'
                : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-750'
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>{automatedTestRunning ? 'Simulando Diálogo...' : 'Simular Conversa 1-Clique'}</span>
          </button>
        </div>
      </div>

      {/* Mobile view switcher for small phone screens */}
      <div className="lg:hidden flex items-center justify-center p-1 bg-slate-900 border border-slate-800 rounded-xl">
        <button
          type="button"
          onClick={() => setActiveTabMobile('both')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            activeTabMobile === 'both' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'
          }`}
        >
          Lado a Lado
        </button>
        <button
          type="button"
          onClick={() => setActiveTabMobile('alfa')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            activeTabMobile === 'alfa' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'
          }`}
        >
          Aparelho Alfa
        </button>
        <button
          type="button"
          onClick={() => setActiveTabMobile('bravo')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            activeTabMobile === 'bravo' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'
          }`}
        >
          Aparelho Bravo
        </button>
      </div>

      {/* --- SIDE-BY-SIDE DUAL DEVICE PHONES --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Celular 1: Rádio Alfa */}
        <div className={activeTabMobile === 'bravo' ? 'hidden lg:block' : 'block'}>
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Dispositivo 1: Celular Alfa
            </span>
            <span className="text-[11px] text-slate-500 font-mono">ID: ALFA-01</span>
          </div>

          <PhoneDevice
            role="alfa"
            deviceName="Rádio Alfa"
            channel={channel}
            onChannelChange={(ch) => setChannel(ch)}
            isPartnerTransmitting={bravoTransmitting}
            partnerName="Rádio Bravo"
            onTransmitChange={(tx) => setAlfaTransmitting(tx)}
          />
        </div>

        {/* Celular 2: Rádio Bravo */}
        <div className={activeTabMobile === 'alfa' ? 'hidden lg:block' : 'block'}>
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Dispositivo 2: Celular Bravo
            </span>
            <span className="text-[11px] text-slate-500 font-mono">ID: BRAVO-02</span>
          </div>

          <PhoneDevice
            role="bravo"
            deviceName="Rádio Bravo"
            channel={channel}
            onChannelChange={(ch) => setChannel(ch)}
            isPartnerTransmitting={alfaTransmitting}
            partnerName="Rádio Alfa"
            onTransmitChange={(tx) => setBravoTransmitting(tx)}
          />
        </div>
      </div>

      {/* Feature Demonstration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
          <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold mb-1.5">
            <Zap className="w-4 h-4" />
            Trava de PTT & VOX
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Acione o <strong className="text-slate-200">PTT Lock</strong> para conversar com mãos-livres ou use o <strong className="text-slate-200">VOX</strong> para falar naturalmente; a transmissão liga e desliga automaticamente por voz.
          </p>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
          <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold mb-1.5">
            <Music className="w-4 h-4" />
            Atenuação Inteligente (Ducking)
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Inicie a <strong className="text-slate-200">Música de Fundo</strong> acima e aperte o PTT. A música baixa imediatamente para 15% permitindo ouvir a mensagem com clareza total, retornando suavemente ao final.
          </p>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
          <div className="flex items-center gap-2 text-cyan-400 text-sm font-semibold mb-1.5">
            <Volume2 className="w-4 h-4" />
            Squelch e Roger Beep
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Sons autênticos de abertura de canal (<strong className="text-slate-200">Squelch burst</strong>) e finalizadores (<strong className="text-slate-200">NASA Quindar, Tático, Clássico</strong>) sintetizados via Web Audio API.
          </p>
        </div>
      </div>
    </div>
  );
};
