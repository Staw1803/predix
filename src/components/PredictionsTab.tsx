import React, { useState, useEffect } from 'react';
import { db } from '../firebaseClient';
import { 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  onSnapshot, 
  query, 
  orderBy, 
  where, 
  serverTimestamp, 
  writeBatch,
  increment
} from 'firebase/firestore';
import { 
  TrendingUp, 
  Globe, 
  Coins, 
  Plus, 
  X, 
  HelpCircle,
  CheckCircle2,
  XCircle,
  Trash2
} from 'lucide-react';

interface PredictionsTabProps {
  session: any;
  profile: any;
  balance: number;
  setToast: (toast: { message: string; type: 'success' | 'error' } | null) => void;
  onBalanceUpdate: (newBalance: number) => void;
}

export default function PredictionsTab({ session, profile, balance, setToast, onBalanceUpdate }: PredictionsTabProps) {
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'open' | 'resolved'>('open');
  
  // Admin Mode (Restricted strictly to the main email)
  const isAdmin = profile?.isAdmin === true || 
                  profile?.role === 'admin' || 
                  session?.email === 'jadermeireles658@gmail.com';
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newSource, setNewSource] = useState('');
  const [newCategory, setNewCategory] = useState('Esportes');
  
  // Custom Dynamic Options (starts with 2 empty fields)
  const [customOptions, setCustomOptions] = useState<string[]>(['SIM', 'NÃO']);

  // Betting states
  const [bettingPredictionId, setBettingPredictionId] = useState<string | null>(null);
  const [betOption, setBetOption] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState<number>(10);
  const [submittingBet, setSubmittingBet] = useState(false);

  // User active bets tracking
  const [userBets, setUserBets] = useState<Record<string, Record<string, number>>>({});

  const categories = ['Esportes', 'Tecnologia', 'Cripto', 'Entretenimento', 'Geral'];

  // 1. Fetch Predictions
  useEffect(() => {
    const q = query(collection(db, 'predictions'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPredictions(list);
      setLoading(false);
    }, (err) => {
      console.error("Error loading predictions:", err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // 2. Fetch User Bets for all open predictions
  useEffect(() => {
    if (!session?.uid || predictions.length === 0) return;

    const fetchBets = async () => {
      const betsObj: Record<string, Record<string, number>> = {};
      for (const pred of predictions) {
        if (pred.status !== 'open') continue;
        try {
          const q = query(
            collection(db, 'predictions', pred.id, 'bets'),
            where('userId', '==', session.uid)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            const optAmounts: Record<string, number> = {};
            snap.docs.forEach(d => {
              const data = d.data();
              optAmounts[data.option] = (optAmounts[data.option] || 0) + data.amount;
            });
            betsObj[pred.id] = optAmounts;
          }
        } catch (err) {
          console.error(`Error loading bets for ${pred.id}:`, err);
        }
      }
      setUserBets(betsObj);
    };

    fetchBets();
  }, [predictions, session]);

  // 3. Create Prediction (Admin)
  const handleCreatePrediction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim() || !newSource.trim()) return;

    const filteredOptions = customOptions.map(o => o.trim()).filter(o => o.length > 0);
    if (filteredOptions.length < 2) {
      setToast({ message: 'A enquete precisa ter no mínimo 2 opções válidas.', type: 'error' });
      return;
    }

    try {
      const poolsMap: Record<string, number> = {};
      filteredOptions.forEach(opt => {
        poolsMap[opt] = 0;
      });

      await addDoc(collection(db, 'predictions'), {
        question: newQuestion.trim(),
        source: newSource.trim(),
        category: newCategory,
        status: 'open',
        options: filteredOptions,
        pools: poolsMap,
        outcome: null,
        createdAt: serverTimestamp()
      });

      setNewQuestion('');
      setNewSource('');
      setCustomOptions(['SIM', 'NÃO']);
      setShowCreateForm(false);
      setToast({ message: 'Previsão criada com sucesso!', type: 'success' });
    } catch (err: any) {
      setToast({ message: `Erro ao criar previsão: ${err.message}`, type: 'error' });
    }
  };

  // 4. Place Bet
  const handlePlaceBet = async () => {
    if (!session?.uid || !bettingPredictionId || !betOption) return;
    if (betAmount <= 0) {
      setToast({ message: 'Insira um valor válido para apostar.', type: 'error' });
      return;
    }
    if (betAmount > balance) {
      setToast({ message: 'Créditos insuficientes.', type: 'error' });
      return;
    }

    setSubmittingBet(true);
    try {
      const predRef = doc(db, 'predictions', bettingPredictionId);
      const betsRef = collection(db, 'predictions', bettingPredictionId, 'bets');
      
      const batch = writeBatch(db);

      // Deduct balance from user
      const userRef = doc(db, 'users', session.uid);
      batch.update(userRef, {
        credits: increment(-betAmount)
      });

      // Update prediction pool field
      const poolFieldPath = `pools.${betOption}`;
      batch.update(predRef, {
        [poolFieldPath]: increment(betAmount)
      });

      // Add bet document
      const newBetRef = doc(betsRef);
      batch.set(newBetRef, {
        userId: session.uid,
        username: profile?.username || '@usuario',
        userDisplayName: profile?.displayName || 'Usuário',
        option: betOption,
        amount: betAmount,
        timestamp: serverTimestamp()
      });

      await batch.commit();
      onBalanceUpdate(balance - betAmount);
      
      setToast({ message: `Aposta de ${betAmount} moedas em "${betOption}" realizada com sucesso!`, type: 'success' });
      setBettingPredictionId(null);
      setBetOption(null);
    } catch (err: any) {
      console.error(err);
      setToast({ message: `Erro ao realizar aposta: ${err.message}`, type: 'error' });
    } finally {
      setSubmittingBet(false);
    }
  };

  // 5. Resolve Prediction (Admin)
  const handleResolvePrediction = async (predictionId: string, outcome: string) => {
    const pred = predictions.find(p => p.id === predictionId);
    if (!pred) return;

    const pools = pred.pools || {};
    const totalPool = Object.values(pools).reduce((a: any, b: any) => a + b, 0) as number;
    const winningPool = (pools[outcome] || 0) as number;

    try {
      setLoading(true);
      const betsRef = collection(db, 'predictions', predictionId, 'bets');
      const snap = await getDocs(betsRef);
      const batch = writeBatch(db);

      if (winningPool > 0 && totalPool > 0) {
        const multiplier = totalPool / winningPool;

        for (const docBet of snap.docs) {
          const bet = docBet.data();
          if (bet.option === outcome) {
            const winnings = Math.floor(bet.amount * multiplier);
            const userRef = doc(db, 'users', bet.userId);
            batch.update(userRef, {
              credits: increment(winnings)
            });
          }
        }
      }

      // Mark prediction as resolved
      const predRef = doc(db, 'predictions', predictionId);
      batch.update(predRef, {
        status: 'resolved',
        outcome: outcome,
        resolvedAt: serverTimestamp()
      });

      await batch.commit();
      
      // Update local balance view if the logged-in user won
      if (session?.uid) {
        const freshSnap = await getDocs(query(betsRef, where('userId', '==', session.uid)));
        let wonAmount = 0;
        freshSnap.docs.forEach(d => {
          const data = d.data();
          if (data.option === outcome) {
            wonAmount += Math.floor(data.amount * (totalPool / winningPool));
          }
        });
        if (wonAmount > 0) {
          onBalanceUpdate(balance + wonAmount);
        }
      }

      setToast({ message: `Previsão resolvida! Resultado: ${outcome}`, type: 'success' });
    } catch (err: any) {
      console.error(err);
      setToast({ message: `Erro ao resolver: ${err.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // 6. Cancel & Refund Prediction (Admin)
  const handleCancelPrediction = async (predictionId: string) => {
    try {
      setLoading(true);
      const betsRef = collection(db, 'predictions', predictionId, 'bets');
      const snap = await getDocs(betsRef);
      const batch = writeBatch(db);

      for (const docBet of snap.docs) {
        const bet = docBet.data();
        const userRef = doc(db, 'users', bet.userId);
        batch.update(userRef, {
          credits: increment(bet.amount)
        });
      }

      const predRef = doc(db, 'predictions', predictionId);
      batch.update(predRef, {
        status: 'canceled',
        outcome: 'CANCELED',
        resolvedAt: serverTimestamp()
      });

      await batch.commit();
      setToast({ message: 'Previsão cancelada e créditos reembolsados!', type: 'success' });
    } catch (err: any) {
      console.error(err);
      setToast({ message: `Erro ao cancelar: ${err.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const filteredPredictions = predictions.filter(p => {
    if (activeSubTab === 'open') return p.status === 'open';
    return p.status === 'resolved' || p.status === 'canceled';
  });

  return (
    <div className="flex-1 flex flex-col bg-black w-full max-w-full overflow-x-hidden min-w-0">
      
      {/* Tab Header Banner */}
      <div className="border-b border-zinc-800 p-4 sticky top-0 bg-black/85 backdrop-blur-md z-10 flex flex-col gap-2 w-full max-w-full overflow-x-hidden min-w-0">
        <div className="flex items-center justify-between w-full">
          <h2 className="text-lg font-black text-white flex items-center gap-2 select-none">
            <TrendingUp className="w-5 h-5 text-sky-400 stroke-[2.5]" />
            Mercado de Previsões P2P
          </h2>
          
          {isAdmin && (
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white text-black font-extrabold text-xs hover:bg-zinc-200 transition-colors cursor-pointer shrink-0"
            >
              {showCreateForm ? <X className="w-3.5 h-3.5 stroke-[2.5]" /> : <Plus className="w-3.5 h-3.5 stroke-[2.5]" />}
              <span>{showCreateForm ? 'Fechar' : 'Nova Previsão'}</span>
            </button>
          )}
        </div>
        <p className="text-[11px] text-zinc-550 leading-relaxed text-left max-w-xl">
          Preveja o resultado de eventos reais. Escolha a sua opção e ganhe a fatia do pote de apostas perdedoras se vencer!
        </p>

        {/* Tab Toggle Switch */}
        <div className="flex gap-2 mt-2 w-full">
          <button
            onClick={() => setActiveSubTab('open')}
            className={`px-4 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer border ${
              activeSubTab === 'open' 
                ? 'bg-zinc-900 text-white border-zinc-800 shadow-md' 
                : 'text-zinc-500 hover:text-zinc-300 border-transparent'
            }`}
          >
            Abertas
          </button>
          <button
            onClick={() => setActiveSubTab('resolved')}
            className={`px-4 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer border ${
              activeSubTab === 'resolved' 
                ? 'bg-zinc-900 text-white border-zinc-800 shadow-md' 
                : 'text-zinc-500 hover:text-zinc-300 border-transparent'
            }`}
          >
            Histórico/Encerradas
          </button>
        </div>
      </div>

      {/* Admin Create Form */}
      {isAdmin && showCreateForm && (
        <form onSubmit={handleCreatePrediction} className="border-b border-zinc-800 p-5 bg-zinc-950/45 text-left flex flex-col gap-4 w-full max-w-full overflow-x-hidden min-w-0">
          <h3 className="text-xs font-black text-white flex items-center gap-1.5 uppercase tracking-widest text-zinc-300">
            <Plus className="w-4 h-4 text-sky-400 stroke-[2.5]" />
            Criar Mercado de Previsão
          </h3>

          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Pergunta da Enquete</label>
            <input
              type="text"
              required
              value={newQuestion}
              onChange={e => setNewQuestion(e.target.value)}
              placeholder="Ex: O Barcelona vai vencer o Real Madrid hoje?"
              className="bg-black border border-zinc-850 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-sky-500 transition-colors w-full"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <div className="flex-1 flex flex-col gap-1.5 min-w-0">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Fonte de Resolução Oficial</label>
              <input
                type="text"
                required
                value={newSource}
                onChange={e => setNewSource(e.target.value)}
                placeholder="Ex: Site da La Liga / Globo Esporte"
                className="bg-black border border-zinc-850 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-sky-500 transition-colors w-full min-w-0"
              />
            </div>

            <div className="flex flex-col gap-1.5 shrink-0 min-w-[120px]">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Categoria</label>
              <select
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                className="bg-black border border-zinc-850 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500 transition-colors cursor-pointer w-full"
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* DYNAMIC POLL OPTIONS */}
          <div className="flex flex-col gap-2 border-t border-zinc-900 pt-4 w-full">
            <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Opções da Enquete (Mínimo 2)</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
              {customOptions.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2 w-full min-w-0">
                  <input
                    type="text"
                    required
                    value={opt}
                    onChange={e => {
                      const newOpts = [...customOptions];
                      newOpts[idx] = e.target.value;
                      setCustomOptions(newOpts);
                    }}
                    placeholder={`Opção ${idx + 1}`}
                    className="bg-black border border-zinc-850 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500 transition-colors flex-1 min-w-0"
                  />
                  {customOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setCustomOptions(customOptions.filter((_, i) => i !== idx))}
                      className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-850 text-zinc-500 hover:text-white transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setCustomOptions([...customOptions, ''])}
              className="text-xs text-sky-400 hover:text-sky-350 font-black self-start mt-2 cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" /> Adicionar Opção
            </button>
          </div>

          <button
            type="submit"
            className="self-end px-6 py-2.5 rounded-full bg-white text-black font-extrabold text-xs hover:bg-zinc-200 transition-colors cursor-pointer shrink-0"
          >
            Publicar Mercado
          </button>
        </form>
      )}

      {/* Predictions list */}
      <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto w-full max-w-full overflow-x-hidden min-w-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500 w-full">
            <HelpCircle className="w-8 h-8 animate-spin mb-2 text-zinc-650" />
            <span className="text-xs font-semibold">Carregando previsões...</span>
          </div>
        ) : filteredPredictions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-550 border border-zinc-900 rounded-3xl p-6 bg-zinc-950/20 w-full">
            <HelpCircle className="w-8 h-8 stroke-[1.5] mb-2 text-zinc-800" />
            <span className="text-sm font-black text-zinc-450">Nenhuma previsão disponível</span>
            <span className="text-xs text-zinc-600 mt-1">Novos mercados e enquetes serão adicionados em breve!</span>
          </div>
        ) : (
          filteredPredictions.map(pred => {
            const pools = pred.pools || {};
            const total = Object.values(pools).reduce((a: any, b: any) => a + b, 0) as number;
            const options = pred.options || [];

            const userBet = userBets[pred.id] || {};

            return (
              <div key={pred.id} className="border border-zinc-900 rounded-3xl p-5 bg-zinc-950/15 flex flex-col gap-4 text-left w-full max-w-full overflow-x-hidden min-w-0 hover:border-zinc-850 transition-all duration-200">
                
                {/* Meta details */}
                <div className="flex items-center justify-between text-[9px] font-black tracking-wider uppercase text-zinc-500 w-full min-w-0">
                  <span className="px-2.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-850 text-zinc-400 shrink-0">{pred.category}</span>
                  <span className="flex items-center gap-1 truncate ml-2">
                    <Globe className="w-3.5 h-3.5 text-zinc-650 shrink-0" />
                    <span className="truncate">Fonte: {pred.source}</span>
                  </span>
                </div>

                {/* Question */}
                <h4 className="text-sm sm:text-base font-black text-white leading-snug w-full break-words select-none">{pred.question}</h4>

                {/* Interactive Twitter-style Poll Options */}
                <div className="flex flex-col gap-2 w-full">
                  {options.map((opt: string) => {
                    const optPool = pools[opt] || 0;
                    const percent = total > 0 ? Math.round((optPool / total) * 100) : 0;
                    const payoutMultiplier = optPool > 0 ? (total / optPool).toFixed(2) : '2.00';
                    const userAmt = userBet[opt] || 0;
                    const isWinningOption = pred.status === 'resolved' && pred.outcome === opt;

                    return (
                      <button
                        key={opt}
                        onClick={() => {
                          if (pred.status === 'open') {
                            setBettingPredictionId(pred.id);
                            setBetOption(opt);
                            setBetAmount(10);
                          }
                        }}
                        disabled={pred.status !== 'open'}
                        className={`group relative w-full text-left p-3.5 rounded-2xl border transition-all duration-200 overflow-hidden flex items-center justify-between min-w-0 ${
                          pred.status === 'open' 
                            ? 'bg-zinc-950/60 hover:bg-zinc-900/30 border-zinc-900 hover:border-zinc-800 cursor-pointer'
                            : isWinningOption 
                              ? 'bg-sky-950/20 border-sky-900/40 text-sky-400 cursor-default'
                              : 'bg-zinc-950/30 border-zinc-900/40 opacity-50 cursor-default'
                        }`}
                      >
                        {/* Progress Bar Background fill */}
                        <div 
                          className={`absolute inset-y-0 left-0 transition-all duration-500 rounded-r-md ${
                            isWinningOption ? 'bg-sky-500/25' : 'bg-zinc-900/50'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                        
                        {/* Left Info: Name & User Bet tag */}
                        <div className="relative flex flex-col min-w-0 z-10">
                          <span className="font-extrabold text-white text-xs sm:text-sm truncate select-none">{opt}</span>
                          {userAmt > 0 && (
                            <span className="text-[10px] text-sky-400 font-black flex items-center gap-1 mt-0.5">
                              <Coins className="w-3 h-3 text-amber-400" /> Sua aposta: {userAmt.toLocaleString()} moedas
                            </span>
                          )}
                        </div>

                        {/* Right Info: Percentage & Multipliers */}
                        <div className="relative flex flex-col items-end z-10 shrink-0 text-right ml-4">
                          <span className="text-xs sm:text-sm font-black text-white tabular-nums">{percent}%</span>
                          <span className="text-[9px] text-zinc-500 font-bold tracking-tight">
                            {payoutMultiplier}x • Pote: {optPool.toLocaleString()}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Total Stats summary */}
                <div className="text-[10px] text-zinc-500 font-bold select-none text-left">
                  Total Acumulado: {total.toLocaleString()} moedas
                </div>

                {/* Betting input sheet */}
                {pred.status === 'open' && bettingPredictionId === pred.id && (
                  <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-850 flex flex-col gap-3 animate-in slide-in-from-top-2 duration-200 w-full">
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold text-zinc-400 select-none">
                        Quanto deseja apostar em <strong className="text-sky-400">"{betOption}"</strong>?
                      </span>
                      <button
                        onClick={() => { setBettingPredictionId(null); setBetOption(null); }}
                        className="p-1 rounded-full hover:bg-zinc-900 text-zinc-500 hover:text-white transition-colors cursor-pointer shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-3 w-full">
                      <div className="flex-1 flex items-center bg-black border border-zinc-800 rounded-full px-4 py-2 min-w-0">
                        <Coins className="w-4 h-4 text-amber-400 mr-2 shrink-0" />
                        <input
                          type="number"
                          min={1}
                          max={balance}
                          value={betAmount}
                          onChange={e => setBetAmount(Math.min(balance, Math.max(1, parseInt(e.target.value) || 0)))}
                          className="w-full bg-transparent focus:outline-none text-white font-black text-sm min-w-0"
                        />
                        <span className="text-[10px] text-zinc-550 font-bold shrink-0 ml-2 select-none">Saldo: {balance.toLocaleString()}</span>
                      </div>
                      
                      <button
                        onClick={handlePlaceBet}
                        disabled={submittingBet || betAmount <= 0}
                        className="px-5 py-2.5 rounded-full bg-white text-black font-extrabold text-xs hover:bg-zinc-200 transition-colors disabled:opacity-40 cursor-pointer shrink-0"
                      >
                        Apostar
                      </button>
                    </div>
                  </div>
                )}

                {/* Admin Actions Area */}
                {isAdmin && pred.status === 'open' && (
                  <div className="flex flex-col gap-2.5 border-t border-zinc-900 pt-4 w-full">
                    <span className="text-[9px] font-black tracking-wider uppercase text-zinc-550 select-none">Controle do Administrador (Encerrar Mercado)</span>
                    <div className="flex flex-wrap gap-2 w-full">
                      {options.map((opt: string) => (
                        <button
                          key={opt}
                          onClick={() => handleResolvePrediction(pred.id, opt)}
                          className="flex-1 min-w-[100px] max-w-full flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl bg-sky-500/10 border border-sky-500/30 hover:bg-sky-500/20 text-sky-400 text-xs font-bold transition-all cursor-pointer truncate"
                          title={`Marcar ${opt} como vencedor`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">"{opt}" venceu</span>
                        </button>
                      ))}
                      <button
                        onClick={() => handleCancelPrediction(pred.id)}
                        className="py-2 px-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
                      >
                        Cancelar Mercado
                      </button>
                    </div>
                  </div>
                )}

                {/* Outcome Display (Resolved) */}
                {pred.status === 'resolved' && (
                  <div className="flex items-center gap-2 border-t border-zinc-900 pt-4 text-xs font-extrabold select-none">
                    <span className="text-zinc-500">Resultado Oficial:</span>
                    <span className="px-3 py-1 rounded-full text-[10px] font-black bg-sky-950/30 text-sky-400 border border-sky-900/40 uppercase">
                      "{pred.outcome}" VENCEU
                    </span>
                  </div>
                )}

                {/* Outcome Display (Canceled) */}
                {pred.status === 'canceled' && (
                  <div className="flex items-center gap-2 border-t border-zinc-900 pt-4 text-xs font-extrabold text-zinc-500 select-none">
                    <XCircle className="w-4 h-4 text-zinc-650 shrink-0" />
                    <span>Mercado Cancelado e Apostas Reembolsadas</span>
                  </div>
                )}

              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
