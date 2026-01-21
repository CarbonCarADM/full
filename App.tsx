
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
import { Loader2, Menu } from 'lucide-react';
import { useEntitySaver } from './hooks/useEntitySaver';
import { generateConfirmationMessage, openWhatsAppChat } from './services/whatsappService';
import { CookieConsent } from './components/CookieConsent';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  // Auth Flow
  const [showAuth, setShowAuth] = useState(false);
  const [authRole, setAuthRole] = useState<'ADMIN' | 'CLIENT'>('ADMIN');
  const [preFillAuth, setPreFillAuth] = useState<{name: string, phone: string} | null>(null);

  const { save } = useEntitySaver();

  useEffect(() => {
    // Check URL for public studio
    const params = new URLSearchParams(window.location.search);
    const studioSlug = params.get('studio');
    if (studioSlug) {
      setPublicSlug(studioSlug);
    }

    // Auth Listener
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!studioSlug) {
          // Only stop loading here if not public mode (public mode fetches data first)
          if(!session) setLoading(false); 
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const normalizeSettings = (biz: any): BusinessSettings => {
      // Garante que operating_days e blocked_dates existam na raiz, extraindo de configs se necessário
      let operating_days = biz.operating_days || biz.configs?.operating_days || [];
      const blocked_dates = biz.blocked_dates || biz.configs?.blocked_dates || [];

      // Fallback: Se não houver horários configurados, usar padrão comercial (Seg-Sex 08-18h)
      // Isso previne que a agenda apareça "travada" ou vazia para contas novas
      if (operating_days.length === 0) {
          operating_days = [
              { dayOfWeek: 0, isOpen: false, openTime: '00:00', closeTime: '00:00' }, // Dom
              { dayOfWeek: 1, isOpen: true, openTime: '08:00', closeTime: '18:00' },  // Seg
              { dayOfWeek: 2, isOpen: true, openTime: '08:00', closeTime: '18:00' },
              { dayOfWeek: 3, isOpen: true, openTime: '08:00', closeTime: '18:00' },
              { dayOfWeek: 4, isOpen: true, openTime: '08:00', closeTime: '18:00' },
              { dayOfWeek: 5, isOpen: true, openTime: '08:00', closeTime: '18:00' },
              { dayOfWeek: 6, isOpen: true, openTime: '09:00', closeTime: '14:00' }   // Sab
          ];
      }

      return {
          ...biz,
          operating_days,
          blocked_dates
      };
  };

  const fetchData = async () => {
    try {
        setLoading(true);
        let businessId = '';

        // Lógica de Prioridade: 
        // 1. Slug na URL (Visitante)
        // 2. Role CLIENT (Cliente Logado - vê a loja que agendou/visitou)
        // 3. Role ADMIN (Dono - vê seu painel)

        const userRole = session?.user?.user_metadata?.role;

        if (publicSlug) {
            const { data: biz } = await supabase.from('business_settings').select('*').eq('slug', publicSlug).single();
            if (biz) {
                const normalized = normalizeSettings(biz);
                setSettings(normalized);
                businessId = biz.id;
            } else {
                alert("Hangar não encontrado.");
                setPublicSlug(null);
                setLoading(false);
                return;
            }
        } else if (session?.user) {
            if (userRole === 'CLIENT') {
                // TODO: Em um cenário real multi-tenant, buscaríamos a última loja visitada ou uma lista.
                // Por enquanto, se o cliente logou e não tem slug, ele pode ter vindo do cadastro.
                // Se não tivermos ID da loja, não conseguimos carregar.
                // O ideal seria persistir a last_visited_store no metadata do user.
                // Fallback: Tenta buscar appointments do user para achar a loja.
                const { data: lastApt } = await supabase.from('appointments').select('business_id').eq('user_id', session.user.id).limit(1).single();
                if (lastApt) {
                     const { data: biz } = await supabase.from('business_settings').select('*').eq('id', lastApt.business_id).single();
                     if (biz) {
                        const normalized = normalizeSettings(biz);
                        setSettings(normalized);
                        businessId = biz.id;
                        // Define slug para ativar modo PublicBooking
                        setPublicSlug(biz.slug); 
                     }
                } else {
                    // Cliente novo sem agendamento e sem slug na URL -> Estado indefinido
                    // Poderíamos redirecionar para uma busca de lojas.
                    setLoading(false);
                    return; 
                }
            } else {
                // Admin Mode
                const { data: biz } = await supabase.from('business_settings').select('*').eq('user_id', session.user.id).single();
                if (biz) {
                    const normalized = normalizeSettings(biz);
                    setSettings(normalized);
                    businessId = biz.id;
                } else {
                    console.warn("Settings não encontradas para usuário logado.");
                }
            }
        }

        if (!businessId) {
            setLoading(false);
            return;
        }

        // Parallel Fetching
        const [
            { data: apts },
            { data: servs },
            { data: bays },
            { data: exps },
            { data: port },
            { data: revs },
            custRes
        ] = await Promise.all([
            // BUG 4 FIX: Fetching appointments by business_id ensures Admins see guests (user_id: null)
            supabase.from('appointments').select('*').eq('business_id', businessId),
            supabase.from('services').select('*').eq('business_id', businessId).eq('is_active', true),
            supabase.from('service_bays').select('*').eq('business_id', businessId).order('name', { ascending: true }),
            supabase.from('expenses').select('*').eq('business_id', businessId),
            supabase.from('portfolio_items').select('*').eq('business_id', businessId),
            supabase.from('reviews').select('*').eq('business_id', businessId),
            supabase.from('customers').select('*').eq('business_id', businessId)
        ]);

        if (apts) {
            setAppointments(apts.map(a => ({
                ...a,
                serviceType: a.service_type,
                durationMinutes: a.duration_minutes,
                customerId: a.customer_id,
                vehicleId: a.vehicle_id,
                boxId: a.box_id
            })));
        }
        if (servs) setServices(servs as ServiceItem[]);
        if (bays) setServiceBays(bays as ServiceBay[]);
        if (exps) setExpenses(exps as Expense[]);
        if (port) setPortfolio(port.map(p => ({ ...p, imageUrl: p.image_url })));
        if (revs) setReviews(revs.map(r => ({ ...r, customerName: r.customer_name })));

        // Customer Logic
        let processedCustomers: Customer[] = [];
        if (custRes.data && custRes.data.length > 0) {
            const customerIds = custRes.data.map((c: any) => c.id);
            const { data: vehiclesData } = await supabase.from('vehicles').select('*').in('customer_id', customerIds);
            
            processedCustomers = custRes.data.map((c: any) => ({
                id: c.id,
                name: c.name,
                phone: c.phone || '',
                email: c.email || '',
                totalSpent: Number(c.total_spent),
                lastVisit: c.last_visit,
                xpPoints: c.xp_points,
                washes: c.washes_count,
                vehicles: vehiclesData?.filter((v: any) => v.customer_id === c.id).map((v: any) => ({
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

    } catch (error) {
        console.error("Data Load Error:", error);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
      if (session || publicSlug) {
          fetchData();
      }
  }, [session, publicSlug]);

  const handleUpdateStatus = async (id: string, status: AppointmentStatus) => {
      const { success } = await save('appointments', { id, status });
      if (success) {
          setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));

          // WHATSAPP AUTOMATION
          if (status === AppointmentStatus.CONFIRMADO) {
              const apt = appointments.find(a => a.id === id);
              if (apt) {
                  const customer = customers.find(c => c.id === apt.customerId);
                  if (customer && customer.phone) {
                      const vehicle = customer.vehicles.find(v => v.id === apt.vehicleId) || customer.vehicles[0];
                      setTimeout(() => {
                          if (window.confirm("Agendamento Aceito! Deseja enviar a mensagem de confirmação para o cliente no WhatsApp?")) {
                              const message = generateConfirmationMessage(
                                  settings?.business_name || 'CarbonCar',
                                  customer.name,
                                  apt.date,
                                  apt.time,
                                  vehicle?.model || 'Veículo',
                                  vehicle?.plate || '---',
                                  apt.serviceType
                              );
                              openWhatsAppChat(customer.phone, message);
                          }
                      }, 100);
                  }
              }
          }
      }
  };

  const handleAddAppointment = async (apt: Appointment, newCustomer?: Customer) => {
      // 1. Obter sessão (pode ser nula para visitantes)
      const { data: { session } } = await supabase.auth.getSession();
      
      // Determine o owner do registro de Cliente. 
      // Se for anonimo, usamos o ID do dono da loja (settings.user_id) para que o admin possa ver o cliente.
      // Se for logado (admin ou cliente), usamos o ID da sessão.
      const customerOwnerId = session?.user?.id || settings?.user_id;

      if (!customerOwnerId) {
          alert("Erro crítico: Identificação do Hangar não encontrada. Recarregue a página.");
          return;
      }

      // Logic to save customer/vehicle first if new, then appointment
      if (newCustomer) {
          const { data: custData, error: custError } = await supabase.from('customers').insert({
              business_id: settings?.id,
              user_id: customerOwnerId, // Vital: Vincula ao Admin se for visitante
              name: newCustomer.name,
              phone: newCustomer.phone,
              email: newCustomer.email
          }).select().single();
          
          if (custError) {
              console.error("Erro ao criar cliente:", custError);
              alert("Erro ao salvar cliente. Verifique os dados.");
              return;
          }
          
          if (custData) {
              const vehicleData = newCustomer.vehicles[0];
              const { data: vehData } = await supabase.from('vehicles').insert({
                  customer_id: custData.id,
                  brand: vehicleData.brand,
                  model: vehicleData.model,
                  plate: vehicleData.plate,
                  type: 'CARRO'
              }).select().single();

              if (vehData) {
                  apt.customerId = custData.id;
                  apt.vehicleId = vehData.id;
              }
          }
      }

      if (!apt.boxId || apt.boxId.length < 10) {
          // Fallback seguro se boxId vier vazio (evita erro UUID)
          // Tenta pegar o primeiro box disponível do estado
          if (serviceBays.length > 0) {
              apt.boxId = serviceBays[0].id;
          } else {
              console.error("Invalid Box ID:", apt.boxId);
              alert("Erro: Nenhum box disponível. Contate o suporte.");
              return;
          }
      }

      const payload = {
        business_id: settings?.id,
        user_id: session?.user?.id || null, // Null para visitantes (permitido pelo SQL)
        customer_id: apt.customerId,
        vehicle_id: apt.vehicleId,
        service_id: apt.serviceId,
        service_type: apt.serviceType,
        date: apt.date,
        time: apt.time,
        duration_minutes: apt.durationMinutes,
        price: apt.price,
        status: apt.status,
        observation: apt.observation,
        box_id: apt.boxId
      };

      const { data: aptData, error } = await supabase.from('appointments').insert(payload).select().single();
      
      if (error) {
          console.error("Erro ao salvar agendamento:", error);
          alert("Erro ao salvar: " + error.message);
      } else if (aptData) {
          // Atualiza dados locais sem refresh total para UX mais fluida
          fetchData();
      }
  };

  if (loading) return <div className="h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-red-600" size={32} /></div>;

  // Renderiza PublicBooking se:
  // 1. Existe publicSlug (Visitante)
  // 2. OU Usuário logado é CLIENT (Cliente acessando painel)
  if ((publicSlug || session?.user?.user_metadata?.role === 'CLIENT') && settings) {
      return <PublicBooking 
        currentUser={session?.user}
        businessSettings={settings}
        services={services}
        existingAppointments={appointments}
        portfolio={portfolio}
        reviews={reviews}
        onBookingComplete={async (apt, newCustomer) => {
            await handleAddAppointment(apt, newCustomer);
            return true;
        }}
        onExit={() => {
            supabase.auth.signOut();
            setPublicSlug(null);
            window.location.href = '/';
        }}
        onLoginRequest={() => {
            // Mantém slug mas mostra auth
            setAuthRole('CLIENT');
            setShowAuth(true);
        }}
        onRegisterRequest={(data) => {
             setAuthRole('CLIENT');
             setPreFillAuth(data);
             setShowAuth(true);
        }}
      />
  }

  if (!session) {
      if (showAuth) {
          return <AuthScreen 
            role={authRole} 
            onLogin={() => {
                setShowAuth(false);
                fetchData(); // Recarrega para aplicar lógica de role
            }} 
            onBack={() => setShowAuth(false)}
            preFillData={preFillAuth} 
          />;
      }
      return <WelcomeScreen onSelectFlow={(role, mode) => {
          setAuthRole(role);
          setShowAuth(true);
      }} />;
  }

  if (!settings) return <div className="h-screen bg-black flex items-center justify-center text-white">Carregando Hangar...</div>;

  return (
    <div className="flex w-full overflow-hidden bg-black font-sans selection:bg-red-900 selection:text-white" style={{ zoom: '0.9', height: '111.12vh' }}>
        <Sidebar 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            currentPlan={settings.plan_type || PlanType.START}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            onUpgrade={() => setActiveTab('assinatura')} 
            onLogout={() => supabase.auth.signOut()}
            logoUrl={settings.profile_image_url}
            businessName={settings.business_name}
            slug={settings.slug}
        />
        
        <div className="flex-1 flex flex-col min-w-0 h-full relative">
            <button 
                onClick={() => setSidebarOpen(true)}
                className="md:hidden absolute top-4 left-4 z-50 p-2 bg-zinc-900 rounded-lg text-white"
            >
                <Menu size={20} />
            </button>

            <SubscriptionGuard 
                businessId={settings.id || ''} 
                onPlanChange={fetchData}
            >
                <main className="flex-1 h-full overflow-y-auto bg-black custom-scrollbar pb-10">
                    {activeTab === 'dashboard' && (
                        <Dashboard 
                            currentPlan={settings.plan_type || PlanType.START}
                            appointments={appointments}
                            customers={customers}
                            onUpgrade={() => setActiveTab('settings')}
                            setActiveTab={setActiveTab}
                            businessSettings={settings}
                            onUpdateStatus={handleUpdateStatus}
                            onCancelAppointment={(id) => handleUpdateStatus(id, AppointmentStatus.CANCELADO)}
                            onDeleteAppointment={async (id) => { await supabase.from('appointments').delete().eq('id', id); fetchData(); }}
                            onRefresh={async () => await fetchData()}
                        />
                    )}
                    {activeTab === 'schedule' && (
                        <Schedule 
                            appointments={appointments}
                            customers={customers}
                            onAddAppointment={handleAddAppointment}
                            onUpdateStatus={handleUpdateStatus}
                            onCancelAppointment={(id) => handleUpdateStatus(id, AppointmentStatus.CANCELADO)}
                            onDeleteAppointment={async (id) => { await supabase.from('appointments').delete().eq('id', id); fetchData(); }}
                            settings={settings}
                            services={services}
                            serviceBays={serviceBays}
                            onUpgrade={() => setActiveTab('settings')}
                            currentPlan={settings.plan_type}
                            onRefresh={async () => await fetchData()}
                        />
                    )}
                    {activeTab === 'crm' && (
                        <CRM 
                            customers={customers}
                            onAddCustomer={async (c) => { 
                                const { data: { session } } = await supabase.auth.getSession();
                                if (!session?.user) return;

                                const { vehicles, ...customerData } = c;

                                const { data: newCust, error } = await supabase.from('customers').insert({
                                    business_id: settings?.id,
                                    user_id: session.user.id, 
                                    ...customerData
                                }).select().single();
                                
                                if(!error && newCust && vehicles && vehicles.length > 0) {
                                    await supabase.from('vehicles').insert({
                                        customer_id: newCust.id,
                                        brand: vehicles[0].brand,
                                        model: vehicles[0].model,
                                        plate: vehicles[0].plate,
                                        type: 'CARRO'
                                    });
                                }

                                if(!error) fetchData(); 
                            }}
                            onDeleteCustomer={async (id) => { await supabase.from('customers').delete().eq('id', id); fetchData(); }}
                            businessSettings={settings}
                            onUpdateSettings={async (s) => { 
                                const { success } = await save('business_settings', s);
                                if (success) fetchData();
                            }}
                        />
                    )}
                    {activeTab === 'finance' && (
                        <FinancialModule 
                             appointments={appointments}
                             expenses={expenses}
                             onAddExpense={async (e) => { 
                                 await save('expenses', { ...e, business_id: settings.id }); 
                                 fetchData(); 
                             }}
                             onDeleteExpense={async (id) => { await supabase.from('expenses').delete().eq('id', id); fetchData(); }}
                             currentPlan={settings.plan_type || PlanType.START}
                             onUpgrade={() => setActiveTab('settings')}
                             businessId={settings.id}
                        />
                    )}
                    {activeTab === 'marketing' && (
                        <MarketingModule 
                            portfolio={portfolio}
                            onAddPortfolioItem={(item) => setPortfolio(prev => [item, ...prev])}
                            onDeletePortfolioItem={async (id) => { await supabase.from('portfolio_items').delete().eq('id', id); fetchData(); }}
                            reviews={reviews}
                            onReplyReview={() => {}}
                            currentPlan={settings.plan_type || PlanType.START}
                            onUpgrade={() => setActiveTab('settings')}
                            businessId={settings.id}
                        />
                    )}
                    {activeTab === 'settings' && (
                        <Settings 
                            currentPlan={settings.plan_type || PlanType.START}
                            onUpgrade={async (plan) => { 
                                await save('business_settings', { id: settings.id, plan_type: plan }); 
                                fetchData(); 
                            }}
                            settings={settings}
                            onUpdateSettings={(s) => setSettings(s)}
                            services={services}
                            onAddService={async (s) => { 
                                await save('services', { ...s, business_id: settings.id, is_active: true }); 
                                fetchData(); 
                            }}
                            onDeleteService={async (id) => { await supabase.from('services').delete().eq('id', id); fetchData(); }}
                        />
                    )}
                </main>
            </SubscriptionGuard>
        </div>
        <CookieConsent />
    </div>
  );
}

export default App;
