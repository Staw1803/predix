import React, { useState } from 'react';
import CreatePrediction from './CreatePrediction';
import type { CreatePredictionRef } from './CreatePrediction';
import PostCard from './PostCard';
import type { Prediction } from '../types';

interface FeedProps {
  predictions: Prediction[];
  onPlaceBet: (predictionId: string, choice: 'YES' | 'NO', amount: number) => boolean;
  onPublish: (question: string, source: string, category: string) => void;
  userBalance: number;
  createPredictionRef: React.RefObject<CreatePredictionRef | null>;
}

export default function Feed({ predictions, onPlaceBet, onPublish, userBalance, createPredictionRef }: FeedProps) {
  const [filter, setFilter] = useState<'hot' | 'new'>('hot');

  const sortedPredictions = [...predictions].sort((a, b) => {
    if (filter === 'hot') {
      const aTotal = a.poolYes + a.poolNo;
      const bTotal = b.poolYes + b.poolNo;
      return bTotal - aTotal;
    } else {
      return parseInt(b.id, 10) - parseInt(a.id, 10);
    }
  });

  return (
    <div className="flex-1 min-h-screen border-r border-zinc-800 bg-black min-w-0">
      {/* Feed Header - X Style Tabs */}
      <div className="sticky top-0 z-30 bg-black/85 backdrop-blur-md border-b border-zinc-800">
        <div className="px-4 pt-3 pb-1">
          <h2 className="text-lg font-bold text-white tracking-tight text-left">Página Inicial</h2>
        </div>
        <div className="flex border-t border-zinc-900">
          {/* Hot Tab */}
          <button
            onClick={() => setFilter('hot')}
            className="flex-1 text-center py-3.5 hover:bg-zinc-900/60 transition-colors relative cursor-pointer"
          >
            <span className={`text-xs uppercase tracking-wider ${filter === 'hot' ? 'font-black text-white' : 'font-semibold text-zinc-500'}`}>
              Em Destaque
            </span>
            {filter === 'hot' && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-sky-500 rounded-full"></div>
            )}
          </button>
          
          {/* New Tab */}
          <button
            onClick={() => setFilter('new')}
            className="flex-1 text-center py-3.5 hover:bg-zinc-900/60 transition-colors relative cursor-pointer"
          >
            <span className={`text-xs uppercase tracking-wider ${filter === 'new' ? 'font-black text-white' : 'font-semibold text-zinc-500'}`}>
              Novas
            </span>
            {filter === 'new' && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-sky-500 rounded-full"></div>
            )}
          </button>
        </div>
      </div>

      <div>
        {/* Creation Form */}
        <CreatePrediction ref={createPredictionRef} onPublish={onPublish} />

        {/* Prediction Cards */}
        <div className="flex flex-col">
          {sortedPredictions.length === 0 ? (
            <div className="text-center py-12 text-zinc-550 font-semibold border-b border-zinc-800">
              Nenhuma previsão ativa no momento. Seja o primeiro a criar uma!
            </div>
          ) : (
            sortedPredictions.map((pred) => (
              <PostCard
                key={pred.id}
                prediction={pred}
                onPlaceBet={onPlaceBet}
                userBalance={userBalance}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
