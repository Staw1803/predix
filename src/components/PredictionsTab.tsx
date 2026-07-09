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
  
  // Admin Mode
  const isAdmin = profile?.isAdmin === true || 
                  profile?.role === 'admin' || 
                  session?.email?.includes('admin') || 
                  session?.email?.includes('jader') || 
                  session?.email?.includes('redaj') ||
                  profile?.username === '@redaj' ||
                  profile?.username === '@jader';
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

    // Filter out empty options
    const filteredOptions = customOptions.map(o => o.trim()).filter(o => o.length > 0);
    if (filteredOptions.length < 2) {
      setToast({ message: 'A enquete precisa ter no mínimo 2 opções válidas.', type: 'error' });
      return;
    }

    try {
      // Build pools map
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
    
    // Sum total pool
    const totalPool = Object.values(pools).reduce((a: any, b: any) => a + b, 0) as number;
    const winningPool = (pools[outcome] || 0) as number;

    try {
      setLoading(true);
      const betsRef = collection(db, 'predictions', predictionId, 'bets');
      const snap = await getDocs(betsRef);
      const batch = writeBatch(db);

      // Distribute payouts if winning pool exists
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

      // Refund everyone
      for (const docBet of snap.docs) {
        const bet = docBet.data();
        const userRef = doc(db, 'users', bet.userId);
        batch.update(userRef, {
          credits: increment(bet.amount)
        });
      }

      // Mark prediction as canceled
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
    <div className="flex-1 flex flex-col bg-black">
      
      {/* Tab Header Banner */}
      <div className="border-b border-zinc-800 p-4 sticky top-0 bg-black/80 backdrop-blur-md z-10 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-sky-400" />
            Mercado de Previsões P2P
          </h2>
          
          {isAdmin && (
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-black font-extrabold text-xs hover:bg-zinc-200 transition-colors cursor-pointer"
            >
              {showCreateForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{showCreateForm ? 'Fechar' : 'Nova Previsão'}</span>
            </button>
          )}
        </div>
        <p className="text-xs text-zinc-550 leading-relaxed text-left">
          Preveja o resultado de eventos reais usando seus créditos. Escolha a sua opção e ganhe a fatia do pote se vencer!
        </p>

        {/* Tab Toggle Switch */}
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => setActiveSubTab('open')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'open' 
                ? 'bg-zinc-900 text-white border border-zinc-800' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Abertas
          </button>
          <button
            onClick={() => setActiveSubTab('resolved')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'resolved' 
                ? 'bg-zinc-900 text-white border border-zinc-800' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Histórico/Encerradas
          </button>
        </div>
      </div>

      {/* Admin Create Form */}
      {isAdmin && showCreateForm && (
        <form onSubmit={handleCreatePrediction} className="border-b border-zinc-800 p-4 bg-zinc-950/45 text-left flex flex-col gap-4">
          <h3 className="text-sm font-black text-white flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-sky-400" />
            Criar Mercado de Previsão
          </h3>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase">Pergunta da Enquete</label>
            <input
              type="text"
              required
              value={newQuestion}
              onChange={e => setNewQuestion(e.target.value)}
              placeholder="Ex: O Barcelona vai vencer o Real Madrid hoje?"
              className="bg-black border border-zinc-850 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase">Fonte de Resolução Oficial</label>
              <input
                type="text"
                required
                value={newSource}
                onChange={e => setNewSource(e.target.value)}
                placeholder="Ex: Site da La Liga / Globo Esporte"
                className="bg-black border border-zinc-850 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
              />
            </div>

            <div className="flex flex-col gap-1 shrink-0">
              <label className="text-[10px] font-bold text-zinc-500 uppercase">Categoria</label>
              <select
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                className="bg-black border border-zinc-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* DYNAMIC POLL OPTIONS */}
          <div className="flex flex-col gap-2 border-t border-zinc-900 pt-3">
            <label className="text-[10px] font-bold text-zinc-500 uppercase">Opções da Enquete (Mínimo 2)</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {customOptions.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
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
                    className="bg-black border border-zinc-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-700 flex-1"
                  />
                  {customOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setCustomOptions(customOptions.filter((_, i) => i !== idx))}
                      className="p-2 rounded-lg bg-zinc-900 border border-zinc-850 text-zinc-500 hover:text-white transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setCustomOptions([...customOptions, ''])}
              className="text-xs text-sky-400 hover:text-sky-350 font-bold self-start mt-1 cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar Opção
            </button>
          </div>

          <button
            type="submit"
            className="self-end px-5 py-2 rounded-full bg-white text-black font-extrabold text-xs hover:bg-zinc-200 transition-colors cursor-pointer"
          >
            Publicar Mercado
          </button>
        </form>
      )}

      {/* Predictions list */}
      <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-140px)]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <HelpCircle className="w-8 h-8 animate-spin mb-2" />
            <span className="text-sm font-semibold">Carregando previsões...</span>
          </div>
        ) : filteredPredictions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500 border border-zinc-900 rounded-3xl p-6 bg-zinc-950/20">
            <HelpCircle className="w-8 h-8 stroke-[1.5] mb-2 text-zinc-750" />
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
              <div key={pred.id} className="border border-zinc-900 rounded-3xl p-5 bg-zinc-950/10 flex flex-col gap-4 text-left">
                
                {/* Meta details */}
                <div className="flex items-center justify-between text-[10px] font-bold tracking-wider uppercase text-zinc-550">
                  <span className="px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-850 text-zinc-400">{pred.category}</span>
                  <span className="flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-zinc-650" />
                    Fonte: {pred.source}
                  </span>
                </div>

                {/* Question */}
                <h4 className="text-base font-black text-white leading-snug">{pred.question}</h4>

                {/* Pools Status */}
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Opções & Distribuição</span>
                  <div className="flex flex-col gap-2.5">
                    {options.map((opt: string) => {
                      const optPool = pools[opt] || 0;
                      const percent = total > 0 ? Math.round((optPool / total) * 100) : 0;
                      const payoutMultiplier = optPool > 0 ? (total / optPool).toFixed(2) : (2.00).toFixed(2);

                      return (
                        <div key={opt} className="flex flex-col gap-1 text-xs">
                          <div className="flex justify-between font-extrabold text-zinc-400">
                            <span className="text-zinc-200">{opt} ({percent}%)</span>
                            <span className="text-zinc-550 tabular-nums">Pote: {optPool.toLocaleString()} moedas</span>
                          </div>
                          
                          {/* Progress Bar */}
                          <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden flex border border-zinc-850">
                            <div className="bg-sky-500 h-full transition-all duration-300" style={{ width: `${percent}%` }}></div>
                          </div>
                          
                          <div className="text-[10px] text-zinc-600 text-left font-semibold">
                            Retorno: {payoutMultiplier}x se vencer
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-xs text-zinc-500 font-bold mt-1">
                    Total Acumulado: {total.toLocaleString()} moedas
                  </div>
                </div>

                {/* User placed bet info */}
                {Object.keys(userBet).length > 0 && (
                  <div className="p-3 rounded-2xl bg-zinc-900/50 border border-zinc-850 flex flex-col gap-1 text-xs">
                    <span className="text-zinc-400 font-bold uppercase text-[9px] tracking-wider">Suas apostas ativas:</span>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-white font-extrabold mt-1">
                      {Object.entries(userBet).map(([opt, amt]) => (
                        amt > 0 && (
                          <span key={opt} className="text-sky-400">
                            {opt}: {amt.toLocaleString()} moedas
                          </span>
                        )
                      ))}
                    </div>
                  </div>
                )}

                {/* Betting Action Area */}
                {pred.status === 'open' && (
                  <div className="flex flex-col gap-3 border-t border-zinc-900 pt-4">
                    {bettingPredictionId === pred.id ? (
                      <div className="flex flex-col gap-3 animate-fade-in">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-zinc-400">
                            Apostando em <strong className="text-sky-400 font-black">"{betOption}"</strong>
                          </span>
                          <button
                            onClick={() => { setBettingPredictionId(null); setBetOption(null); }}
                            className="p-1 rounded-full hover:bg-zinc-900 text-zinc-500 hover:text-white transition-colors cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="flex-1 flex items-center bg-black border border-zinc-850 rounded-full px-4 py-2">
                            <Coins className="w-4 h-4 text-amber-400 mr-2" />
                            <input
                              type="number"
                              min={1}
                              max={balance}
                              value={betAmount}
                              onChange={e => setBetAmount(Math.min(balance, Math.max(1, parseInt(e.target.value) || 0)))}
                              className="w-full bg-transparent focus:outline-none text-white font-black text-sm"
                            />
                            <span className="text-xs text-zinc-500 font-bold shrink-0">Saldo: {balance.toLocaleString()}</span>
                          </div>
                          
                          <button
                            onClick={handlePlaceBet}
                            disabled={submittingBet || betAmount <= 0}
                            className="px-5 py-2.5 rounded-full bg-white text-black font-extrabold text-xs hover:bg-zinc-200 transition-colors disabled:opacity-40 cursor-pointer"
                          >
                            Apostar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Apostar na Enquete</span>
                        <div className="flex flex-wrap gap-2">
                          {options.map((opt: string) => (
                            <button
                              key={opt}
                              onClick={() => { setBettingPredictionId(pred.id); setBetOption(opt); setBetAmount(10); }}
                              className="py-2 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-850 hover:border-zinc-700 text-zinc-200 font-bold text-xs transition-all active:scale-[0.98] cursor-pointer"
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Admin Actions Area */}
                {isAdmin && pred.status === 'open' && (
                  <div className="flex flex-col gap-2 border-t border-zinc-900 pt-3">
                    <span className="text-[9px] font-black tracking-wider uppercase text-zinc-550">Controle do Administrador (Escolha a vencedora)</span>
                    <div className="flex flex-wrap gap-2">
                      {options.map((opt: string) => (
                        <button
                          key={opt}
                          onClick={() => handleResolvePrediction(pred.id, opt)}
                          className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2 rounded-xl bg-sky-500/10 border border-sky-500/30 hover:bg-sky-500/20 text-sky-400 text-xs font-bold transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          "{opt}" Venceu
                        </button>
                      ))}
                      <button
                        onClick={() => handleCancelPrediction(pred.id)}
                        className="py-2 px-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
                        title="Cancelar e reembolsar todos"
                      >
                        Cancelar Enquete
                      </button>
                    </div>
                  </div>
                )}

                {/* Outcome Display (Resolved) */}
                {pred.status === 'resolved' && (
                  <div className="flex items-center gap-2 border-t border-zinc-900 pt-4 text-xs font-extrabold">
                    <span className="text-zinc-500">Resultado Oficial:</span>
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-sky-950/30 text-sky-400 border border-sky-900/40">
                      "{pred.outcome}" VENCEU
                    </span>
                  </div>
                )}

                {/* Outcome Display (Canceled) */}
                {pred.status === 'canceled' && (
                  <div className="flex items-center gap-2 border-t border-zinc-900 pt-4 text-xs font-extrabold text-zinc-500">
                    <XCircle className="w-4 h-4 text-zinc-650" />
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
