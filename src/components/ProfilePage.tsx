import React, { useState, useRef, useEffect, useCallback } from 'react';
import { db, isFirebaseConfigured } from '../firebaseClient';
import {
  collection, query, where, getDocs, doc, updateDoc,
  onSnapshot, orderBy, increment
} from 'firebase/firestore';
import { Edit2, Camera, Check, X, Loader, Calendar, Coins, ArrowLeft, LogOut } from 'lucide-react';
import AvatarCropModal from './AvatarCropModal';
import PostCard from './PostCard';
import { MOEDA_VALOR_REAL } from '../constants';
import { writeBatch as firestoreWriteBatch, serverTimestamp } from 'firebase/firestore';

interface ProfilePageProps {
  session: any;
  profile: any;
  balance: number;
  setToast: (toast: { message: string; type: 'success' | 'error' } | null) => void;
  onProfileUpdate: (updated: any) => void;
  viewingUserId?: string | null;
  onBack?: () => void;
  onLogout?: () => void;
}

export default function ProfilePage({ session, profile, balance, setToast, onProfileUpdate, viewingUserId, onBack, onLogout }: ProfilePageProps) {
  // Edit states
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Username uniqueness check
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const usernameCheckTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Avatar crop
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [currentAvatar, setCurrentAvatar] = useState<string>('');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Posts
  const [myPosts, setMyPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // Followers/Following
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Visited profile states
  const [viewedProfile, setViewedProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loadingFollow, setLoadingFollow] = useState(false);

  const uid = session?.uid;
  const isOwnProfile = !viewingUserId || viewingUserId === uid;

  const displayName = isOwnProfile 
    ? (profile?.displayName || session?.displayName || 'Usuário')
    : (viewedProfile?.displayName || 'Usuário');
  
  const handle = isOwnProfile
    ? (profile?.username ? (profile.username.startsWith('@') ? profile.username : `@${profile.username}`) : '@usuario')
    : (viewedProfile?.username ? (viewedProfile.username.startsWith('@') ? viewedProfile.username : `@${viewedProfile.username}`) : '@usuario');

  const avatar = isOwnProfile
    ? (currentAvatar || profile?.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80')
    : (viewedProfile?.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80');

  // Fetch visited profile from db
  useEffect(() => {
    if (isOwnProfile) {
      setViewedProfile(profile);
      setFollowersCount(profile?.followersCount || 0);
      setFollowingCount(profile?.followingCount || 0);
      setLoadingProfile(false);
      return;
    }

    if (!isFirebaseConfigured || !viewingUserId) return;

    setLoadingProfile(true);
    const userRef = doc(db, 'users', viewingUserId);
    const unsub = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setViewedProfile(data);
        setFollowersCount(data.followersCount || 0);
        setFollowingCount(data.followingCount || 0);
      }
      setLoadingProfile(false);
    });

    return () => unsub();
  }, [viewingUserId, profile, isOwnProfile]);

  // Fetch real-time follow status
  useEffect(() => {
    if (isOwnProfile || !uid || !viewingUserId || !isFirebaseConfigured) {
      setIsFollowing(false);
      return;
    }

    const followRef = doc(db, 'follows', `${uid}_${viewingUserId}`);
    const unsub = onSnapshot(followRef, (docSnap) => {
      setIsFollowing(docSnap.exists());
    });

    return () => unsub();
  }, [uid, viewingUserId, isOwnProfile]);

  // Init edit fields when profile loads
  useEffect(() => {
    if (profile && isOwnProfile) {
      setEditName(profile.displayName || '');
      setEditUsername(profile.username?.replace('@', '') || '');
      setEditBio(profile.bio || '');
      setCurrentAvatar(profile.photoURL || '');
    }
  }, [profile, isOwnProfile]);

  // Fetch posts in real-time
  useEffect(() => {
    const targetUid = isOwnProfile ? uid : viewingUserId;
    if (!targetUid || !isFirebaseConfigured) {
      setMyPosts([]);
      setLoadingPosts(false);
      return;
    }
    const q = query(collection(db, 'posts'), where('authorId', '==', targetUid), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setMyPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingPosts(false);
    }, err => {
      console.error(err);
      setLoadingPosts(false);
    });
    return () => unsub();
  }, [uid, viewingUserId, isOwnProfile]);

  // Debounced username uniqueness check
  const checkUsername = useCallback(async (value: string) => {
    const clean = value.replace(/[@\s]+/g, '').toLowerCase();
    if (!clean || clean === (profile?.username || '').replace('@', '').toLowerCase()) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    try {
      const q = query(collection(db, 'users'), where('username', '==', `@${clean}`));
      const snap = await getDocs(q);
      const taken = snap.docs.some(d => d.id !== uid);
      setUsernameStatus(taken ? 'taken' : 'available');
    } catch {
      setUsernameStatus('idle');
    }
  }, [uid, profile]);

  const handleUsernameChange = (val: string) => {
    setEditUsername(val);
    setUsernameStatus('checking');
    if (usernameCheckTimeout.current) clearTimeout(usernameCheckTimeout.current);
    usernameCheckTimeout.current = setTimeout(() => checkUsername(val), 600);
  };

  // Avatar file selection → open crop modal
  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setToast({ message: 'Selecione um arquivo de imagem válido.', type: 'error' }); return; }
    const reader = new FileReader();
    reader.onload = ev => setCropSrc(ev.target?.result as string);
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  // After crop completes
  const handleCropComplete = async (url: string) => {
    setCropSrc(null);
    setCurrentAvatar(url);
    // Persist immediately if editing, otherwise queue for save
    if (uid && isFirebaseConfigured) {
      try {
        await updateDoc(doc(db, 'users', uid), { photoURL: url });
        onProfileUpdate({ ...profile, photoURL: url });
        setToast({ message: 'Foto de perfil atualizada!', type: 'success' });
      } catch (err: any) {
        setToast({ message: `Erro ao salvar foto: ${err.message}`, type: 'error' });
      }
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid) return;
    if (usernameStatus === 'taken') { setToast({ message: 'Esse username já está em uso!', type: 'error' }); return; }
    if (usernameStatus === 'checking') { setToast({ message: 'Aguarde a validação do username...', type: 'error' }); return; }

    setSavingProfile(true);
    try {
      const cleanUsername = editUsername.replace(/[@\s]+/g, '').toLowerCase();
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        displayName: editName,
        username: `@${cleanUsername}`,
        bio: editBio,
      });
      onProfileUpdate({
        ...profile,
        displayName: editName,
        username: `@${cleanUsername}`,
        bio: editBio,
      });
      setToast({ message: 'Perfil atualizado com sucesso!', type: 'success' });
      setEditing(false);
    } catch (err: any) {
      setToast({ message: `Erro ao salvar perfil: ${err.message}`, type: 'error' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!uid || !viewingUserId || !isFirebaseConfigured) return;
    setLoadingFollow(true);
    try {
      const followId = `${uid}_${viewingUserId}`;
      const followRef = doc(db, 'follows', followId);
      const batch = firestoreWriteBatch(db);

      if (isFollowing) {
        // Unfollow
        batch.delete(followRef);
        batch.update(doc(db, 'users', uid), { followingCount: increment(-1) });
        batch.update(doc(db, 'users', viewingUserId), { followersCount: increment(-1) });
      } else {
        // Follow
        batch.set(followRef, {
          followerId: uid,
          followingId: viewingUserId,
          timestamp: serverTimestamp()
        });
        batch.update(doc(db, 'users', uid), { followingCount: increment(1) });
        batch.update(doc(db, 'users', viewingUserId), { followersCount: increment(1) });
      }

      await batch.commit();
      setToast({
        message: isFollowing ? 'Deixou de seguir o usuário.' : 'Agora você está seguindo!',
        type: 'success'
      });
    } catch (err: any) {
      console.error('Error toggling follow:', err);
      setToast({ message: `Erro: ${err.message}`, type: 'error' });
    } finally {
      setLoadingFollow(false);
    }
  };

  const handleLike = async (postId: string) => {
    if (!isFirebaseConfigured) return;
    try { await updateDoc(doc(db, 'posts', postId), { likesCount: increment(1) }); } catch (e) { console.error(e); }
  };

  const brlValue = (balance * MOEDA_VALOR_REAL).toFixed(2).replace('.', ',');

  if (loadingProfile) {
    return (
      <div className="flex-1 min-h-screen border-r border-zinc-800 bg-black flex items-center justify-center">
        <Loader className="w-6 h-6 text-zinc-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen border-r border-zinc-800 bg-black min-w-0">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-black/85 backdrop-blur-md border-b border-zinc-800 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {!isOwnProfile && onBack && (
            <button onClick={onBack} className="text-zinc-400 hover:text-white p-1.5 rounded-full hover:bg-zinc-900 cursor-pointer">
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <h2 className="text-lg font-black tracking-tight text-white text-left">
            {isOwnProfile ? 'Perfil' : (viewedProfile?.displayName || 'Perfil')}
          </h2>
        </div>
        {isOwnProfile && onLogout && (
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-zinc-800 text-xs font-bold text-zinc-400 hover:text-white hover:border-zinc-700 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair</span>
          </button>
        )}
      </div>

      {/* Avatar Crop Modal */}
      {cropSrc && uid && (
        <AvatarCropModal
          imageSrc={cropSrc}
          userId={uid}
          onComplete={handleCropComplete}
          onClose={() => setCropSrc(null)}
        />
      )}

      <div className="p-4 flex flex-col gap-5 max-w-2xl">
        {/* Profile Card */}
        <div className="border border-zinc-800 rounded-3xl overflow-hidden bg-transparent">
          {/* Cover banner */}
          <div className="h-20 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 relative" />

          {/* Avatar + Edit Row */}
          <div className="px-5 pb-5">
              {/* Avatar image */}
              <div className="relative group">
                <img
                  src={avatar}
                  alt={displayName}
                  className="w-20 h-20 rounded-full object-cover border-4 border-black shadow-xl"
                />
                {isOwnProfile && (
                  <>
                    <button
                      onClick={() => avatarInputRef.current?.click()}
                      className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <Camera className="w-5 h-5 text-white" />
                    </button>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarFileSelect}
                      className="hidden"
                    />
                  </>
                )}
              </div>

              {isOwnProfile ? (
                !editing ? (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-zinc-700 text-xs font-black text-white hover:bg-zinc-900 cursor-pointer transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Editar Perfil
                  </button>
                ) : (
                  <button onClick={() => setEditing(false)} className="text-xs text-zinc-500 hover:text-white cursor-pointer">Cancelar</button>
                )
              ) : (
                <button
                  onClick={handleFollowToggle}
                  disabled={loadingFollow}
                  className={`px-4 py-2 rounded-full text-xs font-black transition-all cursor-pointer active:scale-95 ${
                    isFollowing 
                      ? 'border border-zinc-700 text-white bg-transparent hover:bg-red-950/20 hover:border-red-900 hover:text-red-500' 
                      : 'bg-white text-black hover:bg-zinc-200'
                  }`}
                >
                  {loadingFollow ? '...' : isFollowing ? 'Seguindo' : 'Seguir'}
                </button>
              )}

            {!editing ? (
              <>
                <div className="flex flex-col gap-0.5 text-left">
                  <h3 className="text-xl font-black text-white leading-tight">{displayName}</h3>
                  <span className="text-zinc-500 text-sm font-mono">{handle}</span>
                </div>

                {profile?.bio && (
                  <p className="text-zinc-300 text-sm leading-relaxed mt-3 text-left">{profile.bio}</p>
                )}

                {/* Stats row */}
                <div className="flex items-center gap-5 mt-4 pt-4 border-t border-zinc-900">
                  <div className="flex items-center gap-1.5 text-left">
                    <span className="text-white font-black text-sm">{followersCount.toLocaleString('pt-BR')}</span>
                    <span className="text-zinc-500 text-xs font-semibold">Seguidores</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-left">
                    <span className="text-white font-black text-sm">{followingCount.toLocaleString('pt-BR')}</span>
                    <span className="text-zinc-500 text-xs font-semibold">Seguindo</span>
                  </div>
                  {isOwnProfile && (
                    <div className="flex items-center gap-1.5 text-left ml-auto">
                      <span className="text-zinc-200 font-bold text-sm flex items-center gap-1.5">
                        <Coins className="w-4 h-4 text-zinc-300 stroke-[2.2]" /> {balance.toLocaleString('pt-BR')}
                      </span>
                      <span className="text-zinc-500 text-xs font-semibold">≈ R$ {brlValue}</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Edit Form */
              <form onSubmit={handleSaveProfile} className="flex flex-col gap-4 text-left mt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Display Name */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Nome de Exibição</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      placeholder="Seu nome"
                      required
                      className="bg-black border border-zinc-800 focus:border-sky-500 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none font-medium"
                    />
                  </div>

                  {/* Username with uniqueness check */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Username</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-bold">@</span>
                      <input
                        type="text"
                        value={editUsername}
                        onChange={e => handleUsernameChange(e.target.value)}
                        placeholder="username"
                        required
                        className={`w-full bg-black border rounded-xl pl-7 pr-9 py-2.5 text-sm text-white focus:outline-none font-medium ${
                          usernameStatus === 'taken' ? 'border-red-500 focus:border-red-500' :
                          usernameStatus === 'available' ? 'border-emerald-500 focus:border-emerald-500' :
                          'border-zinc-800 focus:border-sky-500'
                        }`}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {usernameStatus === 'checking' && <Loader className="w-3.5 h-3.5 text-zinc-400 animate-spin" />}
                        {usernameStatus === 'available' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                        {usernameStatus === 'taken' && <X className="w-3.5 h-3.5 text-red-400" />}
                      </div>
                    </div>
                    {usernameStatus === 'taken' && <p className="text-[10px] text-red-400 font-bold">Este username já está sendo usado.</p>}
                    {usernameStatus === 'available' && <p className="text-[10px] text-emerald-400 font-bold">Username disponível! ✓</p>}
                  </div>
                </div>

                {/* Bio */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Biografia</label>
                  <textarea
                    value={editBio}
                    onChange={e => setEditBio(e.target.value)}
                    placeholder="Escreva algo sobre você..."
                    maxLength={160}
                    rows={3}
                    className="bg-black border border-zinc-800 focus:border-sky-500 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none font-medium resize-none"
                  />
                  <span className="text-[10px] text-zinc-600 self-end">{editBio.length}/160</span>
                </div>

                <button
                  type="submit"
                  disabled={savingProfile || usernameStatus === 'taken' || usernameStatus === 'checking'}
                  className="w-full py-3 rounded-full bg-white text-black font-extrabold text-sm hover:bg-zinc-200 disabled:opacity-40 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {savingProfile ? <><Loader className="w-4 h-4 animate-spin" />Salvando...</> : 'Salvar Alterações'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* My Posts */}
        <div className="border border-zinc-800 rounded-3xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-900">
            <Calendar className="w-4 h-4 text-zinc-500" />
            <h3 className="text-xs font-black text-white uppercase tracking-widest">
              {isOwnProfile ? 'Minhas Publicações' : 'Publicações'}
            </h3>
            <span className="ml-auto text-xs text-zinc-600 font-bold">{myPosts.length} posts</span>
          </div>

          {loadingPosts ? (
            <div className="flex items-center justify-center py-12 gap-2 text-zinc-600">
              <div className="w-4 h-4 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : myPosts.length === 0 ? (
            <div className="py-12 text-center text-zinc-600 text-sm font-semibold">
              {isOwnProfile ? 'Você ainda não publicou nada. Vá para o feed e comece!' : 'Nenhum post publicado por este usuário ainda.'}
            </div>
          ) : (
            myPosts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                onLike={handleLike}
                onCommentClick={() => {}}
                currentUserId={uid}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
