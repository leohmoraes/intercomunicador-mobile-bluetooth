import React from 'react';
import { Wifi, Radio, Shield, Zap, Lock, Mic, ArrowRightLeft, Smartphone, CheckCircle, Volume2, ShieldCheck, Activity } from 'lucide-react';

export const OfflineP2PGuide: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              Protocolo de Comunicação & Solução de Conexão Entre Celulares
            </h2>
            <p className="text-xs text-slate-400">
              Arquitetura de baixa latência WebRTC + WebSocket Relay com áudio Opus
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Para garantir que dois celulares consigam trocar áudios reais em qualquer rede (Wi-Fi, 4G, 5G ou roteador local), o aplicativo utiliza uma <strong>arquitetura híbrida de 3 camadas</strong> com redundância automática:
        </p>

        {/* Protocol Layers Architecture */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase">
              <Activity className="w-4 h-4" />
              1. WebRTC Opus (P2P)
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Comunicação direta ponto-a-ponto entre os dois celulares com codec Opus de alta fidelidade e latência sub-50ms via servidores STUN do Google.
            </p>
          </div>

          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase">
              <Zap className="w-4 h-4" />
              2. WebSocket Chunk Relay
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Caso as operadoras de celular utilizem CGNAT ou bloqueiem tráfego UDP direto, o servidor transmite fatias contínuas de voz gravadas em tempo real.
            </p>
          </div>

          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase">
              <Radio className="w-4 h-4" />
              3. BroadcastChannel Local
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Funciona 100% offline no mesmo dispositivo ou navegador para testes imediatos entre abas sem depender de internet ou servidor.
            </p>
          </div>
        </div>

        {/* Why audio didn't play & how it's solved */}
        <div className="mt-6 p-4 bg-amber-950/30 border border-amber-900/50 rounded-2xl space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
            <Volume2 className="w-4 h-4" />
            Por que o áudio pode não ter saído no outro celular e como foi resolvido:
          </h3>

          <ul className="space-y-2 text-xs text-slate-300">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-slate-100">Política de Autoplay de Celulares (iOS/Android):</strong> Navegadores móveis bloqueiam áudio automático até que o usuário toque na tela. Adicionamos um botão de destaque <em>"Toque para ativar áudio e microfone"</em> e o botão <em>"Testar Alto-Falante"</em> para desbloquear a saída de som imediatamente.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-slate-100">Permissão de Microfone:</strong> O microfone agora é solicitado automaticamente com captura de alta qualidade, cancelamento de eco e supressão de ruído ativo.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-slate-100">Transmissão em Chunks Ativa:</strong> Enquanto você segura o botão PTT, o aplicativo grava e envia a voz continuamente (chunks a cada 300ms) tocando instantaneamente no alto-falante do parceiro com som de abertura (Squelch) e finalizador (Roger Beep).
              </span>
            </li>
          </ul>
        </div>

        {/* Step-by-step pairing guide */}
        <div className="mt-6 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
            Passo a Passo Rápido:
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
              <div className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center mb-2">
                1
              </div>
              <h4 className="text-xs font-semibold text-slate-200 mb-1">
                Abra o Link nos 2 Celulares
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                No primeiro celular, clique em <strong>Parear</strong> e aponte a câmera do segundo celular para escanear o QR Code (ou entre com o mesmo PIN, ex: <strong>#7392</strong>).
              </p>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
              <div className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center mb-2">
                2
              </div>
              <h4 className="text-xs font-semibold text-slate-200 mb-1">
                Toque em "Ativar Áudio"
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Nos dois aparelhos, toque no botão para autorizar o microfone e desbloquear o alto-falante do celular.
              </p>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
              <div className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center mb-2">
                3
              </div>
              <h4 className="text-xs font-semibold text-slate-200 mb-1">
                Aperte o PTT e Fale!
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Segure o botão PTT e fale. O outro celular receberá sua voz instantaneamente em alto e bom som!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
