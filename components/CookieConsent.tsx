
import React, { useState, useEffect } from 'react';
import { Cookie, X, Shield, Check, Settings, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { LegalModal } from './LegalModal';
import { cn } from '../lib/utils';

export const CookieConsent: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  
  // Preferências
  const [preferences, setPreferences] = useState({
      essential: true,
      analytics: true,
      marketing: false
  });

  useEffect(() => {
    // Verifica consentimento existente
    const consent = localStorage.getItem('carbon_consent');
    if (!consent) {
      // Pequeno delay para animação de entrada suave
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const activateCookies = (prefs: typeof preferences) => {
      // 1. Salva persistência visual
      localStorage.setItem('carbon_consent', 'true');
      localStorage.setItem('carbon_consent_prefs', JSON.stringify(prefs));

      // 2. "Ativa" cookies reais no navegador (Simulação técnica)
      const maxAge = 60 * 60 * 24 * 365; // 1 ano
      document.cookie = `carbon_essential=true; max-age=${maxAge}; path=/; SameSite=Lax`;
      
      if (prefs.analytics) {
          document.cookie = `carbon_analytics=true; max-age=${maxAge}; path=/; SameSite=Lax`;
          console.log("[System] Cookies de Analytics Ativados");
      }
      
      if (prefs.marketing) {
          document.cookie = `carbon_marketing=true; max-age=${maxAge}; path=/; SameSite=Lax`;
          console.log("[System] Cookies de Marketing Ativados");
      }

      setIsVisible(false);
  };

  const handleAcceptAll = () => {
      const allTrue = { essential: true, analytics: true, marketing: true };
      setPreferences(allTrue);
      activateCookies(allTrue);
  };

  const handleSavePreferences = () => {
      activateCookies(preferences);
  };

  if (!isVisible) return null;

  return (
    <>
        <div className={cn(
            "fixed bottom-4 md:bottom-8 right-0 md:right-8 z-[200] w-full md:max-w-[420px] px-4 md:px-0 transition-all duration-500 ease-out",
            isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
        )}>
            <div className="bg-[#09090b]/90 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden relative group">
                
                {/* Efeito de brilho vermelho sutil no topo */}
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-red-600 to-transparent opacity-50" />
                
                <div className="p-6 md:p-8">
                    {/* Header */}
                    <div className="flex items-start gap-4 mb-4">
                        <div className="p-3 bg-zinc-900 rounded-2xl border border-white/5 shadow-inner">
                            <Cookie className="text-white" size={24} />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-sm font-black text-white uppercase tracking-wide mb-1 flex items-center gap-2">
                                Privacidade & Dados
                                <Shield size={12} className="text-green-500" />
                            </h4>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                Utilizamos cookies para otimizar a performance do Hangar. 
                                <button onClick={() => setShowLegal(true)} className="ml-1 text-white underline hover:text-red-500 transition-colors">Ler Política LGPD</button>.
                            </p>
                        </div>
                    </div>

                    {/* Expandable Preferences */}
                    <div className={cn(
                        "space-y-3 overflow-hidden transition-all duration-300",
                        isExpanded ? "max-h-[300px] mb-6 opacity-100" : "max-h-0 mb-0 opacity-0"
                    )}>
                        <div className="bg-black/40 rounded-xl p-3 border border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Lock size={14} className="text-red-500" />
                                <div>
                                    <p className="text-[10px] font-bold text-white uppercase">Essenciais</p>
                                    <p className="text-[9px] text-zinc-500">Obrigatório para segurança.</p>
                                </div>
                            </div>
                            <div className="w-8 h-4 bg-zinc-700 rounded-full opacity-50 cursor-not-allowed relative">
                                <div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full shadow-sm" />
                            </div>
                        </div>

                        <div className="bg-black/40 rounded-xl p-3 border border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Settings size={14} className="text-zinc-400" />
                                <div>
                                    <p className="text-[10px] font-bold text-white uppercase">Analytics</p>
                                    <p className="text-[9px] text-zinc-500">Melhoria de performance.</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setPreferences(p => ({...p, analytics: !p.analytics}))}
                                className={cn("w-8 h-4 rounded-full relative transition-colors", preferences.analytics ? "bg-green-600" : "bg-zinc-700")}
                            >
                                <div className={cn("absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform", preferences.analytics ? "right-0.5" : "left-0.5")} />
                            </button>
                        </div>

                        <div className="bg-black/40 rounded-xl p-3 border border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Cookie size={14} className="text-zinc-400" />
                                <div>
                                    <p className="text-[10px] font-bold text-white uppercase">Marketing</p>
                                    <p className="text-[9px] text-zinc-500">Ofertas personalizadas.</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setPreferences(p => ({...p, marketing: !p.marketing}))}
                                className={cn("w-8 h-4 rounded-full relative transition-colors", preferences.marketing ? "bg-green-600" : "bg-zinc-700")}
                            >
                                <div className={cn("absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform", preferences.marketing ? "right-0.5" : "left-0.5")} />
                            </button>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-3">
                        <button 
                            onClick={handleAcceptAll}
                            className="w-full py-4 bg-white hover:bg-zinc-200 text-black rounded-xl text-[10px] font-black uppercase tracking-widest shadow-glow flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                        >
                            <Check size={14} /> Aceitar Tudo
                        </button>
                        
                        <div className="flex gap-3">
                            <button 
                                onClick={() => isExpanded ? handleSavePreferences() : setIsExpanded(true)}
                                className="flex-1 py-3 bg-zinc-900 border border-white/10 hover:border-white/20 text-white rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all"
                            >
                                {isExpanded ? "Salvar Escolhas" : "Gerenciar"}
                            </button>
                             {isExpanded && (
                                <button 
                                    onClick={() => setIsExpanded(false)}
                                    className="px-4 py-3 bg-zinc-900 border border-white/10 text-zinc-500 hover:text-white rounded-xl transition-all"
                                >
                                    <ChevronUp size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <LegalModal 
            isOpen={showLegal} 
            type="PRIVACY" 
            onClose={() => setShowLegal(false)} 
        />
    </>
  );
};
