import { Home, User, TrendingUp, ShoppingBag, Wallet, Coins } from 'lucide-react';

interface SidebarProps {
  credits: number;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  username: string;
  userHandle: string;
  userAvatar: string;
}

export default function Sidebar({ credits, activeTab, setActiveTab, username, userHandle, userAvatar }: SidebarProps) {
  const menuItems = [
    { id: 'feed', name: 'Início', icon: Home },
    { id: 'store', name: 'Loja', icon: ShoppingBag },
    { id: 'wallet', name: 'Carteira', icon: Wallet },
    { id: 'profile', name: 'Perfil', icon: User },
  ];



  return (
    <aside className="fixed md:sticky bottom-0 md:top-0 left-0 w-full md:h-screen md:w-64 border-t md:border-t-0 md:border-r border-zinc-800 bg-black flex md:flex-col justify-between md:justify-between px-2 py-2 md:p-4 z-40">
      <div className="flex md:flex-col gap-2 md:gap-6 w-full">
        {/* Brand logo - hidden on mobile */}
        <div className="hidden md:flex items-center gap-3 px-2 py-3">
          <div className="bg-white p-2 rounded-full">
            <TrendingUp className="text-black w-5 h-5 stroke-[3]" />
          </div>
          <span className="font-black text-xl tracking-tight text-white">
            PREDIX
          </span>
        </div>

        {/* Credits Badge - hidden on mobile */}
        <div
          onClick={() => setActiveTab('wallet')}
          className="hidden md:flex border border-zinc-850 rounded-full px-4 py-2 items-center justify-between gap-2 hover:bg-zinc-900/40 backdrop-blur-sm transition-all duration-200 shrink-0 cursor-pointer"
        >
          <span className="text-zinc-500 font-bold text-xs inline">Créditos</span>
          <span className="text-white font-extrabold text-sm flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-zinc-350 stroke-[2.2]" />
            <span>{credits.toLocaleString('pt-BR')}</span>
          </span>
        </div>

        {/* Menu Items */}
        <nav className="flex md:flex-col flex-row justify-around md:justify-start w-full gap-1 md:gap-1.5 md:mt-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex-1 md:w-full flex flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-4 px-2 py-2 md:px-4 md:py-3 rounded-2xl md:rounded-full text-xs md:text-base transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'text-white font-black bg-zinc-900/50 md:bg-transparent'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white font-medium'
                }`}
              >
                <Icon className={`w-5 h-5 md:w-5 md:h-5 ${isActive ? 'text-white stroke-[2.5]' : 'text-zinc-400'}`} />
                <span className="text-[10px] md:text-base md:block">{item.name}</span>
              </button>
            );
          })}
        </nav>

      </div>

      {/* User Info - hidden on mobile */}
      <div
        onClick={() => setActiveTab('profile')}
        className="hidden md:flex items-center gap-3 px-2 py-3 border-t border-zinc-900 mt-auto hover:bg-zinc-900 rounded-full cursor-pointer transition-all duration-150"
      >
        <img
          src={userAvatar}
          alt={username}
          className="w-9 h-9 rounded-full object-cover border border-zinc-800 shrink-0"
        />
        <div className="hidden md:flex flex-col text-left">
          <span className="font-bold text-white text-sm truncate max-w-[100px]">{username}</span>
          <span className="text-zinc-500 text-xs font-mono truncate max-w-[100px]">{userHandle}</span>
        </div>
      </div>
    </aside>
  );
}
