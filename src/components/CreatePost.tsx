import React, { useState, useRef } from 'react';
import { Send, Image as ImageIcon, Smile, Coins, X, Loader, Video } from 'lucide-react';
import { storage, isFirebaseConfigured } from '../firebaseClient';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

interface CreatePostProps {
  onPublishPost: (content: string, monetized: boolean, mediaURL?: string, mediaType?: 'image' | 'video') => Promise<void>;
  userAvatar: string;
  setToast?: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}

const compressImageToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 720;
        const MAX_HEIGHT = 720;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.65));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

export default function CreatePost({ onPublishPost, userAvatar, setToast }: CreatePostProps) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [monetized, setMonetized] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [uploadProgress, setUploadProgress] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!content.trim() && !mediaFile) || isSubmitting) return;
    setIsSubmitting(true);

    try {
      let mediaURL: string | undefined;
      let finalMediaType: 'image' | 'video' | undefined;

      if (mediaFile) {
        setUploadProgress(true);
        finalMediaType = mediaType;

        if (isFirebaseConfigured) {
          try {
            const ext = mediaFile.name.split('.').pop();
            const path = `posts/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
            const sRef = storageRef(storage, path);
            await uploadBytes(sRef, mediaFile, { contentType: mediaFile.type });
            mediaURL = await getDownloadURL(sRef);
          } catch (storageErr) {
            console.warn("Storage upload failed, falling back to compressed base64:", storageErr);
            if (mediaFile.type.startsWith('image/')) {
              // Convert to highly compressed base64 image (fits easily inside 1MB Firestore limit)
              mediaURL = await compressImageToBase64(mediaFile);
            } else {
              throw new Error("Envio de vídeos requer o Firebase Storage ativo (plano Blaze).");
            }
          }
        } else {
          // Offline: use object URL (won't persist across sessions but works for demo)
          mediaURL = URL.createObjectURL(mediaFile);
        }
        setUploadProgress(false);
      }

      await onPublishPost(content.trim(), monetized, mediaURL, finalMediaType);
      setContent('');
      setMonetized(false);
      setMediaFile(null);
      setMediaPreview(null);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } catch (error: any) {
      console.error('Error publishing post:', error);
      if (setToast) {
        setToast({ 
          message: `Erro ao publicar: ${error.message || 'falha de upload'}. Verifique as regras do Firebase Storage.`, 
          type: 'error' 
        });
      }
    } finally {
      setIsSubmitting(false);
      setUploadProgress(false);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isVideo && !isImage) {
      return;
    }

    // Size limit: 50MB
    if (file.size > 50 * 1024 * 1024) {
      return;
    }

    setMediaType(isVideo ? 'video' : 'image');
    setMediaFile(file);

    const reader = new FileReader();
    reader.onload = ev => setMediaPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    e.target.value = '';
  };

  const removeMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
  };

  return (
    <div className="border-b border-zinc-800 p-4 bg-black/40 backdrop-blur-md">
      <div className="flex gap-4">
        <img
          src={userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
          alt="User Avatar"
          className="w-10 h-10 rounded-full object-cover border border-zinc-800 shrink-0 select-none pointer-events-none"
        />
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleTextareaChange}
            placeholder="O que está acontecendo?"
            rows={2}
            maxLength={280}
            className="w-full bg-transparent text-white placeholder-zinc-600 text-lg font-medium focus:outline-none resize-none py-1 border-none outline-none leading-relaxed"
            disabled={isSubmitting}
          />

          {/* Media Preview */}
          {mediaPreview && (
            <div className="relative mt-2 rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950">
              {mediaType === 'image' ? (
                <img
                  src={mediaPreview}
                  alt="Preview"
                  className="w-full max-h-72 object-contain"
                />
              ) : (
                <video
                  src={mediaPreview}
                  controls
                  className="w-full max-h-72"
                  preload="metadata"
                />
              )}
              <button
                type="button"
                onClick={removeMedia}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-black cursor-pointer transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 rounded-full px-2 py-0.5">
                {mediaType === 'video' ? <Video className="w-3 h-3 text-white" /> : <ImageIcon className="w-3 h-3 text-white" />}
                <span className="text-[10px] text-white font-bold">
                  {(mediaFile!.size / (1024 * 1024)).toFixed(1)} MB
                </span>
              </div>
            </div>
          )}

          {/* Monetization Toggle */}
          <button
            type="button"
            onClick={() => setMonetized(!monetized)}
            className={`self-start flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black border transition-all duration-200 cursor-pointer mt-2 mb-1 ${
              monetized
                ? 'bg-amber-400/10 border-amber-400/40 text-amber-400'
                : 'border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
            }`}
          >
            <Coins className={`w-3.5 h-3.5`} />
            <span>{monetized ? 'Gorjetas ativadas ✓' : 'Aceitar Gorjetas'}</span>
          </button>

          <div className="flex items-center justify-between border-t border-zinc-900 pt-3 mt-1">
            <div className="flex items-center gap-3 text-zinc-500">
              {/* Media Upload Button */}
              <button
                type="button"
                onClick={() => mediaInputRef.current?.click()}
                title="Foto ou Vídeo"
                className={`hover:text-white transition-colors duration-150 cursor-pointer p-1.5 rounded-full hover:bg-zinc-900 ${mediaFile ? 'text-sky-400' : ''}`}
              >
                <ImageIcon className="w-4 h-4" />
              </button>
              <input
                ref={mediaInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleMediaSelect}
                className="hidden"
              />
              <button type="button" className="hover:text-white transition-colors duration-150 cursor-pointer p-1.5 rounded-full hover:bg-zinc-900">
                <Smile className="w-4 h-4" />
              </button>
              {content.length > 0 && (
                <span className={`text-[10px] font-bold tabular-nums ml-1 ${content.length > 250 ? 'text-amber-400' : 'text-zinc-600'}`}>
                  {280 - content.length}
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={(!content.trim() && !mediaFile) || isSubmitting}
              className="px-5 py-2 rounded-full bg-white text-black font-extrabold text-sm hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              {isSubmitting ? (
                uploadProgress ? <><Loader className="w-3 h-3 animate-spin" />Enviando...</> : <><Loader className="w-3 h-3 animate-spin" />Postando...</>
              ) : (
                <><Send className="w-3 h-3" />Postar</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
