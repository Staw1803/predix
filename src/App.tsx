import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Feed from './components/Feed';
import RightSidebar from './components/RightSidebar';
import Toast from './components/Toast';
import Auth from './components/Auth';

import { auth, db, isFirebaseConfigured } from './firebaseClient';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { 
  LogOut, 
  Edit2,
  Calendar,
  QrCode,
  Copy,
  Check,
  RefreshCw
} from 'lucide-react';

function App() {
  // Firebase Session States
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isOfflineSandbox, setIsOfflineSandbox] = useState<boolean>(!isFirebaseConfigured);

  // App States (credits are hard-frozen to 0)
  const [balance, setBalance] = useState<number>(0); 
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

  // 2. Fetch User doc from Cloud Firestore
  const fetchUserProfile = async (userId: string) => {
    try {
      const docRef = doc(db, 'users', userId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Se o campo credits não existir no banco, inicializa com 0
        if (data.credits === undefined) {
          await updateDoc(docRef, { credits: 0 });
          data.credits = 0;
        }

        setProfile(data);
        setBalance(data.credits);
        
        // Populate inputs for Profile Editing
        setEditDisplayName(data.displayName || '');
        setEditUsername(data.username || '');
        setEditBio(data.bio || '');
        setEditAvatarUrl(data.photoURL || '');
      } else {
        // Auto-create missing user in database to heal old or partial session states
        const usernameVal = session?.email?.split('@')[0] || 'user';
        const fallbackProfile = {
          id: userId,
          username: usernameVal.startsWith('@') ? usernameVal : `@${usernameVal}`,
          displayName: session?.displayName || usernameVal,
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

  // Initial local sandbox loads when offline
  useEffect(() => {
    if (isOfflineSandbox) {
      setBalance(0);
    }
  }, [isOfflineSandbox]);

  // 10. Profile Image local uploader with canvas compression helper
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setToast({ message: 'Por favor, selecione um arquivo de imagem válido.', type: 'error' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const max_size = 120;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > max_size) {
            height *= max_size / width;
            width = max_size;
          }
        } else {
          if (height > max_size) {
            width *= max_size / height;
            width = max_size;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
        setEditAvatarUrl(compressedBase64);
      };
    };
    reader.readAsDataURL(file);
  };

  // 11. Profile Update handler
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.uid) return;
    
    try {
      const userRef = doc(db, 'users', session.uid);
      const cleanUsername = editUsername.replace(/[@\s]+/g, '').toLowerCase();
      const finalUsername = `@${cleanUsername}`;
      
      await updateDoc(userRef, {
        displayName: editDisplayName,
        username: finalUsername,
        photoURL: editAvatarUrl,
        bio: editBio
      });
      
      setProfile((prev: any) => ({
        ...prev,
        displayName: editDisplayName,
        username: finalUsername,
        photoURL: editAvatarUrl,
        bio: editBio
      }));
      
      setIsEditingProfile(false);
      setToast({ message: 'Perfil atualizado com sucesso!', type: 'success' });
    } catch (err: any) {
      setToast({ message: `Erro ao salvar perfil: ${err.message}`, type: 'error' });
    }
  };

  // 12. Logout Handler
  const handleLogout = async () => {
    if (!isOfflineSandbox) {
      try {
        await signOut(auth);
        setToast({ message: 'Logout efetuado com sucesso!', type: 'success' });
      } catch (err: any) {
        setToast({ message: `Erro ao sair: ${err.message}`, type: 'error' });
      }
    } else {
      setSession(null);
      setProfile(null);
      setToast({ message: 'Logout efetuado (Modo Sandbox)!', type: 'success' });
    }
  };

  // 13. Store / Checkout Handlers (Efí Bank Pix)
  const handleSelectStorePackage = async (pkg: { name: string; coins: number; price: number }) => {
    setLoadingPix(true);
    setCheckoutPackage(null);

    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
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
          qrCodeBase64: data.qrCodeImage
        });
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

  const handleConfirmStorePayment = async () => {
    if (!checkoutPackage) return;
    setConfirmingPayment(true);

    try {
      const addedCoins = checkoutPackage.coins;
      const finalBalance = balance + addedCoins;

      if (!isOfflineSandbox && session?.uid) {
        const userRef = doc(db, 'users', session.uid);
        await updateDoc(userRef, { 
          credits: finalBalance
        });
        setProfile((prev: any) => ({ ...prev, credits: finalBalance }));
      }
      
      setBalance(finalBalance);
      setToast({
        message: `Pagamento Pix confirmado! (🪙 +${addedCoins.toLocaleString()}).`,
        type: 'success',
      });
      setCheckoutPackage(null);
    } catch (err: any) {
      setToast({ message: `Erro ao registrar saldo no Firebase: ${err.message}`, type: 'error' });
    } finally {
      setConfirmingPayment(false);
    }
  };

  // Active User Identifiers
  const activeName = profile?.displayName || (session ? session.displayName || session.email.split('@')[0] : 'Usuário');
  const activeHandle = profile?.username ? (profile.username.startsWith('@') ? profile.username : `@${profile.username}`) : (session ? `@${session.email.split('@')[0]}` : '@usuario');
  const activeAvatar = profile?.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';

  // Strict Auth Redirection Lock
  if (!session && !isOfflineSandbox) {
    return <Auth onLoginSimulated={() => setIsOfflineSandbox(true)} setToast={setToast} />;
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex justify-center selection:bg-sky-500 selection:text-black">
      <div className="w-full max-w-7xl flex relative">
        
        {/* Left Sidebar */}
        <Sidebar
          credits={balance}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          username={activeName}
          userHandle={activeHandle}
          userAvatar={activeAvatar}
        />

        {/* Center Main Scroll Container */}
        <main className="flex-1 min-w-0 min-h-screen pl-20 md:pl-0 flex flex-col">
          
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
                    Compre pacotes de moedas virtuais via PIX para destacar suas postagens e interações no Predix.
                  </p>
                </div>

                {loadingPix ? (
                  /* Loading Spinner */
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <RefreshCw className="w-8 h-8 text-sky-400 animate-spin" />
                    <span className="text-xs font-bold text-zinc-400">Gerando cobrança PIX na Efí Bank...</span>
                  </div>
                ) : !checkoutPackage ? (
                  /* Packages Grid */
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    
                    {/* Starter */}
                    <div className="border border-zinc-800 rounded-3xl p-5 flex flex-col justify-between gap-6 bg-transparent hover:border-zinc-700 transition-all duration-150 text-center">
                      <div className="flex flex-col gap-1">
                        <span className="text-2xl font-black text-white">🪙 100</span>
                        <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider">Pacote Starter</span>
                        <p className="text-zinc-500 text-xs mt-2 leading-relaxed">Ideal para começar e fazer posts simples.</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="text-lg font-black text-white">R$ 10,00</div>
                        <button
                          onClick={() => handleSelectStorePackage({ name: 'Starter', coins: 100, price: 10 })}
                          className="w-full py-2.5 rounded-full bg-white text-black font-extrabold text-xs cursor-pointer hover:bg-zinc-200 transition-all duration-150"
                        >
                          Comprar via PIX
                        </button>
                      </div>
                    </div>

                    {/* Pro */}
                    <div className="border border-sky-500/20 rounded-3xl p-5 flex flex-col justify-between gap-6 bg-sky-950/5 hover:border-sky-500/40 transition-all duration-150 text-center relative">
                      <div className="absolute top-3 right-3 bg-sky-500 text-black text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full">Popular</div>
                      <div className="flex flex-col gap-1">
                        <span className="text-2xl font-black text-white">🪙 500</span>
                        <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider">Pacote Pro</span>
                        <p className="text-zinc-500 text-xs mt-2 leading-relaxed">Perfeito para usuários ativos no feed.</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="text-lg font-black text-white">R$ 45,00</div>
                        <button
                          onClick={() => handleSelectStorePackage({ name: 'Pro', coins: 500, price: 45 })}
                          className="w-full py-2.5 rounded-full bg-white text-black font-extrabold text-xs cursor-pointer hover:bg-zinc-200 transition-all duration-150"
                        >
                          Comprar via PIX
                        </button>
                      </div>
                    </div>

                    {/* Whale */}
                    <div className="border border-zinc-800 rounded-3xl p-5 flex flex-col justify-between gap-6 bg-transparent hover:border-zinc-700 transition-all duration-150 text-center">
                      <div className="flex flex-col gap-1">
                        <span className="text-2xl font-black text-white">🪙 1000</span>
                        <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider">Pacote Whale</span>
                        <p className="text-zinc-500 text-xs mt-2 leading-relaxed">Para quem quer apoiar ao máximo a nossa rede.</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="text-lg font-black text-white">R$ 80,00</div>
                        <button
                          onClick={() => handleSelectStorePackage({ name: 'Whale', coins: 1000, price: 80 })}
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
                        <span className="text-sm font-black text-white">🪙 {checkoutPackage.coins} ({checkoutPackage.name})</span>
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

          {/* Profile Tab with editing form */}
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
                <div className="p-5 rounded-2xl bg-transparent border border-zinc-800 flex flex-col gap-4">
                  
                  {!isEditingProfile ? (
                    <>
                      {/* Avatar & Edit Profile Action Row */}
                      <div className="flex justify-between items-start gap-4">
                        <img
                          src={activeAvatar}
                          alt="Avatar"
                          className="w-16 h-16 rounded-full object-cover border border-zinc-800 shrink-0"
                        />
                        <button
                          onClick={() => setIsEditingProfile(true)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-zinc-800 text-xs font-black text-white hover:bg-zinc-900 transition-all duration-150 cursor-pointer shrink-0"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Editar Perfil</span>
                        </button>
                      </div>

                      {/* Display & Handle Info */}
                      <div className="flex flex-col text-left mt-1">
                        <h3 className="text-xl font-black text-white leading-none">{activeName}</h3>
                        <span className="text-zinc-500 text-xs font-mono mt-1">{activeHandle}</span>
                      </div>

                      {/* Bio */}
                      <div className="border-t border-zinc-900 pt-3.5">
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Biografia</p>
                        <p className="text-zinc-300 text-sm leading-relaxed">
                          {profile?.bio || 'Nenhuma biografia informada.'}
                        </p>
                      </div>
                    </>
                  ) : (
                    /* Inline Edit Profile Form */
                    <form onSubmit={handleSaveProfile} className="flex flex-col gap-4 text-left animate-scale-up">
                      <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                        <h4 className="text-sm font-black text-white uppercase tracking-wider">Informações do Perfil</h4>
                        <button
                          type="button"
                          onClick={() => setIsEditingProfile(false)}
                          className="text-zinc-500 hover:text-white text-xs cursor-pointer hover:underline"
                        >
                          Cancelar
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase">Nome de Exibição</label>
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
                          <label className="text-[10px] font-bold text-zinc-500 uppercase">Handle/Username</label>
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

                      {/* Local File Upload Picker */}
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Foto de Perfil (Upload Local)</label>
                        <div className="flex items-center gap-4">
                          <img
                            src={editAvatarUrl || activeAvatar}
                            alt="Pre-visualização"
                            className="w-12 h-12 rounded-full object-cover border border-zinc-800 shrink-0"
                          />
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="text-xs text-zinc-555 file:mr-4 file:py-1.5 file:px-3 file:rounded-full file:border file:border-zinc-800 file:text-[10px] file:font-black file:bg-zinc-950 file:text-white hover:file:bg-zinc-900 file:cursor-pointer"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Biografia</label>
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

                {/* Minhas Publicações placeholder */}
                <div className="flex flex-col gap-4 mt-2">
                  <h3 className="text-xs font-black text-zinc-555 uppercase tracking-widest border-b border-zinc-900 pb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-zinc-550" />
                    <span>Publicações</span>
                  </h3>
                  <p className="text-zinc-500 text-xs text-center py-10 font-bold">
                    Seu perfil social está configurado e ativo. Suas novas postagens aparecerão no feed geral em tempo real!
                  </p>
                </div>

              </div>
            </div>
          )}

        </main>

        {/* Right Sidebar */}
        <RightSidebar />
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
