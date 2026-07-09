import React, { useState } from 'react';
import { auth, db, isFirebaseConfigured } from '../firebaseClient';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithRedirect, 
  signInWithPopup,
  GoogleAuthProvider 
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import { generateUniqueUsername } from '../utils';

interface AuthProps {
  setToast: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}

export default function Auth({ setToast }: AuthProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    if (!isFirebaseConfigured) {
      setToast({
        message: 'Erro: Firebase não configurado. Por favor configure o arquivo .env com suas chaves reais.',
        type: 'error',
      });
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        // 1. Create Auth User
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Initialize Firestore user document
        const baseUsername = email.split('@')[0];
        const usernameVal = await generateUniqueUsername(baseUsername);
        await setDoc(doc(db, 'users', user.uid), {
          id: user.uid,
          username: usernameVal,
          displayName: baseUsername,
          photoURL: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80`,
          credits: 0
        });

        setToast({
          message: 'Cadastro realizado com sucesso!',
          type: 'success',
        });
        setIsSignUp(false);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        setToast({ message: 'Login efetuado com sucesso!', type: 'success' });
      }
    } catch (err: any) {
      setToast({ message: `Erro: ${err.message || 'Falha na autenticação'}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async () => {
    if (!isFirebaseConfigured) {
      setToast({
        message: 'Erro: Firebase não configurado. Por favor configure o arquivo .env com suas chaves reais.',
        type: 'error',
      });
      return;
    }

    setLoading(true);
    try {
      const providerInstance = new GoogleAuthProvider();
      try {
        // Try popup login first for frictionless desktop sign-in
        await signInWithPopup(auth, providerInstance);
        setToast({ message: 'Login efetuado com sucesso!', type: 'success' });
      } catch (popupErr: any) {
        // Fallback to redirect if popup is blocked
        if (popupErr.code === 'auth/popup-blocked') {
          await signInWithRedirect(auth, providerInstance);
        } else {
          throw popupErr;
        }
      }
    } catch (err: any) {
      setToast({ message: `Erro ao iniciar Google Login: ${err.message}`, type: 'error' });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md flex flex-col gap-8">
        
        {/* Brand Logo Header */}
        <div className="flex items-center justify-center select-none mb-2">
          <img 
            src="/logo.png" 
            alt="Predix Logo" 
            className="h-20 w-auto rounded-xl invert brightness-[2] contrast-[1.1]"
          />
        </div>

        {/* Firebase Config warning */}
        {!isFirebaseConfigured && (
          <div className="bg-red-950/20 border border-red-900/30 p-4 rounded-2xl text-red-400 text-xs font-bold leading-relaxed text-left flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold mb-0.5">Firebase não configurado!</p>
              <p className="text-[11px] font-medium text-red-500">Adicione as chaves VITE_FIREBASE_API_KEY e demais parâmetros no seu arquivo .env local ou nas configurações da Vercel para ativar o login real.</p>
            </div>
          </div>
        )}

        {/* Text Headers */}
        <div className="text-center md:text-left flex flex-col gap-2">
          <h2 className="text-3xl md:text-4xl font-black text-white leading-tight">Acontecendo agora.</h2>
          <p className="text-zinc-500 font-bold text-sm">Participe do maior mercado de previsões P2P hoje mesmo.</p>
        </div>

        {/* Authentication Form Card */}
        <div className="border border-zinc-800 rounded-3xl p-6 bg-transparent flex flex-col gap-6">
          
          {/* Social Logins */}
          <div className="flex flex-col gap-3">
            {/* Google */}
            <button
              onClick={handleOAuthLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-full bg-white text-black font-extrabold text-sm hover:bg-zinc-200 disabled:opacity-40 transition-all duration-150 cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Inscrever-se com o Google</span>
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-zinc-900"></div>
            <span className="text-zinc-555 font-bold text-xs">ou</span>
            <div className="flex-1 h-px bg-zinc-900"></div>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleEmailAuth} className="flex flex-col gap-4 text-left">
            {/* Email Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-400">Endereço de e-mail</label>
              <div className="relative flex items-center bg-black border border-zinc-800 focus-within:border-sky-500 rounded-xl px-3.5 py-2.5 transition-all duration-205">
                <Mail className="text-zinc-550 w-4 h-4 shrink-0 mr-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@provedor.com"
                  className="bg-transparent text-white placeholder-zinc-700 text-xs focus:outline-none w-full font-medium"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-400">Senha</label>
              <div className="relative flex items-center bg-black border border-zinc-800 focus-within:border-sky-500 rounded-xl px-3.5 py-2.5 transition-all duration-205">
                <Lock className="text-zinc-555 w-4 h-4 shrink-0 mr-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Insira sua senha"
                  className="bg-transparent text-white placeholder-zinc-700 text-xs focus:outline-none w-full font-medium"
                  required
                />
              </div>
            </div>

            {/* Buttons */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-2 rounded-full bg-white text-black font-extrabold text-sm hover:bg-zinc-200 disabled:opacity-40 transition-all duration-150 cursor-pointer text-center"
            >
              {loading ? 'Processando...' : isSignUp ? 'Criar Conta' : 'Entrar'}
            </button>
          </form>

          <div className="flex items-center justify-between text-xs font-bold text-zinc-400">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="hover:underline text-sky-400 cursor-pointer"
            >
              {isSignUp ? 'Já tem conta? Faça Login' : 'Não tem conta? Cadastre-se'}
            </button>
          </div>
        </div>


      </div>
    </div>
  );
}
