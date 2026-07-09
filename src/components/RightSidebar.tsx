import { useState, useEffect } from 'react';
import { Search, Hash, UserPlus, Loader } from 'lucide-react';
import { db, isFirebaseConfigured } from '../firebaseClient';
import { collection, query, getDocs, doc, onSnapshot, writeBatch, serverTimestamp, increment, where } from 'firebase/firestore';

const STATIC_TRENDS = [
  { id: '1', tag: '#PredixSocial', postsCount: '1.245 posts' },
  { id: '2', tag: '#PixBrasil', postsCount: '892 posts' },
  { id: '3', tag: '#EfiPix', postsCount: '512 posts' },
  { id: '4', tag: '#InteligenciaArtificial', postsCount: '2.310 posts' },
];

interface RightSidebarProps {
  currentUserId: string | null;
  onUserClick: (userId: string) => void;
}

export default function RightSidebar({ currentUserId, onUserClick }: RightSidebarProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [followedUserIds, setFollowedUserIds] = useState<Set<string>>(new Set());

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Fetch all users for search query filtering
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const fetchAll = async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Error fetching all users for search:', err);
      }
    };
    fetchAll();
  }, []);

  // Filter search results
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const cleanQuery = searchQuery.toLowerCase().replace('@', '');
    const filtered = allUsers.filter(u => 
      u.id !== currentUserId && 
      ((u.displayName || '').toLowerCase().includes(cleanQuery) || 
       (u.username || '').toLowerCase().includes(cleanQuery))
    );
    setSearchResults(filtered.slice(0, 5));
  }, [searchQuery, allUsers, currentUserId]);

  // Listen to followed users
  useEffect(() => {
    if (!isFirebaseConfigured || !currentUserId) {
      setFollowedUserIds(new Set());
      return;
    }
    const q = query(collection(db, 'follows'), where('followerId', '==', currentUserId));
    const unsub = onSnapshot(q, (snap) => {
      const ids = new Set<string>();
      snap.docs.forEach(doc => {
        ids.add(doc.data().followingId);
      });
      setFollowedUserIds(ids);
    }, (err) => {
      console.error('Error fetching follows:', err);
    });

    return () => unsub();
  }, [currentUserId]);

  // Load suggested users (Who to follow)
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setUsers([
        { id: '1', displayName: 'Arthur Santos', username: '@arthur_s', photoURL: 'https://i.pravatar.cc/80?img=11' },
        { id: '2', displayName: 'Juliana Lima', username: '@ju_lima', photoURL: 'https://i.pravatar.cc/80?img=5' },
        { id: '3', displayName: 'Gustavo Dev', username: '@gusta_dev', photoURL: 'https://i.pravatar.cc/80?img=15' },
      ]);
      setLoadingUsers(false);
      return;
    }

    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.id !== currentUserId && !followedUserIds.has(u.id));
      
      // Shuffle & take 3
      const shuffled = [...list].sort(() => 0.5 - Math.random());
      setUsers(shuffled.slice(0, 3));
      setLoadingUsers(false);
    }, (err) => {
      console.error('Error fetching suggested users:', err);
      setLoadingUsers(false);
    });

    return () => unsub();
  }, [currentUserId, followedUserIds]);

  const handleFollow = async (e: React.MouseEvent, targetUserId: string) => {
    e.stopPropagation();
    if (!currentUserId || !isFirebaseConfigured) return;
    try {
      const followId = `${currentUserId}_${targetUserId}`;
      const batch = writeBatch(db);
      
      batch.set(doc(db, 'follows', followId), {
        followerId: currentUserId,
        followingId: targetUserId,
        timestamp: serverTimestamp()
      });
      batch.update(doc(db, 'users', currentUserId), { followingCount: increment(1) });
      batch.update(doc(db, 'users', targetUserId), { followersCount: increment(1) });
      
      await batch.commit();
    } catch (err) {
      console.error('Error following user from sidebar:', err);
    }
  };

  return (
    <aside className="hidden lg:flex flex-col gap-6 w-80 p-4 sticky top-0 h-screen overflow-y-auto bg-black border-l border-zinc-800 z-35 text-left select-none">
      
      {/* Search Input Box */}
      <div className="relative">
        <div className="relative flex items-center bg-zinc-900 rounded-full px-4 py-2 border border-transparent focus-within:border-zinc-700 focus-within:bg-black transition-all duration-200">
          <Search className="text-zinc-500 w-4 h-4 shrink-0 mr-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchResults(true);
            }}
            onFocus={() => setShowSearchResults(true)}
            placeholder="Buscar no Predix..."
            className="bg-transparent text-white placeholder-zinc-500 text-xs focus:outline-none w-full font-medium"
          />
        </div>

        {/* Search Results Dropdown Overlay */}
        {showSearchResults && searchQuery.trim() && (
          <div 
            className="absolute left-0 right-0 mt-2 bg-zinc-950 border border-zinc-800 rounded-2xl p-2.5 shadow-2xl z-50 flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-150"
            onMouseLeave={() => setShowSearchResults(false)}
          >
            {searchResults.length === 0 ? (
              <div className="text-zinc-500 text-[10px] py-3 text-center font-semibold">Nenhum perfil encontrado.</div>
            ) : (
              searchResults.map(u => (
                <div 
                  key={u.id}
                  onClick={() => {
                    onUserClick(u.id);
                    setSearchQuery('');
                    setShowSearchResults(false);
                  }}
                  className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-zinc-900 cursor-pointer transition-all duration-100"
                >
                  <img
                    src={u.photoURL || `https://i.pravatar.cc/80?u=${u.id}`}
                    alt=""
                    className="w-7 h-7 rounded-full object-cover border border-zinc-800"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-zinc-200 text-xs font-bold truncate leading-tight">{u.displayName}</span>
                    <span className="text-zinc-500 text-[9px] font-mono truncate">{u.username}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="bg-transparent border border-zinc-850 rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-900">
          <Hash className="text-zinc-400 w-4 h-4" />
          <h3 className="font-extrabold text-[10px] text-zinc-400 uppercase tracking-widest">Assuntos do momento</h3>
        </div>
        <div className="flex flex-col gap-3.5">
          {STATIC_TRENDS.map((trend) => (
            <div key={trend.id} className="flex flex-col gap-0.5 text-left cursor-pointer group">
              <span className="text-xs font-bold text-zinc-200 group-hover:text-white transition-all duration-150 leading-snug">{trend.tag}</span>
              <span className="text-[10px] text-zinc-500 font-semibold">{trend.postsCount}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-transparent border border-zinc-850 rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-900">
          <UserPlus className="text-zinc-400 w-4 h-4" />
          <h3 className="font-extrabold text-[10px] text-zinc-400 uppercase tracking-widest">Quem seguir</h3>
        </div>
        {loadingUsers ? (
          <div className="flex items-center justify-center py-4 text-zinc-600">
            <Loader className="w-4 h-4 animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-zinc-600 text-[10px] py-4 text-center font-semibold">Tudo pronto! Você já segue todos.</div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {users.map((user) => (
              <div 
                key={user.id} 
                onClick={() => onUserClick(user.id)}
                className="flex items-center justify-between gap-3 text-left cursor-pointer group/item"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={user.photoURL || `https://i.pravatar.cc/80?u=${user.id}`}
                    alt={user.displayName}
                    className="w-8 h-8 rounded-full object-cover border border-zinc-800 shrink-0"
                    onError={(e: any) => { e.target.src = `https://i.pravatar.cc/80?u=${user.id}`; }}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-zinc-200 text-xs truncate group-hover/item:underline">{user.displayName}</span>
                    <span className="text-zinc-500 text-[10px] font-mono truncate">
                      {user.username?.startsWith('@') ? user.username : `@${user.username || user.id.slice(0, 8)}`}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={(e) => handleFollow(e, user.id)}
                  className="px-3 py-1 rounded-full bg-white hover:bg-zinc-200 text-black text-[10px] font-black transition-all duration-150 cursor-pointer shrink-0 active:scale-95"
                >
                  Seguir
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-[10px] text-zinc-600 font-semibold px-2 flex flex-wrap gap-x-2 gap-y-1 justify-center leading-normal">
        <a href="#" className="hover:underline">Privacidade</a>
        <span>•</span>
        <a href="#" className="hover:underline">Termos</a>
        <span>•</span>
        <a href="#" className="hover:underline">Diretrizes</a>
        <span>•</span>
        <span>© 2026 Predix Inc.</span>
      </div>
    </aside>
  );
}
