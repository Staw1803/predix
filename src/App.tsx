import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Feed from './components/Feed';
import RightSidebar from './components/RightSidebar';
import Toast from './components/Toast';
import Auth from './components/Auth';
import WalletTab from './components/WalletTab';
import ProfilePage from './components/ProfilePage';
import PredictionsTab from './components/PredictionsTab';

import { auth, db, isFirebaseConfigured } from './firebaseClient';
import { MOEDA_VALOR_REAL } from './constants';
import { onAuthStateChanged, signOut, getRedirectResult } from 'firebase/auth';
import { generateUniqueUsername } from './utils';
import { 
  doc, 
  getDoc, 
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { 
  QrCode,
  Copy,
  Check,
  RefreshCw,
  Coins
} from 'lucide-react';

function App() {
  // Firebase Session States
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  // App States (credits are hard-frozen to 0)
  const [balance, setBalance] = useState<number>(0); 
  const [activeTab, setActiveTab] = useState<string>('feed');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);

  const navigateToProfile = (userId: string) => {
    setViewingUserId(userId);
    setActiveTab('profile');
  };

  const handleTabChange = (tab: string) => {
    if (tab === 'profile') {
      setViewingUserId(null); // defaults to own profile
    }
    setActiveTab(tab);
  };

  // Store & Checkout States
  const [checkoutPackage, setCheckoutPackage] = useState<{ name: string; coins: number; price: number; qrCode: string; qrCodeBase64: string; txid: string } | null>(null);
  const [loadingPix, setLoadingPix] = useState<boolean>(false);
  const [copiedPix, setCopiedPix] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(900); // 15 minutes (900 seconds)





  // 1. Firebase Auth Listener
  useEffect(() => {
    if (!isFirebaseConfigured) return;

    // A. Auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setSession(user);
      } else {
        setSession(null);
        setProfile(null);
      }
    });

    // B. Handle OAuth Redirect Returns
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          const user = result.user;
          const userRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(userRef);
          
          if (!docSnap.exists()) {
            const baseVal = user.displayName || user.email?.split('@')[0] || 'user';
            const usernameVal = await generateUniqueUsername(baseVal);
            const initialProfile = {
              id: user.uid,
              username: usernameVal,
              displayName: user.displayName || baseVal,
              photoURL: user.photoURL || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80`,
              credits: 0
            };
            await setDoc(userRef, initialProfile);
            setProfile(initialProfile);
          }
        }
      })
      .catch((err) => {
        console.error('Error handling redirect result:', err);
        setToast({ message: `Erro no login Google: ${err.message}`, type: 'error' });
      });

    return () => unsubscribe();
  }, []);

  // 2. Fetch User doc from Cloud Firestore
  const fetchUserProfile = async (userId: string) => {
    try {
      const docRef = doc(db, 'users', userId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Se o campo credits nÃ£o existir no banco, inicializa com 0
        if (data.credits === undefined) {
          await updateDoc(docRef, { credits: 0 });
          data.credits = 0;
        }

        setProfile(data);
        setBalance(data.credits);
        
      } else {
        // Auto-create missing user in database to heal old or partial session states
        const baseVal = session?.displayName || session?.email?.split('@')[0] || 'user';
        const usernameVal = await generateUniqueUsername(baseVal);
        const fallbackProfile = {
          id: userId,
          username: usernameVal,
          displayName: session?.displayName || baseVal,
          photoURL: session?.photoURL || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80`,
          credits: 0
        };

        // Write the new document to Firestore
        await setDoc(doc(db, 'users', userId), fallbackProfile);

        setProfile(fallbackProfile);
        setBalance(0);
      }
    } catch (err: any) {
      console.error('Error fetching profile:', err.message);
      setToast({ 
        message: `Erro de Banco de Dados: ${err.message}. Verifique se ativou as Regras do Firestore (Rules) no seu console.`, 
        type: 'error' 
      });
    }
  };

  // Sync profile on session updates
  useEffect(() => {
    if (session?.uid) {
      fetchUserProfile(session.uid);
    }
  }, [session]);

  // Trigger serverless bot activity in background (handled by server rate-limits)
  useEffect(() => {
    const triggerBot = async () => {
      if (!session) return;
      try {
        const idToken = await auth.currentUser?.getIdToken();
        const res = await fetch('/api/cron-bot', {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });
        const data = await res.json();
        if (data.status === 'success') {
          console.log("Bot automation completed successfully:", data.message);
        }
      } catch (err) {
        console.error("Error triggering bot:", err);
      }
    };
    triggerBot();
  }, [session]);




  // 12. Logout Handler
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setToast({ message: 'Logout efetuado com sucesso!', type: 'success' });
    } catch (err: any) {
      setToast({ message: `Erro ao sair: ${err.message}`, type: 'error' });
    }
  };

  // 13. Store / Checkout Handlers (Efí Bank Pix)
  const handleSelectStorePackage = async (pkg: { name: string; coins: number; price: number }) => {
    setLoadingPix(true);
    setCheckoutPackage(null);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          transaction_amount: pkg.price,
          description: `Recarga Predix - ${pkg.coins} moedas`
        })
      });

      const data = await response.json();

      if (response.ok && data.pixCopiaECola) {
        setCheckoutPackage({
          name: pkg.name,
          coins: pkg.coins,
          price: pkg.price,
          qrCode: data.pixCopiaECola,
          qrCodeBase64: data.qrCodeImage,
          txid: data.txid
        });
        setTimeLeft(900); // Reset countdown to 15 mins
        setToast({ message: 'PIX gerado via Efí Bank!', type: 'success' });
      } else {
        throw new Error(data.error || 'Falha ao processar pagamento com a Efí');
      }
    } catch (err: any) {
      console.error('Checkout network/API error:', err);
      setToast({ 
        message: `Erro no Checkout: ${err.message || 'Falha de conexão com a Efí.'}`, 
        type: 'error' 
      });
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

  // 14. Polling & Countdown Timer Effect for checkout validation
  useEffect(() => {
    if (!checkoutPackage) {
      setTimeLeft(900);
      return;
    }

    // A. Countdown Timer Interval
    const timerInterval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerInterval);
          setCheckoutPackage(null);
          setToast({ message: 'O tempo limite para pagamento do PIX (15 minutos) expirou.', type: 'error' });
          return 900;
        }
        return prev - 1;
      });
    }, 1000);

    // B. Polling Interval (checks payment status in Efí every 5 seconds)
    const pollInterval = setInterval(async () => {
      try {
        const idToken = await auth.currentUser?.getIdToken();
        const response = await fetch(`/api/check-payment?txid=${checkoutPackage.txid}`, {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'CONCLUIDA') {
            clearInterval(timerInterval);
            clearInterval(pollInterval);
            
            // Calculate coins based on fixed conversion rate
            const addedCoins = Math.floor(checkoutPackage.price / MOEDA_VALOR_REAL);
            const finalBalance = balance + addedCoins;

            if (session?.uid) {
              const userRef = doc(db, 'users', session.uid);
              await updateDoc(userRef, { 
                credits: finalBalance
              });
              setProfile((prev: any) => ({ ...prev, credits: finalBalance }));
            }
            
            setBalance(finalBalance);
            setToast({
              message: `Pagamento Pix confirmado! (+${addedCoins.toLocaleString()} liberado).`,
              type: 'success',
            });
            setCheckoutPackage(null);
          }
        }
      } catch (err) {
        console.error('Error polling payment status:', err);
      }
    }, 5000);

    return () => {
      clearInterval(timerInterval);
      clearInterval(pollInterval);
    };
  }, [checkoutPackage, balance, session]);

  // Active User Identifiers
  const activeName = profile?.displayName || (session ? session.displayName || session.email.split('@')[0] : 'Usuário');
  const activeHandle = profile?.username ? (profile.username.startsWith('@') ? profile.username : `@${profile.username}`) : (session ? `@${session.email.split('@')[0]}` : '@usuario');
  const activeAvatar = profile?.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';

  // Maintenance Mode Override (Change to false to put the site back online)
  const IS_MAINTENANCE_MODE = true;

  if (IS_MAINTENANCE_MODE) {
    return (
      <div className="min-h-screen w-full bg-black text-zinc-100 flex flex-col items-center justify-center p-6 select-none font-sans">
        <h1 className="text-base font-black tracking-widest text-white uppercase mb-1">PREDIX ESTÁ OFFLINE</h1>
        <p className="text-[10px] text-zinc-550 font-extrabold uppercase tracking-widest">MANUTENÇÃO</p>
      </div>
    );
  }

  // Strict Auth Redirection Lock
  if (!session) {
    return <Auth setToast={setToast} />;
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex justify-center selection:bg-sky-500 selection:text-black">
      <div className="w-full max-w-7xl flex relative">
        
        {/* Left Sidebar */}
        <Sidebar
          credits={balance}
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          username={activeName}
          userHandle={activeHandle}
          userAvatar={activeAvatar}
        />

        {/* Center Main Scroll Container */}
        <main className="flex-1 min-w-0 min-h-screen pb-20 md:pb-0 flex flex-col">
          
          {/* Feed Tab */}
          {activeTab === 'feed' && (
            <Feed
              currentUser={profile ? {
                id: profile.id,
                displayName: profile.displayName || activeName,
                username: profile.username || activeHandle,
                photoURL: activeAvatar,
                credits: balance
              } : null}
              setToast={setToast}
              onUserClick={navigateToProfile}
            />
          )}

          {/* Predictions Tab */}
          {activeTab === 'predictions' && (
            <div className="flex-1 min-h-screen border-r border-zinc-800 bg-black min-w-0 flex flex-col">
              <PredictionsTab
                session={session}
                profile={profile}
                balance={balance}
                setToast={setToast}
                onBalanceUpdate={(newBal) => {
                  setBalance(newBal);
                  setProfile((prev: any) => ({ ...prev, credits: newBal }));
                }}
              />
            </div>
          )}

          {/* Wallet Tab */}
          {activeTab === 'wallet' && (
            <WalletTab
              balance={balance}
              userId={session?.uid || null}
              setToast={setToast}
              onBalanceUpdate={(newBal) => {
                setBalance(newBal);
                setProfile((prev: any) => ({ ...prev, credits: newBal }));
              }}
            />
          )}

          {/* Store Tab (New Loja Route) */}
          {activeTab === 'store' && (
            <div className="flex-1 min-h-screen border-r border-zinc-800 bg-black min-w-0 animate-fade-in">
              <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-zinc-800 px-4 py-4">
                <h2 className="text-lg font-bold text-white text-left font-black tracking-tight">Loja de Moedas</h2>
              </div>
              <div className="p-4 flex flex-col gap-6 text-left font-medium">
                
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm text-zinc-400">
                    Compre pacotes de moedas virtuais via PIX para destacar suas postagens e interaÃ§Ãµes no Predix.
                  </p>
                </div>

                {loadingPix ? (
                  /* Loading Spinner */
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <RefreshCw className="w-8 h-8 text-sky-400 animate-spin" />
                    <span className="text-xs font-bold text-zinc-400">Gerando cobranÃ§a PIX na EfÃ­ Bank...</span>
                  </div>
                ) : !checkoutPackage ? (
                  /* Packages Grid */
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    
                    {/* Mini - R$5 */}
                    <div className="border border-zinc-800 rounded-3xl p-5 flex flex-col justify-between gap-6 bg-transparent hover:border-zinc-700 transition-all duration-150 text-center">
                      <div className="flex flex-col gap-1">
                        <h3 className="text-xl font-black text-white text-center tracking-tight flex items-center justify-center gap-1.5"><Coins className="w-5 h-5 text-zinc-350 stroke-[2.2]" /> 50</h3>
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center mt-1">Pacote Mini</p>
                        <p className="text-xs text-zinc-400 text-center mt-4 mb-6 leading-relaxed font-semibold px-2">Perfeito para testar e dar primeiras gorjetas.</p>
                      </div>
                      <div className="mt-auto flex flex-col gap-3">
                        <span className="text-xl font-black text-white text-center">R$ 5,00</span>
                        <button
                          onClick={() => handleSelectStorePackage({ name: 'Mini', coins: 50, price: 5 })}
                          className="w-full py-2.5 rounded-full bg-white text-black font-extrabold text-xs cursor-pointer hover:bg-zinc-200 transition-all duration-150"
                        >
                          Comprar via PIX
                        </button>
                      </div>
                    </div>

                    {/* Starter - R$10 */}
                    <div className="border border-zinc-800 rounded-3xl p-5 flex flex-col justify-between gap-6 bg-transparent hover:border-zinc-700 transition-all duration-150 text-center">
                      <div className="flex flex-col gap-1">
                        <h3 className="text-xl font-black text-white text-center tracking-tight flex items-center justify-center gap-1.5"><Coins className="w-5 h-5 text-zinc-350 stroke-[2.2]" /> 100</h3>
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center mt-1">Pacote Starter</p>
                        <p className="text-xs text-zinc-400 text-center mt-4 mb-6 leading-relaxed font-semibold px-2">Ideal para começar e fazer posts simples.</p>
                      </div>
                      <div className="mt-auto flex flex-col gap-3">
                        <span className="text-xl font-black text-white text-center">R$ 10,00</span>
                        <button
                          onClick={() => handleSelectStorePackage({ name: 'Starter', coins: 100, price: 10 })}
                          className="w-full py-2.5 rounded-full bg-white text-black font-extrabold text-xs cursor-pointer hover:bg-zinc-200 transition-all duration-150"
                        >
                          Comprar via PIX
                        </button>
                      </div>
                    </div>

                    {/* Pro */}
                    <div className="border border-zinc-500 rounded-3xl p-5 flex flex-col justify-between gap-6 bg-zinc-900/20 hover:border-zinc-400 transition-all duration-150 text-center relative overflow-hidden">
                      <div className="absolute top-0 right-0 bg-white px-3 py-1 rounded-bl-xl">
                        <span className="text-[9px] font-black uppercase tracking-wider text-black">Popular</span>
                      </div>
                      <div className="flex flex-col gap-1 mt-4">
                        <h3 className="text-2xl font-black text-white text-center tracking-tight flex items-center justify-center gap-1.5"><Coins className="w-6 h-6 text-zinc-350 stroke-[2.2]" /> 500</h3>
                        <p className="text-[10px] font-black text-zinc-300 uppercase tracking-widest text-center mt-1">Pacote Pro</p>
                        <p className="text-xs text-zinc-400 text-center mt-4 mb-6 leading-relaxed font-semibold px-2">Perfeito para usuários ativos no feed.</p>
                      </div>
                      <div className="mt-auto flex flex-col gap-3">
                        <span className="text-xl font-black text-white text-center">R$ 50,00</span>
                        <button
                          onClick={() => handleSelectStorePackage({ name: 'Pro', coins: 500, price: 50 })}
                          className="w-full py-2.5 rounded-full bg-white text-black font-extrabold text-xs cursor-pointer hover:bg-zinc-200 transition-all duration-150"
                        >
                          Comprar via PIX
                        </button>
                      </div>
                    </div>

                    {/* Whale */}
                    <div className="border border-zinc-800 rounded-3xl p-5 flex flex-col justify-between gap-6 bg-transparent hover:border-zinc-700 transition-all duration-150 text-center">
                      <div className="flex flex-col gap-1">
                        <h3 className="text-3xl font-black text-white text-center tracking-tight flex items-center justify-center gap-1.5"><Coins className="w-7 h-7 text-zinc-350 stroke-[2.2]" /> 1000</h3>
                        <p className="text-[10px] font-black text-white uppercase tracking-widest text-center mt-1">Pacote Whale</p>
                        <p className="text-xs text-zinc-400 text-center mt-4 mb-6 leading-relaxed font-semibold px-2">Para quem quer apoiar ao máximo a nossa rede.</p>
                      </div>
                      <div className="mt-auto flex flex-col gap-3">
                        <span className="text-xl font-black text-white text-center">R$ 100,00</span>
                        <button
                          onClick={() => handleSelectStorePackage({ name: 'Whale', coins: 1000, price: 100 })}
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
                        <span className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider block">Pacote Selecionado</span>
                        <span className="text-sm font-black text-white">ðŸª™ {checkoutPackage.coins} ({checkoutPackage.name})</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-zinc-555 uppercase tracking-wider block">Total a pagar</span>
                        <span className="text-sm font-black text-sky-400">R$ {checkoutPackage.price.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* QR Code Real/Mock Display */}
                    <div className="bg-white p-4 rounded-2xl flex flex-col items-center justify-center border border-zinc-800 w-44 h-44 mx-auto select-none gap-2">
                      <img 
                        src={checkoutPackage.qrCodeBase64} 
                        alt="QR Code PIX" 
                        className="w-32 h-32 object-contain"
                      />
                      <span className="text-[9px] text-zinc-550 font-bold uppercase tracking-wider">Escaneie o QR Code</span>
                    </div>

                    {/* Pix key Copy container */}
                    <div className="flex flex-col gap-1.5 text-left">
                      <span className="text-[10px] font-bold text-zinc-555 uppercase tracking-wider">PIX Copia e Cola</span>
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

                    {/* Polling status & countdown indicator */}
                    <div className="flex flex-col items-center justify-center py-2.5 gap-2.5 border-t border-zinc-900 pt-5 mt-2">
                      <div className="flex items-center gap-2 text-sky-400 font-bold text-xs">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Aguardando pagamento automÃ¡tico...</span>
                      </div>
                      
                      <div className="text-center text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                        O QR Code expira em:{' '}
                        <span className="text-white font-mono text-xs">
                          {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="flex-1 min-h-screen border-r border-zinc-800 bg-black min-w-0 flex flex-col">
              <ProfilePage
                session={session}
                profile={profile}
                balance={balance}
                setToast={setToast}
                onProfileUpdate={(updated) => {
                  setProfile(updated);
                  if (updated.credits !== undefined) setBalance(updated.credits);
                }}
                viewingUserId={viewingUserId}
                onBack={() => setViewingUserId(null)}
                onLogout={handleLogout}
              />
            </div>
          )}

        </main>

        {/* Right Sidebar */}
        <RightSidebar
          currentUserId={session?.uid || null}
          onUserClick={navigateToProfile}
        />
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
