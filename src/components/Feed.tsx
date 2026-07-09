import React, { useState, useEffect } from 'react';
import { db, isFirebaseConfigured } from '../firebaseClient';
import {
  collection, addDoc, updateDoc, doc, onSnapshot,
  query, orderBy, where, increment, serverTimestamp,
  writeBatch, getDocs
} from 'firebase/firestore';
import CreatePost from './CreatePost';
import PostCard from './PostCard';
import type { Post, Comment, User } from '../types';
import { X, Send, MessageCircle } from 'lucide-react';

import { GORJETA_MOEDAS } from '../constants';

interface FeedProps {
  currentUser: User | null;
  setToast: (toast: { message: string; type: 'success' | 'error' } | null) => void;
  onSeedReady?: (fn: () => Promise<void>) => void;
  onUserClick?: (userId: string) => void;
}

const FAKE_USERS = [
  { displayName: 'Lucas Oliveira', username: 'lucas_oliv', photoURL: 'https://i.pravatar.cc/150?img=3' },
  { displayName: 'Ana Clara Silva', username: 'anaclara_s', photoURL: 'https://i.pravatar.cc/150?img=5' },
  { displayName: 'Pedro Henrique', username: 'pedrohenrique', photoURL: 'https://i.pravatar.cc/150?img=12' },
  { displayName: 'Fernanda Rocha', username: 'fe_rocha', photoURL: 'https://i.pravatar.cc/150?img=9' },
  { displayName: 'Rafael Costa', username: 'rafa_costa', photoURL: 'https://i.pravatar.cc/150?img=15' },
  { displayName: 'Beatriz Mendes', username: 'bea_mendes', photoURL: 'https://i.pravatar.cc/150?img=25' },
  { displayName: 'Thiago Souza', username: 'thiago_dv', photoURL: 'https://i.pravatar.cc/150?img=8' },
  { displayName: 'Larissa Nunes', username: 'larissa_n', photoURL: 'https://i.pravatar.cc/150?img=47' },
  { displayName: 'Mateus Lima', username: 'mateus_l', photoURL: 'https://i.pravatar.cc/150?img=32' },
  { displayName: 'Isabela Torres', username: 'isa_torres', photoURL: 'https://i.pravatar.cc/150?img=44' },
];

const FAKE_POSTS = [
  'Acabei de entrar no Predix! Essa rede social tem um visual absurdo demais. 🔥',
  'Quem mais aqui usa PIX pra tudo? Sinceramente facilitou muito minha vida.',
  'Boa tarde, Predix! Trabalhando de casa hoje e aproveitando pra dar uma olhadinha no feed. 😎',
  'A inteligência artificial está mudando tudo. E o Predix vai mudar a forma de se conectar.',
  'Postando pelo celular pela primeira vez. Interface muito fluida, parabéns aos devs!',
  'Será que alguém me segue de volta? 👀 Seguindo todo mundo aqui.',
  'Que tal a gente marcar uma live aqui no Predix semana que vem?',
  'Tecnologia, inovação e PIX. Tá aí o trio do futuro do Brasil. 💚💛',
  'Acabei de receber minha primeira gorjeta aqui no Predix! Valeu demais! 💛',
  'Todo dia é um ótimo dia pra aprender algo novo. O que vocês estão estudando hoje?',
  'Minha chave PIX está ativa e pronta pra receber aquele Predix coin 😂',
  'Primeira semana no Predix e já me sinto em casa. Comunidade boa demais.',
  'O futuro das redes sociais é a monetização descentralizada. Predix tá na frente!',
  'Quem mais tá viciado nesse feed? rsrs',
  'Bora crescer juntos aqui no Predix! Deixa seu @usuario abaixo 👇',
];

