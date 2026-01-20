
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { Schedule } from './components/Schedule';
import { CRM } from './components/CRM';
import { FinancialModule } from './components/FinancialModule';
import { WelcomeScreen } from './components/WelcomeScreen';
import { Settings } from './components/Settings';
import { PublicBooking } from './components/PublicBooking';
import { AuthScreen } from './components/AuthScreen';
import { MarketingModule } from './components/MarketingModule';
import { SubscriptionGuard } from './components/SubscriptionGuard';
import { PlanType, Customer, Appointment, AppointmentStatus, Expense, ServiceItem, BusinessSettings, PortfolioItem } from './types';
import { Loader2, CheckCircle2, AlertCircle, Menu, LogOut, Store } from 'lucide-react';
import { cn } from './lib/utils';
import { supabase } from './lib/supabaseClient';

// Helpers para manipulação segura do histórico (evita crash em blob urls)
const isRestrictedEnv = () => {
    try {
        if (typeof window === 'undefined') return true;
        // Verifica protocolo blob ou se a href começa com blob (comum em previews)
        return window.location.protocol === 'blob:' || window.location.protocol === 'file:' || window.location.href.startsWith('blob:');
    } catch {
        return true;
    }
};

const safeReplaceState = (url: string) => {
    if (isRestrictedEnv()) return;
    try { window.history.replaceState({}, '', url); } catch (e) { console.warn('History replace skipped:', e); }
};

