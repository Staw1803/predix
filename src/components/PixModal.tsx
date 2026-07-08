import { useState } from 'react';
import { X, Copy, Check, QrCode, AlertCircle, RefreshCw } from 'lucide-react';

interface PixModalProps {
  isOpen: boolean;
  onClose: () => void;
  coinsPackage: { reais: number; coins: number };
  onPaymentSuccess: (amountReais: number, coinsGranted: number) => void;
}

export default function PixModal({ isOpen, onClose, coinsPackage, onPaymentSuccess }: PixModalProps) {
  const [copied, setCopied] = useState(false);
  const [processing, setProcessing] = useState(false);

  if (!isOpen) return null;

  // Mock Pix Copy & Paste Key
  const pixKey = `00020101021226830014br.gov.bcb.pix2565https://pix.predix.app/qr/v2/${Date.now()}5204000053039865405${coinsPackage.reais.toFixed(2)}5802BR5910Predix_Inc6009Sao_Paulo62070503***6304CA12`;

  const handleCopy = () => {
    navigator.clipboard.writeText(pixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulatePayment = () => {
    setProcessing(true);
    // Simulate gateway API latency
    setTimeout(() => {
      onPaymentSuccess(coinsPackage.reais, coinsPackage.coins);
      setProcessing(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-black border border-zinc-800 rounded-3xl p-5 max-w-sm w-full flex flex-col gap-4 text-left shadow-2xl relative">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-2 pr-6">
          <QrCode className="w-5 h-5 text-sky-400" />
          <h3 className="text-base font-extrabold text-white">Pagamento via Pix</h3>
        </div>

        {/* Package summary */}
        <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-850 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-zinc-550 uppercase">Item adquirido</span>
            <span className="text-sm font-black text-white">Pacote 🪙 {coinsPackage.coins.toLocaleString()} moedas</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-zinc-555 uppercase block">Valor</span>
            <span className="text-sm font-black text-white">R$ {coinsPackage.reais.toFixed(2)}</span>
          </div>
        </div>

        {/* Styled QR Code Box */}
        <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-zinc-800 gap-2 mx-auto w-48 h-48 select-none">
          {/* Mock QR Code Pattern using CSS grids */}
          <div className="grid grid-cols-6 grid-rows-6 gap-1 w-36 h-36 text-black">
            {/* Top-left anchor */}
            <div className="col-span-2 row-span-2 bg-black border-4 border-white p-0.5"><div className="w-full h-full bg-black"></div></div>
            <div className="bg-black"></div>
            <div className="bg-transparent"></div>
            {/* Top-right anchor */}
            <div className="col-span-2 row-span-2 bg-black border-4 border-white p-0.5"><div className="w-full h-full bg-black"></div></div>
            
            <div className="bg-transparent"></div>
            <div className="bg-black"></div>
            
            <div className="bg-black"></div>
            <div className="bg-transparent"></div>
            <div className="bg-black"></div>
            <div className="bg-transparent"></div>
            <div className="bg-black"></div>
            <div className="bg-black"></div>
            
            <div className="bg-transparent"></div>
            <div className="bg-black"></div>
            <div className="bg-transparent"></div>
            <div className="bg-black"></div>
            <div className="bg-transparent"></div>
            <div className="bg-black"></div>
            
            {/* Bottom-left anchor */}
            <div className="col-span-2 row-span-2 bg-black border-4 border-white p-0.5"><div className="w-full h-full bg-black"></div></div>
            <div className="bg-black"></div>
            <div className="bg-transparent"></div>
            <div className="bg-black"></div>
            <div className="bg-transparent"></div>
            
            <div className="bg-transparent"></div>
            <div className="bg-black"></div>
            <div className="bg-transparent"></div>
            <div className="bg-black"></div>
          </div>
        </div>

        {/* Copy & Paste Code */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold text-zinc-550 uppercase">Pix Copia e Cola</span>
          <div className="flex items-center bg-zinc-950 border border-zinc-850 rounded-xl p-2.5">
            <span className="text-[11px] font-mono text-zinc-400 truncate flex-1 pr-3">
              {pixKey}
            </span>
            <button
              onClick={handleCopy}
              className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white cursor-pointer shrink-0 transition-all duration-150"
              title="Copiar Pix"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Simulate approval button */}
        <button
          onClick={handleSimulatePayment}
          disabled={processing}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-white text-black font-extrabold text-sm hover:bg-zinc-200 disabled:opacity-40 transition-all duration-150 cursor-pointer"
        >
          {processing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Processando...</span>
            </>
          ) : (
            <span>Simular Pagamento Confirmado</span>
          )}
        </button>

        {/* Sandbox alert */}
        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-zinc-950/40 border border-zinc-900 text-zinc-500">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-zinc-650" />
          <span className="text-[9px] leading-relaxed">
            Esta é uma integração simuladora Pix P2P. A confirmação gerará créditos instantâneos na sua conta cadastrada no banco de dados Supabase.
          </span>
        </div>
      </div>
    </div>
  );
}
