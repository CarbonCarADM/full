import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import { 
  Customer, Appointment, BusinessSettings, ServiceItem, 
  Expense, PlanType, PortfolioItem, Review, AppointmentStatus 
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

  const fetchData = async () => {
    try {
        setLoading(true);
        let businessId = '';

        if (publicSlug) {
            const { data: biz } = await supabase.from('business_settings').select('*').eq('slug', publicSlug).single();
            if (biz) {
                setSettings(biz);
                businessId = biz.id;
            } else {
                alert("Hangar não encontrado.");
                setPublicSlug(null);
                setLoading(false);
                return;
            }
        } else if (session?.user) {
            // Admin Mode
            const { data: biz } = await supabase.from('business_settings').select('*').eq('user_id', session.user.id).single();
            if (biz) {
                setSettings(biz);
                businessId = biz.id;
            } else {
                // If no business settings found for user, typically handled by AuthScreen logic or new account
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
            { data: exps },
            { data: port },
            { data: revs },
            custRes
        ] = await Promise.all([
            supabase.from('appointments').select('*').eq('business_id', businessId),
            supabase.from('services').select('*').eq('business_id', businessId).eq('is_active', true),
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
                vehicleId: a.vehicle_id
            })));
        }
        if (servs) setServices(servs as ServiceItem[]);
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
      }
  };

  const handleAddAppointment = async (apt: Appointment, newCustomer?: Customer) => {
      // Logic to save customer/vehicle first if new, then appointment
      if (newCustomer) {
          const { data: custData } = await supabase.from('customers').insert({
              business_id: settings?.id,
              name: newCustomer.name,
              phone: newCustomer.phone,
              email: newCustomer.email
          }).select().single();
          
          if (custData) {
              const { data: vehData } = await supabase.from('vehicles').insert({
                  customer_id: custData.id,
                  brand: newCustomer.vehicles[0].brand,
                  model: newCustomer.vehicles[0].model,
                  plate: newCustomer.vehicles[0].plate,
                  type: 'CARRO'
              }).select().single();

              if (vehData) {
                  apt.customerId = custData.id;
                  apt.vehicleId = vehData.id;
                  fetchData(); 
              }
          }
      }

      const payload = {
        business_id: settings?.id,
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

      const { data: aptData } = await supabase.from('appointments').insert(payload).select().single();
      if (aptData) {
          fetchData();
      }
  };

  if (loading) return <div className="h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-red-600" size={32} /></div>;

  if (publicSlug && settings) {
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
            window.history.pushState({}, '', '/');
        }}
        onLoginRequest={() => {
            setPublicSlug(null); 
            window.history.pushState({}, '', '/');
        }}
        onRegisterRequest={(data) => {
             setPublicSlug(null);
             window.history.pushState({}, '', '/');
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
            onLogin={() => setShowAuth(false)} 
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
    <div className="flex h-screen bg-black font-sans selection:bg-red-900 selection:text-white">
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
        
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
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
                <main className="flex-1 overflow-y-auto bg-black custom-scrollbar">
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
                            onRefresh={fetchData}
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
                            onUpgrade={() => setActiveTab('settings')}
                            currentPlan={settings.plan_type}
                            onRefresh={fetchData}
                        />
                    )}
                    {activeTab === 'crm' && (
                        <CRM 
                            customers={customers}
                            onAddCustomer={async (c) => { 
                                const { error } = await supabase.from('customers').insert({
                                    business_id: settings?.id,
                                    ...c
                                });
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
    </div>
  );
}

export default App;