const safePushState = (url: string) => {
    if (isRestrictedEnv()) return;
    try { window.history.pushState({}, '', url); } catch (e) { console.warn('History push skipped:', e); }
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [longLoading, setLongLoading] = useState(false); // Estado para mostrar botão de emergência
  const [notFound, setNotFound] = useState(false); // Estado para Hangar não encontrado
  
  const initialSlug = new URLSearchParams(window.location.search).get('studio');
  const [viewState, setViewState] = useState<'WELCOME' | 'AUTH' | 'DASHBOARD' | 'PUBLIC_BOOKING'>(
    initialSlug ? 'PUBLIC_BOOKING' : 'WELCOME'
  );
  
  const [authRole, setAuthRole] = useState<'CLIENT' | 'ADMIN'>('CLIENT');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [toast, setToast] = useState<{show: boolean, msg: string, type?: 'success' | 'error'} | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // FIX: Typing states as any[] to prevent TS2339 build error
  const [customers, setCustomers] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [currentPlan, setCurrentPlan] = useState<PlanType>(PlanType.START);
  
  // Ref para o timeout de segurança
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // FIX: Typing businessSettings as any
  const [businessSettings, setBusinessSettings] = useState<any>({
    business_name: '', 
    slug: '', 
    box_capacity: 1, 
    patio_capacity: 1, 
    slot_interval_minutes: 60, 
    operating_days: [], 
    blocked_dates: [],
    online_booking_enabled: true, 
    loyalty_program_enabled: false, 
    plan_type: PlanType.START,
    created_at: new Date().toISOString()
  });

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleLogout = useCallback(async () => {
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    if (supabase) await supabase.auth.signOut();
    setCurrentUser(null);
    setViewState('WELCOME');
    setLoadingSession(false);
    setLongLoading(false);
    setNotFound(false);
  }, []);

  // Optimized loadPublicData to prevent recursion loops
  const loadPublicData = useCallback(async (slug: string) => {
    if (!supabase) return;
    setLoadingSession(true);
    setNotFound(false);
    
    try {
        const { data: biz, error } = await supabase
            .from('business_settings')
            .select('*')
            .eq('slug', slug)
            .maybeSingle();

        if (error) {
            console.error("Erro ao buscar hangar:", error);
            setNotFound(true);
            setLoadingSession(false);
            return;
        }

        if (biz) {
            localStorage.setItem('carbon_last_slug', biz.slug);
            
            setBusinessSettings({ 
                ...biz, 
                operating_days: biz.configs?.operating_days || [],
                blocked_dates: biz.configs?.blocked_dates || []
            });
            
            // Carrega dados reais do Supabase
            const [servRes, portRes] = await Promise.all([
                supabase.from('services').select('*').eq('business_id', biz.id).eq('is_active', true),
                supabase.from('portfolio_items').select('*').eq('business_id', biz.id)
            ]);

            if (servRes.data) setServices(servRes.data.map(s => ({ ...s, price: Number(s.price) })));
            if (portRes.data) setPortfolio(portRes.data.map(p => ({ ...p, imageUrl: p.image_url, date: p.created_at })));
        } else {
            console.warn(`Hangar '${slug}' não encontrado.`);
            localStorage.removeItem('carbon_last_slug'); 
            setNotFound(true);
        }
    } catch (e) {
        console.error("Erro dados públicos:", e);
        setNotFound(true);
    } finally {
        setLoadingSession(false);
    }
  }, []);

  const loadData = useCallback(async (userId: string) => {
    if (!supabase) {
        setLoadingSession(false);
        return;
    }

    try {
        // Tenta buscar configurações de negócio vinculadas a este usuário (Modo Admin)
        const { data: biz, error: bizError } = await supabase.from('business_settings').select('*').eq('user_id', userId).maybeSingle();
        
        if (bizError) throw bizError;

        if (biz) {
            // É um Admin/Dono de Loja
            localStorage.setItem('carbon_last_slug', biz.slug);

            setBusinessSettings({ 
                ...biz, 
                operating_days: biz.configs?.operating_days || [],
                blocked_dates: biz.configs?.blocked_dates || []
            });
            setCurrentPlan(biz.plan_type as PlanType);

            // Busca dados em paralelo com tratamento individual de erros para não travar tudo
            const [custRes, aptsRes, servRes, expRes, portRes] = await Promise.all([
                supabase.from('customers').select('*').eq('business_id', biz.id),
                // CRITICAL FIX: Ensure we fetch ALL appointments for the business, regardless of creator (user_id)
                supabase.from('appointments').select('*').eq('business_id', biz.id),
                supabase.from('services').select('*').eq('business_id', biz.id).order('name'),
                supabase.from('expenses').select('*').eq('business_id', biz.id),
                supabase.from('portfolio_items').select('*').eq('business_id', biz.id)
            ]);

            // Processamento de Clientes e Veículos (Seguro)
            let processedCustomers: Customer[] = [];
            if (custRes.data && custRes.data.length > 0) {
                const customerIds = custRes.data.map(c => c.id);
                // Busca veículos separadamente para evitar erro de Join excessivo
                const { data: vehiclesData } = await supabase.from('vehicles').select('*').in('customer_id', customerIds);
                
                processedCustomers = custRes.data.map(c => ({
                    id: c.id,
                    name: c.name,
                    phone: c.phone || '',
                    email: c.email || '',
                    totalSpent: Number(c.total_spent),
                    lastVisit: c.last_visit,
                    xpPoints: c.xp_points,
                    washes: c.washes_count,
                    vehicles: vehiclesData?.filter(v => v.customer_id === c.id).map(v => ({
                        id: v.id,
                        brand: v.brand || '',
                        model: v.model || '',
                        plate: v.plate || '',
                        color: v.color || '',
                        type: v.type || 'CARRO'
                    })) || []
                }));
            }
            setCustomers(processedCustomers);

            if (aptsRes.data) {
                setAppointments(aptsRes.data.map(a => ({
                    id: a.id,
                    customerId: a.customer_id,
                    vehicleId: a.vehicle_id,
                    serviceId: a.service_id,
                    serviceType: a.service_type,
                    date: a.date,
                    time: a.time ? a.time.slice(0, 5) : '00:00',
                    durationMinutes: a.duration_minutes,
                    price: Number(a.price),
                    status: a.status as AppointmentStatus,
                    observation: a.observation
                })));
            }

            if (servRes.data) setServices(servRes.data.map(s => ({ ...s, price: Number(s.price) })));
            if (expRes.data) setExpenses(expRes.data);
            if (portRes.data) setPortfolio(portRes.data.map(p => ({ ...p, imageUrl: p.image_url, date: p.created_at })));

            setViewState('DASHBOARD');
        } else {
            // É um Cliente Final ou Visitante sem negócio
            let targetSlug = new URLSearchParams(window.location.search).get('studio');
            
            // Tenta recuperar contexto se não houver slug na URL
            if (!targetSlug) {
                // 1. Tenta LocalStorage (último acessado)
                targetSlug = localStorage.getItem('carbon_last_slug');
                
                // 2. Se falhar, tenta buscar o último agendamento do usuário para descobrir o Hangar
                if (!targetSlug) {
                     const { data: lastApt } = await supabase
                        .from('appointments')
                        .select('business_id')
                        .eq('user_id', userId)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                     
                     if (lastApt?.business_id) {
                         const { data: b } = await supabase.from('business_settings').select('slug').eq('id', lastApt.business_id).single();
                         if (b) targetSlug = b.slug;
                     }
                }
            }

            if (targetSlug) {
                // Atualiza URL silenciosamente para manter contexto no refresh
                if (!window.location.search.includes('studio=')) {
                    safeReplaceState(`${window.location.pathname}?studio=${targetSlug}`);
                }

                await loadPublicData(targetSlug);
                setViewState('PUBLIC_BOOKING');
            } else {
                setViewState('WELCOME');
            }
        }
    } catch (error) {
        console.error("Erro ao carregar dados:", error);
        setNotFound(true);
        setViewState('PUBLIC_BOOKING');
    } finally {
        setLoadingSession(false);
    }
  }, [loadPublicData]);

  // Session Check
  useEffect(() => {
    // Timeout de segurança: se carregar demorar mais que 8s, libera UI
    safetyTimeoutRef.current = setTimeout(() => {
        setLongLoading(true);
    }, 8000);

    const initSession = async () => {
        if (!supabase) { setLoadingSession(false); return; }
        
        const { data: { session } } = await supabase.auth.getSession();
        setCurrentUser(session?.user ?? null);

        if (session?.user) {
            // Se logado, carrega dados do usuário
            await loadData(session.user.id);
        } else {
            // Se não logado, verifica se tem slug na URL
            const slug = new URLSearchParams(window.location.search).get('studio');
            if (slug) {
                await loadPublicData(slug);
                setViewState('PUBLIC_BOOKING');
            } else {
                setViewState('WELCOME');
                setLoadingSession(false);
            }
        }
    };

    initSession();

    return () => {
        if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    };
  }, [loadData, loadPublicData]);

  // Auth Flow Handler
  const handleAuthFlow = (role: 'CLIENT' | 'ADMIN', mode: 'LOGIN' | 'REGISTER' | 'GUEST') => {
    setAuthRole(role);
    setViewState('AUTH');
  };

  const handleAuthSuccess = async (user: any) => {
      setCurrentUser(user);
      setLoadingSession(true);
      await loadData(user.id);
  };

  // --- BUG FIX 2: PLAN UPDATE ---
  const handleUpdatePlan = async (newPlan: PlanType) => {
      setLoadingSession(true);
      try {
          // Atualização direta no Supabase
          const { error } = await supabase
              .from('business_settings')
              .update({ plan_type: newPlan })
              .eq('id', businessSettings.id);

          if (error) throw error;

          // Atualização otimista do estado local
          setBusinessSettings((prev: any) => ({ ...prev, plan_type: newPlan }));
          setCurrentPlan(newPlan);
          showToast(`Plano atualizado para ${newPlan} com sucesso!`);
      } catch (e: any) {
          console.error("Erro ao atualizar plano:", e);
          showToast(e.message || "Erro ao salvar plano.", 'error');
      } finally {
          setLoadingSession(false);
      }
  };

  // Appointment & Customer Actions
  const handleAddAppointment = async (newApt: Appointment, newCustomer?: Customer) => {
    setLoadingSession(true); 

    try {
        // --- BUG FIX 1: CUSTOMER CREATION CRASH ---
        // Se estamos vindo do CRM (Novo Cliente), não temos ServiceId.
        // Devemos apenas criar o cliente e veículo, sem agendamento (RPC).
        if (newCustomer && (!newApt.serviceId || newApt.serviceId === '')) {
             // 1. Insert Customer Directly
             const { data: custData, error: custError } = await supabase
                .from('customers')
                .insert({
                    user_id: currentUser.id, // Garante owner
                    business_id: businessSettings.id,
                    name: newCustomer.name,
                    phone: newCustomer.phone,
                    email: newCustomer.email
                })
                .select()
                .single();

             if (custError) throw custError;

             // 2. Insert Vehicle Directly
             if (newCustomer.vehicles && newCustomer.vehicles.length > 0) {
                 const v = newCustomer.vehicles[0];
                 const { error: vehError } = await supabase
                    .from('vehicles')
                    .insert({
                        customer_id: custData.id,
                        brand: v.brand,
                        model: v.model,
                        plate: v.plate,
                        type: 'CARRO'
                    });
                 if (vehError) throw vehError;
             }

             // 3. Reload Data Safely
             await loadData(currentUser.id);
             showToast("Cliente cadastrado com sucesso!");
             return; // Encerra aqui para não executar lógica de agendamento
        }

        // --- NORMAL BOOKING FLOW (COM AGENDAMENTO) ---
        
        // 1. Sanitize Data (Fix UUID errors by converting empty strings to null)
        const cleanServiceId = newApt.serviceId && newApt.serviceId.length > 0 ? newApt.serviceId : null;
        const cleanVehicleId = newApt.vehicleId && newApt.vehicleId.length > 0 ? newApt.vehicleId : null;
        
        // 2. Scenario: New Customer WITH Appointment (Use RPC)
        if (newCustomer) {
            const vehicle = newCustomer.vehicles[0];
            if (!businessSettings.slug) throw new Error("Slug da loja não encontrado.");

            const { data, error } = await supabase.rpc('create_complete_booking', {
                p_business_slug: businessSettings.slug,
                p_customer_name: newCustomer.name,
                p_customer_phone: newCustomer.phone,
                p_vehicle_brand: vehicle.brand || '',
                p_vehicle_model: vehicle.model || '',
                p_vehicle_plate: vehicle.plate || '',
                p_service_id: cleanServiceId,
                p_booking_date: newApt.date,
                p_booking_time: newApt.time
            });

            if (error) throw error;
            if (data && !data.success) throw new Error(data.error || "Erro na criação via RPC");

            await loadData(currentUser.id);
            showToast("Agendamento criado com sucesso!");
        } 
        // 3. Scenario: Existing Customer (Direct Insert)
        else {
            if (!newApt.customerId) throw new Error("ID do cliente inválido");

            const { error } = await supabase.from('appointments').insert({
                user_id: currentUser.id,
                business_id: businessSettings.id,
                customer_id: newApt.customerId,
                vehicle_id: cleanVehicleId, 
                service_id: cleanServiceId, 
                service_type: newApt.serviceType,
                date: newApt.date,
                time: newApt.time,
                duration_minutes: newApt.durationMinutes,
                price: newApt.price,
                status: newApt.status,
                observation: newApt.observation
            });

            if (error) throw error;
            await loadData(currentUser.id); 
            showToast("Agendamento criado com sucesso!");
        }
    } catch (e: any) {
        console.error("Erro ao processar:", e);
        showToast(e.message || "Erro na operação.", 'error');
    } finally {
        setLoadingSession(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: AppointmentStatus) => {
    const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
    if (!error) {
        setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
        if (status === AppointmentStatus.FINALIZADO) {
            showToast("Serviço finalizado! Receita contabilizada.");
        }
    }
  };

  const handleCancelAppointment = async (id: string) => {
    const { error } = await supabase.from('appointments').update({ status: AppointmentStatus.CANCELADO }).eq('id', id);
    if (!error) {
        setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: AppointmentStatus.CANCELADO } : a));
        showToast("Agendamento cancelado.");
    }
  };

  const handleDeleteAppointment = async (id: string) => {
      const { error } = await supabase.from('appointments').delete().eq('id', id);
      if (!error) {
          setAppointments(prev => prev.filter(a => a.id !== id));
          showToast("Registro excluído permanentemente.");
      }
  };

  // Public Booking Handler
  const handlePublicBooking = async (apt: Appointment, customerData: any) => {
      // Usa RPC para transação atômica real
      const { data, error } = await supabase.rpc('create_complete_booking', {
          p_business_slug: businessSettings.slug,
          p_customer_name: customerData.name,
          p_customer_phone: customerData.phone,
          p_vehicle_brand: customerData.vehicles[0].brand,
          p_vehicle_model: customerData.vehicles[0].model,
          p_vehicle_plate: customerData.vehicles[0].plate,
          p_service_id: apt.serviceId,
          p_booking_date: apt.date,
          p_booking_time: apt.time
      });

      if (error || (data && !data.success)) {
          console.error("Booking Error:", error || data?.error);
          alert("Erro ao realizar agendamento. Tente novamente.");
          return false;
      }

      // Se usuário estiver logado, atualiza lista local
      if (currentUser) {
          // Pequeno delay para propagação
          setTimeout(() => loadPublicData(businessSettings.slug), 500);
      }

      return true;
  };

  // Loading Screen
  if (loadingSession) {
    return (
      <div className="min-h-screen bg-[#020202] flex flex-col items-center justify-center relative font-sans">
        <div className="relative">
            <div className="w-16 h-16 rounded-full border-2 border-red-600/30 border-t-red-600 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-red-600 rounded-full" />
            </div>
        </div>
        <p className="mt-8 text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">Carregando Sistema</p>
        
        {longLoading && (
            <button 
                onClick={handleLogout}
                className="mt-8 text-red-500 hover:text-red-400 text-xs underline underline-offset-4"
            >
                Demorando muito? Recarregar
            </button>
        )}
      </div>
    );
  }

  // Views Logic
  if (viewState === 'WELCOME') {
    return <WelcomeScreen onSelectFlow={handleAuthFlow} />;
  }

  if (viewState === 'AUTH') {
    return <AuthScreen role={authRole} onLogin={handleAuthSuccess} onBack={() => setViewState('WELCOME')} />;
  }

  if (viewState === 'PUBLIC_BOOKING') {
    if (notFound) {
        return (
            <div className="min-h-screen bg-[#020202] flex items-center justify-center p-4 font-sans">
                <div className="text-center max-w-md animate-in zoom-in duration-300">
                    <div className="w-20 h-20 bg-zinc-900 border border-white/10 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl">
                        <Store size={32} className="text-zinc-600" />
                    </div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Hangar Não Encontrado</h2>
                    <p className="text-zinc-500 text-sm mb-8 leading-relaxed">
                        O estabelecimento solicitado não existe ou o link está incorreto. Verifique o endereço e tente novamente.
                    </p>
                    <button 
                        onClick={() => { 
                            setNotFound(false); 
                            setViewState('WELCOME'); 
                            // Limpa cache e URL para evitar loop
                            localStorage.removeItem('carbon_last_slug');
                            safePushState(window.location.pathname);
                        }}
                        className="px-8 py-4 bg-white text-black rounded-xl text-xs font-black uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-glow"
                    >
                        Voltar ao Início
                    </button>
                </div>
            </div>
        );
    }

    return (
        <PublicBooking 
            currentUser={currentUser}
            businessSettings={businessSettings}
            services={services}
            portfolio={portfolio}
            existingAppointments={appointments}
            onBookingComplete={handlePublicBooking}
            onExit={() => {
                if (currentUser) handleLogout(); // Se logado, faz logout real
                else setViewState('WELCOME'); // Se visitante, volta para welcome
            }}
            onLoginRequest={() => handleAuthFlow('CLIENT', 'LOGIN')}
        />
    );
  }

  return (
    <div className="flex min-h-screen bg-[#020202] text-zinc-100 font-sans selection:bg-red-500/30">
      
      {/* Mobile Menu Button */}
      {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="md:hidden fixed top-4 right-4 z-50 p-3 bg-zinc-900/80 backdrop-blur border border-white/10 rounded-xl text-white shadow-lg"
          >
            <Menu size={20} />
          </button>
      )}

      {/* Main Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        currentPlan={currentPlan}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onUpgrade={() => setActiveTab('settings')}
        onLogout={handleLogout}
        logoUrl={businessSettings.profile_image_url}
        businessName={businessSettings.business_name}
        slug={businessSettings.slug}
      />

      <main className="flex-1 w-full max-w-[100vw] overflow-x-hidden relative">
        
        {/* Toast Notification */}
        <div className={cn(
            "fixed top-6 right-6 z-[100] transition-all duration-500 ease-out transform",
            toast ? "translate-y-0 opacity-100" : "-translate-y-10 opacity-0 pointer-events-none"
        )}>
            {toast && (
                <div className={cn(
                    "flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-md",
                    toast.type === 'error' ? "bg-red-900/80 border-red-500/30 text-white" : "bg-zinc-900/80 border-green-500/30 text-white"
                )}>
                    {toast.type === 'error' ? <AlertCircle size={18} className="text-red-400" /> : <CheckCircle2 size={18} className="text-green-400" />}
                    <span className="text-xs font-bold uppercase tracking-wide">{toast.msg}</span>
                </div>
            )}
        </div>

        <SubscriptionGuard 
            businessId={businessSettings.id} 
            onPlanChange={() => loadData(currentUser?.id)}
        >
            {activeTab === 'dashboard' && (
              <Dashboard 
                currentPlan={currentPlan} 
                appointments={appointments}
                customers={customers}
                onUpgrade={() => setActiveTab('settings')}
                setActiveTab={setActiveTab}
                businessSettings={businessSettings}
                onUpdateStatus={handleUpdateStatus}
                onCancelAppointment={handleCancelAppointment}
                onDeleteAppointment={handleDeleteAppointment}
              />
            )}
            
            {activeTab === 'schedule' && (
              <Schedule 
                appointments={appointments}
                customers={customers}
                onAddAppointment={handleAddAppointment}
                onUpdateStatus={handleUpdateStatus}
                onCancelAppointment={handleCancelAppointment}
                onDeleteAppointment={handleDeleteAppointment}
                currentPlan={currentPlan}
                onUpgrade={() => setActiveTab('settings')}
                settings={businessSettings}
                services={services}
              />
            )}
            
            {activeTab === 'crm' && (
              <CRM 
                customers={customers} 
                // Passa o Appointment vazio para indicar criação APENAS de cliente
                onAddCustomer={(c) => handleAddAppointment({
                    id: '', customerId: '', vehicleId: '', serviceId: '', serviceType: '', date: '', time: '', durationMinutes: 0, price: 0, status: AppointmentStatus.NOVO
                } as any, c)}
                onDeleteCustomer={async (id) => {
                    const { error } = await supabase.from('customers').delete().eq('id', id);
                    if (!error) {
                        setCustomers(prev => prev.filter(c => c.id !== id));
                        showToast("Cliente removido.");
                    }
                }}
                businessSettings={businessSettings}
                onUpdateSettings={async (s) => {
                    const { error } = await supabase.from('business_settings').update({ loyalty_program_enabled: s.loyalty_program_enabled }).eq('id', s.id);
                    if (!error) setBusinessSettings(s);
                }}
              />
            )}
            
            {activeTab === 'finance' && (
              <FinancialModule 
                appointments={appointments}
                expenses={expenses}
                onAddExpense={(e) => setExpenses(prev => [...prev, e])}
                onEditExpense={(e) => setExpenses(prev => prev.map(ex => ex.id === e.id ? e : ex))}
                onDeleteExpense={async (id) => {
                    const { error } = await supabase.from('expenses').delete().eq('id', id);
                    if (!error) setExpenses(prev => prev.filter(e => e.id !== id));
                }}
                currentPlan={currentPlan}
                onUpgrade={() => setActiveTab('settings')}
                businessId={businessSettings.id}
              />
            )}

            {activeTab === 'marketing' && (
                <MarketingModule 
                    portfolio={portfolio}
                    onAddPortfolioItem={(item) => setPortfolio(prev => [item, ...prev])}
                    onDeletePortfolioItem={async (id) => {
                        const { error } = await supabase.from('portfolio_items').delete().eq('id', id);
                        if(!error) setPortfolio(prev => prev.filter(p => p.id !== id));
                    }}
                    reviews={[]}
                    onReplyReview={() => {}}
                    currentPlan={currentPlan}
                    onUpgrade={() => setActiveTab('settings')}
                    businessId={businessSettings.id}
                />
            )}
            
            {activeTab === 'settings' && (
              <Settings 
                currentPlan={currentPlan}
                onUpgrade={handleUpdatePlan} // Passando a nova função de persistência
                settings={businessSettings}
                onUpdateSettings={setBusinessSettings}
                services={services}
                onAddService={(s) => setServices(prev => [...prev, s])}
                onDeleteService={async (id) => {
                    const { error } = await supabase.from('services').update({ is_active: false }).eq('id', id);
                    if (!error) setServices(prev => prev.filter(s => s.id !== id));
                }}
              />
            )}
        </SubscriptionGuard>
      </main>
    </div>
  );
};

export default App;
