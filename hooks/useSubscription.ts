
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface SubscriptionState {
  status: 'ACTIVE' | 'TRIAL' | 'EXPIRED';
  daysLeft: number;
  currentPlan: string;
  loading: boolean;
}

export const useSubscription = (businessId?: string, triggerUpdate?: number) => {
  const [subscription, setSubscription] = useState<SubscriptionState>({
    status: 'ACTIVE',
    daysLeft: 0,
    currentPlan: 'START',
    loading: true
  });

  useEffect(() => {
    if (!businessId) {
      setSubscription(prev => ({ ...prev, loading: false }));
      return;
    }

    // Set loading true when trigger changes to show feedback if needed
    setSubscription(prev => ({ ...prev, loading: true }));

    const checkStatus = async () => {
      try {
        const { data, error } = await supabase.rpc('check_access_status', { 
          business_id: businessId 
        });

        if (error) throw error;

        // Fallback caso o RPC não retorne dados
        if (!data) {
           setSubscription({
             status: 'ACTIVE',
             daysLeft: 0,
             currentPlan: 'START',
             loading: false
           });
           return;
        }

        // CORREÇÃO CRÍTICA: Se o plano for START, forçamos o status ACTIVE.
        // Isso garante que após o downgrade, o usuário não fique preso na tela de bloqueio
        // caso o backend ainda considere o período de trial expirado.
        if (data.current_plan === 'START') {
            setSubscription({
              status: 'ACTIVE',
              daysLeft: 0,
              currentPlan: 'START',
              loading: false
            });
            return;
        }

        setSubscription({
          status: data.status,
          daysLeft: data.days_left || 0,
          currentPlan: data.current_plan,
          loading: false
        });

      } catch (err) {
        console.error('Error checking subscription:', err);
        // Em caso de erro, liberamos acesso para não bloquear indevidamente (fail-open)
        setSubscription(prev => ({ 
            ...prev, 
            status: 'ACTIVE',
            loading: false 
        }));
      }
    };

    checkStatus();
  }, [businessId, triggerUpdate]);

  return subscription;
};
