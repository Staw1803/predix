import { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Feed from './components/Feed';
import RightSidebar from './components/RightSidebar';
import Toast from './components/Toast';
import Auth from './components/Auth';

import { auth, db, isFirebaseConfigured } from './firebaseClient';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { resolvePost } from './services/postResolverService';
import { 
  doc, 
  getDoc, 
  collection, 
  getDocs, 
  updateDoc, 
  runTransaction, 
  query, 
  orderBy, 
  addDoc,
  where
} from 'firebase/firestore';
import type { CreatePredictionRef } from './components/CreatePrediction';
import type { Prediction } from './types';
import { 
  Award, 
  CheckCircle, 
  BarChart2, 
  Star, 
  LogOut, 
  ShoppingBag, 
  QrCode, 
  Copy, 
  Check, 
  RefreshCw,
  Edit2,
  Calendar,
  Lock,
  ArrowUpRight
} from 'lucide-react';

const INITIAL_MOCK_PREDICTIONS: Prediction[] = [
  {
    id: '1',
    authorId: 'system',
    username: 'Fofoqueiro de Plantão',
    userHandle: '@babados_prime',
    userAvatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80',
    timeAgo: 'há 10 min',
    question: 'O cantor canadense Justin Bieber vai anunciar o cancelamento de seu show em São Paulo até sexta-feira?',
    resolutionSource: 'Portal G1 ou perfil oficial do artista no Instagram',
    category: 'Pop/Fofoca',
    poolYes: 4500,
    poolNo: 2100,
    betsCount: 42,
    status: 'active'
  },
  {
    id: '2',
    authorId: 'system',
    username: 'Tech Gurú',
    userHandle: '@tech_future',
    userAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
    timeAgo: 'há 1 hora',
    question: 'A Apple apresentará um dispositivo de Realidade Aumentada (óculos inteligente) com preço sugerido inferior a US$ 1.000 na próxima WWDC?',
    resolutionSource: 'Transmissão oficial do evento Apple WWDC no YouTube',
    category: 'Tecnologia',
    poolYes: 1800,
    poolNo: 3500,
    betsCount: 29,
    status: 'active'
  }
];

function App() {
  // Firebase Session States
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isOfflineSandbox, setIsOfflineSandbox] = useState<boolean>(!isFirebaseConfigured);

  // App States
  const [balance, setBalance] = useState<number>(1000); 
  const [predictions, setPredictions] = useState<Prediction[]>(INITIAL_MOCK_PREDICTIONS);
  const [activeTab, setActiveTab] = useState<string>('feed');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Store & Checkout States
  const [checkoutPackage, setCheckoutPackage] = useState<{ name: string; coins: number; price: number; qrCode: string; qrCodeBase64: string } | null>(null);
  const [loadingPix, setLoadingPix] = useState<boolean>(false);
  const [confirmingPayment, setConfirmingPayment] = useState<boolean>(false);
  const [copiedPix, setCopiedPix] = useState<boolean>(false);

  // Profile Edit States
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [editDisplayName, setEditDisplayName] = useState<string>('');
  const [editUsername, setEditUsername] = useState<string>('');
  const [editBio, setEditBio] = useState<string>('');
  const [editAvatarUrl, setEditAvatarUrl] = useState<string>('');
  
  // Wagers history feed
  const [myBets, setMyBets] = useState<any[]>([]);



  const createPredictionRef = useRef<CreatePredictionRef>(null);

  // 1. Firebase Auth Listener
  useEffect(() => {
    if (!isFirebaseConfigured) return;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setSession(user);
        setIsOfflineSandbox(false);
      } else {
        setSession(null);
        setProfile(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Fetch Profile doc from Cloud Firestore
  const fetchUserProfile = async (userId: string) => {
    try {
      const docRef = doc(db, 'profiles', userId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfile(data);
        setBalance(data.balance);
        
        // Populate inputs for Profile Editing
        setEditDisplayName(data.display_name || '');
        setEditUsername(data.username || '');
        setEditBio(data.bio || '');
        setEditAvatarUrl(data.avatar_url || '');
      } else {
        const fallbackProfile = {
          id: userId,
          username: session?.email?.split('@')[0] || 'user',
          display_name: session?.displayName || session?.email?.split('@')[0] || 'User',
          balance: 1000,
          total_deposited: 0,
          total_wagered: 0,
          win_rate: 0,
          total_bets: 0,
          total_earnings: 0,
          bio: 'Palpitador no Predix.'
        };
        setProfile(fallbackProfile);
        setBalance(1000);
      }
    } catch (err: any) {
      console.error('Error fetching profile:', err.message);
    }
  };

  // 3. Fetch Wagers History from Firestore
  const fetchUserBets = async (userId: string) => {
    if (!isFirebaseConfigured) return;
    try {
      const q = query(collection(db, 'bets'), where('user_id', '==', userId));
      const snap = await getDocs(q);
      const list: any[] = [];
      
      for (const docSnap of snap.docs) {
        const betData = docSnap.data();
        const postSnap = await getDoc(doc(db, 'posts', betData.post_id));
        const postQuestion = postSnap.exists() ? postSnap.data().question : 'Previsão encerrada';
        
        list.push({
          id: docSnap.id,
          amount: betData.amount,
          choice: betData.choice,
          created_at: betData.created_at?.toDate() || new Date(),
          question: postQuestion
        });
      }
      
      list.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
      setMyBets(list);
    } catch (err: any) {
      console.error('Error fetching bets:', err.message);
    }
  };

  // 4. Fetch Predictions from Firestore `posts` collection
  const fetchPredictions = async () => {
    if (!isFirebaseConfigured) return;
    try {
      const postsRef = collection(db, 'posts');
      const postsQuery = query(postsRef, orderBy('created_at', 'desc'));
      const querySnapshot = await getDocs(postsQuery);
      
      const mapped: Prediction[] = [];
      const authorCache: { [id: string]: any } = {};

      for (const docSnap of querySnapshot.docs) {
        const postData = docSnap.data();
        const authorId = postData.author_id;

        if (authorId && !authorCache[authorId]) {
          const authorSnap = await getDoc(doc(db, 'profiles', authorId));
          if (authorSnap.exists()) {
            authorCache[authorId] = authorSnap.data();
          }
        }

        const authorInfo = authorCache[authorId] || { 
          display_name: 'Usuário', 
          username: 'user',
          avatar_url: 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&w=150&q=80'
        };

        mapped.push({
          id: docSnap.id,
          authorId: authorId,
          username: authorInfo.display_name,
          userHandle: `@${authorInfo.username}`,
          userAvatar: authorInfo.avatar_url || 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&w=150&q=80',
          timeAgo: 'ativo',
          question: postData.question,
          resolutionSource: postData.source_url,
          category: postData.category || 'Geral',
          poolYes: postData.pool_yes || 0,
          poolNo: postData.pool_no || 0,
          betsCount: Math.round(((postData.pool_yes || 0) + (postData.pool_no || 0)) / 100),
          status: postData.status || 'active',
          winningChoice: postData.winning_choice
        });
      }

      setPredictions(mapped);
    } catch (err: any) {
      console.error('Error fetching predictions:', err.message);
    }
  };

  // Sync profile & wagers on session updates
  useEffect(() => {
    if (session?.uid) {
      fetchUserProfile(session.uid);
      fetchUserBets(session.uid);
      fetchPredictions();
    }
  }, [session]);

  // Initial local sandbox loads when offline
  useEffect(() => {
    if (isOfflineSandbox) {
      const savedBalance = localStorage.getItem('predix_balance');
      const savedPreds = localStorage.getItem('predix_predictions');
      if (savedBalance) setBalance(parseInt(savedBalance, 10));
      if (savedPreds) setPredictions(JSON.parse(savedPreds));
    }
  }, [isOfflineSandbox]);

  // Sync local-storage states in sandbox mode
  useEffect(() => {
    if (isOfflineSandbox) {
      localStorage.setItem('predix_balance', balance.toString());
    }
  }, [balance, isOfflineSandbox]);

  useEffect(() => {
    if (isOfflineSandbox) {
      localStorage.setItem('predix_predictions', JSON.stringify(predictions));
    }
  }, [predictions, isOfflineSandbox]);

  // 5. Place P2P Bet (Atomic Firestore Transaction)
  const handlePlaceBet = (predictionId: string, choice: 'YES' | 'NO', amount: number): boolean => {
    if (amount > balance) {
      setToast({ message: 'Erro: Saldo insuficiente!', type: 'error' });
      return false;
    }

    if (!isOfflineSandbox && session?.uid) {
      // Optimistic update
      setBalance((prev) => prev - amount);
      setPredictions((prev) =>
        prev.map((pred) => {
          if (pred.id === predictionId) {
            return {
              ...pred,
              poolYes: choice === 'YES' ? pred.poolYes + amount : pred.poolYes,
              poolNo: choice === 'NO' ? pred.poolNo + amount : pred.poolNo,
              betsCount: pred.betsCount + 1,
            };
          }
          return pred;
        })
      );

      (async () => {
        try {
          await runTransaction(db, async (transaction) => {
            const userProfileRef = doc(db, 'profiles', session.uid);
            const postRef = doc(db, 'posts', predictionId);

            const userProfileSnap = await transaction.get(userProfileRef);
            const postSnap = await transaction.get(postRef);

            if (!userProfileSnap.exists()) throw new Error("Perfil não encontrado");
            if (!postSnap.exists()) throw new Error("Previsão não encontrada");

            const currentBalance = userProfileSnap.data().balance;
            const currentWagered = userProfileSnap.data().total_wagered || 0;
            const currentBets = userProfileSnap.data().total_bets || 0;
            const postData = postSnap.data();

            if (currentBalance < amount) {
              throw new Error("Saldo insuficiente verificado no servidor.");
            }

            // Update balance and rollover metric total_wagered
            transaction.update(userProfileRef, { 
              balance: currentBalance - amount,
              total_wagered: currentWagered + amount,
              total_bets: currentBets + 1
            });

            const newYes = choice === 'YES' ? (postData.pool_yes || 0) + amount : (postData.pool_yes || 0);
            const newNo = choice === 'NO' ? (postData.pool_no || 0) + amount : (postData.pool_no || 0);
            transaction.update(postRef, { pool_yes: newYes, pool_no: newNo });

            const betRef = doc(collection(db, 'bets'));
            transaction.set(betRef, {
              post_id: predictionId,
              user_id: session.uid,
              choice: choice === 'YES',
              amount,
              created_at: new Date()
            });
          });

          fetchUserProfile(session.uid);
          fetchUserBets(session.uid);
          setToast({
            message: `Aposta de 🪙 ${amount.toLocaleString()} no ${choice === 'YES' ? 'SIM' : 'NÃO'} confirmada!`,
            type: 'success',
          });
        } catch (err: any) {
          setBalance((prev) => prev + amount);
          fetchPredictions(); 
          setToast({ message: `Erro de rede/transação: ${err.message || 'Falha na rede'}`, type: 'error' });
        }
      })();
    } else {
      // Local Sandbox mode
      setBalance((prev) => prev - amount);
      setPredictions((prev) =>
        prev.map((pred) => {
          if (pred.id === predictionId) {
            return {
              ...pred,
              poolYes: choice === 'YES' ? pred.poolYes + amount : pred.poolYes,
              poolNo: choice === 'NO' ? pred.poolNo + amount : pred.poolNo,
              betsCount: pred.betsCount + 1,
            };
          }
          return pred;
        })
      );
      setToast({
        message: `Aposta de 🪙 ${amount.toLocaleString()} no ${choice === 'YES' ? 'SIM' : 'NÃO'} efetuada (Modo Sandbox)!`,
        type: 'success',
      });
    }

    return true;
  };

  // 6. Create new Prediction Market
  const handlePublishPrediction = (question: string, source: string, category: string) => {
    if (!isOfflineSandbox && session?.uid) {
      (async () => {
        try {
          const postData = {
            question,
            source_url: source,
            category,
            author_id: session.uid,
            pool_yes: 0,
            pool_no: 0,
            status: 'active',
            created_at: new Date()
          };

          const docRef = await addDoc(collection(db, 'posts'), postData);

          const newPred: Prediction = {
            id: docRef.id,
            authorId: session.uid,
            username: profile?.display_name || session.email.split('@')[0],
            userHandle: `@${profile?.username || session.email.split('@')[0]}`,
            userAvatar: profile?.avatar_url || 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&w=150&q=80',
            timeAgo: 'agora mesmo',
            question,
            resolutionSource: source,
            category,
            poolYes: 0,
            poolNo: 0,
            betsCount: 0,
            status: 'active'
          };

          setPredictions((prev) => [newPred, ...prev]);
          setToast({ message: 'Previsão criada e publicada no Cloud Firestore!', type: 'success' });
        } catch (err: any) {
          setToast({ message: `Erro ao publicar: ${err.message}`, type: 'error' });
        }
      })();
    } else {
      // Sandbox mode
      const newPrediction: Prediction = {
        id: Date.now().toString(),
        authorId: 'sandbox',
        username: 'Redaj',
        userHandle: '@redaj_lsx',
        userAvatar: 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&w=150&q=80',
        timeAgo: 'agora mesmo',
        question,
        resolutionSource: source,
        category,
        poolYes: 0,
        poolNo: 0,
        betsCount: 0,
        status: 'active'
      };

      setPredictions((prev) => [newPrediction, ...prev]);
      setToast({ message: 'Previsão publicada com sucesso (Modo Sandbox)!', type: 'success' });
    }

    setActiveTab('feed');
  };

  // 7. Handle Post Resolution (Pari-Mutuel Engine Trigger)
  const handleResolvePost = async (postId: string, winningChoice: boolean) => {
    if (!session?.uid) return;
    try {
      const result = await resolvePost(postId, winningChoice);
      if (result.success) {
        setToast({ 
          message: `Aposta encerrada! Moedas divididas entre os vencedores (Pool Total: 🪙 ${result.poolTotal.toLocaleString()}).`, 
          type: 'success' 
        });
        fetchUserProfile(session.uid);
        fetchPredictions();
      }
    } catch (err: any) {
      setToast({ message: `Erro ao resolver aposta: ${err.message}`, type: 'error' });
    }
  };



  // 9. Store / Checkout Handlers
  const handleSelectStorePackage = async (pkg: { name: string; coins: number; price: number }) => {
    setLoadingPix(true);
    setCheckoutPackage(null);

    const emailVal = session?.email || 'test@test.com';

    try {
      const response = await fetch('/api-mp/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `predix-${Date.now()}`
        },
        body: JSON.stringify({
          transaction_amount: pkg.price,
          description: `Recarga Predix - ${pkg.coins} moedas`,
          payment_method_id: 'pix',
          payer: {
            email: emailVal,
            first_name: emailVal.split('@')[0],
            last_name: 'User'
          }
        })
      });

      const data = await response.json();

      if (response.ok && data.point_of_interaction?.transaction_data) {
        const transData = data.point_of_interaction.transaction_data;
        setCheckoutPackage({
          name: pkg.name,
          coins: pkg.coins,
          price: pkg.price,
          qrCode: transData.qr_code,
          qrCodeBase64: transData.qr_code_base64
        });
        setToast({ message: 'PIX gerado via Mercado Pago!', type: 'success' });
      } else {
        throw new Error(data.message || 'Falha ao processar Pix com o gateway');
      }
    } catch (err: any) {
      console.warn('Proxy fail, generating sandbox fallback:', err.message);
      setCheckoutPackage({
        name: pkg.name,
        coins: pkg.coins,
        price: pkg.price,
        qrCode: `00020101021226870014br.gov.bcb.pix2565https://qr.mercadopago.com/pix/v1/mp-predix-${pkg.price}-${Date.now()}5204000053039865405${pkg.price.toFixed(2)}5802BR5910Predix_Inc6009Sao_Paulo62070503***6304CA12`,
        qrCodeBase64: ''
      });
      setToast({ message: 'Conexao falhou. Carregando Pix de contingência.', type: 'error' });
    } finally {
      setLoadingPix(false);
    }
  };

  const handleCopyPixKey = () => {
    if (!checkoutPackage) return;
    navigator.clipboard.writeText(checkoutPackage.qrCode);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2000);
  };

  const handleConfirmStorePayment = () => {
    if (!checkoutPackage) return;
    setConfirmingPayment(true);

    setTimeout(() => {
      const addedCoins = checkoutPackage.coins;
      const finalBalance = balance + addedCoins;
      setBalance(finalBalance);

      if (!isOfflineSandbox && session?.uid) {
        (async () => {
          try {
            await addDoc(collection(db, 'transactions'), {
              user_id: session.uid,
              amount_reais: checkoutPackage.price,
              coins_amount: addedCoins,
              status: 'completed',
              gateway: 'mercadopago',
              created_at: new Date()
            });

            // Increment balance and rollover metric total_deposited
            const currentDeposited = profile?.total_deposited || 0;
            const finalDeposited = currentDeposited + addedCoins;

            const userProfileRef = doc(db, 'profiles', session.uid);
            await updateDoc(userProfileRef, { 
              balance: finalBalance,
              total_deposited: finalDeposited
            });
            
            setProfile((prev: any) => ({ ...prev, balance: finalBalance, total_deposited: finalDeposited }));
            setToast({
              message: `Pagamento Pix confirmado! R$ ${checkoutPackage.price.toFixed(2)} creditados com sucesso (🪙 +${addedCoins.toLocaleString()}).`,
              type: 'success',
            });
          } catch (err: any) {
            setToast({ message: `Erro ao registrar saldo no Firebase: ${err.message}`, type: 'error' });
          }
        })();
      } else {
        setToast({
          message: `Pagamento Pix confirmado! R$ ${checkoutPackage.price.toFixed(2)} creditados (🪙 +${addedCoins.toLocaleString()}).`,
          type: 'success',
        });
      }

      setConfirmingPayment(false);
      setCheckoutPackage(null);
    }, 3000);
  };

  // 10. Profile Update handler
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.uid) return;
    
    try {
      const userRef = doc(db, 'profiles', session.uid);
      await updateDoc(userRef, {
        display_name: editDisplayName,
        username: editUsername.replace(/[@\s]+/g, '').toLowerCase(),
        bio: editBio,
        avatar_url: editAvatarUrl
      });
      
      setProfile((prev: any) => ({
        ...prev,
        display_name: editDisplayName,
        username: editUsername.replace(/[@\s]+/g, '').toLowerCase(),
        bio: editBio,
        avatar_url: editAvatarUrl
      }));
      
      setIsEditingProfile(false);
      setToast({ message: 'Perfil atualizado com sucesso!', type: 'success' });
    } catch (err: any) {
      setToast({ message: `Erro ao salvar perfil: ${err.message}`, type: 'error' });
    }
  };

  // 11. Request Withdraw (Rollover checks)
  const handleRequestWithdraw = () => {
    // Basic guard
    const totalDeposited = profile?.total_deposited || 0;
    const totalWagered = profile?.total_wagered || 0;
    if (balance < 500 || totalWagered < totalDeposited) {
      setToast({ message: 'Saque bloqueado pelas regras de rollover.', type: 'error' });
      return;
    }

    setToast({ message: 'Solicitação de saque enviada para processamento Pix!', type: 'success' });
    // deduct balance on request
    const updated = balance - 500;
    setBalance(updated);
    if (!isOfflineSandbox && session?.uid) {
      updateDoc(doc(db, 'profiles', session.uid), { balance: updated });
    }
  };

  const handleCreateBetClick = () => {
    setActiveTab('feed');
    setTimeout(() => {
      createPredictionRef.current?.focus();
    }, 100);
  };

  const handleTrendClick = (_question: string) => {
    setActiveTab('feed');
    setTimeout(() => {
      createPredictionRef.current?.focus();
    }, 100);
  };

  const handleLogout = async () => {
    if (isFirebaseConfigured && !isOfflineSandbox) {
      await signOut(auth);
    }
    setSession(null);
    setProfile(null);
    setIsOfflineSandbox(!isFirebaseConfigured);
    setToast({ message: 'Sessão encerrada com sucesso.', type: 'success' });
  };



  // 12. Strict Auth Redirection Lock
  if (!session && !isOfflineSandbox) {
    return <Auth onLoginSimulated={() => setIsOfflineSandbox(true)} setToast={setToast} />;
  }

  // Active User Identifiers
  const activeName = profile?.display_name || profile?.username || (session ? session.displayName || session.email.split('@')[0] : 'Redaj');
  const activeHandle = profile?.username ? `@${profile.username}` : (session ? `@${session.email.split('@')[0]}` : '@redaj_lsx');
  const activeAvatar = profile?.avatar_url || 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&w=150&q=80';

  // Rollover validation calculations
  const totalDepositedVal = profile?.total_deposited || 0;
  const totalWageredVal = profile?.total_wagered || 0;
  const missingWagerVal = Math.max(0, totalDepositedVal - totalWageredVal);
  const isRolloverCleared = totalWageredVal >= totalDepositedVal;
  const isWithdrawEnabled = balance >= 500 && isRolloverCleared;

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex justify-center selection:bg-sky-500 selection:text-black">
      <div className="w-full max-w-7xl flex relative">
        
        {/* Left Sidebar */}
        <Sidebar
          balance={balance}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onCreateBetClick={handleCreateBetClick}
          username={activeName}
          userHandle={activeHandle}
          userAvatar={activeAvatar}
        />

        {/* Center Main Scroll Container */}
        <main className="flex-1 min-w-0 min-h-screen pl-20 md:pl-0 flex flex-col">
          
          {/* Feed Tab */}
          {activeTab === 'feed' && (
            <Feed
              predictions={predictions}
              onPlaceBet={handlePlaceBet}
              onPublish={handlePublishPrediction}
              userBalance={balance}
              createPredictionRef={createPredictionRef}
              currentUserId={session?.uid}
              onResolve={handleResolvePost}
            />
          )}

          {/* Wallet Tab with Withdraw Rollover system */}
          {activeTab === 'wallet' && (
            <div className="flex-1 min-h-screen border-r border-zinc-800 bg-black min-w-0">
              <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-zinc-800 px-4 py-4">
                <h2 className="text-lg font-bold text-white text-left">Carteira</h2>
              </div>
              <div className="p-4 flex flex-col gap-6 text-left animate-fade-in font-medium">
                
                {/* Wallet Balance Hero Card */}
                <div className="p-5 rounded-2xl bg-transparent border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex flex-col gap-1">
                    <span className="text-zinc-550 font-bold uppercase tracking-wider text-[10px]">Saldo Disponível</span>
                    <div className="flex items-center gap-1.5 font-black text-white text-3xl md:text-4xl">
                      <span>🪙</span>
                      <span>{balance.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        setActiveTab('store');
                      }}
                      className="px-4 py-2.5 rounded-full bg-white text-black hover:bg-zinc-200 font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      Ir para a Loja de Moedas
                    </button>
                  </div>
                </div>

                {/* Sacar PIX Section */}
                <div className="border border-zinc-800 rounded-3xl p-5 flex flex-col gap-4 bg-transparent">
                  <div className="flex items-center gap-2 border-b border-zinc-900 pb-3">
                    <ArrowUpRight className="w-5 h-5 text-sky-400" />
                    <h3 className="font-extrabold text-white text-sm">Sacar PIX</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-left">
                    <div className="p-3 bg-zinc-950 border border-zinc-900 rounded-xl">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase block">Total Depositado</span>
                      <span className="text-sm font-black text-white">🪙 {totalDepositedVal.toLocaleString()}</span>
                    </div>
                    <div className="p-3 bg-zinc-950 border border-zinc-900 rounded-xl">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase block">Total Apostado</span>
                      <span className="text-sm font-black text-white">🪙 {totalWageredVal.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleRequestWithdraw}
                      disabled={!isWithdrawEnabled}
                      className="w-full py-3 rounded-full font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer bg-white text-black hover:bg-zinc-200 disabled:bg-zinc-900 disabled:text-zinc-600 disabled:border-zinc-800 disabled:cursor-not-allowed"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Solicitar Saque (Mínimo R$ 50,00 / 🪙 500)</span>
                    </button>

                    {/* Rollover error warning */}
                    {!isRolloverCleared && (
                      <p className="text-[11px] text-zinc-500 leading-relaxed font-semibold mt-1">
                        Para liberar o saque, você precisa apostar as moedas depositadas. Faltam <span className="text-sky-400 font-black">🪙 {missingWagerVal.toLocaleString()}</span> moedas.
                      </p>
                    )}

                    {isRolloverCleared && balance < 500 && (
                      <p className="text-[11px] text-zinc-500 leading-relaxed font-semibold mt-1">
                        Seu rollover está liberado! Porém, você precisa de no mínimo <span className="text-white">🪙 500</span> para solicitar o saque.
                      </p>
                    )}

                    {isWithdrawEnabled && (
                      <p className="text-[11px] text-emerald-500 leading-relaxed font-semibold mt-1">
                        Parabéns! Suas moedas estão desbloqueadas para saque via PIX.
                      </p>
                    )}
                  </div>
                </div>

                {/* History Section */}
                <div className="flex flex-col gap-4">
                  <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-900 pb-2">Histórico de Transações</h3>
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between py-3 border-b border-zinc-900">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full border border-zinc-800 text-zinc-400 shrink-0">
                          <CheckCircle className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col text-left">
                          <span className="text-sm font-bold text-zinc-200">Moedas Iniciais</span>
                          <span className="text-[10px] text-zinc-550">Bônus de boas-vindas do app</span>
                        </div>
                      </div>
                      <span className="text-white font-black text-sm">+🪙 1.000</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Store Tab (New Loja Route) */}
          {activeTab === 'store' && (
            <div className="flex-1 min-h-screen border-r border-zinc-800 bg-black min-w-0">
              <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-zinc-800 px-4 py-4">
                <h2 className="text-lg font-bold text-white text-left">Loja de Moedas</h2>
              </div>
              <div className="p-4 flex flex-col gap-6 text-left animate-fade-in font-medium">
                
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm text-zinc-400">
                    Compre pacotes de moedas virtuais via PIX para realizar palpites e gerenciar wagers no Predix.
                  </p>
                </div>

                {loadingPix ? (
                  /* Loading Spinner */
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <RefreshCw className="w-8 h-8 text-sky-400 animate-spin" />
                    <span className="text-xs font-bold text-zinc-400">Gerando cobrança PIX no Mercado Pago...</span>
                  </div>
                ) : !checkoutPackage ? (
                  /* Packages Grid */
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    
                    {/* Starter */}
                    <div className="border border-zinc-800 rounded-3xl p-5 flex flex-col justify-between gap-6 bg-transparent hover:border-zinc-700 transition-all duration-150 text-center">
                      <div className="flex flex-col gap-1">
                        <span className="text-2xl font-black text-white">🪙 50</span>
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Pacote Starter</span>
                        <p className="text-zinc-500 text-xs mt-2 leading-relaxed">Ideal para iniciantes no mercado de fofocas.</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="text-lg font-black text-white">R$ 5,00</div>
                        <button
                          onClick={() => handleSelectStorePackage({ name: 'Starter', coins: 50, price: 5 })}
                          className="w-full py-2.5 rounded-full bg-white text-black font-extrabold text-xs cursor-pointer hover:bg-zinc-200 transition-all duration-150"
                        >
                          Comprar via PIX
                        </button>
                      </div>
                    </div>

                    {/* Bronze */}
                    <div className="border border-zinc-800 rounded-3xl p-5 flex flex-col justify-between gap-6 bg-transparent hover:border-zinc-700 transition-all duration-150 text-center">
                      <div className="flex flex-col gap-1">
                        <span className="text-2xl font-black text-white">🪙 100</span>
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Pacote Bronze</span>
                        <p className="text-zinc-500 text-xs mt-2 leading-relaxed">Para quem quer começar a testar teorias.</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="text-lg font-black text-white">R$ 10,00</div>
                        <button
                          onClick={() => handleSelectStorePackage({ name: 'Bronze', coins: 100, price: 10 })}
                          className="w-full py-2.5 rounded-full bg-white text-black font-extrabold text-xs cursor-pointer hover:bg-zinc-200 transition-all duration-150"
                        >
                          Comprar via PIX
                        </button>
                      </div>
                    </div>

                    {/* Prata */}
                    <div className="border border-sky-500/20 rounded-3xl p-5 flex flex-col justify-between gap-6 bg-sky-950/5 hover:border-sky-500/40 transition-all duration-150 text-center relative">
                      <div className="absolute top-3 right-3 bg-sky-500 text-black text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full">Popular</div>
                      <div className="flex flex-col gap-1">
                        <span className="text-2xl font-black text-white">🪙 200</span>
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Pacote Prata</span>
                        <p className="text-zinc-500 text-xs mt-2 leading-relaxed">Para quem aposta sério e quer maximizar lucros.</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="text-lg font-black text-white">R$ 20,00</div>
                        <button
                          onClick={() => handleSelectStorePackage({ name: 'Prata', coins: 200, price: 20 })}
                          className="w-full py-2.5 rounded-full bg-white text-black font-extrabold text-xs cursor-pointer hover:bg-zinc-200 transition-all duration-150"
                        >
                          Comprar via PIX
                        </button>
                      </div>
                    </div>

                  </div>
                ) : (
                  /* Store Checkout */
                  <div className="border border-zinc-800 rounded-3xl p-6 bg-transparent flex flex-col gap-5 max-w-md mx-auto w-full animate-scale-up">
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                      <div className="flex items-center gap-2">
                        <QrCode className="w-5 h-5 text-sky-400" />
                        <h3 className="font-extrabold text-white">Checkout Pix</h3>
                      </div>
                      <button
                        onClick={() => setCheckoutPackage(null)}
                        className="text-zinc-500 hover:text-white text-xs cursor-pointer hover:underline"
                      >
                        Cancelar
                      </button>
                    </div>

                    <div className="flex justify-between items-center bg-zinc-950 p-4 rounded-2xl border border-zinc-850">
                      <div>
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Pacote Selecionado</span>
                        <span className="text-sm font-black text-white">🪙 {checkoutPackage.coins} ({checkoutPackage.name})</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Total a pagar</span>
                        <span className="text-sm font-black text-sky-455">R$ {checkoutPackage.price.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* QR Code Real/Mock Display */}
                    <div className="bg-white p-4 rounded-2xl flex flex-col items-center justify-center border border-zinc-800 w-44 h-44 mx-auto select-none gap-2">
                      {checkoutPackage.qrCodeBase64 ? (
                        <img 
                          src={`data:image/jpeg;base64,${checkoutPackage.qrCodeBase64}`} 
                          alt="QR Code PIX" 
                          className="w-32 h-32 object-contain"
                        />
                      ) : (
                        <QrCode className="w-28 h-28 text-black stroke-[1.5]" />
                      )}
                      <span className="text-[9px] text-zinc-550 font-bold uppercase tracking-wider">Escaneie o QR Code</span>
                    </div>

                    {/* Pix key Copy container */}
                    <div className="flex flex-col gap-1.5 text-left">
                      <span className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider">PIX Copia e Cola</span>
                      <div className="flex items-center bg-zinc-950 border border-zinc-850 rounded-xl p-2">
                        <span className="text-[11px] font-mono text-zinc-400 truncate flex-1 pr-3">
                          {checkoutPackage.qrCode}
                        </span>
                        <button
                          onClick={handleCopyPixKey}
                          className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white cursor-pointer shrink-0 transition-all duration-150"
                        >
                          {copiedPix ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Button */}
                    <button
                      onClick={handleConfirmStorePayment}
                      disabled={confirmingPayment}
                      className="w-full py-3 rounded-full bg-white text-black font-extrabold text-sm hover:bg-zinc-200 disabled:opacity-40 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {confirmingPayment ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Processando Pagamento (3s)...</span>
                        </>
                      ) : (
                        <span>Confirmar Pagamento</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Profile Tab with editing modal & bets logs */}
          {activeTab === 'profile' && (
            <div className="flex-1 min-h-screen border-r border-zinc-800 bg-black min-w-0">
              <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-zinc-800 px-4 py-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white text-left">Perfil</h2>
                
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-zinc-800 text-xs font-bold text-zinc-400 hover:text-white hover:border-zinc-700 transition-all duration-150 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sair</span>
                </button>
              </div>
              <div className="p-4 flex flex-col gap-6 text-left animate-fade-in font-medium">
                
                {/* Profile Header Card */}
                <div className="p-5 rounded-2xl bg-transparent border border-zinc-800 flex flex-col gap-5 relative">
                  
                  {/* Edit profile toggler */}
                  <button
                    onClick={() => setIsEditingProfile(!isEditingProfile)}
                    className="absolute top-4 right-4 flex items-center gap-1 px-3 py-1.5 rounded-full border border-zinc-800 text-[10px] font-extrabold text-zinc-400 hover:text-white hover:border-zinc-700 transition-all duration-150 cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>{isEditingProfile ? 'Cancelar' : 'Editar Perfil'}</span>
                  </button>

                  {!isEditingProfile ? (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <img
                            src={activeAvatar}
                            alt="Avatar"
                            className="w-16 h-16 rounded-full object-cover border border-zinc-800 shrink-0"
                          />
                          <div className="flex flex-col text-left">
                            <h3 className="text-lg font-extrabold text-white">{activeName}</h3>
                            <span className="text-zinc-550 text-xs font-mono">{activeHandle}</span>
                            <div className="flex items-center gap-1.5 mt-1 bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded-full w-fit">
                              <Star className="w-3 h-3 text-zinc-350 fill-zinc-350" />
                              <span className="text-[10px] font-bold text-zinc-400">Classificação: Trader</span>
                            </div>
                          </div>
                        </div>

                        {/* Starting stats - Zeroed out for new users */}
                        <div className="flex items-center gap-2">
                          <div className="border border-zinc-800 px-3 py-1.5 rounded-xl text-center shrink-0">
                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide block">Taxa de Acerto</span>
                            <span className="text-white font-extrabold text-sm">{profile?.win_rate || 0}%</span>
                          </div>
                          <div className="border border-zinc-800 px-3 py-1.5 rounded-xl text-center shrink-0">
                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide block">Apostas Totais</span>
                            <span className="text-white font-extrabold text-sm">{profile?.total_bets || 0}</span>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-zinc-900 pt-3.5">
                        <p className="text-zinc-350 text-xs font-bold uppercase tracking-wider text-zinc-555 mb-1">Biografia</p>
                        <p className="text-zinc-300 text-sm leading-relaxed">
                          {profile?.bio || 'Nenhuma biografia informada.'}
                        </p>
                      </div>
                    </>
                  ) : (
                    /* Inline Edit Profile Form */
                    <form onSubmit={handleSaveProfile} className="flex flex-col gap-4 text-left animate-scale-up">
                      <h4 className="text-sm font-black text-white uppercase tracking-wider mb-2 border-b border-zinc-900 pb-2">Informacoes do Perfil</h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-zinc-450 uppercase">Nome de Exibicao</label>
                          <input
                            type="text"
                            value={editDisplayName}
                            onChange={(e) => setEditDisplayName(e.target.value)}
                            className="bg-black border border-zinc-800 focus:border-sky-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-bold"
                            placeholder="Nome de Exibição"
                            required
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-zinc-450 uppercase">Handle/Username</label>
                          <input
                            type="text"
                            value={editUsername}
                            onChange={(e) => setEditUsername(e.target.value)}
                            className="bg-black border border-zinc-800 focus:border-sky-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-bold"
                            placeholder="username"
                            required
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-zinc-450 uppercase">URL do Avatar</label>
                        <input
                          type="text"
                          value={editAvatarUrl}
                          onChange={(e) => setEditAvatarUrl(e.target.value)}
                          className="bg-black border border-zinc-800 focus:border-sky-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-bold"
                          placeholder="https://exemplo.com/sua-foto.jpg"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-zinc-450 uppercase">Biografia</label>
                        <textarea
                          value={editBio}
                          onChange={(e) => setEditBio(e.target.value)}
                          className="bg-black border border-zinc-800 focus:border-sky-500 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none font-bold min-h-[80px]"
                          placeholder="Escreva algo sobre você..."
                        />
                      </div>

                      <button
                        type="submit"
                        className="px-4 py-2.5 mt-2 rounded-full bg-white text-black font-extrabold text-xs cursor-pointer hover:bg-zinc-200 transition-all text-center"
                      >
                        Salvar Alterações
                      </button>
                    </form>
                  )}
                </div>

                {/* Dashboard Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-transparent border border-zinc-800 flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-zinc-555 uppercase tracking-widest">Ganhos Totais</span>
                      <span className="text-white text-xl font-black mt-1">
                        {profile?.total_earnings >= 0 ? `+🪙 ${profile.total_earnings}` : `-🪙 ${Math.abs(profile.total_earnings)}`}
                      </span>
                    </div>
                    <BarChart2 className="text-zinc-400 w-6 h-6 opacity-80" />
                  </div>

                  <div className="p-4 rounded-2xl bg-transparent border border-zinc-800 flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-zinc-555 uppercase tracking-widest">Previsões Criadas</span>
                      <span className="text-white text-xl font-black mt-1">{predictions.filter(p => p.authorId === session?.uid).length}</span>
                    </div>
                    <Award className="text-zinc-400 w-6 h-6 opacity-85" />
                  </div>
                </div>

                {/* Minhas Apostas (Bets Timeline History Feed) */}
                <div className="flex flex-col gap-4 mt-2">
                  <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-900 pb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-zinc-550" />
                    <span>Minhas Apostas ({myBets.length})</span>
                  </h3>
                  
                  {myBets.length === 0 ? (
                    <p className="text-zinc-555 text-xs text-center py-6">Você ainda não realizou apostas em previsões.</p>
                  ) : (
                    <div className="flex flex-col border border-zinc-900 rounded-2xl overflow-hidden divide-y divide-zinc-900">
                      {myBets.map((bet) => (
                        <div key={bet.id} className="p-4 bg-zinc-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
                          <div className="flex flex-col gap-1">
                            <span className="text-white text-xs font-extrabold leading-normal">{bet.question}</span>
                            <span className="text-[10px] text-zinc-550 font-medium">
                              Apostou no <span className={bet.choice ? 'text-sky-400 font-bold' : 'text-zinc-300 font-bold'}>{bet.choice ? 'SIM' : 'NÃO'}</span>
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-black text-white">🪙 {bet.amount.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

        </main>

        {/* Right Sidebar */}
        <RightSidebar onTrendClick={handleTrendClick} />
      </div>



      {/* Persistent Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default App;
