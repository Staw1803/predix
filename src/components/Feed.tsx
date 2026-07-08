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
  currentUserId?: string;
  onResolve?: (predictionId: string, winningChoice: boolean) => void;
}

export default function Feed({ 
  predictions, 
  onPlaceBet, 
  onPublish, 
  userBalance, 
  createPredictionRef,
  currentUserId,
  onResolve
}: FeedProps) {
  const [filter, setFilter] = useState<'hot' | 'new'>('hot');

  const sortedPredictions = [...predictions].sort((a, b) => {
    if (filter === 'hot') {
      const aTotal = a.poolYes + a.poolNo;
      const bTotal = b.poolYes + b.poolNo;
      return bTotal - aTotal;
    } else {
      // Handle alphanumeric or UUID sorting
      return b.id.localeCompare(a.id);
    }
  });

  return (
    <div className="flex-1 min-h-screen border-r border-zinc-800 bg-black min-w-0">
      {/* Feed Header - X Style Tabs */}
      <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-zinc-800">
        <div className="flex">
          <button
            onClick={() => setFilter('hot')}
            className="flex-1 py-3.5 text-xs font-black tracking-wide border-b-2 transition-all cursor-pointer text-center"
            style={{
              borderColor: filter === 'hot' ? '#ffffff' : 'transparent',
              color: filter === 'hot' ? '#ffffff' : '#71717a',
            }}
          >
            Quentes
          </button>
          <button
            onClick={() => setFilter('new')}
            className="flex-1 py-3.5 text-xs font-black tracking-wide border-b-2 transition-all cursor-pointer text-center"
            style={{
              borderColor: filter === 'new' ? '#ffffff' : 'transparent',
              color: filter === 'new' ? '#ffffff' : '#71717a',
            }}
          >
            Novas
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
                currentUserId={currentUserId}
                onResolve={onResolve}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
