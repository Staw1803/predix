import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  increment,
  query,
  limit
} from 'firebase/firestore';

const FIRST_NAMES = ['Gabriel', 'Lucas', 'Matheus', 'Pedro', 'Thiago', 'Bruno', 'Felipe', 'Rafael', 'Diego', 'Rodrigo', 'Ana', 'Julia', 'Mariana', 'Beatriz', 'Fernanda', 'Amanda', 'Larissa', 'Camila', 'Juliana', 'Isabela', 'Arthur', 'Davi', 'Lucca', 'Guilherme', 'Gustavo', 'Caio', 'Vinicius'];
const LAST_NAMES = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida'];
const BIO_TEMPLATES = [
  'Trader esportivo & entusiasta Crypto 📉',
  'Dev fullstack | apaixonado por mercados preditivos 💻',
  'Só posto previsões quentes! 🔥 Siga para lucrar',
  'Estudante de Economia, de olho nas flutuações do dólar 💵',
  'Futebol, games e cripto. O combo perfeito 🎮⚽',
  'Investidor P2P nas horas vagas 💰'
];

const POST_TEMPLATES = [
  "Barcelona vs Real Madrid hoje! Quem leva a melhor? Meu palpite é 2x1 Barça! ⚽🔴🔵",
  "A alta histórica do Bitcoin está chegando? Eu aposto que bate $100k até o fim do mês! 🚀💸",
  "Mais um dia de muito trabalho e desenvolvendo novas ferramentas. Foco total! 💻💻",
  "O que vocês acham da nova temporada de House of the Dragon? Vale o hype? 🐉🍿",
  "Alguém acompanhando os rumores da nova linha de iPhones? As câmeras parecem absurdas. 📸📱",
  "Pensando em abrir um mercado de previsão sobre a final do campeonato de vôlei. Quem apoia? 🏆🏐",
  "Que dia lindo! Ótimo para dar um passeio e planejar novas estratégias. ☀️🍃",
  "Ethereum subindo forte hoje. Será que atinge nova máxima semanal? 📈💎",
  "Dólar caindo hoje. Oportunidade de compra de ativos internacionais? 💸📉",
  "Qual a melhor criptomoeda para investir a curto prazo hoje? Mandem sugestões!"
];

const COMMENT_TEMPLATES = [
  "Concordo demais com isso! 👏",
  "Acho que vai dar o contrário hein...",
  "Excelente análise!",
  "Vou colocar umas moedas nessa previsão! 🔥",
  "Interessante isso, não tinha pensado por esse lado.",
  "Sem chances, o Real ganha fácil kkk 😂",
  "Estou de olho nessa call 👀",
  "Boa! Vamos ver no que dá.",
  "Já deixei meu like aqui!",
  "Isso muda bastante as coisas."
];

const AVATAR_IDS = [
  '1535713875002-d1d0cf377fde', '1494790108377-be9c29b29330', '1507003211169-0a1dd7228f2d',
  '1438761681033-6461ffad8d80', '1500648767791-00dcc994a43e', '1544005313-94ddf0286df2',
  '1534528741775-53994a69daeb', '1570295999919-56ceb5ecca61', '1472099645785-5658abf4ff4e',
  '1522075469751-3a6694fb2f61', '1580489944761-15a19d654956', '1633332755192-727a05c4013d'
];

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Security Check: Block unauthorized cron invokes
  const hasCronHeader = req.headers['x-vercel-cron'] === '1';
  const hasAuthHeader = req.headers['authorization'] === `Bearer ${process.env.CRON_SECRET}`;
  
  if (!hasCronHeader && !hasAuthHeader && process.env.NODE_ENV === 'production') {
    res.status(401).json({ error: "Unauthorized cron invoke." });
    return;
  }

  try {
    const firebaseConfig = {
      apiKey: process.env.VITE_FIREBASE_API_KEY,
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.VITE_FIREBASE_APP_ID,
    };

    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      throw new Error("Missing Firebase Config env keys on Vercel.");
    }

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    // 1. Generate 10 random bot users
    const generatedBots = [];
    for (let i = 0; i < 10; i++) {
      const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      const displayName = `${firstName} ${lastName}`;
      const username = `@${firstName.toLowerCase()}_${lastName.toLowerCase()}${Math.floor(Math.random() * 900 + 100)}`;
      const photoURL = `https://images.unsplash.com/photo-${AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)]}?auto=format&fit=crop&w=150&q=80`;
      const bio = BIO_TEMPLATES[Math.floor(Math.random() * BIO_TEMPLATES.length)];

      const userDocRef = await addDoc(collection(db, 'users'), {
        username,
        displayName,
        photoURL,
        bio,
        followersCount: Math.floor(Math.random() * 500 + 50),
        followingCount: Math.floor(Math.random() * 200 + 20),
        credits: Math.floor(Math.random() * 100) + 10,
        createdAt: new Date()
      });
      
      generatedBots.push({
        id: userDocRef.id,
        username,
        displayName,
        photoURL
      });
    }

    // 2. Make 4 of the new bots publish a post
    const generatedPosts = [];
    for (let i = 0; i < 4; i++) {
      const bot = generatedBots[i];
      const content = POST_TEMPLATES[Math.floor(Math.random() * POST_TEMPLATES.length)];
      const likesCount = Math.floor(Math.random() * 25) + 2;

      const postDocRef = await addDoc(collection(db, 'posts'), {
        authorId: bot.id,
        authorName: bot.displayName,
        authorHandle: bot.username,
        authorAvatar: bot.photoURL,
        content,
        likesCount,
        commentsCount: 0,
        monetized: Math.random() > 0.5,
        timestamp: new Date()
      });

      generatedPosts.push({ id: postDocRef.id, authorId: bot.id });
    }

    // 3. Select 6 existing recent posts from database to receive a comment
    const postsSnap = await getDocs(query(collection(db, 'posts'), limit(15)));
    const existingPostsList = postsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (existingPostsList.length > 0) {
      for (let i = 0; i < Math.min(6, existingPostsList.length); i++) {
        // Pick a random post
        const randomPost = existingPostsList[Math.floor(Math.random() * existingPostsList.length)];
        
        // Pick a bot user to comment
        const commentingBot = generatedBots[Math.floor(Math.random() * generatedBots.length)];
        const commentContent = COMMENT_TEMPLATES[Math.floor(Math.random() * COMMENT_TEMPLATES.length)];

        // Add comment
        await addDoc(collection(db, 'comments'), {
          postId: randomPost.id,
          authorId: commentingBot.id,
          authorName: commentingBot.displayName,
          authorHandle: commentingBot.username,
          authorAvatar: commentingBot.photoURL,
          content: commentContent,
          timestamp: new Date()
        });

        // Increment commentsCount in post
        const postDocRef = doc(db, 'posts', randomPost.id);
        await updateDoc(postDocRef, {
          commentsCount: increment(1)
        });
      }
    }

    res.status(200).json({ 
      status: "success", 
      message: "Bot automation run completed! Generated 10 users, 4 posts, and 6 comments." 
    });

  } catch (error) {
    console.error("Cron bot failed:", error);
    res.status(500).json({ error: error.message || "Failed running bot automation." });
  }
}
