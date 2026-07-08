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
  Calendar
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
        
        // Todo usuário recém-registrado ou existente deve ter o campo credits: 0 no banco de dados.
        if (data.credits !== 0) {
          await updateDoc(docRef, { credits: 0 });
          data.credits = 0;
        }

        setProfile(data);
        setBalance(0);
        
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
                credits: 0
              } : null}
              setToast={setToast}
            />
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
