import { useEffect } from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

export default function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl border bg-zinc-950/90 backdrop-blur-md shadow-2xl transition-all duration-300 border-zinc-800`}>
      {type === 'success' ? (
        <>
          <CheckCircle className="text-zinc-200 w-5 h-5 shrink-0" />
          <span className="text-sm font-medium text-zinc-100">{message}</span>
          <div className="absolute bottom-0 left-0 h-0.5 bg-zinc-700 rounded-b-xl w-full transition-all duration-[4000ms] ease-linear" style={{ width: '0%', animation: 'shrink 4s linear forwards' }}></div>
        </>
      ) : (
        <>
          <AlertTriangle className="text-rose-500 w-5 h-5 shrink-0 animate-bounce" />
          <span className="text-sm font-medium text-zinc-100">{message}</span>
          <div className="absolute bottom-0 left-0 h-0.5 bg-rose-500 rounded-b-xl w-full transition-all duration-[4000ms] ease-linear" style={{ width: '0%', animation: 'shrink 4s linear forwards' }}></div>
        </>
      )}
    </div>
  );
}
