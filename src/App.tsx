import React, { useState } from 'react';
import { Radio, ArrowRightLeft, Smartphone, Zap, BookOpen, QrCode } from 'lucide-react';
import { DualDeviceSimulator } from './components/DualDeviceSimulator';
import { SingleDeviceIntercom } from './components/SingleDeviceIntercom';
import { AudioDuckingExplainer } from './components/AudioDuckingExplainer';
import { OfflineP2PGuide } from './components/OfflineP2PGuide';
import { PairingModal } from './components/PairingModal';
import { p2pManager } from './utils/p2pManager';

type ActiveTab = 'simulator' | 'device' | 'ducking' | 'guide';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('simulator');
  const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);
  const [roomId, setRoomId] = useState('7392');

  const handleRoomChange = (newRoom: string) => {
    setRoomId(newRoom);
    p2pManager.joinRoom(newRoom);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* --- TOP BAR (Strict 3-zone contract) --- */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Zone 1: Brand title wordmark */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20">
              <Radio className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span className="text-base font-bold tracking-tight text-slate-100">
              Intercom P2P
            </span>
          </div>

          {/* Zone 2: Navigation Links / Tab selector */}
          <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-1">
            <button
              type="button"
              onClick={() => setActiveTab('simulator')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'simulator'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Simulador Duplo
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('device')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'device'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Meu Intercomunicador
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ducking')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'ducking'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Atenuação (Ducking)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('guide')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'guide'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Guia Offline
            </button>
          </nav>

          {/* Zone 3: Primary Action button */}
          <div className="shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPairingModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors shadow-sm whitespace-nowrap"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Parear Celular</span>
            </button>
          </div>
        </div>
      </header>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'simulator' && <DualDeviceSimulator />}
        {activeTab === 'device' && <SingleDeviceIntercom />}
        {activeTab === 'ducking' && <AudioDuckingExplainer />}
        {activeTab === 'guide' && <OfflineP2PGuide />}
      </main>

      {/* --- FOOTER --- */}
      <footer className="border-t border-slate-900 bg-slate-950 py-5 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px]">
            <span>Intercomunicador Offline P2P</span>
            <span aria-hidden="true">·</span>
            <span>PTT Lock & VOX</span>
            <span aria-hidden="true">·</span>
            <span>Audio Ducking Inteligente</span>
            <span aria-hidden="true">·</span>
            <span>Squelch & Roger Beep</span>
          </div>
          <div className="text-[11px] text-slate-600 font-mono">
            Web Audio API · WebRTC P2P · BroadcastChannel Local
          </div>
        </div>
      </footer>

      {/* Quick Pairing Modal accessible from top bar */}
      <PairingModal
        isOpen={isPairingModalOpen}
        onClose={() => setIsPairingModalOpen(false)}
        roomId={roomId}
        onRoomChange={handleRoomChange}
        status="ready"
        peerCount={0}
      />
    </div>
  );
}
