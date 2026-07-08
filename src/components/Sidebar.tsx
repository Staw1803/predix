import { Home, PlusCircle, Wallet, User, TrendingUp, ShoppingBag } from 'lucide-react';

interface SidebarProps {
  balance: number;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onCreateBetClick: () => void;
  username: string;
  userHandle: string;
  userAvatar: string;
}

export default function Sidebar({ balance, activeTab, setActiveTab, onCreateBetClick, username, userHandle, userAvatar }: SidebarProps) {
  const menuItems = [
    { id: 'feed', name: 'Início', icon: Home },
    { id: 'create', name: 'Criar Aposta', icon: PlusCircle, action: onCreateBetClick },
    { id: 'wallet', name: 'Carteira', icon: Wallet },
    { id: 'store', name: 'Loja', icon: ShoppingBag },
    { id: 'profile', name: 'Perfil', icon: User },
  ];

  return (
    <aside className="fixed md:sticky top-0 left-0 h-screen w-20 md:w-64 border-r border-zinc-800 bg-black flex flex-col justify-between p-4 z-40">
      <div className="flex flex-col gap-6">
        {/* Brand logo - Plain white */}
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="bg-white p-2 rounded-full">
            <TrendingUp className="text-black w-5 h-5 stroke-[3]" />
          </div>
          <span className="hidden md:block font-black text-xl tracking-tight text-white">
            PREDIX
          </span>
        </div>

        {/* Balance Badge - Simple flat pill */}
        <div className="border border-zinc-800 rounded-full px-4 py-2 flex items-center justify-between gap-2 hover:bg-zinc-900 transition-all duration-200 shrink-0">
          <span className="text-zinc-550 font-bold text-xs hidden md:inline">Saldo</span>
          <span className="text-white font-extrabold text-sm flex items-center gap-1 mx-auto md:mx-0">
            <span>🪙</span>
            <span>{balance.toLocaleString()}</span>
          </span>
        </div>

        {/* Menu Items - X Style */}
        <nav className="flex flex-col gap-1.5 mt-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.action) {
                    item.action();
                  } else {
                    setActiveTab(item.id);
                  }
                }}
                className={`w-full flex items-center justify-center md:justify-start gap-4 px-4 py-3 rounded-full text-base transition-all duration-150 cursor-pointer ${
                  isActive 
                    ? 'text-white font-black bg-transparent' 
                    : 'text-zinc-300 hover:bg-zinc-900 hover:text-white font-medium'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white stroke-[2.5]' : 'text-zinc-300'}`} />
                <span className="hidden md:block">{item.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Info - Dynamic */}
      <div className="flex items-center gap-3 px-2 py-3 border-t border-zinc-900 mt-auto hover:bg-zinc-900 rounded-full cursor-pointer transition-all duration-150">
        <img
          src={userAvatar}
          alt={username}
          className="w-9 h-9 rounded-full object-cover border border-zinc-800 shrink-0"
        />
        <div className="hidden md:flex flex-col text-left">
          <span className="font-bold text-white text-sm">{username}</span>
          <span className="text-zinc-550 text-xs font-mono">{userHandle}</span>
        </div>
      </div>
    </aside>
  );
}
