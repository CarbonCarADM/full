
import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, ArrowRight, Sparkles, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { cn } from '../lib/utils';

interface OnboardingWidgetProps {
  businessId: string;
  onNavigate: (tab: string) => void;
}

export const OnboardingWidget: React.FC<OnboardingWidgetProps> = ({ businessId, onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState({
    hasServices: false,
    hasHours: false,
    hasAppointments: false
  });

  useEffect(() => {
    if (!businessId) return;

    const checkProgress = async () => {
      try {
        // 1. Verificar Serviços
        const { count: servicesCount } = await supabase
          .from('services')
          .select('*', { count: 'exact', head: true })
          .eq('business_id', businessId);

        // 2. Verificar Agendamentos
        const { count: appointmentsCount } = await supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .eq('business_id', businessId);

        // 3. Verificar Horários (JSONB na tabela business_settings)
        const { data: settings } = await supabase
          .from('business_settings')
          .select('configs')
          .eq('id', businessId)
          .single();

        const hasOperatingDays = settings?.configs?.operating_days && settings.configs.operating_days.length > 0;

        setSteps({
          hasServices: (servicesCount || 0) > 0,
          hasAppointments: (appointmentsCount || 0) > 0,
          hasHours: !!hasOperatingDays
        });
      } catch (error) {
        console.error("Erro ao verificar onboarding:", error);
      } finally {
        setLoading(false);
      }
    };

    checkProgress();
  }, [businessId]);

  // Calcula progresso
  const totalSteps = 3;
  const completedSteps = Object.values(steps).filter(Boolean).length;
  const progress = (completedSteps / totalSteps) * 100;

  // Se tudo estiver pronto, o widget desaparece
  if (!loading && completedSteps === totalSteps) return null;

  return (
    <div className="mb-8 animate-in slide-in-from-top-4 duration-700">
      <div className="relative bg-[#0c0c0c] border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl group">
        
        {/* Decorative Background */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/5 blur-[80px] rounded-full pointer-events-none" />

        {/* Progress Bar Top */}
        <div className="h-1 w-full bg-zinc-900">
            <div 
                className="h-full bg-gradient-to-r from-red-600 to-red-500 shadow-[0_0_10px_rgba(220,38,38,0.5)] transition-all duration-1000 ease-out" 
                style={{ width: `${progress}%` }} 
            />
        </div>

        <div className="p-6 md:p-8 relative z-10 flex flex-col md:flex-row gap-8 items-start md:items-center">
            
            {/* Left: Info */}
            <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-red-600/10 rounded-lg border border-red-600/20">
                        <Sparkles size={16} className="text-red-500" />
                    </div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">
                        Configuração do Hangar
                    </h3>
                </div>
                <p className="text-zinc-500 text-xs font-medium leading-relaxed max-w-md pl-11">
                    Complete os passos essenciais para ativar 100% da capacidade operacional do seu sistema CarbonCar.
                </p>
            </div>

            {/* Right: Steps List */}
            <div className="w-full md:w-auto flex flex-col gap-3 min-w-[300px]">
                {loading ? (
                    <div className="flex items-center gap-2 text-zinc-600 text-xs py-4">
                        <Loader2 className="animate-spin" size={14} /> Verificando sistema...
                    </div>
                ) : (
                    <>
                        <StepItem 
                            done={steps.hasServices} 
                            label="Cadastrar Serviços" 
                            onClick={() => onNavigate('settings')} 
                        />
                        <StepItem 
                            done={steps.hasHours} 
                            label="Definir Horários" 
                            onClick={() => onNavigate('settings')} 
                        />
                        <StepItem 
                            done={steps.hasAppointments} 
                            label="Criar 1º Agendamento" 
                            onClick={() => onNavigate('schedule')} 
                        />
                    </>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

const StepItem = ({ done, label, onClick }: { done: boolean, label: string, onClick: () => void }) => {
    return (
        <button 
            onClick={!done ? onClick : undefined}
            disabled={done}
            className={cn(
                "flex items-center justify-between w-full p-3 rounded-xl border transition-all text-left group",
                done 
                    ? "bg-green-900/5 border-green-900/20 cursor-default" 
                    : "bg-zinc-900/50 border-white/5 hover:bg-zinc-800 hover:border-white/10 cursor-pointer"
            )}
        >
            <div className="flex items-center gap-3">
                {done ? (
                    <CheckCircle2 size={16} className="text-green-500" />
                ) : (
                    <Circle size={16} className="text-zinc-600 group-hover:text-white transition-colors" />
                )}
                <span className={cn(
                    "text-[10px] font-black uppercase tracking-widest transition-all",
                    done ? "text-green-500/50 line-through decoration-green-500/50" : "text-zinc-300 group-hover:text-white"
                )}>
                    {label}
                </span>
            </div>
            
            {!done && (
                <ChevronRight size={14} className="text-zinc-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
            )}
        </button>
    );
};
