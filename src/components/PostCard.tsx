import React, { useState } from 'react';
import type { Prediction } from '../types';
import { Award, AlertCircle, TrendingUp } from 'lucide-react';

interface PostCardProps {
  prediction: Prediction;
  onPlaceBet: (predictionId: string, choice: 'YES' | 'NO', amount: number) => boolean;
  userBalance: number;
}

export default function PostCard({ prediction, onPlaceBet, userBalance }: PostCardProps) {
  const [selectedChoice, setSelectedChoice] = useState<'YES' | 'NO' | null>(null);
  const [betAmount, setBetAmount] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const totalPool = prediction.poolYes + prediction.poolNo;
  const yesPercent = totalPool > 0 ? Math.round((prediction.poolYes / totalPool) * 100) : 50;
  const noPercent = totalPool > 0 ? 100 - yesPercent : 50;

  const handleChoiceSelect = (choice: 'YES' | 'NO') => {
    if (selectedChoice === choice) {
      setSelectedChoice(null);
      setBetAmount('');
      setErrorMsg(null);
    } else {
      setSelectedChoice(choice);
      setBetAmount('');
      setErrorMsg(null);
    }
  };

  const handleAmountChange = (val: string) => {
    setBetAmount(val);
    const amount = parseInt(val, 10);
    if (isNaN(amount) || amount <= 0) {
      setErrorMsg('Digite um valor maior que zero.');
    } else if (amount > userBalance) {
      setErrorMsg(`Saldo insuficiente (Você tem 🪙${userBalance.toLocaleString()}).`);
    } else {
      setErrorMsg(null);
    }
  };

  const handleConfirmBet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChoice) return;
    const amount = parseInt(betAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      setErrorMsg('Valor inválido.');
      return;
    }
    if (amount > userBalance) {
      setErrorMsg(`Saldo insuficiente.`);
      return;
    }

    const success = onPlaceBet(prediction.id, selectedChoice, amount);
    if (success) {
      setBetAmount('');
      setSelectedChoice(null);
      setErrorMsg(null);
    }
  };

  return (
    <div className="bg-transparent border-b border-zinc-800 p-4 hover:bg-zinc-950/20 transition-all duration-200 text-left">
      {/* User Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <img
            src={prediction.userAvatar}
            alt={prediction.username}
            className="w-9 h-9 rounded-full object-cover border border-zinc-800 shrink-0"
          />
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-white text-sm hover:underline cursor-pointer">{prediction.username}</span>
              <span className="text-zinc-500 text-xs font-mono">{prediction.userHandle}</span>
            </div>
            <span className="text-zinc-550 text-xs">{prediction.timeAgo}</span>
          </div>
        </div>
        
        {/* Category Pill - Minimalist border */}
        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase border border-zinc-800 text-zinc-500 bg-transparent">
          {prediction.category}
        </span>
      </div>

      {/* Body Question */}
      <div className="mb-3.5 pl-0 md:pl-12">
        <h3 className="text-base font-bold text-white leading-normal hover:underline transition-all cursor-pointer">
          {prediction.question}
        </h3>
        {/* Resolution Source */}
        <p className="mt-1.5 text-xs text-zinc-500 flex items-center gap-1">
          <Award className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <span className="font-medium text-zinc-500">Fonte: <span className="text-zinc-400">{prediction.resolutionSource}</span></span>
        </p>
      </div>

      {/* YES / NO Selection - X Poll Layout Style */}
      <div className="flex flex-col gap-2 mb-4 pl-0 md:pl-12">
        {/* YES Button */}
        <button
          onClick={() => handleChoiceSelect('YES')}
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
            selectedChoice === 'YES'
              ? 'border-sky-500 bg-sky-950/15'
              : 'border-zinc-800 bg-black hover:bg-zinc-900/40'
          }`}
        >
          <span className={`text-xs font-extrabold ${selectedChoice === 'YES' ? 'text-sky-500' : 'text-zinc-300'}`}>SIM</span>
          <span className={`text-xs font-black font-mono ${selectedChoice === 'YES' ? 'text-sky-500' : 'text-zinc-400'}`}>
            {yesPercent}%
          </span>
        </button>

        {/* NO Button */}
        <button
          onClick={() => handleChoiceSelect('NO')}
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
            selectedChoice === 'NO'
              ? 'border-sky-500 bg-sky-950/15'
              : 'border-zinc-800 bg-black hover:bg-zinc-900/40'
          }`}
        >
          <span className={`text-xs font-extrabold ${selectedChoice === 'NO' ? 'text-sky-500' : 'text-zinc-300'}`}>NÃO</span>
          <span className={`text-xs font-black font-mono ${selectedChoice === 'NO' ? 'text-sky-500' : 'text-zinc-400'}`}>
            {noPercent}%
          </span>
        </button>
      </div>

      {/* Expandable Bet Wager Form - Pure flat black */}
      {selectedChoice && (
        <form onSubmit={handleConfirmBet} className="mb-4 ml-0 md:ml-12 p-4 rounded-xl bg-black border border-zinc-800 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-zinc-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-zinc-500" />
              <span>Apostando no <span className={selectedChoice === 'YES' ? 'text-sky-500 font-extrabold' : 'text-zinc-100 font-extrabold'}>{selectedChoice === 'YES' ? 'SIM' : 'NÃO'}</span></span>
            </span>
            <div className="flex items-center gap-1 bg-transparent px-2 py-0.5 rounded-md border border-zinc-800">
              <span className="text-[9px] text-zinc-550 font-bold uppercase">Saldo:</span>
              <span className="text-white text-xs font-black">🪙 {userBalance.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-450 font-bold text-sm">🪙</span>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="Quantidade de moedas"
                className="w-full bg-black text-white placeholder-zinc-700 pl-7 pr-3 py-2 rounded-full border border-zinc-800 text-xs focus:outline-none focus:border-zinc-700 font-bold"
                min="1"
                step="1"
                autoFocus
              />
            </div>

            {/* White Pill Button */}
            <button
              type="submit"
              disabled={!!errorMsg || !betAmount}
              className="px-4 py-2 rounded-full font-extrabold text-xs bg-white text-black hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer shrink-0"
            >
              Confirmar Aposta
            </button>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-1.5 text-xs text-rose-500 font-semibold mt-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{errorMsg}</span>
            </div>
          )}
        </form>
      )}

      {/* Progress Bar & Statistics - Monochrome zinc-300 vs zinc-700 */}
      <div className="pl-0 md:pl-12 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[10px] font-bold tracking-wide">
          <div className="flex items-center gap-1 text-zinc-200">
            <span>SIM</span>
            <span>{yesPercent}%</span>
            <span className="text-zinc-550 font-medium font-mono">({prediction.poolYes.toLocaleString()} 🪙)</span>
          </div>
          <div className="flex items-center gap-1 text-zinc-450">
            <span className="text-zinc-555 font-medium font-mono">({prediction.poolNo.toLocaleString()} 🪙)</span>
            <span>{noPercent}%</span>
            <span>NÃO</span>
          </div>
        </div>

        {/* Visual Progress Slider - Clean flat grayscale */}
        <div className="bg-zinc-800 h-1.5 rounded-full overflow-hidden flex">
          <div
            style={{ width: `${yesPercent}%` }}
            className="bg-zinc-300 h-full transition-all duration-500 ease-out"
          ></div>
          <div
            style={{ width: `${noPercent}%` }}
            className="bg-zinc-600 h-full transition-all duration-500 ease-out"
          ></div>
        </div>

        {/* Info stats */}
        <div className="flex items-center justify-between text-zinc-550 text-[10px] font-bold mt-1">
          <div>
            Piscina Total: <span className="text-zinc-400 font-extrabold">{totalPool.toLocaleString()} moedas</span>
          </div>
          <div className="font-mono text-zinc-550">
            {prediction.betsCount} {prediction.betsCount === 1 ? 'aposta' : 'apostas'}
          </div>
        </div>
      </div>
    </div>
  );
}
