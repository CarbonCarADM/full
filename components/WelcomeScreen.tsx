
import React, { useState, useEffect } from 'react';
import { Lock, ChevronRight, ScanLine, ArrowRight, LogIn, UserPlus, ChevronLeft } from 'lucide-react';
import { cn } from '../lib/utils';

interface WelcomeScreenProps {
  onSelectFlow: (role: 'CLIENT' | 'ADMIN', mode: 'LOGIN' | 'REGISTER' | 'GUEST') => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSelectFlow }) => {
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState<'INITIAL' | 'CLIENT_OPTIONS'>('INITIAL');

  useEffect(() => {
    // Simula um carregamento rápido do sistema
    const timer = setTimeout(() => setBooting(false), 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col font-sans relative overflow-hidden selection:bg-red-900 selection:text-white">
      
      {/* --- ESTILOS PARA ANIMAÇÃO DE PARTÍCULAS (INLINE PARA NÃO ALTERAR CONFIG GLOBAL) --- */}
      <style>{`
        @keyframes float-particle {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          20% { opacity: 0.5; }
          80% { opacity: 0.5; }
          100% { transform: translateY(-100vh) translateX(20px); opacity: 0; }
        }
        .particle {
          position: absolute;
          background: white;
          border-radius: 50%;
          opacity: 0;
          animation: float-particle linear infinite;
        }
        .carbon-pattern {
            background-color: #050505;
            background-image: 
                linear-gradient(27deg, #09090b 50%, transparent 50%),
                linear-gradient(207deg, #09090b 50%, transparent 50%),
                linear-gradient(127deg, #0f0f10 50%, transparent 50%),
                linear-gradient(307deg, #0f0f10 50%, transparent 50%);
            background-size: 8px 8px;
        }
      `}</style>

      {/* --- BACKGROUND LAYERS --- */}
      
      {/* 1. Carbon Texture */}
      <div className="absolute inset-0 carbon-pattern opacity-40 z-0 pointer-events-none" />

      {/* 2. Radial Gradient (Vignette/Spotlight Depth) */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900/0 via-[#000000]/60 to-[#000000] z-0 pointer-events-none" />

      {/* 3. Floating Particles */}
      <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
          {/* Gerando partículas manualmente com delays variados */}
          {[...Array(15)].map((_, i) => (
              <div 
                key={i}
                className="particle bg-red-500"
                style={{
                    left: `${Math.random() * 100}%`,
                    bottom: '-10px',
                    width: `${Math.random() * 3 + 1}px`,
                    height: `${Math.random() * 3 + 1}px`,
                    animationDuration: `${Math.random() * 10 + 10}s`,
                    animationDelay: `${Math.random() * 5}s`,
                    opacity: 0.3
                }}
              />
          ))}
          {[...Array(10)].map((_, i) => (
              <div 
                key={`w-${i}`}
                className="particle bg-white"
                style={{
                    left: `${Math.random() * 100}%`,
                    bottom: '-10px',
                    width: `${Math.random() * 2 + 1}px`,
                    height: `${Math.random() * 2 + 1}px`,
                    animationDuration: `${Math.random() * 15 + 15}s`,
                    animationDelay: `${Math.random() * 10}s`,
                    opacity: 0.1
                }}
              />
          ))}
      </div>

      {/* 4. Volumetric Lighting (Glow Sutil) */}
      <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] bg-red-900/10 blur-[150px] rounded-full pointer-events-none z-10 mix-blend-screen" />

      {/* --- HUD HEADER --- */}
      <header className="relative z-30 w-full p-8 md:p-10 flex justify-between items-center animate-in slide-in-from-top-10 duration-1000 fade-in">
          <div className="flex items-center gap-4">
               <img 
                   src="https://i.postimg.cc/wxRyvSbG/carboncarlogo.png" 
                   alt="CarbonCar"
                   className="h-7 w-auto object-contain opacity-90"
               />
               <div className="h-6 w-px bg-white/10 hidden md:block" />
               <div className="flex flex-col justify-center">
                   <span className="text-[10px] font-bold text-zinc-400 tracking-[0.2em] uppercase leading-tight">Carbon OS</span>
                   <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest leading-tight">V1.0 Stable • Secure</span>
               </div>
          </div>

          <div className="flex items-center gap-2">
              <button 
                onClick={() => onSelectFlow('ADMIN', 'LOGIN')}
                className="group flex items-center gap-3 px-5 py-2 rounded-full border border-white/5 bg-white/[0.02] hover:bg-white/[0.08] hover:border-white/10 transition-all duration-500 backdrop-blur-md"
              >
                <span className="hidden md:block text-[9px] font-bold text-zinc-500 group-hover:text-zinc-300 uppercase tracking-widest transition-colors">Staff Access</span>
                <Lock size={12} className="text-zinc-600 group-hover:text-white transition-colors" />
              </button>
          </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="relative z-30 flex-1 flex flex-col justify-center px-8 md:px-20 lg:px-32 pb-20">
         
         <div className={cn(
             "max-w-4xl transition-all duration-1000 ease-out", 
             booting ? "opacity-0 translate-y-10 blur-sm" : "opacity-100 translate-y-0 blur-0"
         )}>
            
            {/* TAGLINE */}
            <div className="flex items-center gap-4 mb-6 overflow-hidden">
                <div className="h-px w-10 bg-red-600 shadow-[0_0_10px_#dc2626]" />
                <p className="text-red-500 font-bold text-[10px] md:text-xs tracking-[0.4em] uppercase text-shadow-glow">
                    Automotive Intelligence
                </p>
            </div>

            {/* HERO TITLE */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white leading-[0.95] tracking-tighter mb-8 drop-shadow-2xl">
                DETALHES QUE <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-500 via-zinc-200 to-zinc-600">DEFINEM A PERFEIÇÃO.</span>
            </h1>

            {/* INTERACTIVE AREA */}
            <div className="mt-8 w-full max-w-md min-h-[180px]">
                {view === 'INITIAL' ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-700">
                        <p className="text-zinc-400 text-xs md:text-sm font-medium leading-relaxed max-w-md border-l border-white/10 pl-5">
                            A plataforma definitiva para agendamento e gestão de estética automotiva de alta performance.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-4">
                            <button 
                                onClick={() => setView('CLIENT_OPTIONS')}
                                className="group relative px-8 py-4 bg-white text-black rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(255,255,255,0.1)] flex-1 sm:flex-none"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-zinc-200 to-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="relative flex items-center justify-center gap-3">
                                    <span className="text-[10px] font-black uppercase tracking-widest">Acessar Hangar</span>
                                    <ArrowRight size={14} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" />
                                </div>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-8 duration-500">
                         <div className="flex items-center gap-3 mb-4">
                            <button 
                                onClick={() => setView('INITIAL')} 
                                className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/5 transition-all group"
                            >
                                <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                            </button>
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Selecione seu acesso</span>
                         </div>

                         <div className="grid gap-2">
                             <button 
                                onClick={() => onSelectFlow('CLIENT', 'LOGIN')}
                                className="w-full p-4 bg-[#0a0a0a]/80 hover:bg-[#111] border border-white/10 hover:border-red-600/50 rounded-xl group transition-all duration-300 flex items-center justify-between backdrop-blur-md shadow-2xl relative overflow-hidden"
                             >
                                 <div className="absolute inset-0 bg-gradient-to-r from-red-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                 <div className="relative flex items-center gap-4">
                                     <div className="w-10 h-10 rounded-lg bg-black border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                                         <LogIn size={16} className="text-white group-hover:text-red-500 transition-colors" />
                                     </div>
                                     <div className="text-left">
                                         <span className="block text-white font-black uppercase tracking-tight text-sm group-hover:text-red-500 transition-colors">Já sou Cliente</span>
                                         <span className="block text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Login Seguro</span>
                                     </div>
                                 </div>
                                 <ChevronRight size={14} className="text-zinc-700 group-hover:text-white group-hover:translate-x-1 transition-all relative" />
                             </button>

                             <button 
                                onClick={() => onSelectFlow('CLIENT', 'REGISTER')}
                                className="w-full p-4 bg-zinc-900/30 hover:bg-white/5 border border-white/5 hover:border-white/20 rounded-xl group transition-all duration-300 flex items-center justify-between backdrop-blur-sm"
                             >
                                 <div className="flex items-center gap-4">
                                     <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                                         <UserPlus size={16} className="text-zinc-400 group-hover:text-white transition-colors" />
                                     </div>
                                     <div className="text-left">
                                         <span className="block text-zinc-300 font-bold uppercase tracking-tight text-sm group-hover:text-white transition-colors">Criar Conta</span>
                                         <span className="block text-[8px] text-zinc-600 font-bold uppercase tracking-widest group-hover:text-zinc-500">Primeiro Acesso</span>
                                     </div>
                                 </div>
                                 <ChevronRight size={14} className="text-zinc-800 group-hover:text-white group-hover:translate-x-1 transition-all" />
                             </button>
                         </div>
                    </div>
                )}
            </div>

         </div>
      </main>

      {/* --- FOOTER DECORATION --- */}
      <footer className="absolute bottom-0 w-full p-8 md:p-10 flex justify-between items-end z-30 pointer-events-none">
          <div className="flex flex-col gap-2">
              <div className="w-20 h-px bg-gradient-to-r from-zinc-500 to-transparent" />
              <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">
                  System Architecture <br/> <span className="text-zinc-400">NextGen Framework</span>
              </p>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
               <div className="text-right">
                   <p className="text-[7px] font-black text-zinc-600 uppercase tracking-[0.2em]">Server Latency</p>
                   <p className="text-[10px] font-bold text-green-500 tabular-nums">12ms</p>
               </div>
               <div className="text-right">
                   <p className="text-[7px] font-black text-zinc-600 uppercase tracking-[0.2em]">Encryption</p>
                   <p className="text-[10px] font-bold text-zinc-400">AES-256</p>
               </div>
          </div>
      </footer>
      
      {/* Decorative Grid Line */}
      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent z-20" />
    </div>
  );
};
