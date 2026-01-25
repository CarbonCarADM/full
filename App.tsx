import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import { 
  Customer, Appointment, BusinessSettings, ServiceItem, 
  Expense, PlanType, PortfolioItem, Review, AppointmentStatus, ServiceBay 
} from './types';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { Schedule } from './components/Schedule';
import { CRM } from './components/CRM';
import { FinancialModule } from './components/FinancialModule';
import { Settings } from './components/Settings';
import { MarketingModule } from './components/MarketingModule';
import { WelcomeScreen } from './components/WelcomeScreen';
import { AuthScreen } from './components/AuthScreen';
import { PublicBooking } from './components/PublicBooking';
import { SubscriptionGuard } from './components/SubscriptionGuard';
import { Loader2, Menu, AlertCircle, RefreshCw, LogOut, Store, Plus, Sparkles } from 'lucide-react';
import { useEntitySaver } from './hooks/useEntitySaver';
import { generateConfirmationMessage, openWhatsAppChat } from './services/whatsappService';
import { CookieConsent } from './components/CookieConsent';
import { generateUUID, cn } from './lib/utils';
import { WhatsAppModal } from './components/WhatsAppModal';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [initializing, setInitializing] = useState(false);

  // Data
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [serviceBays, setServiceBays] = useState<ServiceBay[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  // Public Mode
  const [publicSlug, setPublicSlug] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  // Auth Flow
  const [showAuth, setShowAuth] = useState(false);
  const [authRole, setAuthRole] = useState<'ADMIN' | 'CLIENT'>('ADMIN');
  const [preFillAuth, setPreFillAuth] = useState<{name: string, phone: string} | null>(null);

  // WhatsApp Modal State
  const [whatsappModal, setWhatsappModal] = useState<{isOpen: boolean, phone: string, message: string, customerName: string} | null>(null);

  const { save } = useEntitySaver();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const studioSlug = params.get('studio');
    if (studioSlug) {
      setPublicSlug(studioSlug);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!studioSlug && !session) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const normalizeSettings = (biz: any): BusinessSettings => {
      let operating_days = biz.operating_days || biz.configs?.operating_days || [];
      const blocked_dates = biz.blocked_dates || biz.configs?.blocked_dates || [];

      if (operating_days.length === 0) {
          operating_days = [
              { dayOfWeek: 0, isOpen: false, openTime: '00:00', closeTime: '00:00' },
              { dayOfWeek: 1, isOpen: true, openTime: '08:00', closeTime: '18:00' },
              { dayOfWeek: 2, isOpen: true, openTime: '08:00', closeTime: '18:00' },
              { dayOfWeek: 3, isOpen: true, openTime: '08:00', closeTime: '18:00' },
              { dayOfWeek: 4, isOpen: true, openTime: '08:00', closeTime: '18:00' },
              { dayOfWeek: 5, isOpen: true, openTime: '08:00', closeTime: '18:00' },
              { dayOfWeek: 6, isOpen: true, openTime: '09:00', closeTime: '14:00' }
          ];
      }

      return { ...biz, operating_days, blocked_dates };
  };

  const fetchData = async (silent = false) => {
    try {
        if (!silent) setLoading(true);
        let businessId = '';
        let currentBiz: any = null;
        const userRole = session?.user?.user_metadata?.role;

        // PRIORIDADE 1: Slug na URL
        if (publicSlug) {
            const { data: biz, error: bizErr } = await supabase
                .from('business_settings')
                .select('*')
                .eq('slug', publicSlug)
                .maybeSingle();

            if (biz) {
                currentBiz = biz;
                const normalized = normalizeSettings(biz);
                setSettings(normalized);
                businessId = biz.id;
            } else if (bizErr) {
                console.error("Erro ao buscar hangar pelo slug:", bizErr);
            }
        } 
        
        // PRIORIDADE 2: Usuário Logado
        if (!businessId && session?.user) {
            if (userRole === 'CLIENT') {
                const { data: lastApt } = await supabase
                    .from('appointments')
                    .select('business_id')
                    .eq('user_id', session.user.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (lastApt) {
                     const { data: biz } = await supabase
                        .from('business_settings')
                        .select('*')
                        .eq('id', lastApt.business_id)
                        .maybeSingle();

                     if (biz) {
                        currentBiz = biz;
                        setSettings(normalizeSettings(biz));
                        businessId = biz.id;
                        if (!publicSlug) setPublicSlug(biz.slug); 
                     }
                }
            } else {
                const { data: biz } = await supabase
                    .from('business_settings')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .maybeSingle();

                if (biz) {
                    currentBiz = biz;
                    setSettings(normalizeSettings(biz));
                    businessId = biz.id;
                }
            }
        }

        // FALLBACK PARA PREVIEW MODE
        if (!businessId && previewMode) {
             const { data: firstBiz } = await supabase.from('business_settings').select('*').limit(1).maybeSingle();
             if (firstBiz) {
                 currentBiz = firstBiz;
                 setSettings(normalizeSettings(firstBiz));
                 businessId = firstBiz.id;
                 setPublicSlug(firstBiz.slug);
             } else {
                 const mockBiz: BusinessSettings = {
                     id: 'mock-id',
                     business_name: 'Hangar Carbon Demo',
                     slug: 'carbon-demo',
                     box_capacity: 3,
                     patio_capacity: 10,
                     online_booking_enabled: true,
                     loyalty_program_enabled: true,
                     slot_interval_minutes: 60,
                     configs: { instagram: '@carboncar' }
                 };
                 setSettings(normalizeSettings(mockBiz));
                 setServices([
                     { id: '1', name: 'Lavagem Detalhada', price: 150, duration_minutes: 120, description: 'Limpeza profunda externa e interna.', is_active: true },
                     { id: '2', name: 'Polimento Técnico', price: 450, duration_minutes: 240, description: 'Correção de verniz e brilho espelhado.', is_active: true }
                 ]);
                 if (!silent) setLoading(false);
                 return;
             }
        }

        if (!businessId) {
            if (!silent) setLoading(false);
            return;
        }

        if (userRole === 'CLIENT' || previewMode) {
            const results = await Promise.allSettled([
                supabase.from('services').select('*').eq('business_id', businessId).eq('is_active', true),
                supabase.from('portfolio_items').select('*').eq('business_id', businessId).order('created_at', { ascending: false }),
                supabase.from('reviews').select('*').eq('business_id', businessId).order('created_at', { ascending: false }),
            ]);

            const [servs, port, revs] = results.map(r => r.status === 'fulfilled' ? r.value : { data: null });

            if (servs.data) {
                const serviceImages = currentBiz?.configs?.service_images || {};
                setServices((servs.data as any[]).map(s => ({
                    ...s,
                    image_url: serviceImages[s.id] || s.image_url
                })));
            }
            else setServices([]);

            if (port.data) {
                setPortfolio(port.data.map((p: any) => ({ 
                    ...p, imageUrl: p.image_url, date: p.created_at 
                })));
            }
            
            if (revs.data) {
                setReviews(revs.data.map((r: any) => ({ 
                    ...r, customerName: r.customer_name, date: r.created_at 
                })));
            }

        } else {
            // ADMINS: Fetch Everything
            const results = await Promise.allSettled([
                supabase.from('appointments').select('*').eq('business_id', businessId),
                supabase.from('services').select('*').eq('business_id', businessId).eq('is_active', true),
                supabase.from('service_bays').select('*').eq('business_id', businessId).order('name', { ascending: true }),
                supabase.from('expenses').select('*').eq('business_id', businessId),
                supabase.from('portfolio_items').select('*').eq('business_id', businessId).order('created_at', { ascending: false }),
                supabase.from('reviews').select('*').eq('business_id', businessId).order('created_at', { ascending: false }),
                supabase.from('customers').select('*').eq('business_id', businessId)
            ]);

            const [apts, servs, bays, exps, port, revs, custRes] = results.map(r => r.status === 'fulfilled' ? r.value : { data: null });

            const rawAppointments = apts.data || [];

            if (apts.data) {
                setAppointments(apts.data.map((a: any) => ({
                    ...a, serviceType: a.service_type, durationMinutes: a.duration_minutes, customerId: a.customer_id, vehicleId: a.vehicle_id, boxId: a.box_id
                })));
            }
            
            if (servs.data) {
                const serviceImages = currentBiz?.configs?.service_images || {};
                setServices((servs.data as any[]).map(s => ({
                    ...s,
                    image_url: serviceImages[s.id] || s.image_url
                })));
            }
            else setServices([]);

            if (bays.data) setServiceBays(bays.data as ServiceBay[]);
            if (exps.data) setExpenses(exps.data as Expense[]);
            
            if (port.data) {
                setPortfolio(port.data.map((p: any) => ({ 
                    ...p, imageUrl: p.image_url, date: p.created_at 
                })));
            }
            
            if (revs.data) {
                setReviews(revs.data.map((r: any) => ({ 
                    ...r, customerName: r.customer_name, date: r.created_at 
                })));
            }

            let processedCustomers: Customer[] = [];
            if (custRes.data && custRes.data.length > 0) {
                const customerIds = custRes.data.map((c: any) => c.id);
                const { data: vehiclesData } = await supabase.from('vehicles').select('*').in('customer_id', customerIds);
                
                processedCustomers = custRes.data.map((c: any) => {
                    const calculatedLTV = rawAppointments
                        .filter((a: any) => a.customer_id === c.id && a.status === 'FINALIZADO')
                        .reduce((sum: number, a: any) => sum + (Number(a.price) || 0), 0);

                    return {
                        id: c.id, 
                        name: c.name, 
                        phone: c.phone || '', 
                        email: c.email || '', 
                        totalSpent: calculatedLTV, 
                        lastVisit: c.last_visit, 
                        xpPoints: c.xp_points, 
                        washes: c.washes_count,
                        vehicles: vehiclesData?.filter((v: any) => v.customer_id === c.id).map((v: any) => ({
                            id: v.id, brand: v.brand || '', model: v.model || '', plate: v.plate || '', color: v.color || '', type: v.type || 'CARRO'
                        })) || []
                    };
                });
            }
            setCustomers(processedCustomers);
        }

    } catch (error) {
        console.error("Data Load Error:", error);
    } finally {
        if (!silent) setLoading(false);
    }
  };

  const handleInitializeHangar = async () => {
      if (!session?.user) return;
      setInitializing(true);
      try {
          const fullName = session.user.user_metadata?.full_name || 'Meu Hangar';
          const phone = session.user.user_metadata?.phone || '';
          const slug = fullName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Math.floor(Math.random() * 1000);
          
          const { error: bizError } = await supabase.from('business_settings').insert({
              user_id: session.user.id,
              business_name: fullName,
              slug: slug,
              whatsapp: phone,
              plan_type: PlanType.START,
              subscription_status: 'TRIAL',
              box_capacity: 3,
              patio_capacity: 10,
              configs: { operating_days: [] }
          });

          if (bizError) throw bizError;
          await fetchData();
      } catch (err: any) {
          alert("Erro ao inicializar hangar: " + err.message);
      } finally {
          setInitializing(false);
      }
  };

  useEffect(() => {
      if (session || publicSlug || previewMode) fetchData();
  }, [session, publicSlug, previewMode]);

  const handleUpdateStatus = async (id: string, status: AppointmentStatus) => {
      const currentApt = appointments.find(a => a.id === id);
      const { success } = await save('appointments', { id, status });
      if (success) {
          setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
          if (status === AppointmentStatus.CONFIRMADO && currentApt) {
              const customer = customers.find(c => c.id === currentApt.customerId);
              if (customer && customer.phone) {
                  const vehicle = (customer.vehicles || []).find(v => v.id === currentApt.vehicleId) || 
                                  (customer.vehicles && customer.vehicles.length > 0 ? customer.vehicles[0] : null);
                  const msg = generateConfirmationMessage(settings?.business_name || 'CarbonCar', customer.name, currentApt.date, currentApt.time, vehicle?.model || 'Veículo', vehicle?.plate || '', currentApt.serviceType);
                  setWhatsappModal({ isOpen: true, phone: customer.phone, message: msg, customerName: customer.name });
              }
          }
          if (status === AppointmentStatus.FINALIZADO) fetchData();
      }
  };

  const handleAddAppointment = async (apt: Appointment, newCustomer?: Customer, silent = false) => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const customerUserId = currentSession?.user?.id || null;
      if (!settings) return alert("Hangar não identificado.");
      let finalCustomerId = apt.customerId;
      let finalVehicleId = apt.vehicleId;
      if (newCustomer) {
          const { data: existingCust } = await supabase.from('customers').select('id, vehicles(id, plate)').eq('business_id', settings.id).eq('phone', newCustomer.phone).maybeSingle();
          if (existingCust) {
              finalCustomerId = existingCust.id;
              const vehicleData = newCustomer.vehicles[0];
              const existingVeh = existingCust.vehicles.find((v: any) => v.plate === vehicleData.plate.toUpperCase());
              if (existingVeh) finalVehicleId = existingVeh.id;
              else {
                  const newVehId = generateUUID();
                  const { error: vErr } = await supabase.from('vehicles').insert({ id: newVehId, customer_id: finalCustomerId, brand: vehicleData.brand, model: vehicleData.model, plate: vehicleData.plate.toUpperCase(), type: 'CARRO' });
                  if (!vErr) finalVehicleId = newVehId;
              }
          } else {
              const newCustId = generateUUID();
              const { error: cErr } = await supabase.from('customers').insert({ id: newCustId, business_id: settings.id, user_id: customerUserId, name: newCustomer.name, phone: newCustomer.phone, email: newCustomer.email });
              if (cErr) return;
              finalCustomerId = newCustId;
              const vehicleData = newCustomer.vehicles[0];
              const newVehId = generateUUID();
              const { error: vErr } = await supabase.from('vehicles').insert({ id: newVehId, customer_id: newCustId, brand: vehicleData.brand, model: vehicleData.model, plate: vehicleData.plate.toUpperCase(), type: 'CARRO' });
              if (!vErr) finalVehicleId = newVehId;
          }
      }
      let finalBoxId = apt.boxId;
      if (!finalBoxId || finalBoxId.length < 10) {
          if (serviceBays.length > 0) finalBoxId = serviceBays[0].id;
          else return alert("Nenhum box disponível.");
      }
      const { error } = await supabase.from('appointments').insert({ business_id: settings.id, user_id: customerUserId, customer_id: finalCustomerId, vehicle_id: finalVehicleId, service_id: apt.serviceId, service_type: apt.serviceType, date: apt.date, time: apt.time, duration_minutes: apt.durationMinutes, price: apt.price, status: AppointmentStatus.NOVO, observation: apt.observation, box_id: finalBoxId });
      if (error) alert("Erro ao agendar: " + error.message);
      else fetchData(silent);
  };

  const handleReplyReview = async (id: string, reply: string) => {
      const { error } = await supabase.from('reviews').update({ reply }).eq('id', id);
      if (error) throw error;
      await fetchData();
  };

  if (loading) return <div className="h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-red-600" size={32} /></div>;

  if (showAuth && !session && !publicSlug && !settings) {
      return <AuthScreen role={authRole} onLogin={() => { setShowAuth(false); fetchData(); }} onBack={() => setShowAuth(false)} preFillData={preFillAuth} />;
  }

  if ((publicSlug || session?.user?.user_metadata?.role === 'CLIENT' || previewMode) && settings) {
      return (
        <>
            <PublicBooking 
                currentUser={session?.user}
                businessSettings={settings}
                services={services}
                existingAppointments={appointments}
                portfolio={portfolio}
                reviews={reviews}
                onBookingComplete={async (apt, newCustomer) => {
                    await handleAddAppointment(apt, newCustomer, true); 
                    return true;
                }}
                onExit={() => {
                    supabase.auth.signOut();
                    setPublicSlug(null);
                    setPreviewMode(false);
                    window.location.href = '/';
                }}
                onLoginRequest={() => { setAuthRole('CLIENT'); setShowAuth(true); }}
                onRegisterRequest={(data) => { setAuthRole('CLIENT'); setPreFillAuth(data); setShowAuth(true); }}
            />
            {showAuth && !session && (
                <div className="fixed inset-0 z-[250] bg-black animate-in fade-in duration-300">
                    <AuthScreen role="CLIENT" onLogin={() => { setShowAuth(false); fetchData(); }} onBack={() => setShowAuth(false)} preFillData={preFillAuth} />
                </div>
            )}
        </>
      );
  }

  if (!session) {
      return <WelcomeScreen onSelectFlow={(role) => { setAuthRole(role); setShowAuth(true); }} onPreviewClient={() => setPreviewMode(true)} />;
  }

  // FALLBACK: Se autenticado mas sem settings (Admin recém-criado ou erro de carregamento)
  if (!settings && session) {
      const isAdmin = session.user.user_metadata?.role === 'ADMIN';

      return (
          <div className="h-screen bg-[#050505] flex flex-col items-center justify-center p-8 text-center font-sans overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none" />
              <div className="relative z-10 space-y-8 max-w-lg animate-in zoom-in-95 duration-500">
                  <div className="w-20 h-20 rounded-[2.5rem] bg-zinc-900 border border-white/10 flex items-center justify-center mx-auto shadow-2xl relative group overflow-hidden">
                      <div className="absolute inset-0 bg-red-600/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                      <AlertCircle className="text-red-500 z-10" size={36} strokeWidth={1.5} />
                  </div>
                  
                  <div>
                      <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">
                        {isAdmin ? 'Hangar não Inicializado' : 'Acesso Restrito'}
                      </h2>
                      <p className="text-zinc-500 text-sm font-medium leading-relaxed">
                          {isAdmin 
                            ? 'Detectamos que sua conta de administrador foi criada, mas o espaço operacional (Hangar) ainda não foi configurado no banco de dados.'
                            : 'Não conseguimos localizar configurações vinculadas a este perfil.'}
                      </p>
                  </div>

                  <div className="grid gap-3 w-full">
                      {isAdmin && (
                          <button 
                              onClick={handleInitializeHangar}
                              disabled={initializing}
                              className="w-full py-5 bg-red-600 hover:bg-red-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(220,38,38,0.3)] transition-all active:scale-[0.98]"
                          >
                              {initializing ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                              Inicializar meu Hangar Agora
                          </button>
                      )}

                      <button 
                          onClick={() => fetchData()}
                          className="w-full py-5 bg-white text-black rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-glow transition-all active:scale-[0.98]"
                      >
                          <RefreshCw size={16} /> Tentar Re-Sincronização
                      </button>
                      
                      <button 
                          onClick={() => supabase.auth.signOut()}
                          className="w-full py-5 bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3"
                      >
                          <LogOut size={16} /> Encerrar Sessão
                      </button>
                  </div>

                  <div className="pt-8 opacity-20">
                      <img src="https://i.postimg.cc/wxRyvSbG/carboncarlogo.png" className="h-6 mx-auto grayscale" alt="Carbon OS" />
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="flex w-full overflow-hidden bg-black font-sans" style={{ zoom: '0.9', height: '111.12vh' }}>
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} currentPlan={settings.plan_type || PlanType.START} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onUpgrade={() => setActiveTab('settings')} onLogout={() => supabase.auth.signOut()} logoUrl={settings.profile_image_url} businessName={settings.business_name} slug={settings.slug} />
        <div className="flex-1 flex flex-col min-w-0 h-full relative">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden absolute top-4 left-4 z-50 p-2 bg-zinc-900 rounded-lg text-white"><Menu size={20} /></button>
            <SubscriptionGuard businessId={settings.id || ''} onPlanChange={fetchData}>
                <main className="flex-1 h-full overflow-y-auto bg-black custom-scrollbar pb-10">
                    {activeTab === 'dashboard' && <Dashboard currentPlan={settings.plan_type || PlanType.START} appointments={appointments} customers={customers} onUpgrade={() => setActiveTab('settings')} setActiveTab={setActiveTab} businessSettings={settings} onUpdateStatus={handleUpdateStatus} onCancelAppointment={(id) => handleUpdateStatus(id, AppointmentStatus.CANCELADO)} onDeleteAppointment={async (id) => { await supabase.from('appointments').delete().eq('id', id); fetchData(); }} onRefresh={async () => await fetchData()} />}
                    {activeTab === 'schedule' && <Schedule appointments={appointments} customers={customers} onAddAppointment={handleAddAppointment} onUpdateStatus={handleUpdateStatus} onCancelAppointment={(id) => handleUpdateStatus(id, AppointmentStatus.CANCELADO)} onDeleteAppointment={async (id) => { await supabase.from('appointments').delete().eq('id', id); fetchData(); }} settings={settings} services={services} serviceBays={serviceBays} onUpgrade={() => setActiveTab('settings')} currentPlan={settings.plan_type} onRefresh={async () => await fetchData()} />}
                    {activeTab === 'crm' && <CRM customers={customers} onAddCustomer={async (c) => { const { data: { session: s } } = await supabase.auth.getSession(); if (!s?.user) return; const { vehicles, ...customerData } = c; const { data: newCust, error } = await supabase.from('customers').insert({ business_id: settings?.id, user_id: s.user.id, ...customerData }).select().single(); if(!error && newCust && vehicles && vehicles.length > 0) { await supabase.from('vehicles').insert({ customer_id: newCust.id, brand: vehicles[0].brand, model: vehicles[0].model, plate: vehicles[0].plate, type: 'CARRO' }); } if(!error) fetchData(); }} onDeleteCustomer={async (id) => { await supabase.from('customers').delete().eq('id', id); fetchData(); }} businessSettings={settings} onUpdateSettings={async (s) => { const { success } = await save('business_settings', s); if (success) fetchData(); }} />}
                    {activeTab === 'finance' && <FinancialModule appointments={appointments} expenses={expenses} onAddExpense={async (e) => { await save('expenses', { ...e, business_id: settings.id }); fetchData(); }} onDeleteExpense={async (id) => { await supabase.from('expenses').delete().eq('id', id); fetchData(); }} currentPlan={settings.plan_type || PlanType.START} onUpgrade={() => setActiveTab('settings')} businessId={settings.id} />}
                    {activeTab === 'marketing' && <MarketingModule portfolio={portfolio} onAddPortfolioItem={(item) => setPortfolio(prev => [item, ...prev])} onDeletePortfolioItem={async (id) => { await supabase.from('portfolio_items').delete().eq('id', id); fetchData(); }} reviews={reviews} onReplyReview={handleReplyReview} currentPlan={settings.plan_type || PlanType.START} onUpgrade={() => setActiveTab('settings')} businessId={settings.id} />}
                    {activeTab === 'settings' && <Settings currentPlan={settings.plan_type || PlanType.START} onUpgrade={async (plan) => { await save('business_settings', { id: settings.id, plan_type: plan }); fetchData(); }} settings={settings} onUpdateSettings={(s) => setSettings(s)} services={services} onAddService={async (s) => { fetchData(); }} onDeleteService={async (id) => { await supabase.from('services').delete().eq('id', id); fetchData(); }} />}
                </main>
            </SubscriptionGuard>
        </div>
        <CookieConsent />
        {whatsappModal && <WhatsAppModal isOpen={whatsappModal.isOpen} onClose={() => setWhatsappModal(null)} phone={whatsappModal.phone} message={whatsappModal.message} customerName={whatsappModal.customerName} />}
    </div>
  );
}

export default App;