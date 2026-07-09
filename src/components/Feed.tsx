import React, { useState, useEffect } from 'react';
import { db, isFirebaseConfigured } from '../firebaseClient';
import {
  collection, addDoc, updateDoc, doc, onSnapshot,
  query, orderBy, where, increment, serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import CreatePost from './CreatePost';
import PostCard from './PostCard';
import type { Post, Comment, User } from '../types';
import { X, Send, MessageCircle } from 'lucide-react';

import { GORJETA_MOEDAS } from '../constants';

interface FeedProps {
  currentUser: User | null;
  setToast: (toast: { message: string; type: 'success' | 'error' } | null) => void;
  onUserClick?: (userId: string) => void;
}

const FIRST_NAMES = ['Gabriel', 'Lucas', 'Matheus', 'Pedro', 'Thiago', 'Bruno', 'Felipe', 'Rafael', 'Diego', 'Rodrigo', 'Ana', 'Julia', 'Mariana', 'Beatriz', 'Fernanda', 'Amanda', 'Larissa', 'Camila', 'Juliana', 'Isabela', 'Sophia', 'Alice', 'Manuela', 'Laura', 'Heloisa', 'Arthur', 'Bernardo', 'Heitor', 'Davi', 'Lorenzo', 'Théo', 'Enzo', 'Nicolas', 'Henrique', 'Murilo', 'Lucca', 'Guilherme', 'Gustavo', 'Caio', 'Vinicius'];
const LAST_NAMES = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida', 'Lopes', 'Soares', 'Dias', 'Vieira', 'Barbosa'];
const BIO_TEMPLATES = [
  'Trader esportivo & entusiasta Crypto 📉',
  'Dev fullstack | apaixonado por mercados preditivos 💻',
  'Apenas tentando adivinhar o futuro do Brasil 🔮',
  'Fã de futebol, tecnologia e investimento anjo ⚽',
  'Economista de dia, analista de tendências de noite 📊',
  'Previsões são minha terapia 😂',
  'Siga para as melhores calls de política e entretenimento ⚡'
];
const UNSPLASH_AVATARS = [
  '1535713875002-d1d0cf377fde', '1494790108377-be9c29b29330', '1570295999919-56ceb5ecca61', '1507003211169-0a1dd7228f2d',
  '1438761681033-6461ffad8d80', '1472099645785-5658abf4ff4e', '1544005313-94ddf0286df2', '1506794778202-cad84cf45f1d',
  '1517841905240-472988babdf9', '1539571696357-5a69c17a67c6', '1522075469751-3a6694fb2f61', '1534528741775-53994a69daeb',
  '1508214751196-bcfd4ca60f91', '1580489944761-15a19d654956', '1492562080023-ab3db95bfbce', '1488426862026-3ee34a7d66df',
  '1501196354995-cbb51c65aaea', '1519085360753-af0119f7cbe7', '1489424122828-9865352413a3', '1513956589380-bad6acb9b9d4',
  '1496440737103-cd596325d314', '1531746020798-e6953c6e8e04', '1500648767791-00dcc994a43e', '1548142813-c348350df52b',
  '1560250097-0b93528c311a', '1554151228-14d9def656e4', '1537368910025-700350fe46c7', '1544725176-7c40e5a71c5e',
  '1527980965255-d3b416303d12', '1583337130417-3346a1be7dee', '150425740623-013e6e83b711', '1566753323558-f4e0952af115',
  '1568602471122-7832951cc4c5', '1619895862022-09114b41f16f', '1524504388940-b1c1722653e1', '1503185912284-5271ff81b9a8',
  '1531123897727-8f129e1688ce', '1528892901404-74b87d3793c2', '1558203728-00f45181dd84', '1500048993953-d23a436266cf',
  '1599566150163-29194dcaad36', '1542206395-9ebd3e6c1797', '1519345182560-3f2917c472ef', '1509305711191-441779f4578f',
  '1502823403129-14027a7c6c1f', '1546969415-95748a4392df', '1534751516642-a131ffa10b27', '1508214501196-bcfd4ca60f91',
  '1487412720507-e7ab37603c6f', '1520813792240-56fc4a3765a7'
];
const POST_TEMPLATES = [
  "Será que o Flamengo ganha o campeonato este ano? 🔴⚫",
  "O Bitcoin vai passar de $100k este mês? O que vocês acham? 🚀",
  "Previsão de hoje: chuva à tarde e alta do dólar... 💸",
  "Alguém aí já comprou moedas no Predix hoje?",
  "A inteligência artificial vai substituir os programadores ou só ajudar? 💻",
  "Melhor plataforma de mercado preditivo que já usei, muito rápida!",
  "Quem ganha as eleições americanas? Deixem seus palpites!",
  "O Pix mudou completamente o comércio no Brasil. Sem taxas é perfeito! 🇧🇷",
  "Gastei minhas moedas apostando no Real Madrid kkkkk 🤡",
  "O segredo do sucesso é a consistência. Bom dia grupo!",
  "Qual a melhor cripto para investir abaixo de $1 atualmente?",
  "Predix tá com uma interface muito bonita, estilo X. Gostei do minimalismo.",
  "Acabei de fazer meu primeiro saque! Caiu na conta em segundos ⚡",
  "Alguém aceita um palpite sobre a rodada do Brasileirão?",
  "Taxa de juros vai cair ou subir na próxima reunião do Copom?",
  "A comunidade aqui é muito engajada, gosto de ler as respostas.",
  "Quem é o melhor jogador de futebol da atualidade? Vini Jr?",
  "Não operem alavancado hoje, o mercado está muito volátil! ⚠️",
  "Estudando desenvolvimento web com React. Alguma dica para iniciantes?",
  "Hoje o dia promete! Vamos fazer algumas previsões de futebol.",
  "Se o Pix da Efí falhar eu choro, mas até agora tudo 100% kkkk",
  "Qual o seu maior palpite que deu certo na vida?",
  "Quem aí já testou a funcionalidade de seguir perfis?",
  "Achei o perfil do @lucas_oliv, o cara só dá palpite certeiro!",
  "Mais um dia de análises e previsões no Predix Social.",
  "Será que a taxa de conversão de moedas vai continuar fixa?",
  "Gorjetas monetizadas são o futuro da criação de conteúdo.",
  "Deixei 50 moedas de gorjeta num post de análise excelente.",
  "Quem ganha o clássico de domingo? Meu palpite é empate.",
  "Trabalhando remoto e acompanhando o feed do Predix. ☕",
  "Amanhã tem lançamento espacial da SpaceX. Ansioso!",
  "Qual o melhor livro de economia que você já leu?",
  "Alguém com problemas de saldo? O meu zerou mas já carreguei via Pix.",
  "Esse design em preto e branco ficou muito chique, estilo X mesmo.",
  "Não troco o Predix por nenhuma outra rede social atualmente.",
  "Quem aí acertou a previsão do preço do Ethereum?",
  "Apenas observando as discussões sobre política no feed 👀",
  "Hoje tem jogo do Brasil! Palpites de placar?",
  "Investir em conhecimento rende sempre os melhores juros.",
  "Alguém aí querendo comprar moedas? Os pacotes estão ótimos.",
  "Fazendo posts monetizados para ver se ganho umas gorjetas kkk",
  "O Pix copia e cola da loja é muito prático.",
  "Esperando a alta das altcoins... Algum dia vem! 💎",
  "Minha meta é bater 1000 seguidores esta semana, me sigam!",
  "Muito bom ver a plataforma crescendo e novos usuários entrando.",
  "Qual o palpite mais louco que você já viu darem aqui?",
  "Quem ganha a Champions League este ano? City ou Real?",
  "Tudo pronto para as previsões do final de semana.",
  "Predix Social é o futuro dos mercados preditivos no Brasil! 🚀🚀",
  "Seja bem-vindo quem está entrando hoje! Me segue aí!"
];

const COMMENT_TEMPLATES = [
  "Concordo plenamente com isso! 👏",
  "Não sei não... Acho que o resultado vai ser diferente.",
  "Esse palpite é quente! Vou apostar algumas moedas nisso.",
  "Melhor análise que vi hoje no Predix.",
  "Estou de olho nessa previsão 👀",
  "Com certeza! Quem não concorda está assistindo outro jogo kkk",
  "Nossa, bem pensado! Não tinha analisado por esse lado.",
  "O mercado de previsões vai ficar insano com essa call.",
  "Já deixei minha gorjeta pelo post de alta qualidade!",
  "Acompanhando de perto para ver no que dá.",
  "Isso muda tudo! Obrigado por compartilhar.",
  "Excelente post, direto ao ponto."
];

export default function Feed({ currentUser, setToast, onUserClick }: FeedProps) {
  const [posts, setPosts] = useState<(Post & { authorName?: string; authorHandle?: string; authorAvatar?: string; monetized?: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [comments, setComments] = useState<(Comment & { authorName?: string; authorHandle?: string; authorAvatar?: string })[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [hasSeeded, setHasSeeded] = useState(false);
  const [feedSort, setFeedSort] = useState<'recent' | 'popular'>('recent');

  const performAutoSeed = async () => {
    try {
      console.log('Database needs seeding! Triggering automatic seed of 50 users, 50 posts, and comments...');
      
      // Batch 1: Create 50 Users
      const batch1 = writeBatch(db);
      const generatedUsersData: any[] = [];

      for (let i = 0; i < 50; i++) {
        const ref = doc(collection(db, 'users'));
        const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
        const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
        const displayName = `${firstName} ${lastName}`;
        const username = `@${firstName.toLowerCase()}_${lastName.toLowerCase()}${Math.floor(Math.random() * 90 + 10)}`;
        const photoURL = `https://images.unsplash.com/photo-${UNSPLASH_AVATARS[i % UNSPLASH_AVATARS.length]}?auto=format&fit=crop&w=150&q=80`;
        const bio = BIO_TEMPLATES[Math.floor(Math.random() * BIO_TEMPLATES.length)];
        const followersCount = Math.floor(Math.random() * 2000 + 100);
        const followingCount = Math.floor(Math.random() * 800 + 50);

        const userData = {
          id: ref.id,
          displayName,
          username,
          photoURL,
          bio,
          followersCount,
          followingCount,
          credits: Math.floor(Math.random() * 300) * 10,
          createdAt: serverTimestamp()
        };

        batch1.set(ref, userData);
        generatedUsersData.push(userData);
      }
      await batch1.commit();
      console.log('✅ Auto Seed: 50 Users created.');

      // Batch 2: Create 50 Posts
      const batch2 = writeBatch(db);
      const generatedPostRefs: any[] = [];

      for (let i = 0; i < 50; i++) {
        const ref = doc(collection(db, 'posts'));
        const userIndex = i % 50;
        const author = generatedUsersData[userIndex];
        const content = POST_TEMPLATES[i % POST_TEMPLATES.length];
        const commentsCount = Math.floor(Math.random() * 2) + 1;

        batch2.set(ref, {
          authorId: author.id,
          authorName: author.displayName,
          authorHandle: author.username,
          authorAvatar: author.photoURL,
          content,
          monetized: Math.random() > 0.4,
          likesCount: Math.floor(Math.random() * 200 + 10),
          commentsCount: commentsCount,
          timestamp: serverTimestamp()
        });
        generatedPostRefs.push({ id: ref.id, authorId: author.id, commentsCount });
      }
      await batch2.commit();
      console.log('✅ Auto Seed: 50 Posts created.');

      // Batch 3: Create Comments for each Post
      const batch3 = writeBatch(db);
      for (let i = 0; i < 50; i++) {
        const postData = generatedPostRefs[i];
        const commentsCount = postData.commentsCount;
        
        for (let c = 0; c < commentsCount; c++) {
          const commentRef = doc(collection(db, 'comments'));
          
          // Select a random user that is not the author of the post
          let commentUserIndex = Math.floor(Math.random() * 50);
          if (generatedUsersData[commentUserIndex].id === postData.authorId) {
            commentUserIndex = (commentUserIndex + 1) % 50;
          }
          const commentUser = generatedUsersData[commentUserIndex];
          const commentContent = COMMENT_TEMPLATES[Math.floor(Math.random() * COMMENT_TEMPLATES.length)];

          batch3.set(commentRef, {
            postId: postData.id,
            authorId: commentUser.id,
            authorName: commentUser.displayName,
            authorHandle: commentUser.username,
            authorAvatar: commentUser.photoURL,
            content: commentContent,
            timestamp: serverTimestamp()
          });
        }
      }
      await batch3.commit();
      console.log('✅ Auto Seed: Comments created successfully!');
    } catch (err) {
      console.error('Error during auto seed:', err);
    }
  };

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
    const unsub = onSnapshot(q, async (snap) => {
      const postsList = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setPosts(postsList);
      setLoading(false);

      if (postsList.length < 30 && !hasSeeded) {
        setHasSeeded(true);
        await performAutoSeed();
      }
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
      const batch = writeBatch(db);
      const newCommentRef = doc(collection(db, 'comments'));
      
      batch.set(newCommentRef, {
        postId: selectedPost.id, 
        authorId: currentUser.id, 
        authorName: currentUser.displayName,
        authorHandle: currentUser.username, 
        authorAvatar: currentUser.photoURL,
        content: newComment.trim(), 
        timestamp: serverTimestamp()
      });

      const postRef = doc(db, 'posts', selectedPost.id);
      batch.update(postRef, {
        commentsCount: increment(1)
      });

      await batch.commit();
      setNewComment('');
    } catch (err: any) { 
      setToast({ message: 'Erro ao comentar.', type: 'error' }); 
    } finally { 
      setSubmittingComment(false); 
    }
  };

  const sortedPosts = [...posts].sort((a, b) => {
    if (feedSort === 'recent') {
      const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
      const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
      return timeB - timeA;
    } else {
      const scoreA = (a.likesCount || 0) + ((a as any).commentsCount || 0) * 2;
      const scoreB = (b.likesCount || 0) + ((b as any).commentsCount || 0) * 2;
      return scoreB - scoreA;
    }
  });

  return (
    <div className="flex-1 min-h-screen border-r border-zinc-800 bg-black min-w-0">
      <div className="sticky top-0 z-30 bg-black/85 backdrop-blur-md border-b border-zinc-800 flex flex-col">
        <div className="py-4 px-6 text-left">
          <h1 className="text-lg font-black tracking-tight text-white select-none">Página Inicial</h1>
        </div>
        
        {/* Sort Filter Tabs */}
        <div className="flex border-t border-zinc-900">
          <button
            onClick={() => setFeedSort('recent')}
            className="flex-1 py-3 text-xs font-black tracking-wider uppercase border-r border-zinc-900 transition-colors cursor-pointer text-center relative"
          >
            <span className={feedSort === 'recent' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}>Recentes</span>
            {feedSort === 'recent' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-white rounded-full"></div>}
          </button>
          <button
            onClick={() => setFeedSort('popular')}
            className="flex-1 py-3 text-xs font-black tracking-wider uppercase transition-colors cursor-pointer text-center relative"
          >
            <span className={feedSort === 'popular' ? 'text-white font-black' : 'text-zinc-500 hover:text-zinc-300'}>Relevantes</span>
            {feedSort === 'popular' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-white rounded-full"></div>}
          </button>
        </div>
      </div>

      {currentUser && <CreatePost onPublishPost={handlePublishPost} userAvatar={currentUser.photoURL} setToast={setToast} />}

      <div className="flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-zinc-500 gap-2">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span className="font-semibold text-xs">Carregando feed...</span>
          </div>
        ) : sortedPosts.length === 0 ? (
          <div className="text-center py-16 text-zinc-500 font-semibold border-b border-zinc-800">
            Nenhum post ainda.
          </div>
        ) : (
          sortedPosts.map((post) => (
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
