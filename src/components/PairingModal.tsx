import React, { useState, useEffect } from 'react';
import { X, QrCode, Copy, Check, Wifi, Share2, Smartphone, ShieldCheck } from 'lucide-react';
import QRCode from 'qrcode';

interface PairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  onRoomChange: (newRoom: string) => void;
  status: string;
  peerCount: number;
}

export const PairingModal: React.FC<PairingModalProps> = ({
  isOpen,
  onClose,
  roomId,
  onRoomChange,
  status,
  peerCount,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [inputCode, setInputCode] = useState(roomId);
  const [copied, setCopied] = useState(false);

  // Compute pairing URL
  const pairingUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?channel=${roomId}`
    : '';

  useEffect(() => {
    if (!pairingUrl) return;
    QRCode.toDataURL(pairingUrl, {
      width: 260,
      margin: 1.5,
      color: {
        dark: '#0f172a',
        light: '#f8fafc',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Failed to generate QR code:', err));
  }, [pairingUrl, roomId]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(pairingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode.trim()) {
      onRoomChange(inputCode.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-slate-100">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Parear com Segundo Celular</h3>
            <p className="text-xs text-slate-400">Escaneie o QR Code ou use o Código PIN do canal</p>
          </div>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center p-4 bg-slate-950 rounded-2xl border border-slate-800 my-4">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR Code de Pareamento do Intercomunicador"
              className="w-48 h-48 rounded-xl shadow-md border-4 border-white"
            />
          ) : (
            <div className="w-48 h-48 rounded-xl bg-slate-800 animate-pulse flex items-center justify-center text-xs text-slate-500">
              Gerando QR Code...
            </div>
          )}

          <div className="mt-3 text-center">
            <span className="text-[11px] text-slate-400">Canal / Sala de Pareamento:</span>
            <div className="font-mono text-xl font-bold tracking-widest text-amber-400">
              PIN #{roomId}
            </div>
          </div>
        </div>

        {/* Quick Link Copy */}
        <div className="flex items-center gap-2 p-2 bg-slate-950/70 border border-slate-800 rounded-xl mb-4">
          <input
            type="text"
            readOnly
            value={pairingUrl}
            className="flex-1 bg-transparent text-xs text-slate-400 px-2 font-mono outline-none truncate"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-colors whitespace-nowrap"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copiado!' : 'Copiar Link'}</span>
          </button>
        </div>

        {/* Manual PIN Code Change Form */}
        <form onSubmit={handleApplyCode} className="space-y-3 pt-2 border-t border-slate-800">
          <label className="block text-xs font-medium text-slate-400">
            Ou digite o código do canal do outro celular:
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder="Ex: 4821 ou CH-01"
              className="flex-1 py-2 px-3 rounded-xl bg-slate-800 border border-slate-700 text-sm font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
            >
              Conectar
            </button>
          </div>
        </form>

        {/* Offline / Wi-Fi info note */}
        <div className="mt-4 p-3 bg-slate-800/40 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
          <Wifi className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            <strong className="text-slate-300">Modo Offline e P2P:</strong> Funciona na mesma rede Wi-Fi, roteador portátil sem internet, ou via BroadcastChannel direto entre aparelhos pareados.
          </span>
        </div>
      </div>
    </div>
  );
};
