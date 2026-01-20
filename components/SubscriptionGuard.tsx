
import React, { useState } from 'react';
import { PlanSelection } from './PlanSelection';
import { useSubscription } from '../hooks/useSubscription';
import { Clock, AlertTriangle } from 'lucide-react';
import { PlanType } from '../types';

interface SubscriptionGuardProps {
  children: React.ReactNode;
  businessId?: string;
  onPlanChange: () => void;
}

export const SubscriptionGuard: React.FC<SubscriptionGuardProps> = ({ 
  children, 
  businessId, 
  onPlanChange 
}) => {
  // Estado local para forçar a atualização do hook quando o plano mudar (downgrade/upgrade)
  const [trigger, setTrigger] = useState(0);

  // Chamada ao hook que executa o RPC check_access_status, dependendo do trigger
  const { status, daysLeft, currentPlan, loading } = useSubscription(businessId, trigger);

  // Wrapper para atualizar tanto o pai quanto o hook local
  const handlePlanChange = () => {
    setTrigger(prev => prev + 1); // Força re-execução do useSubscription para pegar status 'ACTIVE'
    onPlanChange(); // Notifica o App.tsx para recarregar dados globais
  };

  // Se não tiver businessId (ainda carregando sessão) ou o hook estiver carregando
  if (!businessId || loading) {
    return <>{children}</>; // Renderiza children para não dar "flicker" branco
  }

  // Lógica de Bloqueio EXPIRED
  if (status === 'EXPIRED') {
    return (
      <PlanSelection 
        businessId={businessId} 
        onPlanChange={handlePlanChange} 
      />
    );
  }

  // Renderização normal com Banner de Trial se necessário
  return (
    <div className="relative flex flex-col h-full">
      {status === 'TRIAL' && currentPlan !== 'START' && (
        <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-center gap-3 shadow-lg z-40 relative">
          <Clock size={16} className="animate-pulse" />
          <p className="text-[10px] md:text-xs font-black uppercase tracking-widest">
            Período de Teste {currentPlan}: Restam {daysLeft} dias para o bloqueio.
          </p>
        </div>
      )}
      <div className="flex-1 overflow-hidden relative">
        {children}
      </div>
    </div>
  );
};
