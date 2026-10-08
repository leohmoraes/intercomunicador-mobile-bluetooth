import React from 'react';
import { Wifi, Radio, Shield, Zap, Lock, Mic, ArrowRightLeft, Smartphone, CheckCircle } from 'lucide-react';

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
              Guia de Comunicação Offline & Ponto-a-Ponto (P2P)
            </h2>
            <p className="text-xs text-slate-400">
              Como parear dois celulares reais sem internet ou operadora de telefonia
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          O Intercomunicador Offline foi projetado para operações onde a rede de celular (4G/5G) é inexistente ou instável. 
          Ele utiliza protocolos ponto-a-ponto de baixíssima latência (WebRTC Local + BroadcastChannel + WebSocket LAN) para troca direta de áudio entre os aparelhos.
        </p>

        {/* Step-by-step pairing guide */}
        <div className="mt-6 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
            Passo a Passo para Conectar 2 Celulares Físicos:
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
              <div className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center mb-2">
                1
              </div>
              <h4 className="text-xs font-semibold text-slate-200 mb-1">
                Conecte à Mesma Rede
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Ligue o <strong>Roteador Wi-Fi portátil</strong> ou ative o <strong>Ponto de Acesso (Hotspot)</strong> em um dos celulares e conecte o segundo celular nele (não precisa ter pacote de dados!).
              </p>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
              <div className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center mb-2">
                2
              </div>
              <h4 className="text-xs font-semibold text-slate-200 mb-1">
                Abra o Intercomunicador
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Abra o app nos dois celulares. Clique no botão <strong>Parear</strong> e aponte a câmera do segundo celular para o QR Code gerado pelo primeiro.
              </p>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
              <div className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center mb-2">
                3
              </div>
              <h4 className="text-xs font-semibold text-slate-200 mb-1">
                Pronto para Falar!
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Aperte o <strong>PTT</strong> ou use <strong>PTT Lock / VOX</strong> para conversar instantaneamente com áudio amplificado e ducking inteligente.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Deep Dive */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold">
            <Lock className="w-4 h-4" />
            Trava de PTT (PTT Lock)
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Permite travar o microfone aberto com 1 toque sem precisar segurar o botão físico com o dedo. Essencial para quem está pilotando moto, pedalando ou usando luvas grossas de trabalho.
          </p>
        </div>

        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
            <Mic className="w-4 h-4" />
            Acionamento por Voz (VOX)
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Detecta quando você começa a falar e aciona a transmissão sem nenhum toque na tela. Com delay ajustável, ele evita que o final das palavras seja cortado.
          </p>
        </div>

        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-cyan-400 text-sm font-semibold">
            <Zap className="w-4 h-4" />
            Voz Limpa HQ & Modo Amplificado
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Alterne entre o áudio cristalino de alta fidelidade ou o modo amplificado com compressor dinâmico (+12dB) e filtro tático passa-faixa para cortar ruídos de vento e trânsito.
          </p>
        </div>

        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold">
            <Radio className="w-4 h-4" />
            Squelch e Roger Beeps
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            O som de corte de portadora (Squelch) garante que você saiba exatamente quando o canal foi aberto, e o Roger Beep avisa ao parceiro que você terminou a frase.
          </p>
        </div>
      </div>
    </div>
  );
};
