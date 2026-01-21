
import React, { useState } from 'react';
import { LayoutDashboard, Calendar, Users, Settings, BarChart3, X, Store, Lock, Megaphone, LogOut, Globe } from 'lucide-react';
import { PlanType } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentPlan: PlanType;
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  onLogout?: () => void;
  logoUrl?: string;
  businessName?: string;
  slug?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  currentPlan, 
  isOpen, 
  onClose,
  onLogout,
  logoUrl,
  businessName,
  slug
}) => {
  const [imgError, setImgError] = useState(false);
  
  const isLocked = (minPlan?: PlanType) => {
    if (!minPlan) return false;
    if (minPlan === PlanType.PRO && currentPlan === PlanType.START) return true;
    if (minPlan === PlanType.ELITE && currentPlan !== PlanType.ELITE) return true;
    return false;
  };

  const menuItems = [
    { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'schedule', label: 'Agenda & Boxes', icon: Calendar },
    { id: 'crm', label: 'Clientes', icon: Users },
    { id: 'marketing', label: 'Reputação', icon: Megaphone, minPlan: PlanType.PRO },
    { id: 'finance', label: 'Financeiro', icon: BarChart3, minPlan: PlanType.PRO },
    { id: 'settings', label: 'Ajustes', icon: Settings },
  ];

  const handleTabClick = (id: string) => {
    setActiveTab(id);
    onClose(); 
  };

  const handleOpenPublicLink = () => {
      if (slug) {
          window.open(`?studio=${slug}`, '_blank');
      } else {
          alert("Identificador da loja não encontrado.");
      }
  };

  return (
    <>
        {/* Mobile Backdrop */}
        {isOpen && (
            <div 
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-300"
                onClick={onClose}
            />
        )}

        <div className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-[#09090b]/95 backdrop-blur-xl border-r border-white/5 flex flex-col 
          transform transition-transform duration-500 ease-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
          md:translate-x-0 md:static md:h-full shadow-2xl md:shadow-none
        `}>
          <div className="p-8 pb-4">
            <div className="mb-10 px-0 h-57 flex items-center justify-start">
                {!imgError ? (
                    <img 
                        src="https://i.postimg.cc/wxRyvSbG/carboncarlogo.png" 
                        alt="Carbon Car" 
                        className="h-full w-auto object-contain max-w-[190px]"
                        onError={() => setImgError(true)}
                        referrerPolicy="no-referrer"
                    />
                ) : (
                    <span className="text-xl font-black text-white">CARBON CAR</span>
                )}
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors group cursor-default mb-2">
                <div className="flex items-center gap-3">
                    {logoUrl ? (
                        <img 
                          src={logoUrl} 
                          alt="Logo" 
                          className="w-8 h-8 rounded-lg object-cover bg-zinc-900 border border-white/10" 
                          onError={(e) => { e.currentTarget.src = '/placeholder.png'; }}
                        />
                    ) : (
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center border border-white/10">
                            <Store size={14} className="text-zinc-400" />
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-0.5">Hangar Ativo</p>
                        <p className="text-xs font-bold text-white truncate group-hover:text-red-500 transition-colors">{businessName || 'Carregando...'}</p>
                    </div>
                </div>
            </div>
            
            <button 
                onClick={handleOpenPublicLink}
                className="w-full py-3 bg-red-600/10 hover:bg-red-600 border border-red-600/20 hover:border-red-600 rounded-xl flex items-center justify-center gap-2 group transition-all"
            >
                <Globe size={14} className="text-red-500 group-hover:text-white transition-colors" />
                <span className="text-[9px] font-black uppercase tracking-widest text-red-500 group-hover:text-white transition-colors">Ver Loja Online</span>
            </button>
            
            <button onClick={onClose} className="md:hidden absolute top-8 right-8 text-white/40 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          <nav className="flex-1 px-4 space-y-2 mt-2 overflow-y-auto custom-scrollbar">
            {menuItems.map((item) => {
              const locked = isLocked(item.minPlan);
              const active = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => !locked && handleTabClick(item.id)}
                  disabled={locked}
                  className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl text-xs font-bold transition-all duration-300 group relative overflow-hidden
                    ${active 
                      ? 'text-white bg-white/5 border border-white/5' 
                      : 'text-zinc-500 hover:text-white hover:bg-white/5 border border-transparent'}
                    ${locked ? 'opacity-40 cursor-not-allowed hover:bg-transparent' : ''}
                  `}
                >
                  <div className="flex items-center gap-4 relative z-10">
                    <item.icon size={18} className={active ? 'text-red-500' : 'text-zinc-600 group-hover:text-white transition-colors'} />
                    <span className="tracking-widest uppercase text-[10px]">{item.label}</span>
                  </div>
                  {locked && <Lock size={12} className="text-zinc-700" />}
                </button>
              );
            })}
          </nav>

          <div className="p-6 border-t border-white/5 bg-[#09090b]">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-zinc-800 to-zinc-900 border border-white/10 flex items-center justify-center shadow-lg">
                    <span className="text-[10px] font-black text-white/40">AD</span>
                </div>
                <div>
                    <p className="text-[10px] text-white font-bold uppercase tracking-widest">Admin</p>
                    <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">Gerente</p>
                </div>
                </div>
                
                {onLogout && (
                    <button 
                        onClick={onLogout}
                        className="p-2.5 text-zinc-600 hover:text-red-500 hover:bg-red-900/10 rounded-xl transition-all"
                        title="Sair"
                    >
                        <LogOut size={16} />
                    </button>
                )}
            </div>
          </div>
        </div>
    </>
  );
};
