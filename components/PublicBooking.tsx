import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Phone, Instagram, MapPin, Car, Clock, RefreshCw, ChevronLeft, Check, Lock, 
  Star, Reply, User, Trophy, History, ShieldCheck, LogOut, Gift, Mail, Key, 
  Home, Image as ImageIcon, Calendar as CalendarIcon, Loader2, Wrench, Sparkles, X, LayoutGrid,
  ChevronRight, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import { cn, formatPhone, formatPlate, generateUUID } from '../lib/utils';
import { BusinessSettings, ServiceItem, Appointment, PortfolioItem, Review, Customer, Vehicle, AppointmentStatus } from '../types';

interface PublicBookingProps {
  currentUser: any;
  businessSettings: BusinessSettings;
  services: ServiceItem[];
  existingAppointments: Appointment[];
  portfolio: PortfolioItem[];
  reviews: Review[];
  onBookingComplete: (apt: Appointment, newCustomer?: Customer) => Promise<boolean>;
  onExit: () => void;
  onLoginRequest: () => void;
  onRegisterRequest: (data: { name: string, phone: string }) => void;
}

export const PublicBooking: React.FC<PublicBookingProps> = ({
  currentUser,
  businessSettings,
  services,
  existingAppointments,
  portfolio,
  reviews,
  onBookingComplete,
  onExit,
  onLoginRequest,
  onRegisterRequest
}) => {
  // Screens: HOME, GALLERY, AGENDA, PROFILE, BOOKING
  const [currentScreen, setCurrentScreen] = useState<'HOME' | 'GALLERY' | 'AGENDA' | 'PROFILE' | 'BOOKING'>('HOME');
  
  // Home State
  const [searchTerm, setSearchTerm] = useState('');
  const [currentSlide, setCurrentSlide] = useState(0);

  // Booking Flow State
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [guestForm, setGuestForm] = useState({ name: '', phone: '' });
  const [vehicleForm, setVehicleForm] = useState({ brand: '', model: '', plate: '' });
  const [loading, setLoading] = useState(false);
  const [showAuthCard, setShowAuthCard] = useState(false);
  const [confirmedDetails, setConfirmedDetails] = useState<{ date: string, time: string } | null>(null);
  const [pendingResume, setPendingResume] = useState<any>(null);

  // Gallery State
  const [galleryTab, setGalleryTab] = useState<'PHOTOS' | 'REVIEWS'>('PHOTOS');
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // Agenda State
  const [agendaTab, setAgendaTab] = useState<'UPCOMING' | 'HISTORY'>('UPCOMING');

  // Profile State
  const [profileView, setProfileView] = useState<'MENU' | 'INFO' | 'FIDELITY' | 'VEHICLE' | 'SECURITY'>('MENU');
  const [updateForm, setUpdateForm] = useState({ email: '', password: '' });
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  
  // Data State
  const [dbReviews, setDbReviews] = useState<Review[]>(reviews);
  const [dbUserAppointments, setDbUserAppointments] = useState<Appointment[]>([]);
  const [userCustomer, setUserCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    setDbReviews(reviews);
  }, [reviews]);

  // Slideshow effect
  useEffect(() => {
    if (businessSettings.configs?.studio_photos?.length > 0) {
      const interval = setInterval(() => {
        setCurrentSlide(prev => (prev + 1) % businessSettings.configs.studio_photos.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [businessSettings.configs?.studio_photos]);

  // Check for pending resume
  useEffect(() => {
    const savedDraft = sessionStorage.getItem('carbon_booking_draft');
    if (currentUser && savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        setPendingResume(draft);
      } catch (e) {
        sessionStorage.removeItem('carbon_booking_draft');
      }
    }
  }, [currentUser]);

  // Load User Data
  useEffect(() => {
    const loadUserData = async () => {
      if (!currentUser || !businessSettings.id) return;
      
      const { data: customerData } = await supabase
        .from('customers')
        .select('*, vehicles(*)')
        .eq('user_id', currentUser.id)
        .eq('business_id', businessSettings.id)
        .maybeSingle();

      if (customerData) {
        setUserCustomer(customerData);
        setGuestForm({ name: customerData.name, phone: customerData.phone });
        if (customerData.vehicles && customerData.vehicles.length > 0) {
            const v = customerData.vehicles[0];
            setVehicleForm({ brand: v.brand, model: v.model, plate: v.plate });
        }
      }

      // Load Appointments
      const { data: apts } = await supabase
        .from('appointments')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('business_id', businessSettings.id)
        .order('date', { ascending: false });

      if (apts) {
          const enhancedApts = await Promise.all(apts.map(async (a: any) => {
               const { data: v } = await supabase.from('vehicles').select('*').eq('id', a.vehicle_id).single();
               return { ...a, vehicle_model: v?.model || 'Veículo', vehicle_plate: v?.plate || '' };
          }));
          setDbUserAppointments(enhancedApts as any[]);
      }
    };
    loadUserData();
  }, [currentUser, businessSettings.id]);

  // Computed
  const isOpenNow = useMemo(() => {
      const now = new Date();
      const day = now.getDay();
      const rule = businessSettings.operating_days?.find(d => d.dayOfWeek === day);
      if (!rule || !rule.isOpen) return false;
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [openH, openM] = rule.openTime.split(':').map(Number);
      const [closeH, closeM] = rule.closeTime.split(':').map(Number);
      return currentMinutes >= (openH * 60 + openM) && currentMinutes < (closeH * 60 + closeM);
  }, [businessSettings.operating_days]);

  const filteredServices = useMemo(() => {
      return services.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [services, searchTerm]);

  const servicesCount = useMemo(() => {
      return dbUserAppointments.filter(a => a.status === 'FINALIZADO').length;
  }, [dbUserAppointments]);

  const userVehicle = useMemo(() => {
      if (!userCustomer?.vehicles || userCustomer.vehicles.length === 0) return 'Nenhum veículo registrado';
      const v = userCustomer.vehicles[0];
      return `${v.brand} ${v.model} - ${v.plate}`;
  }, [userCustomer]);

  const identifiedVehicleId = userCustomer?.vehicles?.[0]?.id;
  const identifiedCustomerId = userCustomer?.id;

  // Calendar Logic
  const calendarDays = useMemo(() => {
      const days = [];
      const year = viewDate.getFullYear();
      const month = viewDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let i = 1; i <= daysInMonth; i++) {
          const date = new Date(year, month, i);
          const dateStr = date.toLocaleDateString('en-CA');
          const dayOfWeek = date.getDay();
          
          const rule = businessSettings.operating_days?.find(d => d.dayOfWeek === dayOfWeek);
          const isBlocked = businessSettings.blocked_dates?.some(b => b.date === dateStr);
          const isPast = new Date(dateStr + 'T23:59:59') < new Date();
          
          if (isPast) continue; 

          const isOpen = rule?.isOpen && !isBlocked;
          
          days.push({
              dayNumber: i,
              dayName: date.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3),
              dateStr,
              isOpen
          });
      }
      return days;
  }, [viewDate, businessSettings]);

  const availableSlots = useMemo(() => {
      if (!selectedDate) return [];
      const dayOfWeek = new Date(selectedDate + 'T12:00:00').getDay();
      const rule = businessSettings.operating_days?.find(d => d.dayOfWeek === dayOfWeek);
      if (!rule || !rule.isOpen) return [];

      const slots = [];
      let [h, m] = rule.openTime.split(':').map(Number);
      const [closeH, closeM] = rule.closeTime.split(':').map(Number);
      const endMinutes = closeH * 60 + closeM;

      while ((h * 60 + m) < endMinutes) {
          const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          
          const now = new Date();
          const slotDateTime = new Date(`${selectedDate}T${timeStr}`);
          if (slotDateTime > now) {
               slots.push(timeStr);
          }

          m += businessSettings.slot_interval_minutes;
          if (m >= 60) {
              h += Math.floor(m / 60);
              m %= 60;
          }
      }
      return slots;
  }, [selectedDate, businessSettings]);

  const slotOccupancy = useMemo(() => {
      if (!selectedDate) return {};
      const counts: Record<string, number> = {};
      existingAppointments.forEach(a => {
          if (a.date === selectedDate && a.status !== 'CANCELADO') {
              counts[a.time] = (counts[a.time] || 0) + 1;
          }
      });
      return counts;
  }, [selectedDate, existingAppointments]);

  // Actions
  const handleOpenWhatsapp = () => {
      if (businessSettings.whatsapp) {
          window.open(`https://wa.me/${businessSettings.whatsapp.replace(/\D/g, '')}`, '_blank');
      }
  };

  const changeMonth = (delta: number) => {
      const newDate = new Date(viewDate);
      newDate.setMonth(newDate.getMonth() + delta);
      setViewDate(newDate);
  };

  const getDurationParts = (minutes: number) => {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      let full = '';
      if (h > 0) full += `${h}h `;
      if (m > 0) full += `${m}min`;
      return { h, m, full: full.trim() };
  };

  const saveDraft = () => {
    if (selectedService && selectedDate && selectedTime) {
      const draft = { 
        service: selectedService, 
        date: selectedDate, 
        time: selectedTime, 
        guestData: guestForm 
      };
      sessionStorage.setItem('carbon_booking_draft', JSON.stringify(draft));
    }
  };

  const confirmResume = () => {
    if (!pendingResume) return;
    setSelectedService(pendingResume.service);
    setSelectedDate(pendingResume.date);
    setSelectedTime(pendingResume.time);
    setGuestForm(pendingResume.guestData || { name: '', phone: '' });
    setCurrentScreen('BOOKING');
    setStep(3); // Go directly to vehicle step
    setPendingResume(null);
    sessionStorage.removeItem('carbon_booking_draft');
  };

  const cancelResume = () => {
    setPendingResume(null);
    sessionStorage.removeItem('carbon_booking_draft');
  };

  const handleUpdateSecurity = async () => {
      if (!updateForm.email && !updateForm.password) return;
      setIsUpdatingUser(true);
      try {
          const updates: any = {};
          if (updateForm.email) updates.email = updateForm.email;
          if (updateForm.password) updates.password = updateForm.password;
          
          const { error } = await supabase.auth.updateUser(updates);
          if (error) throw error;
          alert("Credenciais atualizadas com sucesso!");
          setUpdateForm({ email: '', password: '' });
      } catch (err: any) {
          alert("Erro ao atualizar: " + err.message);
      } finally {
          setIsUpdatingUser(false);
      }
  };

  const handleRedeemReward = () => {
      alert("Prêmio resgatado! Apresente este código no balcão: " + generateUUID().slice(0, 8).toUpperCase());
  };

  const handleContinueAction = async () => {
      if (step === 1) {
          if (!selectedDate || !selectedTime) return;
          setStep(2);
      } else if (step === 2) {
          if (!currentUser) {
            if (!guestForm.name || !guestForm.phone || guestForm.phone.length < 10) {
              alert("Por favor, preencha seu nome e telefone corretamente.");
              return;
            }
            saveDraft();
            setShowAuthCard(true);
            return;
          }
          setStep(3);
      } else if (step === 3) {
          if (!vehicleForm.brand || !vehicleForm.model || !vehicleForm.plate) {
               alert("Preencha os dados do veículo.");
               return;
          }
          setLoading(true);
          
          const newApt: Appointment = {
              id: 'temp', 
              customerId: identifiedCustomerId || 'new', 
              vehicleId: identifiedVehicleId || 'new', 
              serviceId: selectedService!.id,
              serviceType: selectedService!.name,
              date: selectedDate,
              time: selectedTime,
              durationMinutes: selectedService!.duration_minutes,
              price: selectedService!.price,
              status: AppointmentStatus.NOVO
          };

          const newCustomer: Customer | undefined = !identifiedCustomerId ? {
              id: 'temp_cust',
              name: guestForm.name,
              phone: guestForm.phone,
              email: '',
              totalSpent: 0,
              lastVisit: '',
              vehicles: [{
                  id: 'temp_veh',
                  brand: vehicleForm.brand,
                  model: vehicleForm.model,
                  plate: vehicleForm.plate,
                  type: 'CARRO',
                  color: 'A definir'
              }]
          } : undefined;

          const success = await onBookingComplete(newApt, newCustomer || (identifiedCustomerId ? {
              id: identifiedCustomerId,
              name: guestForm.name,
              phone: guestForm.phone,
              email: currentUser?.email || '',
              totalSpent: 0,
              lastVisit: '',
              vehicles: [{
                  id: identifiedVehicleId || 'temp_veh', 
                  brand: vehicleForm.brand,
                  model: vehicleForm.model,
                  plate: vehicleForm.plate,
                  type: 'CARRO',
                  color: 'A definir'
              }]
          } : undefined));

          if (success) {
              setConfirmedDetails({ date: selectedDate, time: selectedTime });
              setStep(4);
          } else {
              alert("Erro ao realizar agendamento. Tente novamente.");
          }
          setLoading(false);
      }
  };

  // Components
  const AuthInvite = ({ title, desc }: { title: string, desc: string }) => (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-6 opacity-60 hover:opacity-100 transition-opacity">
          <div className="w-16 h-16 rounded-3xl bg-zinc-900 border border-white/10 flex items-center justify-center transform rotate-3">
              <Lock size={24} className="text-zinc-500" />
          </div>
          <div className="max-w-xs">
              <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2">{title}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
          </div>
          <div className="flex gap-4">
              <button onClick={onLoginRequest} className="px-6 py-2.5 bg-white text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all">Entrar</button>
              <button onClick={() => onRegisterRequest(guestForm)} className="px-6 py-2.5 bg-zinc-900 border border-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all">Criar Conta</button>
          </div>
      </div>
  );

  const ProfileMenuButton = ({ icon: Icon, label, sublabel, onClick, badge, badgeColor, disabled }: any) => (
      <button 
          onClick={onClick}
          disabled={disabled}
          className={cn(
              "w-full p-5 bg-[#121212] border border-white/5 hover:border-white/10 rounded-[2rem] flex items-center justify-between group transition-all duration-300",
              disabled && "opacity-50 cursor-not-allowed"
          )}
      >
          <div className="flex items-center gap-5">
              <div className="w-12 h-12 rounded-2xl bg-zinc-950 border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Icon size={20} className="text-zinc-500 group-hover:text-white transition-colors" />
              </div>
              <div className="text-left">
                  <p className="text-xs font-bold text-white uppercase tracking-wide group-hover:text-red-500 transition-colors">{label}</p>
                  {sublabel && <p className="text-[9px] text-zinc-600 font-medium mt-0.5 uppercase tracking-wider">{sublabel}</p>}
              </div>
          </div>
          <div className="flex items-center gap-3">
              {badge && (
                  <span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border", badgeColor)}>
                      {badge}
                  </span>
              )}
              <ChevronRight size={14} className="text-zinc-700 group-hover:text-white group-hover:translate-x-1 transition-transform" />
          </div>
      </button>
  );

  const BottomNav = () => (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0c0c0c]/80 backdrop-blur-xl border border-white/10 rounded-full p-1.5 flex items-center gap-1 shadow-2xl z-40">
          {[
              { id: 'HOME', icon: Home, label: 'Início' },
              { id: 'GALLERY', icon: ImageIcon, label: 'Galeria' },
              { id: 'AGENDA', icon: Calendar, label: 'Agenda' },
              { id: 'PROFILE', icon: User, label: 'Perfil' },
          ].map((item) => (
              <button 
                  key={item.id}
                  onClick={() => setCurrentScreen(item.id as any)}
                  className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 relative group",
                      currentScreen === item.id ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]" : "text-zinc-500 hover:text-white hover:bg-white/10"
                  )}
              >
                  <item.icon size={18} strokeWidth={2.5} />
                  {currentScreen === item.id && (
                      <span className="absolute -top-10 bg-white text-black text-[8px] font-black uppercase px-2 py-1 rounded tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                          {item.label}
                      </span>
                  )}
              </button>
          ))}
      </div>
  );

  return (
    <div className="h-full bg-[#050505] flex flex-col font-sans relative overflow-hidden">
        <style>{`.custom-scrollbar::-webkit-scrollbar { width: 0px; } .shadow-glow-red { shadow: 0 0 20px rgba(220, 38, 38, 0.4); }`}</style>
        
        {/* Background Atmosphere */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none" />
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-red-900/10 blur-[150px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-900/5 blur-[120px] rounded-full pointer-events-none" />

        {/* Resume Modal */}
        <AnimatePresence>
            {pendingResume && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-[#0c0c0c] border border-white/10 rounded-[2rem] w-full max-w-sm p-6 shadow-2xl relative">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 bg-red-900/10 border border-red-600/20 rounded-full flex items-center justify-center"><History size={32} className="text-red-500" /></div>
                            <div><h3 className="text-lg font-black text-white uppercase mb-2">Continuar?</h3><p className="text-[10px] text-zinc-400">Retomar agendamento anterior?</p></div>
                            <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-4 w-full text-[10px] text-zinc-300">
                                <div className="flex justify-between mb-1"><span>Dia</span><span className="text-white font-black">{new Date(pendingResume.date + 'T12:00:00').toLocaleDateString('pt-BR')}</span></div>
                                <div className="flex justify-between"><span>Serviço</span><span className="text-white font-black">{pendingResume.service?.name}</span></div>
                            </div>
                            <div className="flex gap-3 w-full">
                                <button onClick={cancelResume} className="flex-1 py-3 text-[10px] uppercase text-zinc-500 font-black">Não</button>
                                <button onClick={confirmResume} className="flex-1 py-3 bg-white text-black rounded-xl text-[10px] font-black uppercase shadow-glow">Sim</button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col max-w-md mx-auto w-full h-full relative z-10 shadow-2xl bg-[#050505]">
            {/* Header */}
            <div className="pt-8 pb-4 px-6 flex justify-between items-center bg-gradient-to-b from-[#050505] to-transparent z-20 sticky top-0">
                {currentScreen !== 'HOME' ? (
                    <button onClick={() => {
                        if (currentScreen === 'BOOKING' && step > 1) {
                            if (showAuthCard) setShowAuthCard(false);
                            else setStep(s => s - 1);
                        }
                        else if (profileView !== 'MENU') setProfileView('MENU');
                        else setCurrentScreen('HOME');
                    }} className="w-10 h-10 rounded-full bg-zinc-900/50 border border-white/5 flex items-center justify-center text-white hover:bg-zinc-800 transition-colors backdrop-blur-md">
                        <ChevronLeft size={18} />
                    </button>
                ) : (
                    <div className="w-10" /> 
                )}
                
                <h1 className="text-xs font-black text-white uppercase tracking-[0.3em] opacity-80">
                    {currentScreen === 'HOME' ? 'Carbon App' : 
                     currentScreen === 'GALLERY' ? 'Showroom' : 
                     currentScreen === 'AGENDA' ? 'Minha Agenda' :
                     currentScreen === 'PROFILE' ? 'Área Vip' : 'Reservas'}
                </h1>

                {currentUser ? (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-800 to-black border border-white/10 flex items-center justify-center text-xs font-black text-white shadow-lg">
                        {currentUser.user_metadata?.full_name?.charAt(0) || 'U'}
                    </div>
                ) : (
                    <button onClick={onLoginRequest} className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
                        <User size={16} />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto pb-32 relative custom-scrollbar">
                {currentScreen === 'HOME' && (
                    <div className="space-y-6 md:space-y-8 px-5 md:px-8">
                        <div className="bg-[#121212]/80 backdrop-blur-xl border border-white/5 rounded-2xl h-12 flex items-center px-4 gap-3 text-zinc-500 shadow-lg"><Search size={16} /><input placeholder="Buscar serviço..." className="bg-transparent w-full h-full outline-none text-[10px] font-bold uppercase text-white placeholder:text-zinc-700" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                        
                        <div className="w-full aspect-[1.8/1] rounded-[2rem] relative group overflow-hidden border border-white/10 shadow-2xl transition-all hover:border-white/20">
                            <img src="https://i.postimg.cc/8C7Q2nLS/a46bffcccc88cf92ef08d1e542177d1a-(1).jpg" className="absolute inset-0 w-full h-full object-cover opacity-60 z-0 transition-transform duration-700 group-hover:scale-105" alt="Cover" />
                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent z-10 pointer-events-none mix-blend-overlay" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-0" />
                            <div className="absolute inset-0 z-10 flex flex-col justify-between p-6">
                                <div className="flex justify-between items-start relative z-20">
                                    <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-zinc-900/80 border border-white/10 flex items-center justify-center overflow-hidden backdrop-blur-sm shadow-inner">{businessSettings.profile_image_url ? <img src={businessSettings.profile_image_url} className="w-full h-full object-cover" /> : <span className="text-xl font-black text-white">{businessSettings.business_name.charAt(0)}</span>}</div><div className="drop-shadow-lg"><h3 className="text-sm font-black text-white uppercase tracking-wider">{businessSettings.business_name}</h3><p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">Estética Automotiva</p></div></div>
                                    <button onClick={handleOpenWhatsapp} className="w-10 h-10 rounded-full bg-green-900/30 border border-green-500/30 flex items-center justify-center text-green-500 shadow-[0_0_15px_rgba(34,197,94,0.2)]"><Phone size={16} /></button>
                                </div>
                                <div className="relative z-20 space-y-2"><div className="flex items-center gap-2 mb-1"><div className={cn("w-2 h-2 rounded-full animate-pulse shadow-[0_0_8px_currentColor]", isOpenNow ? "bg-green-500 text-green-500" : "bg-red-500 text-red-500")} /><span className={cn("text-[9px] font-bold uppercase tracking-widest", isOpenNow ? "text-green-500" : "text-red-500")}>{isOpenNow ? "Aberto" : "Fechado"}</span></div><div className="flex items-center gap-2 text-zinc-300"><Instagram size={12} /><span className="text-[9px] font-bold uppercase">{businessSettings.configs?.instagram || '@carboncar'}</span></div><div className="flex items-start gap-2 text-zinc-300"><MapPin size={12} className="shrink-0 mt-0.5" /><span className="text-[9px] font-bold uppercase leading-tight max-w-[90%]">{businessSettings.address || 'Endereço N/A'}</span></div></div>
                            </div>
                        </div>

                        {businessSettings.configs?.studio_photos?.length > 0 && !searchTerm && (
                            <div className="w-full aspect-[1.5/1] rounded-[2rem] relative overflow-hidden border border-white/5 shadow-2xl bg-[#0c0c0c]">
                                <div className="flex h-full transition-transform duration-1000" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
                                    {businessSettings.configs.studio_photos.map((photo: string, idx: number) => (<div key={idx} className="w-full h-full flex-shrink-0 relative"><img src={photo} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" /></div>))}
                                </div>
                            </div>
                        )}

                        <div>
                            <h3 className="text-[9px] font-black text-zinc-500 uppercase mb-6 text-center tracking-[0.3em] opacity-80">{searchTerm ? 'Resultados' : 'SERVIÇOS DISPONÍVEIS'}</h3>
                            <div className="grid grid-cols-2 gap-3">
                                {filteredServices.length > 0 ? filteredServices.map((s) => {
                                    const dur = getDurationParts(s.duration_minutes);
                                    const serviceImg = businessSettings.configs?.service_images?.[s.id] || s.image_url;
                                    return (
                                        <div key={s.id} className="group relative h-[190px] w-full overflow-hidden rounded-[20px] bg-zinc-950 shadow-2xl border border-white/10 transition-all duration-500 hover:-translate-y-1 hover:border-red-600/30 hover:shadow-[0_10px_40px_-10px_rgba(220,38,38,0.1)]">
                                            <div className="absolute inset-0 bg-gradient-to-t from-red-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10 pointer-events-none" />
                                            {serviceImg ? (
                                                <img src={serviceImg} alt={s.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-100" />
                                            ) : (
                                                <div className="absolute inset-0 w-full h-full flex items-center justify-center opacity-20"><Car size={40} className="text-zinc-700" /></div>
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent/20" />
                                            <div className="absolute top-2 inset-x-2 z-20 flex justify-between items-center bg-black/40 backdrop-blur-xl border border-white/10 rounded-[14px] py-2 px-3 group-hover:border-white/20 transition-colors">
                                                    <div className="flex flex-col"><span className="text-[5px] font-bold text-zinc-400 uppercase leading-none mb-0.5">Tempo</span><span className="text-[8px] font-black text-white uppercase">{dur.full}</span></div>
                                                    <div className="flex flex-col items-end"><span className="text-[5px] font-bold text-zinc-400 uppercase leading-none mb-0.5">Valor</span><span className="text-[8px] font-black text-white">R$ {Number(s.price).toFixed(0)}</span></div>
                                            </div>
                                            <div className="absolute bottom-0 inset-x-0 p-3 z-20 flex flex-col justify-end h-full">
                                                <div className="mb-2 text-center"><h3 className="text-[9px] font-black text-white uppercase leading-tight mb-1 drop-shadow-md">{s.name}</h3>{s.description && <p className="text-[6px] text-zinc-300 font-medium leading-tight line-clamp-2 opacity-70">{s.description}</p>}</div>
                                                <button onClick={() => { setSelectedService(s); setCurrentScreen('BOOKING'); setStep(1); }} className="w-full py-2 bg-white hover:bg-zinc-200 text-black rounded-xl font-black uppercase tracking-[0.2em] text-[7px] shadow-glow transition-transform active:scale-95">Agendar</button>
                                            </div>
                                        </div>
                                    );
                                }) : <div className="col-span-2 py-10 text-center text-zinc-500 text-[10px] font-bold uppercase">Nenhum serviço</div>}
                            </div>
                        </div>
                    </div>
                )}

                {currentScreen === 'GALLERY' && (
                    <div className="px-5 md:px-8 pb-32">
                        <div className="flex bg-[#121212] p-1 rounded-xl border border-white/5 mb-6"><button onClick={() => setGalleryTab('PHOTOS')} className={cn("flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all", galleryTab === 'PHOTOS' ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white")}>Showroom</button><button onClick={() => setGalleryTab('REVIEWS')} className={cn("flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all", galleryTab === 'REVIEWS' ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white")}>Avaliações</button></div>
                        {galleryTab === 'PHOTOS' ? (<div className="grid grid-cols-2 gap-3">{portfolio.map((item) => <div key={item.id} className="aspect-[4/5] bg-zinc-900 rounded-2xl overflow-hidden relative group"><img src={item.imageUrl} className="w-full h-full object-cover group-hover:scale-110 duration-700" /><div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 flex items-end p-4"><p className="text-[9px] text-white font-bold uppercase">{item.description}</p></div></div>)}</div>) : (
                            <div className="space-y-4">
                                <button onClick={() => setIsReviewModalOpen(true)} className="w-full py-4 bg-zinc-900 border border-white/10 rounded-2xl text-zinc-400 text-[10px] font-black uppercase tracking-widest">Avaliar Experiência</button>
                                <div className="space-y-3">
                                    {dbReviews.map(review => (
                                        <div key={review.id} className="bg-[#121212] border border-white/5 p-4 rounded-2xl">
                                            <div className="flex justify-between mb-2">
                                                <p className="text-[10px] font-black text-white uppercase">{review.customerName}</p>
                                                <div className="flex gap-0.5">
                                                    {Array.from({ length: 5 }).map((_, i) => (
                                                        <Star key={i} size={12} className={cn(i < review.rating ? "text-yellow-500 fill-yellow-500" : "text-zinc-800 fill-zinc-800")} />
                                                    ))}
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-zinc-400 italic">"{review.comment}"</p>
                                            {review.reply && (
                                                <div className="mt-3 pt-3 border-t border-white/5">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Reply size={10} className="text-red-500 -scale-x-100" />
                                                        <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">Resposta do Hangar</span>
                                                    </div>
                                                    <p className="text-[9px] text-zinc-300 font-medium">{review.reply}</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {currentScreen === 'AGENDA' && (
                    <div className="px-5 md:px-8 pb-32">
                        {!currentUser ? (
                            <AuthInvite 
                                title="Acesse sua Agenda" 
                                desc="Para visualizar seus agendamentos e histórico, entre com sua conta Carbon." 
                            />
                        ) : (
                            <div className="space-y-6">
                                <div className="flex bg-[#121212] p-1 rounded-xl border border-white/5">
                                    <button onClick={() => setAgendaTab('UPCOMING')} className={cn("flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all", agendaTab === 'UPCOMING' ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white")}>Próximos</button>
                                    <button onClick={() => setAgendaTab('HISTORY')} className={cn("flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all", agendaTab === 'HISTORY' ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white")}>Histórico</button>
                                </div>
                                <div className="space-y-4">
                                    {(agendaTab === 'UPCOMING' 
                                        ? dbUserAppointments.filter(a => a.status !== 'FINALIZADO' && a.status !== 'CANCELADO')
                                        : dbUserAppointments.filter(a => a.status === 'FINALIZADO' || a.status === 'CANCELADO')
                                    ).length === 0 ? (
                                        <div className="py-20 text-center opacity-30 flex flex-col items-center">
                                            <CalendarIcon size={32} className="mb-4" />
                                            <p className="text-[10px] font-black uppercase tracking-widest">Nenhum registro encontrado</p>
                                        </div>
                                    ) : (
                                        (agendaTab === 'UPCOMING' 
                                            ? dbUserAppointments.filter(a => a.status !== 'FINALIZADO' && a.status !== 'CANCELADO')
                                            : dbUserAppointments.filter(a => a.status === 'FINALIZADO' || a.status === 'CANCELADO')
                                        ).map((apt) => (
                                            <div key={apt.id} className="bg-[#121212] border border-white/5 p-5 rounded-[2rem] relative overflow-hidden group">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <p className="text-[11px] font-black text-white uppercase tracking-tight mb-1">{apt.serviceType}</p>
                                                        <div className="flex items-center gap-2">
                                                            <Clock size={10} className="text-red-600" />
                                                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{apt.time} • {new Date(apt.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                                                        </div>
                                                    </div>
                                                    <div className={cn(
                                                        "px-3 py-1 rounded-full text-[7px] font-black uppercase tracking-widest border transition-all duration-300",
                                                        apt.status === 'NOVO' ? "bg-blue-600/10 border-blue-500/20 text-blue-500 animate-pulse" :
                                                        apt.status === 'CONFIRMADO' ? "bg-white/10 border-white/20 text-white" :
                                                        apt.status === 'EM_EXECUCAO' ? "bg-red-600/10 border-red-500/20 text-red-500 animate-pulse" :
                                                        apt.status === 'FINALIZADO' ? "bg-green-600/10 border-green-500/20 text-green-500" :
                                                        "bg-zinc-800 border-white/5 text-zinc-400"
                                                    )}>
                                                        {apt.status === 'NOVO' ? 'AGUARDANDO CONFIRMAÇÃO' : apt.status.replace('_', ' ')}
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-center pt-4 border-t border-white/5">
                                                    <div className="flex items-center gap-2">
                                                        <Car size={12} className="text-zinc-600" />
                                                        <span className="text-[9px] font-black text-zinc-400 uppercase">{(apt as any).vehicle_model || 'Veículo'} • {(apt as any).vehicle_plate || ''}</span>
                                                    </div>
                                                    <p className="text-sm font-black text-white tabular-nums">R$ {Number(apt.price).toFixed(0)}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {currentScreen === 'PROFILE' && (
                    <div className="px-5 md:px-8 pb-32">
                        {!currentUser ? (
                            <AuthInvite 
                                title="Seu Perfil Carbon" 
                                desc="Gerencie seus veículos e acesse benefícios exclusivos." 
                            />
                        ) : (
                            <div className="space-y-6">
                                <AnimatePresence mode='wait'>
                                    {profileView === 'MENU' && (
                                        <motion.div key="menu" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-6">
                                            <div className="flex flex-col items-center pt-12 pb-8 text-center">
                                                <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-zinc-900 to-black border border-white/10 flex items-center justify-center mb-5 text-2xl font-black text-red-600 shadow-2xl relative overflow-hidden">
                                                    <div className="absolute inset-0 bg-red-600/5 blur-xl" />
                                                    {currentUser?.user_metadata?.full_name?.charAt(0) || 'U'}
                                                </div>
                                                <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-1">
                                                    {currentUser?.user_metadata?.full_name || 'Usuário Carbon'}
                                                </h3>
                                                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-900 border border-white/5">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-red-600 shadow-[0_0_8px_red]" />
                                                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Membro Autenticado</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <ProfileMenuButton icon={User} label="Informações pessoais" sublabel="Nome, Email e telefone" onClick={() => setProfileView('INFO')} />
                                                <ProfileMenuButton icon={Trophy} label="Fidelidade" badge={businessSettings.loyalty_program_enabled ? `${Math.min(servicesCount, 10)}/10` : "DESATIVADO"} badgeColor={businessSettings.loyalty_program_enabled ? (servicesCount >= 10 ? "text-yellow-500 border-yellow-500/20 bg-yellow-500/5" : "text-green-500 border-green-500/20 bg-green-500/5") : "text-zinc-600 border-white/5 bg-black/40"} sublabel={businessSettings.loyalty_program_enabled ? "Acompanhe seu progresso de prêmios" : "Aguardando ativação."} onClick={() => businessSettings.loyalty_program_enabled && setProfileView('FIDELITY')} disabled={!businessSettings.loyalty_program_enabled} />
                                                <ProfileMenuButton icon={Car} label="Veículo cadastrado" sublabel={userVehicle} onClick={() => setProfileView('VEHICLE')} />
                                                <ProfileMenuButton icon={History} label="Histórico de Agendamentos" onClick={() => { setCurrentScreen('AGENDA'); setAgendaTab('HISTORY'); }} />
                                                <ProfileMenuButton icon={ShieldCheck} label="Alteração de dados" sublabel="Alterar Email e/ou senha" onClick={() => setProfileView('SECURITY')} />
                                                <div className="pt-8">
                                                    <button onClick={onExit} className="w-full py-5 bg-[#0a0a0a] border border-red-600/10 rounded-[2.5rem] flex items-center justify-center gap-3 group hover:bg-red-600 hover:border-red-500 transition-all active:scale-[0.98] shadow-2xl">
                                                        <LogOut size={18} className="text-red-500 group-hover:text-white transition-colors" />
                                                        <span className="text-xs font-black text-red-500 group-hover:text-white uppercase tracking-[0.2em]">Encerrar Sessão</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                    {profileView === 'INFO' && (
                                        <motion.div key="info" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 pt-6 animate-in slide-in-from-right-4">
                                            <h3 className="text-lg font-black text-white uppercase flex items-center gap-3"><User className="text-red-600" /> Meus Dados</h3>
                                            <div className="space-y-4">
                                                <div className="bg-zinc-950/40 backdrop-blur-xl p-6 rounded-[2rem] border border-white/5 shadow-2xl">
                                                    <p className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.4em] mb-2">Identificação Nominal</p>
                                                    <p className="text-sm font-bold text-white uppercase tracking-tight">{currentUser.user_metadata?.full_name || 'Usuário Carbon'}</p>
                                                </div>
                                                <div className="bg-zinc-950/40 backdrop-blur-xl p-6 rounded-[2rem] border border-white/5 shadow-2xl">
                                                    <p className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.4em] mb-2">Comunicação Digital</p>
                                                    <p className="text-sm font-bold text-white tracking-tight">{currentUser.email}</p>
                                                </div>
                                                <div className="bg-zinc-950/40 backdrop-blur-xl p-6 rounded-[2rem] border border-white/5 shadow-2xl">
                                                    <p className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.4em] mb-2">Contato Operacional</p>
                                                    <p className="text-sm font-bold text-white tracking-tight">{currentUser.user_metadata?.phone || 'Nenhum telefone cadastrado'}</p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                    {profileView === 'FIDELITY' && (
                                        <motion.div key="fidelity" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 pt-6 animate-in slide-in-from-right-4">
                                            <h3 className="text-lg font-black text-white uppercase flex items-center gap-3"><Trophy className="text-yellow-500" /> Fidelidade</h3>
                                            <div className="bg-[#121212] border border-white/5 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden text-center">
                                                <div className="relative z-10 space-y-6">
                                                    <div className="w-20 h-20 bg-yellow-500/10 border border-yellow-500/30 rounded-full flex items-center justify-center mx-auto shadow-[0_0_40px_rgba(234,179,8,0.1)]">
                                                        <Gift className={cn("text-yellow-500", servicesCount >= 10 && "animate-bounce")} size={32} />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-xl font-black text-white uppercase tracking-tight mb-2">Seu Progresso</h4>
                                                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest max-w-[220px] mx-auto leading-relaxed">
                                                            Complete 10 serviços para ganhar uma lavagem grátis exclusiva!
                                                        </p>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <div className="flex justify-between items-end px-2">
                                                            <span className="text-[9px] font-black text-zinc-500 uppercase">Serviços Concluídos</span>
                                                            <span className="text-xl font-black text-white tabular-nums">{Math.min(servicesCount, 10)}/10</span>
                                                        </div>
                                                        <div className="h-4 w-full bg-zinc-950 border border-white/5 rounded-full overflow-hidden p-1 shadow-inner">
                                                            <motion.div 
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${Math.min(servicesCount, 10) * 10}%` }}
                                                                className={cn(
                                                                    "h-full rounded-full transition-all duration-1000",
                                                                    servicesCount >= 10 ? "bg-yellow-500 shadow-[0_0_15px_#eab308]" : "bg-red-600"
                                                                )}
                                                            />
                                                        </div>
                                                    </div>
                                                    {servicesCount >= 10 ? (
                                                        <button 
                                                            onClick={handleRedeemReward}
                                                            className="w-full py-5 bg-yellow-500 hover:bg-yellow-400 text-black rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_0_30px_rgba(234,179,8,0.3)] transition-all animate-pulse"
                                                        >
                                                            Resgatar Minha Lavagem!
                                                        </button>
                                                    ) : (
                                                        <div className="p-4 bg-zinc-900/50 rounded-2xl border border-white/5">
                                                            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                                                                Faltam apenas {10 - Math.min(servicesCount, 10)} serviços para seu prêmio!
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                    {profileView === 'VEHICLE' && (
                                        <motion.div key="vehicle" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 pt-6 animate-in slide-in-from-right-4">
                                            <h3 className="text-lg font-black text-white uppercase flex items-center gap-3"><Car className="text-red-600" /> Veículo Registrado</h3>
                                            {identifiedVehicleId || userVehicle !== 'Nenhum veículo registrado' ? (
                                                <div className="bg-[#121212] border border-white/5 p-8 rounded-[3rem] flex items-center gap-6 shadow-2xl relative overflow-hidden group">
                                                    <div className="w-16 h-16 rounded-2xl bg-zinc-950 border border-white/5 flex items-center justify-center text-zinc-500 group-hover:text-red-500 transition-colors shadow-inner relative z-10">
                                                        <Car size={32} strokeWidth={1.5} />
                                                    </div>
                                                    <div className="relative z-10">
                                                        <p className="text-xl font-black text-white uppercase tracking-tight leading-none mb-2">
                                                            {vehicleForm.brand} {vehicleForm.model}
                                                        </p>
                                                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-red-600/10 border border-red-600/20">
                                                            <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">{vehicleForm.plate || 'S/P'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="py-20 text-center opacity-30 flex flex-col items-center">
                                                    <div className="w-16 h-16 rounded-full border-2 border-dashed border-zinc-800 flex items-center justify-center mb-6">
                                                        <Car size={32} className="text-zinc-800" />
                                                    </div>
                                                    <p className="text-[10px] font-black uppercase tracking-widest max-w-[200px] leading-relaxed">Nenhum veículo vinculado. Realize seu primeiro agendamento para registrar seu ativo.</p>
                                                </div>
                                            )}
                                        </motion.div>
                                    )}
                                    {profileView === 'SECURITY' && (
                                        <motion.div key="security" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 pt-6 animate-in slide-in-from-right-4">
                                            <h3 className="text-lg font-black text-white uppercase flex items-center gap-3"><ShieldCheck className="text-red-600" /> Segurança</h3>
                                            <div className="space-y-4">
                                                <div className="bg-zinc-950/40 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/5">
                                                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1 mb-3 block">Email de Acesso</label>
                                                    <div className="relative">
                                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                                                        <input className="w-full bg-black border border-white/10 rounded-2xl p-4 pl-12 text-xs font-bold text-white outline-none focus:border-red-600 transition-all shadow-inner" value={updateForm.email} onChange={e => setUpdateForm({ ...updateForm, email: e.target.value })} />
                                                    </div>
                                                </div>
                                                <div className="bg-zinc-950/40 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/5">
                                                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1 mb-3 block">Nova Senha Alpha</label>
                                                    <div className="relative">
                                                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                                                        <input type="password" placeholder="••••••••" className="w-full bg-black border border-white/10 rounded-2xl p-4 pl-12 text-xs font-bold text-white outline-none focus:border-red-600 transition-all shadow-inner" value={updateForm.password} onChange={e => setUpdateForm({ ...updateForm, password: e.target.value })} />
                                                    </div>
                                                </div>
                                                <button onClick={handleUpdateSecurity} disabled={isUpdatingUser} className="w-full py-5 bg-white text-black rounded-[2rem] text-[10px] font-black uppercase tracking-[0.3em] shadow-[0_0_40px_rgba(255,255,255,0.15)] flex items-center justify-center gap-3 mt-4 active:scale-95 transition-all">
                                                    {isUpdatingUser ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />} Salvar Novas Credenciais
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                                <div className="flex flex-col items-center justify-center mt-12 opacity-30 pb-4">
                                    <p className="text-[7px] font-bold text-zinc-700 uppercase tracking-widest mb-2">Powered by</p>
                                    <img src="https://i.postimg.cc/wxRyvSbG/carboncarlogo.png" alt="Carbon OS" className="h-5 w-auto object-contain grayscale" />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {currentScreen === 'BOOKING' && (
                    <div className="px-5 md:px-8 pb-4">
                        {step === 1 && (
                            <div className="space-y-6 animate-in slide-in-from-right-4">
                                {selectedService && (
                                    <div className="relative overflow-hidden bg-white/5 backdrop-blur-3xl rounded-[2.5rem] p-6 mb-6 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] animate-in slide-in-from-top-4 duration-700">
                                        <div className="absolute top-0 inset-x-0 h-[0.5px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                                        <div className="flex justify-between items-center mb-5 relative z-10">
                                            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.3em]">Serviço Selecionado</span>
                                            <button onClick={() => { setCurrentScreen('HOME'); setStep(1); setSelectedService(null); }} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600/10 border border-red-500/20 text-red-500 text-[8px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all active:scale-95"><RefreshCw size={10} /> Alterar</button>
                                        </div>
                                        <div className="flex items-center gap-5 relative z-10">
                                            <div className="w-16 h-16 rounded-2xl bg-zinc-950 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-2xl relative group">{businessSettings.configs?.service_images?.[selectedService.id] || selectedService.image_url ? (<img src={businessSettings.configs?.service_images?.[selectedService.id] || selectedService.image_url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={selectedService.name} />) : (<Wrench className="text-zinc-700" size={24} />)}<div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" /></div>
                                            <div className="flex-1 min-w-0"><h4 className="text-sm font-black text-white uppercase truncate leading-tight mb-1.5 tracking-tight">{selectedService.name}</h4><div className="flex items-center gap-2"><Clock size={10} className="text-red-600" /><p className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.15em]">{getDurationParts(selectedService.duration_minutes).full}</p></div></div>
                                            <div className="text-right"><p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5 opacity-60">Total</p><p className="text-2xl font-black text-white tabular-nums tracking-tighter shadow-[0_0_20px_rgba(255,255,255,0.1)]"><span className="text-[10px] mr-1 text-zinc-500">R$</span>{Number(selectedService.price).toFixed(0)}</p></div>
                                        </div>
                                    </div>
                                )}
                                <div className="bg-[#0c0c0c] border border-white/5 p-4 rounded-[2rem]"><div className="flex items-center justify-between mb-4"><button onClick={() => changeMonth(-1)}><ChevronLeft size={14} className="text-zinc-500" /></button><span className="text-[10px] font-black text-white uppercase">{viewDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</span><button onClick={() => changeMonth(1)}><ChevronRight size={14} className="text-zinc-500" /></button></div><div className="flex gap-2 overflow-x-auto pb-2">{calendarDays.map(d => <button key={d.dateStr} disabled={!d.isOpen} onClick={() => setSelectedDate(d.dateStr)} className={cn("min-w-[50px] h-[64px] rounded-xl flex flex-col items-center justify-center transition-all", selectedDate === d.dateStr ? "bg-red-600 text-white shadow-glow-red" : !d.isOpen ? "opacity-20" : "bg-zinc-900 text-zinc-400")}><span className="text-[8px] font-bold uppercase">{d.dayName}</span><span className="text-lg font-black">{d.dayNumber}</span></button>)}</div></div>
                                <div><h3 className="text-xs font-black text-white uppercase mb-4">Horários</h3><div className="grid grid-cols-3 gap-2">{availableSlots.map(t => { const full = (slotOccupancy[t] || 0) >= businessSettings.box_capacity; return <button key={t} disabled={full} onClick={() => setSelectedTime(t)} className={cn("py-3 rounded-lg border text-xs font-bold transition-all", full ? "bg-red-900/10 border-red-900/30 text-red-900" : selectedTime === t ? "bg-white text-black" : "bg-[#121212] border-white/5 text-zinc-400")}>{t}</button> })}</div></div>
                            </div>
                        )}
                        {step === 2 && !currentUser && (<div className="space-y-4 animate-in slide-in-from-right-4">
                            <h3 className="text-xs font-black text-white uppercase">Seus Dados</h3>
                            <input placeholder="Nome Completo" className="w-full bg-[#121212] border border-white/5 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none focus:border-red-600" value={guestForm.name} onChange={e => setGuestForm({ ...guestForm, name: e.target.value })} />
                            <input placeholder="Telefone" className="w-full bg-[#121212] border border-white/5 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none focus:border-red-600" value={guestForm.phone} onChange={e => setGuestForm({ ...guestForm, phone: formatPhone(e.target.value) })} />
                            {showAuthCard && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 p-6 rounded-2xl bg-zinc-900/60 backdrop-blur-xl border border-white/10 shadow-2xl flex flex-col items-center text-center space-y-4">
                                    <Lock size={18} className="text-white" />
                                    <p className="text-[10px] font-bold text-zinc-300 uppercase leading-relaxed">Para prosseguir e garantir seus benefícios, entre ou crie sua conta Carbon:</p>
                                    <div className="flex gap-3 w-full">
                                        <button onClick={() => { saveDraft(); onLoginRequest(); }} className="flex-1 py-3 bg-zinc-800 text-white rounded-xl text-[9px] font-black uppercase">Já tenho conta</button>
                                        <button onClick={() => { saveDraft(); onRegisterRequest(guestForm); }} className="flex-1 py-3 bg-white text-black rounded-xl text-[9px] font-black uppercase shadow-glow">Criar Nova Conta</button>
                                    </div>
                                </motion.div>
                            )}
                        </div>)}
                        {step === 3 && (<div className="space-y-4 animate-in slide-in-from-right-4"><h3 className="text-xs font-black text-white uppercase">Veículo</h3><div className="grid grid-cols-2 gap-3"><input placeholder="Marca" className="bg-[#121212] border border-white/5 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none" value={vehicleForm.brand} onChange={e => setVehicleForm({ ...vehicleForm, brand: e.target.value })} /><input placeholder="Modelo" className="bg-[#121212] border border-white/5 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none" value={vehicleForm.model} onChange={e => setVehicleForm({ ...vehicleForm, model: e.target.value })} /></div><input placeholder="Placa" className="w-full bg-[#121212] border border-white/5 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none" value={vehicleForm.plate} onChange={e => setVehicleForm({ ...vehicleForm, plate: formatPlate(e.target.value) })} /></div>)}
                        {step === 4 && (<div className="flex flex-col items-center justify-center py-10 text-center"><div className="w-20 h-20 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mb-6"><Check size={32} className="text-green-500" /></div><h2 className="text-2xl font-black text-white uppercase mb-2">Confirmado! 🚀</h2><p className="text-zinc-400 text-xs mb-8">Data: <span className="text-white">{new Date((confirmedDetails?.date || selectedDate) + 'T12:00:00').toLocaleDateString()}</span> às <span className="text-white">{confirmedDetails?.time || selectedTime}</span>.</p><button onClick={() => { setCurrentScreen('HOME'); setStep(1); }} className="text-zinc-600 hover:text-white text-[10px] font-bold uppercase tracking-widest">Voltar ao Início</button></div>)}
                    </div>
                )}
            </div>
            {currentScreen === 'BOOKING' ? (
                step < 4 && !showAuthCard && (
                    <div className="absolute bottom-0 left-0 right-0 w-full z-50 flex flex-col items-center bg-[#050505] border-t border-white/5 pt-6 pb-6 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                        <div className="absolute -top-6 left-0 right-0 h-12 flex flex-col items-center justify-center pointer-events-none">
                            <div className="w-full max-w-[340px] h-[1px] bg-gradient-to-r from-transparent via-red-500/20 to-transparent shadow-[0_0_8px_rgba(239,68,68,0.1)]" />
                            <div className="absolute w-[60%] h-8 bg-red-900/5 blur-[20px] rounded-full -translate-y-2" />
                        </div>
                        <div className="w-full max-w-[340px] px-4 flex justify-center relative z-10">
                            <button 
                                onClick={handleContinueAction} 
                                disabled={loading || (step === 1 && (!selectedDate || !selectedTime))} 
                                className={cn(
                                    "w-full py-4 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg",
                                    (step === 1 && (!selectedDate || !selectedTime)) 
                                        ? "bg-zinc-900 text-zinc-600 border border-white/5" 
                                        : "bg-red-600 text-white shadow-glow-red hover:bg-red-500"
                                )}
                            >
                                {loading ? <Loader2 className="animate-spin" size={14} /> : (step === 3 ? "Finalizar Agendamento" : "Continuar")}
                            </button>
                        </div>
                    </div>
                )
            ) : (
                !isReviewModalOpen && <BottomNav />
            )}
        </div>
    </div>
  );
};