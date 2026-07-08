import React, { useState } from 'react';
import { Heart, MessageCircle, Share2, MoreHorizontal } from 'lucide-react';
import type { Post } from '../types';

interface PostCardProps {
  post: Post & {
    authorName?: string;
    authorHandle?: string;
    authorAvatar?: string;
  };
  onLike: (postId: string) => void;
  onCommentClick: (post: any) => void;
}

export default function PostCard({ post, onLike, onCommentClick }: PostCardProps) {
  const [liked, setLiked] = useState(false);
  const [likeCountOffset, setLikeCountOffset] = useState(0);

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onLike(post.id);
    // Visual feedback helper
    setLiked(!liked);
    setLikeCountOffset(liked ? -1 : 1);
  };

  // Format Firestore timestamp
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

  return (
    <div 
      onClick={() => onCommentClick(post)}
      className="bg-transparent border-b border-zinc-800 p-4 hover:bg-zinc-950/20 transition-all duration-200 cursor-pointer text-left flex gap-3.5 select-none"
    >
      {/* Avatar */}
      <img
        src={avatar}
        alt={name}
        className="w-10 h-10 rounded-full object-cover border border-zinc-800 shrink-0 select-none pointer-events-none"
      />

      {/* Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header line */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="font-bold text-white text-sm hover:underline cursor-pointer truncate max-w-[140px] sm:max-w-[200px]">
              {name}
            </span>
            <span className="text-zinc-500 text-xs font-medium truncate max-w-[100px] sm:max-w-[150px]">
              {handle}
            </span>
            <span className="text-zinc-650 text-xs">•</span>
            <span className="text-zinc-550 text-xs shrink-0">
              {formatTimeAgo(post.timestamp)}
            </span>
          </div>
          <button className="text-zinc-600 hover:text-zinc-400 p-1 rounded-full transition-colors duration-150 cursor-pointer">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Post text content */}
        <p className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap break-words mb-3">
          {post.content}
        </p>

        {/* Footer/Actions Row */}
        <div className="flex items-center gap-10 text-zinc-500 text-xs mt-1">
          {/* Like Button */}
          <button
            onClick={handleLikeClick}
            className={`group flex items-center gap-1.5 transition-colors duration-150 cursor-pointer ${
              liked ? 'text-red-500' : 'hover:text-red-500'
            }`}
          >
            <span className="p-2 rounded-full group-hover:bg-red-500/10 group-active:scale-75 transition-all duration-155">
              <Heart 
                className={`w-4 h-4 transition-transform duration-100 ${
                  liked ? 'fill-current stroke-current scale-110' : 'stroke-current'
                }`} 
              />
            </span>
            <span className="font-semibold tabular-nums">
              {Math.max(0, post.likesCount + likeCountOffset)}
            </span>
          </button>

          {/* Comment Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCommentClick(post);
            }}
            className="group flex items-center gap-1.5 hover:text-sky-400 transition-colors duration-150 cursor-pointer"
          >
            <span className="p-2 rounded-full group-hover:bg-sky-400/10 group-active:scale-75 transition-all duration-155">
              <MessageCircle className="w-4 h-4 stroke-current" />
            </span>
            <span className="font-semibold">Responder</span>
          </button>

          {/* Share Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="group flex items-center gap-1.5 hover:text-emerald-400 transition-colors duration-150 cursor-pointer ml-auto sm:ml-0"
          >
            <span className="p-2 rounded-full group-hover:bg-emerald-400/10 group-active:scale-75 transition-all duration-155">
              <Share2 className="w-4 h-4 stroke-current" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
