import React, { useState, forwardRef, useImperativeHandle, useRef } from 'react';
import { Send, Globe, MessageSquare } from 'lucide-react';

interface CreatePredictionProps {
  onPublish: (question: string, source: string, category: string) => void;
}

export interface CreatePredictionRef {
  focus: () => void;
}

const CreatePrediction = forwardRef<CreatePredictionRef, CreatePredictionProps>(({ onPublish }, ref) => {
  const [question, setQuestion] = useState('');
  const [source, setSource] = useState('');
  const [category, setCategory] = useState('Pop/Fofoca');
  
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    }
  }));

  const categories = ['Pop/Fofoca', 'Tecnologia', 'Cripto', 'Esportes', 'Cinema', 'Geral'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !source.trim()) return;
    onPublish(question, source, category);
    setQuestion('');
    setSource('');
  };

  return (
    <div className="bg-transparent border-b border-zinc-800 p-4 mb-2 flex flex-col gap-4 text-left">
      <div className="flex gap-4">
        {/* Avatar Placeholder for Redaj */}
        <img
          src="https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&w=150&q=80"
          alt="Avatar Placeholder"
          className="w-10 h-10 rounded-full object-cover border border-zinc-800 shrink-0"
        />
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4">
          {/* Question Text Area */}
          <textarea
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="O que está acontecendo? Poste sua previsão..."
            rows={2}
            className="w-full bg-transparent text-white placeholder-zinc-600 text-lg font-medium focus:outline-none resize-none py-1"
          />

          {/* Source & Category Selectors - Flat black style */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Source Input */}
            <div className="flex-1 flex items-center gap-2 px-3.5 py-2 rounded-full bg-black border border-zinc-800 focus-within:border-zinc-700 transition-all duration-200">
              <Globe className="text-zinc-500 w-3.5 h-3.5 shrink-0" />
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Fonte de Resolução (ex: G1, X oficial)"
                className="w-full bg-transparent text-zinc-200 placeholder-zinc-600 text-xs focus:outline-none"
              />
            </div>
            
            {/* Category selector */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-black border border-zinc-800 focus-within:border-zinc-700 transition-all duration-200 shrink-0">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-transparent text-zinc-300 text-xs focus:outline-none cursor-pointer pr-4 font-semibold"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat} className="bg-black text-zinc-200">
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-zinc-900 pt-3">
            <div className="flex items-center gap-1.5 text-zinc-650 text-xs font-medium">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Mercado aberto para previsões.</span>
            </div>
            
            {/* Clean White Pill Button */}
            <button
              type="submit"
              disabled={!question.trim() || !source.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black font-extrabold text-sm hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer shrink-0"
            >
              <span>Publicar</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

CreatePrediction.displayName = 'CreatePrediction';

export default CreatePrediction;
