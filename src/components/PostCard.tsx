import React, { useState } from 'react';
import { Heart, MessageCircle, Share2, MoreHorizontal, Coins, Sparkles } from 'lucide-react';
import type { Post } from '../types';

import { GORJETA_MOEDAS } from '../constants';

interface PostCardProps {
  post: Post & {
    authorName?: string;
    authorHandle?: string;
    authorAvatar?: string;
    monetized?: boolean;
  };
  onLike: (postId: string) => void;
  onCommentClick: (post: any) => void;
  onTip?: (postId: string, authorId: string) => void;
  currentUserId?: string;
  onUserClick?: (userId: string) => void;
}

export default function PostCard({ post, onLike, onCommentClick, onTip, currentUserId, onUserClick }: PostCardProps) {
  const [liked, setLiked] = useState(false);
  const [likeCountOffset, setLikeCountOffset] = useState(0);
  const [tipped, setTipped] = useState(false);
  const [tipping, setTipping] = useState(false);

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onLike(post.id);
    setLiked(!liked);
    setLikeCountOffset(liked ? -1 : 1);
  };

  const handleTipClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tipped || tipping || !onTip || post.authorId === currentUserId) return;
    setTipping(true);
    await onTip(post.id, post.authorId);
    setTipped(true);
    setTipping(false);
  };

  const formatTimeAgo = (timestamp: any) => {
    if (!timestamp) return 'agora';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'agora';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `há ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `há ${hours}h`;
    const days = Math.floor(hours / 24);
    return `há ${days}d`;
  };

  const name = post.authorName || 'Usuário';
  const handle = post.authorHandle || '@usuario';
  const avatar = post.authorAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';
  const isOwn = post.authorId === currentUserId;

  return (
    <div
      onClick={() => onCommentClick(post)}
      className="bg-transparent border-b border-zinc-800 p-4 hover:bg-zinc-950/20 transition-all duration-200 cursor-pointer text-left flex gap-3.5 select-none"
    >
      <img
        src={avatar}
        alt={name}
        onClick={(e) => { e.stopPropagation(); onUserClick?.(post.authorId); }}
        className="w-10 h-10 rounded-full object-cover border border-zinc-800 shrink-0 cursor-pointer select-none" 
      />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span 
              onClick={(e) => { e.stopPropagation(); onUserClick?.(post.authorId); }}
              className="font-bold text-white text-sm hover:underline cursor-pointer truncate max-w-[140px] sm:max-w-[200px]"
            >
              {name}
            </span>
            <span className="text-zinc-505 text-xs font-medium truncate max-w-[100px] sm:max-w-[150px]">{handle}</span>
            <span className="text-zinc-650 text-xs">•</span>
            <span className="text-zinc-550 text-xs shrink-0">{formatTimeAgo(post.timestamp)}</span>
            {post.monetized && (
              <span className="flex items-center gap-0.5 text-[9px] font-black text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded-full">
                <Sparkles className="w-2.5 h-2.5" />Monetizado
              </span>
            )}
          </div>
          <button className="text-zinc-600 hover:text-zinc-400 p-1 rounded-full transition-colors duration-150 cursor-pointer">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        <p className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap break-words mb-3">{post.content}</p>

        {/* Media (image or video) */}
        {(post as any).mediaURL && (
          <div className="mb-3 rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950">
            {(post as any).mediaType === 'video' ? (
              <video
                src={(post as any).mediaURL}
                controls
                preload="metadata"
                onClick={e => e.stopPropagation()}
                className="w-full max-h-80 object-contain"
              />
            ) : (
              <img
                src={(post as any).mediaURL}
                alt="Mídia do post"
                onClick={e => e.stopPropagation()}
                className="w-full max-h-80 object-cover cursor-zoom-in"
                loading="lazy"
              />
            )}
          </div>
        )}

        <div className="flex items-center gap-6 text-zinc-500 text-xs mt-1 flex-wrap">
          <button
            onClick={handleLikeClick}
            className={`group flex items-center gap-1.5 transition-colors duration-150 cursor-pointer ${liked ? 'text-red-500' : 'hover:text-red-500'}`}
          >
            <span className="p-2 rounded-full group-hover:bg-red-500/10 group-active:scale-75 transition-all duration-155">
              <Heart className={`w-4 h-4 transition-transform duration-100 ${liked ? 'fill-current stroke-current scale-110' : 'stroke-current'}`} />
            </span>
            <span className="font-semibold tabular-nums">{Math.max(0, post.likesCount + likeCountOffset)}</span>
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onCommentClick(post); }}
            className="group flex items-center gap-1.5 hover:text-sky-400 transition-colors duration-150 cursor-pointer"
          >
            <span className="p-2 rounded-full group-hover:bg-sky-400/10 group-active:scale-75 transition-all duration-155">
              <MessageCircle className="w-4 h-4 stroke-current" />
            </span>
            <span className="font-semibold">Responder</span>
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); }}
            className="group flex items-center gap-1.5 hover:text-emerald-400 transition-colors duration-150 cursor-pointer"
          >
            <span className="p-2 rounded-full group-hover:bg-emerald-400/10 group-active:scale-75 transition-all duration-155">
              <Share2 className="w-4 h-4 stroke-current" />
            </span>
          </button>

          {post.monetized && !isOwn && onTip && (
            <button
              onClick={handleTipClick}
              disabled={tipped || tipping}
              className={`group flex items-center gap-1.5 ml-auto cursor-pointer transition-all duration-150 font-bold text-[11px] px-3 py-1.5 rounded-full border ${
                tipped
                  ? 'text-zinc-500 border-zinc-850 bg-zinc-950 opacity-60 cursor-default'
                  : 'text-white border-zinc-800 bg-zinc-900 hover:bg-zinc-800 hover:border-zinc-700 active:scale-95'
              }`}
            >
              <Coins className={`w-3.5 h-3.5 text-zinc-350 stroke-[2.2] ${tipping ? 'animate-spin' : ''}`} />
              <span>{isOwn ? 'Seu Post' : (tipped ? 'Enviada' : `Gorjeta (${GORJETA_MOEDAS})`)}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
