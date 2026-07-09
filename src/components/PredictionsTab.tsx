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
  XCircle
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
  const isAdmin = profile?.isAdmin === true || profile?.role === 'admin' || session?.email?.includes('admin') || session?.email?.includes('jader');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newSource, setNewSource] = useState('');
  const [newCategory, setNewCategory] = useState('Esportes');

  // Betting states
  const [bettingPredictionId, setBettingPredictionId] = useState<string | null>(null);
  const [betOption, setBetOption] = useState<'SIM' | 'NÃO' | null>(null);
  const [betAmount, setBetAmount] = useState<number>(10);
  const [submittingBet, setSubmittingBet] = useState(false);

  // User active bets tracking
  const [userBets, setUserBets] = useState<Record<string, any>>({});

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

    // We fetch user bets from subcollections
    // For simplicity, we loop through loaded predictions and query the user's specific bets
    const fetchBets = async () => {
      const betsObj: Record<string, any> = {};
      for (const pred of predictions) {
        if (pred.status !== 'open') continue;
        try {
          const q = query(
            collection(db, 'predictions', pred.id, 'bets'),
            where('userId', '==', session.uid)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            // Sum all bets placed by this user on this prediction
            let totalSim = 0;
            let totalNao = 0;
            snap.docs.forEach(d => {
              const data = d.data();
              if (data.option === 'SIM') totalSim += data.amount;
              if (data.option === 'NÃO') totalNao += data.amount;
            });
            betsObj[pred.id] = { SIM: totalSim, NÃO: totalNao };
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

    try {
      await addDoc(collection(db, 'predictions'), {
        question: newQuestion.trim(),
        source: newSource.trim(),
        category: newCategory,
        status: 'open',
        poolYes: 0,
        poolNo: 0,
        outcome: null,
        createdAt: serverTimestamp()
      });

      setNewQuestion('');
      setNewSource('');
      setShowCreateForm(false);
      setToast({ message: 'Previsão criada com sucesso!', type: 'success' });
    } catch (err: any) {
      setToast({ message: `Erro ao criar previsão: ${err.message}`, type: 'error' });
    }
  };

  // 4. Place Bet
  const handlePlaceBet = async () => {
    if (!session?.uid) return;
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
      const predRef = doc(db, 'predictions', bettingPredictionId!);
      const betsRef = collection(db, 'predictions', bettingPredictionId!, 'bets');
      
      const batch = writeBatch(db);

      // Deduct balance from user
      const userRef = doc(db, 'users', session.uid);
      batch.update(userRef, {
        credits: increment(-betAmount)
      });

      // Update prediction pool
      batch.update(predRef, {
        poolYes: betOption === 'SIM' ? increment(betAmount) : increment(0),
        poolNo: betOption === 'NÃO' ? increment(betAmount) : increment(0)
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
      
      setToast({ message: `Aposta de ${betAmount} moedas em ${betOption} realizada com sucesso!`, type: 'success' });
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
  const handleResolvePrediction = async (predictionId: string, outcome: 'SIM' | 'NÃO') => {
    const pred = predictions.find(p => p.id === predictionId);
    if (!pred) return;

    const totalPool = (pred.poolYes || 0) + (pred.poolNo || 0);
    const winningPool = outcome === 'SIM' ? (pred.poolYes || 0) : (pred.poolNo || 0);

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
          Preveja o resultado de eventos futuros usando seus créditos. Se você acertar, ganha uma fatia proporcional do pote acumulado das apostas perdedoras!
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
        <form onSubmit={handleCreatePrediction} className="border-b border-zinc-800 p-4 bg-zinc-950/40 text-left flex flex-col gap-4">
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
            <span className="text-xs text-zinc-600 mt-1">Fique ligado, novos palpites serão adicionados em breve!</span>
          </div>
        ) : (
          filteredPredictions.map(pred => {
            const total = (pred.poolYes || 0) + (pred.poolNo || 0);
            const yesPercent = total > 0 ? Math.round((pred.poolYes / total) * 100) : 50;
            const noPercent = total > 0 ? Math.round((pred.poolNo / total) * 100) : 50;
            
            // Expected payouts
            const yesPayout = pred.poolYes > 0 ? (total / pred.poolYes).toFixed(2) : '2.00';
            const noPayout = pred.poolNo > 0 ? (total / pred.poolNo).toFixed(2) : '2.00';

            const userBet = userBets[pred.id];

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

                {/* Pool Status Bars */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs font-extrabold text-zinc-400">
                    <span className="text-sky-400">SIM ({yesPercent}%)</span>
                    <span className="text-zinc-500 tabular-nums">Pote: {(pred.poolYes || 0).toLocaleString()} moedas</span>
                    <span className="text-rose-400">NÃO ({noPercent}%)</span>
                  </div>
                  {/* Progress Bar Container */}
                  <div className="h-3 w-full bg-zinc-900 rounded-full overflow-hidden flex border border-zinc-850">
                    <div className="bg-sky-500 h-full transition-all duration-300" style={{ width: `${yesPercent}%` }}></div>
                    <div className="bg-rose-500 h-full transition-all duration-300 flex-1"></div>
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-500 font-semibold">
                    <span>Retorno: {yesPayout}x se SIM vencer</span>
                    <span>Retorno: {noPayout}x se NÃO vencer</span>
                  </div>
                </div>

                {/* User placed bet info */}
                {userBet && (
                  <div className="p-3 rounded-2xl bg-zinc-900/50 border border-zinc-850 flex items-center justify-between text-xs">
                    <span className="text-zinc-400 font-medium">Suas apostas ativas:</span>
                    <div className="flex gap-3 text-white font-extrabold">
                      {userBet.SIM > 0 && <span className="text-sky-400">SIM: {userBet.SIM.toLocaleString()} moedas</span>}
                      {userBet.NÃO > 0 && <span className="text-rose-400">NÃO: {userBet.NÃO.toLocaleString()} moedas</span>}
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
                            Apostando em <strong className={betOption === 'SIM' ? 'text-sky-400' : 'text-rose-400'}>{betOption}</strong>
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
                      <div className="flex gap-3">
                        <button
                          onClick={() => { setBettingPredictionId(pred.id); setBetOption('SIM'); setBetAmount(10); }}
                          className="flex-1 py-2.5 rounded-full bg-sky-950/20 hover:bg-sky-950/40 border border-sky-900/35 hover:border-sky-800 text-sky-400 font-black text-xs transition-all active:scale-[0.98] cursor-pointer"
                        >
                          Apostar SIM
                        </button>
                        <button
                          onClick={() => { setBettingPredictionId(pred.id); setBetOption('NÃO'); setBetAmount(10); }}
                          className="flex-1 py-2.5 rounded-full bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/35 hover:border-rose-800 text-rose-400 font-black text-xs transition-all active:scale-[0.98] cursor-pointer"
                        >
                          Apostar NÃO
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Admin Actions Area */}
                {isAdmin && pred.status === 'open' && (
                  <div className="flex flex-col gap-2 border-t border-zinc-900 pt-3">
                    <span className="text-[9px] font-black tracking-wider uppercase text-zinc-550">Controle do Administrador</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResolvePrediction(pred.id, 'SIM')}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30 hover:bg-sky-500/20 text-sky-400 text-xs font-bold transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        SIM venceu
                      </button>
                      <button
                        onClick={() => handleResolvePrediction(pred.id, 'NÃO')}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-400 text-xs font-bold transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        NÃO venceu
                      </button>
                      <button
                        onClick={() => handleCancelPrediction(pred.id)}
                        className="py-1.5 px-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
                        title="Cancelar e reembolsar todos"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Outcome Display (Resolved) */}
                {pred.status === 'resolved' && (
                  <div className="flex items-center gap-2 border-t border-zinc-900 pt-4 text-xs font-extrabold">
                    <span className="text-zinc-500">Resultado Oficial:</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-black ${
                      pred.outcome === 'SIM' ? 'bg-sky-950/30 text-sky-400 border border-sky-900/40' : 'bg-rose-950/30 text-rose-400 border border-rose-900/40'
                    }`}>
                      {pred.outcome} VENCEU
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