export default function Feed({ currentUser, setToast, onSeedReady, onUserClick }: FeedProps) {
  const [posts, setPosts] = useState<(Post & { authorName?: string; authorHandle?: string; authorAvatar?: string; monetized?: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [comments, setComments] = useState<(Comment & { authorName?: string; authorHandle?: string; authorAvatar?: string })[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const handleSeedDatabase = async () => {
    if (!isFirebaseConfigured) { setToast({ message: 'Firebase não configurado.', type: 'error' }); return; }
    try {
      const existingSnap = await getDocs(collection(db, 'posts'));
      if (existingSnap.size >= 10) {
        setToast({ message: 'Banco já possui dados. Apague os posts primeiro.', type: 'error' });
        return;
      }
      setToast({ message: 'Gerando dados iniciais...', type: 'success' });
      const batch1 = writeBatch(db);
      const ids: string[] = [];
      for (const user of FAKE_USERS) {
        const ref = doc(collection(db, 'users'));
        batch1.set(ref, {
          displayName: user.displayName, username: user.username, photoURL: user.photoURL,
          credits: Math.floor(Math.random() * 500) * 10, bio: 'Usuário do Predix Social 🚀', 
          followersCount: Math.floor(Math.random() * 1500), followingCount: Math.floor(Math.random() * 800),
          createdAt: serverTimestamp()
        });
        ids.push(ref.id);
      }
      await batch1.commit();
      const batch2 = writeBatch(db);
      for (let i = 0; i < FAKE_POSTS.length; i++) {
        const ui = i % FAKE_USERS.length;
        const ref = doc(collection(db, 'posts'));
        batch2.set(ref, {
          authorId: ids[ui] || 'seed', authorName: FAKE_USERS[ui].displayName,
          authorHandle: `@${FAKE_USERS[ui].username}`, authorAvatar: FAKE_USERS[ui].photoURL,
          content: FAKE_POSTS[i], monetized: Math.random() > 0.4, // 60% of posts monetized
          timestamp: serverTimestamp(), likesCount: Math.floor(Math.random() * 120)
        });
      }
      await batch2.commit();
      setToast({ message: '✅ 10 usuários e 15 posts gerados!', type: 'success' });
    } catch (err: any) {
      setToast({ message: `Erro: ${err.message}`, type: 'error' });
    }
  };

  useEffect(() => {
    if (onSeedReady) onSeedReady(handleSeedDatabase);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setPosts([
        { id: 'mock-1', authorId: 'system-1', authorName: 'Steve Jobs', authorHandle: '@steve_retro',
          authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
          content: 'A simplicidade é o último grau da sofisticação.', monetized: false,
          timestamp: { toDate: () => new Date(Date.now() - 7200000) }, likesCount: 142 },
        { id: 'mock-2', authorId: 'system-2', authorName: 'Predix Team', authorHandle: '@predix_social',
          authorAvatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80',
          content: 'Bem-vindo ao Predix! Agora com gorjetas monetizadas', monetized: true,
          timestamp: { toDate: () => new Date(Date.now() - 18000000) }, likesCount: 57 }
      ]);
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
      setLoading(false);
    }, (err) => {
      console.error(err);
      setToast({ message: 'Erro ao ler posts.', type: 'error' });
      setLoading(false);
    });
    return () => unsub();
  }, [setToast]);

  useEffect(() => {
    if (!selectedPost) { setComments([]); return; }
    if (!isFirebaseConfigured) {
      setComments([{ id: 'c1', postId: selectedPost.id, authorId: 'u1', authorName: 'Visitante',
        authorHandle: '@visitante', authorAvatar: 'https://i.pravatar.cc/150?img=3',
        content: 'Muito legal!', timestamp: { toDate: () => new Date() } }]);
      return;
    }
    const q = query(collection(db, 'comments'), where('postId', '==', selectedPost.id), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    }, console.error);
    return () => unsub();
  }, [selectedPost]);

  const handlePublishPost = async (content: string, monetized: boolean, mediaURL?: string, mediaType?: string) => {
    if (!currentUser) { setToast({ message: 'Faça login para postar.', type: 'error' }); return; }
    if (!isFirebaseConfigured) {
      setPosts([{ id: `mock-${Date.now()}`, authorId: currentUser.id, authorName: currentUser.displayName,
        authorHandle: currentUser.username, authorAvatar: currentUser.photoURL, content, monetized,
        mediaURL, mediaType,
        timestamp: { toDate: () => new Date() }, likesCount: 0 }, ...posts]);
      setToast({ message: 'Post publicado (Simulado)!', type: 'success' }); return;
    }
    try {
      await addDoc(collection(db, 'posts'), {
        authorId: currentUser.id, authorName: currentUser.displayName,
        authorHandle: currentUser.username, authorAvatar: currentUser.photoURL,
        content, monetized: monetized || false,
        ...(mediaURL ? { mediaURL, mediaType: mediaType || 'image' } : {}),
        timestamp: serverTimestamp(), likesCount: 0
      });
      setToast({ message: 'Post publicado!', type: 'success' });
    } catch (err: any) { setToast({ message: `Erro: ${err.message}`, type: 'error' }); }
  };

  const handleLike = async (postId: string) => {
    if (!currentUser) { setToast({ message: 'Faça login para curtir.', type: 'error' }); return; }
    if (!isFirebaseConfigured) { setPosts(posts.map(p => p.id === postId ? { ...p, likesCount: p.likesCount + 1 } : p)); return; }
    try { await updateDoc(doc(db, 'posts', postId), { likesCount: increment(1) }); } catch (e) { console.error(e); }
  };

  const handleTip = async (_postId: string, authorId: string) => {
    if (!currentUser) { setToast({ message: 'Faça login para dar gorjeta.', type: 'error' }); return; }
    if ((currentUser.credits || 0) < GORJETA_MOEDAS) {
      setToast({ message: `Saldo insuficiente! Precisa de ${GORJETA_MOEDAS} moedas.`, type: 'error' }); return;
    }
    if (!isFirebaseConfigured) { setToast({ message: `Gorjeta de ${GORJETA_MOEDAS} moedas enviada!`, type: 'success' }); return; }
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', currentUser.id), { credits: increment(-GORJETA_MOEDAS) });
      batch.update(doc(db, 'users', authorId), { credits: increment(GORJETA_MOEDAS) });
      await batch.commit();
      setToast({ message: `Gorjeta de ${GORJETA_MOEDAS} moedas enviada!`, type: 'success' });
    } catch (err: any) { setToast({ message: `Erro: ${err.message}`, type: 'error' }); }
  };

  const handlePublishComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submittingComment || !selectedPost || !currentUser) return;
    setSubmittingComment(true);
    if (!isFirebaseConfigured) {
      setComments([...comments, { id: `c-${Date.now()}`, postId: selectedPost.id, authorId: currentUser.id,
        authorName: currentUser.displayName, authorHandle: currentUser.username,
        authorAvatar: currentUser.photoURL, content: newComment.trim(), timestamp: { toDate: () => new Date() } }]);
      setNewComment(''); setSubmittingComment(false); return;
    }
    try {
      await addDoc(collection(db, 'comments'), {
        postId: selectedPost.id, authorId: currentUser.id, authorName: currentUser.displayName,
        authorHandle: currentUser.username, authorAvatar: currentUser.photoURL,
        content: newComment.trim(), timestamp: serverTimestamp()
      });
      setNewComment('');
    } catch (err: any) { setToast({ message: 'Erro ao comentar.', type: 'error' }); }
    finally { setSubmittingComment(false); }
  };

  return (
    <div className="flex-1 min-h-screen border-r border-zinc-800 bg-black min-w-0">
      <div className="sticky top-0 z-30 bg-black/85 backdrop-blur-md border-b border-zinc-800 py-4 px-6">
        <h1 className="text-lg font-black tracking-tight text-white select-none">Página Inicial</h1>
      </div>

      {currentUser && <CreatePost onPublishPost={handlePublishPost} userAvatar={currentUser.photoURL} />}

      <div className="flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-zinc-500 gap-2">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span className="font-semibold text-xs">Carregando feed...</span>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-zinc-500 font-semibold border-b border-zinc-800">
            Nenhum post ainda. Use "Gerar Dados Iniciais" na sidebar!
          </div>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onLike={handleLike}
              onCommentClick={setSelectedPost}
              onTip={handleTip}
              currentUserId={currentUser?.id}
              onUserClick={onUserClick}
            />
          ))
        )}
      </div>

      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full sm:max-w-2xl bg-zinc-950 border border-zinc-800 rounded-t-3xl sm:rounded-3xl flex flex-col h-[85vh] sm:h-[80vh] shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-900 shrink-0">
              <span className="font-black text-white text-sm">Post</span>
              <button onClick={() => setSelectedPost(null)} className="p-1.5 rounded-full hover:bg-zinc-900 text-zinc-400 hover:text-white transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="flex gap-3.5 border-b border-zinc-900 pb-6">
                <img 
                  src={selectedPost.authorAvatar || 'https://i.pravatar.cc/150?img=1'} 
                  alt="" 
                  onClick={() => { setSelectedPost(null); onUserClick?.(selectedPost.authorId); }}
                  className="w-10 h-10 rounded-full object-cover border border-zinc-800 shrink-0 cursor-pointer" 
                />
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span 
                      onClick={() => { setSelectedPost(null); onUserClick?.(selectedPost.authorId); }}
                      className="font-bold text-white text-sm hover:underline cursor-pointer"
                    >
                      {selectedPost.authorName || 'Usuário'}
                    </span>
                    <span className="text-zinc-500 text-xs">{selectedPost.authorHandle || '@usuario'}</span>
                  </div>
                  <p className="text-zinc-200 text-base leading-relaxed whitespace-pre-wrap break-words">{selectedPost.content}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold uppercase tracking-wider border-b border-zinc-900 pb-2">
                <MessageCircle className="w-4 h-4" /><span>Respostas</span>
              </div>
              <div className="space-y-4">
                {comments.length === 0 ? (
                  <div className="text-center py-8 text-zinc-600 font-semibold text-sm">Nenhuma resposta ainda.</div>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="flex gap-3 text-left">
                      <img 
                        src={c.authorAvatar || `https://i.pravatar.cc/150?u=${c.authorId}`} 
                        alt="" 
                        onClick={() => { setSelectedPost(null); onUserClick?.(c.authorId); }}
                        className="w-8 h-8 rounded-full object-cover border border-zinc-800 shrink-0 cursor-pointer" 
                      />
                      <div className="flex-1 bg-zinc-900/40 border border-zinc-900 rounded-2xl p-3 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span 
                              onClick={() => { setSelectedPost(null); onUserClick?.(c.authorId); }}
                              className="font-bold text-white text-xs truncate max-w-[120px] hover:underline cursor-pointer"
                            >
                              {c.authorName}
                            </span>
                            <span className="text-zinc-500 text-[10px] truncate max-w-[100px]">{c.authorHandle}</span>
                          </div>
                          <span className="text-zinc-655 text-[10px] shrink-0">
                            {c.timestamp ? (c.timestamp.toDate ? c.timestamp.toDate() : new Date(c.timestamp)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'agora'}
                          </span>
                        </div>
                        <p className="text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap break-words">{c.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            {currentUser ? (
              <form onSubmit={handlePublishComment} className="p-4 border-t border-zinc-900 bg-zinc-950 rounded-b-3xl shrink-0 flex gap-3 items-center">
                <img src={currentUser.photoURL} alt="" className="w-8 h-8 rounded-full object-cover border border-zinc-800 shrink-0" />
                <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Postar sua resposta"
                  className="flex-1 bg-zinc-900/60 border border-zinc-800 text-white placeholder-zinc-600 rounded-full px-4 py-2 text-xs focus:outline-none focus:border-zinc-700"
                  disabled={submittingComment} />
                <button type="submit" disabled={!newComment.trim() || submittingComment}
                  className="p-2 rounded-full bg-white text-black hover:bg-zinc-200 disabled:opacity-40 transition-all cursor-pointer shrink-0 active:scale-90">
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            ) : (
              <div className="p-4 border-t border-zinc-900 bg-zinc-950 text-center text-xs font-bold text-zinc-500 rounded-b-3xl shrink-0">Faça login para responder.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
