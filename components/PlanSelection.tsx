
import React, { useState } from 'react';
import { Check, Shield, Lock, ArrowDown, Loader2, AlertTriangle, Calendar, Zap } from 'lucide-react';
import { PlanType } from '../types';
import { PLAN_FEATURES } from '../constants';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabaseClient';

interface PlanSelectionProps {
  businessId: string;
  onPlanChange: () => void;
}

export const PlanSelection: React.FC<PlanSelectionProps> = ({ businessId, onPlanChange }) => {
  const [processing, setProcessing] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');

  const pro = PLAN_FEATURES[PlanType.PRO];
  const elite = PLAN_FEATURES[PlanType.ELITE];

  const handleDowngrade = async () => {
    // Validação de segurança
    if (!businessId) {
        console.error("Business ID is missing");
        return;
    }

    setProcessing(true);
    
    try {
      console.log("Attempting downgrade via RPC for:", businessId);
      
      // Chamada RPC
      const { error } = await supabase.rpc('downgrade_to_start', { 
        p_business_id: businessId 
      });

      if (error) {
          // Se erro na RPC, tentamos fallback direto (caso RLS permita em algum cenário)
          console.warn("RPC failed, attempting direct update fallback:", error);
          const { error: directError } = await supabase
            .from('business_settings')
            .update({ plan_type: 'START', subscription_status: 'ACTIVE' })
            .eq('id', businessId);
            
          if (directError) throw error; // Lança o erro original da RPC se ambos falharem
      }
      
      onPlanChange();
      // Reload removido para evitar tela branca/404 em ambientes de preview
      
    } catch (err: any) {
      console.error("Erro crítico ao realizar downgrade:", err);
      // Feedback visual silencioso no console para não travar UI em sandbox
      setProcessing(false);
    }
  };

  const handleSubscribe = (link: string | null) => {
    if (link) window.open(link, '_blank');
  };

  const formatPrice = (value: number) => 
    value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#050505]/95 backdrop-blur-xl">
      <div className="w-full max-w-6xl h-full max-h-[95vh] overflow-y-auto custom-scrollbar">
        <div className="text-center mb-8 pt-10">
          <div className="w-16 h-16 rounded-2xl bg-red-600/10 border border-red-600/30 flex items-center justify-center mx-auto mb-6 shadow-[0_0_50px_rgba(220,38,38,0.2)]">
            <Lock size={28} className="text-red-500" />
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter mb-4">
            Acesso Expirado
          </h1>
          <p className="text-zinc-400 text-sm md:text-base max-w-xl mx-auto leading-relaxed mb-8">
            Seu período de avaliação chegou ao fim. Para continuar gerenciando sua estética com alta performance, selecione um plano abaixo.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="inline-flex items-center p-1 bg-zinc-900 border border-white/10 rounded-xl relative">
              <button 
                onClick={() => setBillingCycle('MONTHLY')}
                className={cn(
                    "px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all z-10",
                    billingCycle === 'MONTHLY' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-white"
                )}
              >
                  Mensal
              </button>
              <button 
                onClick={() => setBillingCycle('ANNUAL')}
                className={cn(
                    "px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all z-10 flex items-center gap-2",
                    billingCycle === 'ANNUAL' ? "bg-white text-black shadow-glow" : "text-zinc-500 hover:text-white"
                )}
              >
                  Anual
                  <span className="bg-green-500 text-white text-[9px] px-1.5 py-0.5 rounded ml-1">-15%</span>
              </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4 md:px-20 mb-12 max-w-5xl mx-auto">
          {/* PRO PLAN */}
          <div className="bg-[#0c0c0c] border border-white/10 rounded-[2.5rem] p-8 relative overflow-hidden group hover:border-red-600/50 transition-all flex flex-col">
            <div className="absolute top-0 right-0 p-6">
              <span className="bg-zinc-800 text-zinc-400 border border-white/5 text-[9px] font-black uppercase px-3 py-1 rounded-full tracking-widest">Profissional</span>
            </div>
            
            <h3 className="text-2xl font-black text-white uppercase mb-2">Carbon PRO</h3>
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-4xl font-black text-white">R$ {formatPrice(billingCycle === 'MONTHLY' ? pro.monthlyPrice : pro.annualPrice)}</span>
              <span className="text-xs font-bold text-zinc-500">/ mês</span>
            </div>
            {billingCycle === 'ANNUAL' && (
                <p className="text-[10px] text-green-500 font-bold uppercase tracking-wide mb-6">Cobrado anualmente R$ {(pro.annualPrice * 12).toFixed(2)}</p>
            )}
            {billingCycle === 'MONTHLY' && <div className="h-4 mb-6" />}

            <ul className="space-y-4 mb-8 flex-1">
              {pro.features.map((feat, i) => (
                <li key={i} className="flex items-start gap-3 text-xs font-bold text-zinc-400 uppercase tracking-wide">
                  <Check size={14} className="text-red-600 shrink-0 mt-0.5" /> {feat}
                </li>
              ))}
            </ul>
            
            <button 
              onClick={() => handleSubscribe(billingCycle === 'MONTHLY' ? pro.stripeLinkMonthly : pro.stripeLinkAnnual)}
              className="w-full py-4 bg-zinc-900 hover:bg-white hover:text-black border border-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
            >
              Assinar Pro {billingCycle === 'ANNUAL' && 'Anual'}
            </button>
          </div>

          {/* ELITE PLAN */}
          <div className="bg-[#0c0c0c] border border-white/10 rounded-[2.5rem] p-8 relative overflow-hidden group hover:border-yellow-500/50 transition-all flex flex-col shadow-2xl">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent opacity-50" />
            <div className="absolute top-0 right-0 p-6">
               <span className="bg-yellow-500 text-black text-[9px] font-black uppercase px-3 py-1 rounded-full tracking-widest flex items-center gap-1">
                   <Zap size={10} fill="currentColor" /> Recomendado
               </span>
            </div>

            <h3 className="text-2xl font-black text-white uppercase mb-2">Carbon ELITE</h3>
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-4xl font-black text-white">R$ {formatPrice(billingCycle === 'MONTHLY' ? elite.monthlyPrice : elite.annualPrice)}</span>
              <span className="text-xs font-bold text-zinc-500">/ mês</span>
            </div>
             {billingCycle === 'ANNUAL' && (
                <p className="text-[10px] text-yellow-500/80 font-bold uppercase tracking-wide mb-6">Cobrado anualmente R$ {(elite.annualPrice * 12).toFixed(2)}</p>
            )}
            {billingCycle === 'MONTHLY' && <div className="h-4 mb-6" />}

            <ul className="space-y-4 mb-8 flex-1">
              {elite.features.map((feat, i) => (
                <li key={i} className="flex items-start gap-3 text-xs font-bold text-zinc-200 uppercase tracking-wide">
                  <Check size={14} className="text-yellow-500 shrink-0 mt-0.5" /> {feat}
                </li>
              ))}
            </ul>

            <button 
              onClick={() => handleSubscribe(billingCycle === 'MONTHLY' ? elite.stripeLinkMonthly : elite.stripeLinkAnnual)}
              className="w-full py-4 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(234,179,8,0.2)]"
            >
              Assinar Elite {billingCycle === 'ANNUAL' && 'Anual'}
            </button>
          </div>
        </div>

        <div className="text-center pb-12">
          <button 
            onClick={handleDowngrade}
            disabled={processing}
            className="group flex items-center justify-center gap-2 mx-auto text-zinc-600 hover:text-white transition-colors py-3 px-6 rounded-xl hover:bg-white/5"
          >
            {processing ? <Loader2 className="animate-spin" size={14} /> : <ArrowDown size={14} className="group-hover:translate-y-1 transition-transform" />}
            <span className="text-[10px] font-black uppercase tracking-widest border-b border-transparent group-hover:border-white pb-0.5">
              Continuar no Plano Grátis (Limitado)
            </span>
          </button>
          <p className="mt-4 text-[9px] text-zinc-600 font-medium max-w-md mx-auto px-4">
            Ao retornar ao plano START, recursos como DRE Financeiro, WhatsApp Automático e Gestão de Clientes Avançada serão bloqueados imediatamente.
          </p>
        </div>
      </div>
    </div>
  );
};
