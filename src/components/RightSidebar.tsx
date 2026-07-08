import { Search, Hash, UserPlus } from 'lucide-react';

export default function RightSidebar() {
  const trends = [
    {
      id: '1',
      tag: '#PredixSocial',
      postsCount: '1,245 posts',
    },
    {
      id: '2',
      tag: '#VercelEdge',
      postsCount: '892 posts',
    },
    {
      id: '3',
      tag: '#EfiPix',
      postsCount: '512 posts',
    },
    {
      id: '4',
      tag: '#InteligenciaArtificial',
      postsCount: '2,310 posts',
    },
  ];

  const whoToFollow = [
    { name: 'Arthur Santos', handle: '@arthur_s', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&q=80' },
    { name: 'Juliana Lima', handle: '@ju_lima', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&q=80' },
    { name: 'Gustavo Dev', handle: '@gusta_dev', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=80&q=80' },
  ];

  return (
    <aside className="hidden lg:flex flex-col gap-6 w-80 p-4 sticky top-0 h-screen overflow-y-auto bg-black border-l border-zinc-800 z-35 text-left select-none">
      {/* Search Input - X Style */}
      <div className="relative flex items-center bg-zinc-900 rounded-full px-4 py-2 border border-transparent focus-within:border-sky-500 focus-within:bg-black transition-all duration-200">
        <Search className="text-zinc-500 w-4 h-4 shrink-0 mr-3" />
        <input
          type="text"
          placeholder="Buscar no Predix..."
          className="bg-transparent text-white placeholder-zinc-500 text-xs focus:outline-none w-full font-medium"
        />
      </div>

      {/* Trending Box - Monochrome */}
      <div className="bg-transparent border border-zinc-800 rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-900">
          <Hash className="text-zinc-300 w-4 h-4" />
          <h3 className="font-extrabold text-xs text-white uppercase tracking-wider">Assuntos do momento</h3>
        </div>

        <div className="flex flex-col gap-3.5">
          {trends.map((trend) => (
            <div
              key={trend.id}
              className="flex flex-col gap-0.5 text-left cursor-pointer group"
            >
              <span className="text-xs font-bold text-zinc-200 group-hover:text-sky-400 transition-all duration-150 leading-snug">
                {trend.tag}
              </span>
              <span className="text-[10px] text-zinc-500 font-semibold">{trend.postsCount}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Who to Follow - Suggested Accounts */}
      <div className="bg-transparent border border-zinc-800 rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-900">
          <UserPlus className="text-zinc-300 w-4 h-4" />
          <h3 className="font-extrabold text-xs text-white uppercase tracking-wider">Quem seguir</h3>
        </div>

        <div className="flex flex-col gap-3.5">
          {whoToFollow.map((user) => (
            <div key={user.handle} className="flex items-center justify-between gap-3 text-left">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-8 h-8 rounded-full object-cover border border-zinc-800 shrink-0"
                />
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-zinc-200 text-xs truncate">
                    {user.name}
                  </span>
                  <span className="text-zinc-550 text-[10px] font-mono truncate">
                    {user.handle}
                  </span>
                </div>
              </div>
              
              <button className="px-3 py-1 rounded-full bg-white hover:bg-zinc-200 text-black text-[10px] font-bold transition-all duration-150 cursor-pointer shrink-0 active:scale-95">
                Seguir
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Footer credit */}
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
