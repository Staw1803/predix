import React, { useState, useEffect } from 'react';
import { db, isFirebaseConfigured } from '../firebaseClient';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  where, 
  increment, 
  serverTimestamp
} from 'firebase/firestore';
import CreatePost from './CreatePost';
import PostCard from './PostCard';
import type { Post, Comment, User } from '../types';
import { X, Send, MessageCircle } from 'lucide-react';

interface FeedProps {
  currentUser: User | null;
  setToast: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}

export default function Feed({ currentUser, setToast }: FeedProps) {
  const [posts, setPosts] = useState<(Post & { authorName?: string; authorHandle?: string; authorAvatar?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Comment Modal States
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [comments, setComments] = useState<(Comment & { authorName?: string; authorHandle?: string; authorAvatar?: string })[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Real-time Posts Listener
  useEffect(() => {
    if (!isFirebaseConfigured) {
      // Offline mock data
      setPosts([
        {
          id: 'mock-1',
          authorId: 'system-1',
          authorName: 'Steve Jobs',
          authorHandle: '@steve_retro',
          authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
          content: 'A simplicidade é o último grau da sofisticação. Olhando para trás, as conexões fazem sentido.',
          timestamp: { toDate: () => new Date(Date.now() - 3600000 * 2) },
          likesCount: 142
        },
        {
          id: 'mock-2',
          authorId: 'system-2',
          authorName: 'Predix Team',
          authorHandle: '@predix_social',
          authorAvatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80',
          content: 'Bem-vindo ao novo núcleo do Predix! Agora somos uma rede social completa baseada em micro-posts. Deixe o seu feedback abaixo! 👇',
          timestamp: { toDate: () => new Date(Date.now() - 3600000 * 5) },
          likesCount: 57
        }
      ]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setPosts(list);
      setLoading(false);
    }, (error) => {
      console.error("Error reading posts:", error);
      setToast({ message: "Erro ao ler posts do Firestore.", type: "error" });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setToast]);

  // Real-time Comments Listener
  useEffect(() => {
    if (!selectedPost) {
      setComments([]);
      return;
    }

    if (!isFirebaseConfigured) {
      // Offline mock comments
      setComments([
        {
          id: 'comment-1',
          postId: selectedPost.id,
          authorId: 'user-1',
          authorName: 'Visitante Curioso',
          authorHandle: '@visitante',
          authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
          content: 'Muito legal a nova interface! Super fluida.',
          timestamp: { toDate: () => new Date() }
        }
      ]);
      return;
    }

    const q = query(
      collection(db, 'comments'), 
      where('postId', '==', selectedPost.id),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setComments(list);
    }, (error) => {
      console.error("Error reading comments:", error);
    });

    return () => unsubscribe();
  }, [selectedPost]);

  // Handle Publish Post
  const handlePublishPost = async (content: string) => {
    if (!currentUser) {
      setToast({ message: "Você precisa fazer login para postar.", type: "error" });
      return;
    }

    if (!isFirebaseConfigured) {
      const newMockPost = {
        id: `mock-${Date.now()}`,
        authorId: currentUser.id,
        authorName: currentUser.displayName,
        authorHandle: currentUser.username,
        authorAvatar: currentUser.photoURL,
        content: content,
        timestamp: { toDate: () => new Date() },
        likesCount: 0
      };
      setPosts([newMockPost, ...posts]);
      setToast({ message: "Post publicado (Simulado)!", type: "success" });
      return;
    }

    try {
      await addDoc(collection(db, 'posts'), {
        authorId: currentUser.id,
        authorName: currentUser.displayName,
        authorHandle: currentUser.username,
        authorAvatar: currentUser.photoURL,
        content: content,
        timestamp: serverTimestamp(),
        likesCount: 0
      });
      setToast({ message: "Post publicado!", type: "success" });
    } catch (err: any) {
      console.error("Error creating post:", err);
      setToast({ message: `Erro ao postar: ${err.message}`, type: "error" });
    }
  };

  // Handle Like Post
  const handleLike = async (postId: string) => {
    if (!currentUser) {
      setToast({ message: "Faça login para curtir.", type: "error" });
      return;
    }

    if (!isFirebaseConfigured) {
      setPosts(posts.map(p => p.id === postId ? { ...p, likesCount: p.likesCount + 1 } : p));
      return;
    }

    try {
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        likesCount: increment(1)
      });
    } catch (err: any) {
      console.error("Error liking post:", err);
    }
  };

  // Handle Publish Comment
  const handlePublishComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submittingComment || !selectedPost || !currentUser) return;

    setSubmittingComment(true);

    if (!isFirebaseConfigured) {
      const mockComment = {
        id: `comment-${Date.now()}`,
        postId: selectedPost.id,
        authorId: currentUser.id,
        authorName: currentUser.displayName,
        authorHandle: currentUser.username,
        authorAvatar: currentUser.photoURL,
        content: newComment.trim(),
        timestamp: { toDate: () => new Date() }
      };
      setComments([...comments, mockComment]);
      setNewComment('');
      setSubmittingComment(false);
      return;
    }

    try {
      await addDoc(collection(db, 'comments'), {
        postId: selectedPost.id,
        authorId: currentUser.id,
        authorName: currentUser.displayName,
        authorHandle: currentUser.username,
        authorAvatar: currentUser.photoURL,
        content: newComment.trim(),
        timestamp: serverTimestamp()
      });
      setNewComment('');
    } catch (err: any) {
      console.error("Error creating comment:", err);
      setToast({ message: "Erro ao adicionar comentário.", type: "error" });
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <div className="flex-1 min-h-screen border-r border-zinc-800 bg-black min-w-0">
      {/* Header - Glassmorphism */}
      <div className="sticky top-0 z-30 bg-black/85 backdrop-blur-md border-b border-zinc-800 py-4 px-6 flex items-center justify-between">
        <h1 className="text-lg font-black tracking-tight text-white select-none">Página Inicial</h1>
      </div>

      {/* Post creator */}
      {currentUser && (
        <CreatePost 
          onPublishPost={handlePublishPost} 
          userAvatar={currentUser.photoURL} 
        />
      )}

      {/* Feed List */}
      <div className="flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-zinc-500 gap-2">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span className="font-semibold text-xs">Carregando feed...</span>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-zinc-550 font-semibold border-b border-zinc-800">
            Nenhum post no momento. Seja o primeiro a iniciar a conversa!
          </div>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onLike={handleLike}
              onCommentClick={setSelectedPost}
            />
          ))
        )}
      </div>

      {/* Comments Drawer / Modal (Apple slide-up premium transition) */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 transition-all duration-350">
          <div className="w-full sm:max-w-2xl bg-zinc-950 border border-zinc-800 rounded-t-3xl sm:rounded-3xl flex flex-col h-[85vh] sm:h-[80vh] shadow-2xl relative animate-in slide-in-from-bottom duration-300">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-900 shrink-0">
              <span className="font-black text-white text-sm">Post</span>
              <button 
                onClick={() => setSelectedPost(null)}
                className="p-1.5 rounded-full hover:bg-zinc-900 text-zinc-400 hover:text-white transition-colors duration-150 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Original Post */}
              <div className="flex gap-3.5 border-b border-zinc-900 pb-6">
                <img
                  src={selectedPost.authorAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
                  alt={selectedPost.authorName}
                  className="w-10 h-10 rounded-full object-cover border border-zinc-800 shrink-0"
                />
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className="font-bold text-white text-sm">{selectedPost.authorName || 'Usuário'}</span>
                    <span className="text-zinc-500 text-xs">{selectedPost.authorHandle || '@usuario'}</span>
                  </div>
                  <p className="text-zinc-200 text-base leading-relaxed whitespace-pre-wrap break-words">
                    {selectedPost.content}
                  </p>
                </div>
              </div>

              {/* Comments Section Header */}
              <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold uppercase tracking-wider text-left border-b border-zinc-900 pb-2">
                <MessageCircle className="w-4 h-4" />
                <span>Respostas</span>
              </div>

              {/* Comments List */}
              <div className="space-y-4">
                {comments.length === 0 ? (
                  <div className="text-center py-8 text-zinc-600 font-semibold text-sm">
                    Nenhuma resposta ainda. Seja o primeiro a responder!
                  </div>
                ) : (
                  comments.map((comment) => {
                    const cName = comment.authorName || 'Usuário';
                    const cHandle = comment.authorHandle || '@usuario';
                    const cAvatar = comment.authorAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';
                    const cTimeAgo = comment.timestamp ? (comment.timestamp.toDate ? comment.timestamp.toDate() : new Date(comment.timestamp)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'agora';

                    return (
                      <div key={comment.id} className="flex gap-3 text-left">
                        <img
                          src={cAvatar}
                          alt={cName}
                          className="w-8 h-8 rounded-full object-cover border border-zinc-800 shrink-0"
                        />
                        <div className="flex-1 bg-zinc-900/40 border border-zinc-900 rounded-2xl p-3 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-bold text-white text-xs truncate max-w-[120px]">{cName}</span>
                              <span className="text-zinc-500 text-[10px] truncate max-w-[100px]">{cHandle}</span>
                            </div>
                            <span className="text-zinc-600 text-[10px] shrink-0">{cTimeAgo}</span>
                          </div>
                          <p className="text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap break-words">
                            {comment.content}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Comment Creation Box (Stick to bottom) */}
            {currentUser ? (
              <form 
                onSubmit={handlePublishComment}
                className="p-4 border-t border-zinc-900 bg-zinc-950 rounded-b-3xl shrink-0 flex gap-3 items-center"
              >
                <img
                  src={currentUser.photoURL}
                  alt="My Avatar"
                  className="w-8 h-8 rounded-full object-cover border border-zinc-800 shrink-0 select-none pointer-events-none"
                />
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Postar sua resposta"
                  className="flex-1 bg-zinc-900/60 border border-zinc-800 text-white placeholder-zinc-600 rounded-full px-4 py-2 text-xs focus:outline-none focus:border-zinc-700"
                  disabled={submittingComment}
                />
                <button
                  type="submit"
                  disabled={!newComment.trim() || submittingComment}
                  className="p-2 rounded-full bg-white text-black hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer flex items-center justify-center shrink-0 active:scale-90"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            ) : (
              <div className="p-4 border-t border-zinc-900 bg-zinc-950 text-center text-xs font-bold text-zinc-500 rounded-b-3xl shrink-0">
                Faça login para responder a este post.
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
