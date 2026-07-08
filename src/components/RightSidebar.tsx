import { Search, Flame, TrendingUp } from 'lucide-react';

interface RightSidebarProps {
  onTrendClick?: (question: string) => void;
}

export default function RightSidebar({ onTrendClick }: RightSidebarProps) {
  const trends = [
    {
      id: '1',
      title: 'GPT-5 anunciado até o fim do trimestre?',
      category: 'Tecnologia',
      poolSize: 124500,
    },
    {
      id: '2',
      title: 'Taylor Swift anunciará novo álbum surpresa?',
      category: 'Pop/Fofoca',
      poolSize: 98200,
    },
    {
      id: '3',
      title: 'Bitcoin supera US$ 150k este ano?',
      category: 'Cripto',
      poolSize: 84320,
    },
    {
      id: '4',
      title: 'Brasil campeão da Copa do Mundo 2026?',
      category: 'Esportes',
      poolSize: 76100,
    },
  ];

  const topPredictors = [
    { rank: 1, name: 'Renato Silva', handle: '@renato_predict', profit: 24500, avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&q=80' },
    { rank: 2, name: 'Bia Crypto', handle: '@bia_crypto', profit: 18900, avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&q=80' },
    { rank: 3, name: 'Gustavo Santos', handle: '@guga_bets', profit: 15420, avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=80&q=80' },
  ];

  return (
    <aside className="hidden lg:flex flex-col gap-6 w-80 p-4 sticky top-0 h-screen overflow-y-auto bg-black border-l border-zinc-800 z-35 text-left">
      {/* Search Input - X Style */}
      <div className="relative flex items-center bg-zinc-900 rounded-full px-4 py-2 border border-transparent focus-within:border-sky-500 focus-within:bg-black transition-all duration-200">
        <Search className="text-zinc-500 w-4 h-4 shrink-0 mr-3" />
        <input
          type="text"
          placeholder="Buscar previsões ou perfis..."
          className="bg-transparent text-white placeholder-zinc-500 text-xs focus:outline-none w-full font-medium"
        />
      </div>

      {/* Trending Box - Monochrome */}
      <div className="bg-transparent border border-zinc-800 rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-900">
          <Flame className="text-zinc-300 w-4 h-4" />
          <h3 className="font-extrabold text-xs text-white uppercase tracking-wider">O que está acontecendo</h3>
        </div>

        <div className="flex flex-col gap-3.5">
          {trends.map((trend) => (
            <div
              key={trend.id}
              onClick={() => onTrendClick?.(trend.title)}
              className="flex flex-col gap-0.5 text-left cursor-pointer group"
            >
              <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase">
                <span>{trend.category}</span>
                <span className="font-mono">🪙 {trend.poolSize.toLocaleString()}</span>
              </div>
              <span className="text-xs font-bold text-zinc-200 group-hover:text-sky-400 group-hover:underline transition-all duration-150 leading-snug">
                {trend.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard - Monochrome */}
      <div className="bg-transparent border border-zinc-800 rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-900">
          <TrendingUp className="text-zinc-300 w-4 h-4" />
          <h3 className="font-extrabold text-xs text-white uppercase tracking-wider">Top Predictors</h3>
        </div>

        <div className="flex flex-col gap-3">
          {topPredictors.map((user) => (
            <div key={user.rank} className="flex items-center justify-between gap-3 text-left">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-zinc-500 font-bold text-xs w-4 text-center">
                  {user.rank}
                </span>
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
              
              <div className="text-right shrink-0">
                <span className="text-white font-extrabold text-xs">
                  +{user.profit.toLocaleString()}
                </span>
                <span className="text-zinc-550 text-[9px] block">moedas</span>
              </div>
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
        <a href="#" className="hover:underline">Regras</a>
        <span>•</span>
        <span>© 2026 Predix Inc.</span>
      </div>
    </aside>
  );
}
