
import React, { useState, useEffect, useRef } from 'react';
import { Check, ChevronLeft, Star, MapPin, Search, Zap, X, User, ArrowRight, Clock, Loader2, CalendarX, History, LayoutGrid, Bell, Phone, Filter, Instagram, Calendar as CalendarIcon, Wrench, Car, LogOut, Key, MessageSquare, Send, Image as ImageIcon, ThumbsUp, Lock, ArrowUpRight, Trophy, Reply, LogIn, UserPlus, AlertCircle } from 'lucide-react';
import { BusinessSettings, ServiceItem, Appointment, PortfolioItem, Review } from '../types';
import { cn, formatPhone, formatPlate } from '../lib/utils';
import { supabase } from '../lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';

interface PublicBookingProps {
    currentUser?: any;
    businessSettings: BusinessSettings;
    services: ServiceItem[];
    existingAppointments: Appointment[]; 
    portfolio: PortfolioItem[];
    reviews?: Review[];
    onBookingComplete: (apt: Appointment, newCustomer?: any) => Promise<boolean>;
    onExit: () => void;
    onLoginRequest?: () => void;
    onRegisterRequest?: (data: { name: string, phone: string }) => void;
}

interface CalendarDay {
    dateStr: string;
    dayName: string;
    dayNumber: string;
    isOpen: boolean;
    isPast: boolean;
}

interface Notification {
    id: string;
    title: string;
    message: string;
    time: string;
    read: boolean;
    type: 'START' | 'FINISH' | 'INFO';
}

const timeToMinutes = (time: string): number => {
    if (!time) return 0;
    const [h, m] = time.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
};

const minutesToTime = (minutes: number): string => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const formatDuration = (minutes: number): string => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}min`;
    if (h > 0) return `${h}h`;
    return `${m}min`;
};

export const PublicBooking: React.FC<PublicBookingProps> = ({ 
    currentUser, businessSettings, services, portfolio, 
    existingAppointments = [],
    onBookingComplete, onExit, onLoginRequest, onRegisterRequest
}) => {
    const [currentScreen, setCurrentScreen] = useState<'HOME' | 'BOOKING' | 'PROFILE' | 'GALLERY' | 'AGENDA'>('HOME');
    const [step, setStep] = useState(1); 
    const [loading, setLoading] = useState(false);
    const [agendaTab, setAgendaTab] = useState<'UPCOMING' | 'HISTORY'>('UPCOMING');
    const [galleryTab, setGalleryTab] = useState<'PHOTOS' | 'REVIEWS'>('PHOTOS');
    
    const [searchTerm, setSearchTerm] = useState(''); // Estado para busca
    const [selectedService, setSelectedService] = useState<any>(null);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedTime, setSelectedTime] = useState<string>(''); 
    const [guestForm, setGuestForm] = useState({ name: '', phone: '' });
    const [vehicleForm, setVehicleForm] = useState({ brand: '', model: '', plate: '' });
    
    const [viewDate, setViewDate] = useState(new Date());
    const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [slotOccupancy, setSlotOccupancy] = useState<Record<string, number>>({}); 
    
    const [userVehicle, setUserVehicle] = useState<string>('---');
    const [servicesCount, setServicesCount] = useState(0);
    const [dbReviews, setDbReviews] = useState<Review[]>([]);
    const [dbUserAppointments, setDbUserAppointments] = useState<any[]>([]);
    const [identifiedCustomerId, setIdentifiedCustomerId] = useState<string | null>(null);
    const [identifiedVehicleId, setIdentifiedVehicleId] = useState<string | null>(null);

    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);

    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '', name: '' });
    const [submittingReview, setSubmittingReview] = useState(false);

    const [isOpenNow, setIsOpenNow] = useState(false);
    
    // Estado para controlar a exibição do Card de Login no Passo 2
    const [showAuthCard, setShowAuthCard] = useState(false);
    
    // Estado para o Modal de Resumo (Retomada de Agendamento)
    const [pendingResume, setPendingResume] = useState<any>(null);

    // Estado para persistir detalhes confirmados (Snaphot para tela de sucesso)
    const [confirmedDetails, setConfirmedDetails] = useState<{date: string, time: string} | null>(null);

    // Estado para Slideshow automático
    const [currentSlide, setCurrentSlide] = useState(0);

    const LockIcon = Lock as any;

    // Filtro de serviços baseado na busca
    const filteredServices = services.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (s.description && s.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // --- LÓGICA DE RECUPERAÇÃO DE SESSÃO (RESUME FLOW) ---
    useEffect(() => {
        // 1. Verifica se há um rascunho salvo no sessionStorage ao carregar
        const savedDraft = sessionStorage.getItem('carbon_booking_draft');
        
        if (currentUser && savedDraft) {
            try {
                const draft = JSON.parse(savedDraft);
                // Valida se o draft é recente (ex: menos de 24h) ou pertence ao business atual
                setPendingResume(draft);
            } catch (e) {
                console.error("Erro ao ler rascunho", e);
                sessionStorage.removeItem('carbon_booking_draft');
            }
        }
    }, [currentUser]);

    // --- LÓGICA DE SLIDESHOW AUTOMÁTICO ---
    useEffect(() => {
        const photos = businessSettings.configs?.studio_photos || [];
        if (photos.length <= 1) return;

        const timer = setInterval(() => {
            setCurrentSlide(prev => (prev + 1) % photos.length);
        }, 3000); // Troca a cada 3 segundos

        return () => clearInterval(timer);
    }, [businessSettings.configs?.studio_photos]);

    const saveDraft = () => {
        if (selectedService && selectedDate && selectedTime) {
            const draft = {
                service: selectedService,
                date: selectedDate,
                time: selectedTime,
                guestData: guestForm // Salva também o que foi digitado
            };
            sessionStorage.setItem('carbon_booking_draft', JSON.stringify(draft));
        }
    };

    const confirmResume = () => {
        if (!pendingResume) return;
        
        // Restaura o estado
        setSelectedService(pendingResume.service);
        setSelectedDate(pendingResume.date);
        setSelectedTime(pendingResume.time);
        
        // Avança direto para Veículo (Passo 3)
        setCurrentScreen('BOOKING');
        setStep(3);
        
        // Limpa o modal e o storage
        setPendingResume(null);
        sessionStorage.removeItem('carbon_booking_draft');
    };

    const cancelResume = () => {
        setPendingResume(null);
        sessionStorage.removeItem('carbon_booking_draft');
    };

    // --- FIM LÓGICA RESUME ---

    // Detectar login durante o fluxo para avançar automaticamente (Legado mantido para casos in-memory)
    useEffect(() => {
        if (currentUser && currentScreen === 'BOOKING' && step === 1 && selectedDate && selectedTime) {
            setStep(3); // Pula dados pessoais, vai direto para Veículo
        } else if (currentUser && currentScreen === 'BOOKING' && step === 2) {
            setStep(3); // Se logou no passo 2, avança
        }
    }, [currentUser, currentScreen, step, selectedDate, selectedTime]);

    // Resetar o estado do card se mudar de passo ou tela
    useEffect(() => {
        setShowAuthCard(false);
    }, [step, currentScreen]);

    useEffect(() => {
        const checkOpenStatus = () => {
            const now = new Date();
            const currentMins = now.getHours() * 60 + now.getMinutes();
            const day = now.getDay();
            const rule = businessSettings.operating_days?.find(r => r.dayOfWeek === day);
            if (!rule || !rule.isOpen) { setIsOpenNow(false); return; }
            const start = timeToMinutes(rule.openTime);
            const end = timeToMinutes(rule.closeTime);
            setIsOpenNow(currentMins >= start && currentMins < end);
        };
        checkOpenStatus();
        const interval = setInterval(checkOpenStatus, 60000);
        return () => clearInterval(interval);
    }, [businessSettings]);

    // Função de carregamento de dados realocada para ser reutilizável
    const fetchRealData = async () => {
        if (!businessSettings.id) return;
        
        // Fetch Reviews
        const { data: revs } = await supabase
            .from('reviews')
            .select('*')
            .eq('business_id', businessSettings.id)
            .order('created_at', { ascending: false });
        
        if (revs) {
            setDbReviews(revs.map(r => ({
                ...r,
                customerName: r.customer_name,
                date: r.created_at // Mapeia created_at para o campo date esperado pela UI
            })) as any);
        }

        if (currentUser) {
            let query = supabase.from('customers').select('id, name, phone, vehicles(*)').eq('business_id', businessSettings.id);
            query = query.or(`email.eq.${currentUser.email},user_id.eq.${currentUser.id}`);
            const { data: customers } = await query;
            const customer = customers && customers.length > 0 ? customers[0] : null;

            if (customer) {
                setIdentifiedCustomerId(customer.id);
                setReviewForm(prev => ({ ...prev, name: customer.name }));
                if (customer.vehicles && customer.vehicles.length > 0) {
                    const v = customer.vehicles[0];
                    setIdentifiedVehicleId(v.id);
                    setUserVehicle(`${v.brand || ''} ${v.model || 'Modelo N/A'} (${v.plate || '---'})`.trim());
                    setVehicleForm({ brand: v.brand || '', model: v.model || '', plate: v.plate || '' });
                }
                setGuestForm({ name: customer.name, phone: customer.phone });
                const { data: apts } = await supabase.from('appointments').select('*').eq('customer_id', customer.id).order('date', { ascending: false });
                if (apts) setDbUserAppointments(apts.map(a => ({ ...a, serviceType: a.service_type, durationMinutes: a.duration_minutes, customerId: a.customer_id, vehicleId: a.vehicle_id } as any)));
                const { count } = await supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('customer_id', customer.id).eq('business_id', businessSettings.id).eq('status', 'FINALIZADO');
                setServicesCount(count || 0);
            } else {
                if (currentUser.user_metadata?.full_name) {
                    setGuestForm(prev => ({ ...prev, name: currentUser.user_metadata.full_name }));
                    setReviewForm(prev => ({ ...prev, name: currentUser.user_metadata.full_name }));
                }
                if (currentUser.user_metadata?.phone) setGuestForm(prev => ({ ...prev, phone: currentUser.user_metadata.phone }));
            }
        }
    };

    useEffect(() => {
        fetchRealData();
    }, [businessSettings.id, currentUser]);

    useEffect(() => {
        const days: CalendarDay[] = [];
        const opDays = businessSettings.operating_days || [];
        const blockedDates = businessSettings.blocked_dates || [];
        const realToday = new Date(); realToday.setHours(0, 0, 0, 0);
        const year = viewDate.getFullYear(); const month = viewDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month, i);
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            const rule = opDays.find(r => r.dayOfWeek === date.getDay());
            const isOpenDay = rule ? rule.isOpen : false; 
            const isBlocked = blockedDates.some(bd => bd.date === dateStr);
            const isPast = date < realToday;
            days.push({ 
                dateStr, dayName: date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase(), dayNumber: String(i).padStart(2, '0'),
                isOpen: isOpenDay && !isBlocked && !isPast, isPast: isPast
            });
        }
        setCalendarDays(days);
        if (!selectedDate || new Date(selectedDate).getMonth() !== month) {
             const firstAvailable = days.find(d => d.isOpen);
             if (firstAvailable) setSelectedDate(firstAvailable.dateStr);
             else setSelectedDate('');
        }
    }, [businessSettings, viewDate]);

    useEffect(() => {
        if (!selectedDate || !businessSettings.id) return;
        const fetchAndGenerateSlots = async () => {
            const [y, m, d] = selectedDate.split('-').map(Number);
            const rule = businessSettings.operating_days?.find(r => r.dayOfWeek === new Date(y, m - 1, d).getDay());
            if (!rule || !rule.isOpen) { setAvailableSlots([]); setSlotOccupancy({}); return; }
            const slots: string[] = [];
            const interval = (businessSettings.slot_interval_minutes && businessSettings.slot_interval_minutes > 0) ? businessSettings.slot_interval_minutes : 60;
            const startMins = timeToMinutes(rule.openTime); const endMins = timeToMinutes(rule.closeTime);
            if (endMins > startMins) {
                for (let currentMins = startMins; currentMins < endMins; currentMins += interval) slots.push(minutesToTime(currentMins));
            }
            setAvailableSlots(slots);
            const { data: busyData } = await supabase.from('appointments').select('time').eq('business_id', businessSettings.id).eq('date', selectedDate).neq('status', 'CANCELADO');
            const occupancyMap: Record<string, number> = {};
            if (busyData) slots.forEach(slotTime => { occupancyMap[slotTime] = busyData.filter(apt => apt.time?.slice(0, 5) === slotTime).length; });
            setSlotOccupancy(occupancyMap);
        };
        fetchAndGenerateSlots();
        setSelectedTime('');
    }, [selectedDate, businessSettings]);

    const handleContinueAction = () => {
        if (step === 1) {
            if (!selectedDate || !selectedTime) return;
            if (currentUser) {
                setStep(3);
            } else {
                setStep(2);
            }
        } else if (step === 2) {
            // Se já logado, avança
            if (currentUser) {
                setStep(3);
                return;
            }
            // Se não logado, valida campos e mostra o card de auth
            if (!guestForm.name || !guestForm.phone || guestForm.phone.length < 10) {
                alert("Por favor, preencha seus dados corretamente.");
                return;
            }
            setShowAuthCard(true);
        } else if (step === 3) {
            handleFinalize();
        }
    };

    const handleFinalize = async () => {
        if (!selectedService || !selectedDate || !selectedTime) return;
        setLoading(true);
        
        const apt: any = { 
            serviceId: selectedService.id, 
            date: selectedDate, 
            time: selectedTime,
            customerId: identifiedCustomerId,
            vehicleId: identifiedVehicleId,
            serviceType: selectedService.name,
            price: selectedService.price,
            durationMinutes: selectedService.duration_minutes
        };

        const customerData = identifiedCustomerId ? undefined : { 
            name: guestForm.name, 
            phone: guestForm.phone, 
            vehicles: [{ brand: vehicleForm.brand, model: vehicleForm.model, plate: vehicleForm.plate }] 
        };

        const success = await onBookingComplete(apt, customerData);
        if (success) {
            // Salva snapshot dos dados confirmados para evitar que resets de background limpem a tela de sucesso
            setConfirmedDetails({ date: selectedDate, time: selectedTime });
            setStep(4);
            sessionStorage.removeItem('carbon_booking_draft'); // Limpa draft se houver
        }
        setLoading(false);
    };

    const handleSubmitReview = async (e: React.FormEvent) => {
        e.preventDefault(); 
        if (!businessSettings.id) return;
        setSubmittingReview(true);
        
        const { data, error } = await supabase
            .from('reviews')
            .insert({ 
                business_id: businessSettings.id, 
                customer_name: reviewForm.name || 'Anônimo', 
                rating: reviewForm.rating, 
                comment: reviewForm.comment 
            })
            .select()
            .single();

        if (!error && data) { 
            // Atualiza localmente e recarrega para garantir sincronia
            await fetchRealData();
            setIsReviewModalOpen(false); 
            setReviewForm(prev => ({ ...prev, comment: '', rating: 5 })); 
        } else if (error) {
            console.error("Review Error:", error);
            alert("Erro ao enviar avaliação: " + error.message);
        }
        setSubmittingReview(false);
    };

    const changeMonth = (delta: number) => { const newDate = new Date(viewDate); newDate.setMonth(newDate.getMonth() + delta); setViewDate(newDate); };
    const handleOpenWhatsapp = () => { if (businessSettings.whatsapp) window.open(`https://wa.me/${businessSettings.whatsapp.replace(/\D/g, '')}`, '_blank'); };

    const upcomingAppointments = dbUserAppointments.filter(a => ['NOVO', 'CONFIRMADO', 'EM_EXECUCAO'].includes(a.status)).sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());
    const historyAppointments = dbUserAppointments.filter(a => ['FINALIZADO', 'CANCELADO'].includes(a.status)).sort((a, b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime());

    const BottomNav = () => (
        <div className="fixed md:absolute bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-[340px] px-6 md:px-4">
            <div className="bg-[#121212]/90 backdrop-blur-xl border border-white/5 rounded-full h-16 flex items-center justify-evenly shadow-2xl">
                {[
                    { id: 'HOME', icon: LayoutGrid, label: 'Home' },
                    { id: 'GALLERY', icon: Search, label: 'Galeria' },
                    { id: 'AGENDA', icon: CalendarIcon, label: 'Agenda' },
                    { id: 'PROFILE', icon: User, label: 'Perfil' },
                ].map((item) => (
                    <button key={item.id} onClick={() => setCurrentScreen(item.id as any)} className="relative flex flex-col items-center justify-center w-14 h-full group">
                        <item.icon size={20} className={cn("transition-all duration-300", currentScreen === item.id ? "text-white -translate-y-1" : "text-zinc-500 group-hover:text-zinc-300")} fill={currentScreen === item.id && item.id !== 'GALLERY' && item.id !== 'AGENDA' ? "currentColor" : "none"} />
                        {currentScreen === item.id && <motion.div layoutId="nav-dot" className="absolute bottom-3 w-1 h-1 bg-red-600 rounded-full shadow-[0_0_8px_red]" />}
                    </button>
                ))}
            </div>
        </div>
    );

    if (!businessSettings.id) return <div className="min-h-screen bg-[#020202] flex items-center justify-center font-sans p-4"><Loader2 className="w-8 h-8 text-red-600 animate-spin" /></div>;

    return (
        // Aplicando Spotlight (Radial Gradient) e Noise Texture no container principal
        // Ajustado para um gradiente um pouco mais visível para evitar o "preto absoluto"
        <div className="min-h-screen bg-[#020202] flex flex-col items-center font-sans bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800/40 via-[#050505] to-black relative">
            
            {/* CSS para Textura de Carbono no Cartão (Atualizado para Honeycomb Mesh) */}
            <style>{`
                .carbon-card-pattern {
                    background-color: #080808;
                    /* Honeycomb Hexagon Pattern */
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='14' viewBox='0 0 8 14'%3E%3Cpath d='M4 0l4 2.3v4.6L4 9.2 0 6.9V2.3z' fill='%23181818'/%3E%3C/svg%3E");
                    background-size: 8px 14px;
                }
            `}</style>

            {/* Noise Texture Overlay */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none" />

            {/* --- MODAL DE RETOMADA DE AGENDAMENTO (RESUME) --- */}
            <AnimatePresence>
                {pendingResume && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-[#0c0c0c] border border-white/10 rounded-[2rem] w-full max-w-sm p-6 shadow-2xl relative"
                        >
                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="w-16 h-16 bg-red-900/10 border border-red-600/20 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.2)]">
                                    <History size={32} className="text-red-500" />
                                </div>
                                
                                <div>
                                    <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2">Continuar Agendamento?</h3>
                                    <p className="text-[10px] text-zinc-400 font-medium leading-relaxed">
                                        Identificamos um serviço iniciado anteriormente. Deseja retomar?
                                    </p>
                                </div>

                                <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-4 w-full">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Dia</span>
                                        <span className="text-[10px] font-black text-white uppercase">
                                            {new Date(pendingResume.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Hora</span>
                                        <span className="text-[10px] font-black text-white">{pendingResume.time}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Serviço</span>
                                        <span className="text-[10px] font-black text-white uppercase truncate max-w-[150px]">
                                            {pendingResume.service?.name}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex gap-3 w-full pt-2">
                                    <button 
                                        onClick={cancelResume}
                                        className="flex-1 py-3 text-[10px] font-black uppercase text-zinc-500 hover:text-white transition-colors"
                                    >
                                        Não, Cancelar
                                    </button>
                                    <button 
                                        onClick={confirmResume}
                                        className="flex-1 py-3 bg-white text-black rounded-xl text-[10px] font-black uppercase tracking-widest shadow-glow hover:bg-zinc-200 transition-all"
                                    >
                                        Sim, Continuar
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <div className="w-full max-w-md h-full md:h-[850px] md:my-auto md:rounded-[3rem] bg-[#020202]/50 border-x border-white/5 md:border border-white/5 relative shadow-2xl flex flex-col overflow-hidden backdrop-blur-sm z-10">
                <div className="pt-10 md:pt-12 px-5 md:px-8 pb-4 flex justify-between items-center shrink-0 z-30 bg-transparent">
                    {currentScreen === 'BOOKING' || (currentScreen === 'GALLERY' && isReviewModalOpen) ? (
                        <button onClick={() => { if (currentScreen === 'BOOKING') { if (step > 1) setStep(step - 1); else if (step === 2 && showAuthCard) setShowAuthCard(false); else if (step === 2) setStep(1); else if (step > 1) setStep(step - 1); else setCurrentScreen('HOME'); } else { setIsReviewModalOpen(false); } }} className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white hover:bg-white/5 transition-all"><ChevronLeft size={18} /></button>
                    ) : (
                        <div>
                            {currentScreen === 'HOME' && <h2 className="text-lg font-black text-white uppercase tracking-tight">Olá, {currentUser ? currentUser.user_metadata?.full_name?.split(' ')[0] : 'Visitante'}</h2>}
                            {currentScreen === 'GALLERY' && <h2 className="text-lg font-black text-white uppercase tracking-tight">Galeria & Reviews</h2>}
                            {currentScreen === 'AGENDA' && <h2 className="text-lg font-black text-white uppercase tracking-tight">Minha Agenda</h2>}
                            {currentScreen === 'PROFILE' && <h2 className="text-lg font-black text-white uppercase tracking-tight">Meu Perfil</h2>}
                        </div>
                    )}
                    <div className="relative">
                        {currentScreen === 'HOME' ? (
                            <button onClick={() => setShowNotifications(!showNotifications)} className="w-10 h-10 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all"><Bell size={18} />{hasUnread && <span className="absolute top-0 right-0 w-3 h-3 bg-red-600 rounded-full border-2 border-[#020202] animate-pulse" />}</button>
                        ) : <div className="w-10" />}
                        <AnimatePresence>{showNotifications && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute right-0 top-12 w-64 bg-[#121212] border border-white/10 rounded-2xl shadow-2xl z-50 p-2"><div className="flex justify-between items-center px-2 pb-2 mb-2 border-b border-white/5"><span className="text-[10px] font-bold text-zinc-500 uppercase">Notificações</span><X size={12} className="text-zinc-500 cursor-pointer" onClick={() => setShowNotifications(false)} /></div><div className="max-h-48 overflow-y-auto space-y-2">{notifications.length === 0 && <p className="text-[9px] text-center text-zinc-600 py-4">Sem notificações</p>}{notifications.map(n => <div key={n.id} className="p-2 bg-white/5 rounded-lg border border-white/5"><p className="text-[9px] font-bold text-white">{n.title}</p><p className="text-[8px] text-zinc-400">{n.message}</p></div>)}</div></motion.div>}</AnimatePresence>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pb-32 relative">
                    {currentScreen === 'HOME' && (
                        <div className="space-y-6 md:space-y-8 px-5 md:px-8">
                            <div className="bg-[#121212] border border-white/5 rounded-2xl h-12 flex items-center px-4 gap-3 text-zinc-500 hover:border-white/20 transition-all">
                                <Search size={16} />
                                <input 
                                    placeholder="Buscar serviço..." 
                                    className="bg-transparent w-full h-full outline-none text-[10px] font-bold uppercase text-white placeholder:text-zinc-700" 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            
                            {/* Business Card (Updated with Carbon Texture) */}
                            <div className="w-full aspect-[1.8/1] rounded-[2rem] relative group overflow-hidden border border-white/10 shadow-2xl">
                                {/* Carbon Pattern Background */}
                                <div className="absolute inset-0 carbon-card-pattern opacity-100" />
                                
                                {/* Bottom Gradient Overlay (Spotlight effect as per photo) */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 z-0 pointer-events-none" />
                                <div className="absolute top-[-50%] left-[-20%] w-[140%] h-[140%] bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.08),_transparent_70%)] pointer-events-none mix-blend-screen" />

                                <div className="absolute inset-0 z-10 flex flex-col justify-between p-6">
                                    <div className="flex justify-between items-start relative z-20">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-zinc-900/80 border border-white/10 flex items-center justify-center overflow-hidden backdrop-blur-sm shadow-lg">{businessSettings.profile_image_url ? <img src={businessSettings.profile_image_url} className="w-full h-full object-cover" /> : <span className="text-xl font-black text-white">{businessSettings.business_name.charAt(0)}</span>}</div>
                                            <div>
                                                <h3 className="text-sm font-black text-white uppercase tracking-wider drop-shadow-md">{businessSettings.business_name}</h3>
                                                <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">Estética Automotiva</p>
                                            </div>
                                        </div>
                                        <button onClick={handleOpenWhatsapp} className="w-10 h-10 rounded-full bg-green-900/30 border border-green-500/30 flex items-center justify-center text-green-500 hover:bg-green-500 hover:text-white transition-all backdrop-blur-sm"><Phone size={16} /></button>
                                    </div>
                                    <div className="relative z-20 space-y-2">
                                        <div className="flex items-center gap-2 mb-1"><div className={cn("w-2 h-2 rounded-full animate-pulse", isOpenNow ? "bg-green-500" : "bg-red-500")} /><span className={cn("text-[9px] font-bold uppercase tracking-widest drop-shadow-sm", isOpenNow ? "text-green-500" : "text-red-500")}>{isOpenNow ? "Aberto agora" : "Fechado"}</span></div>
                                        <div className="flex items-center gap-2 text-zinc-300"><Instagram size={12} /><span className="text-[9px] font-bold uppercase">{businessSettings.configs?.instagram || '@carboncar'}</span></div>
                                        <div className="flex items-start gap-2 text-zinc-300"><MapPin size={12} className="shrink-0 mt-0.5" /><span className="text-[9px] font-bold uppercase leading-tight max-w-[90%]">{businessSettings.address || 'Endereço não informado'}</span></div>
                                    </div>
                                </div>
                            </div>

                            {/* Studio Photos Card */}
                            {businessSettings.configs?.studio_photos && businessSettings.configs.studio_photos.length > 0 && !searchTerm && (
                                <div className="w-full aspect-[1.5/1] rounded-[2rem] relative overflow-hidden border border-white/5 shadow-2xl bg-[#0c0c0c] group animate-in fade-in">
                                    <div className="absolute top-4 left-4 z-20 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                                        <p className="text-[8px] font-black uppercase text-white tracking-widest flex items-center gap-1">
                                            <ImageIcon size={10} /> O Espaço
                                        </p>
                                    </div>
                                    
                                    {/* Slideshow Container */}
                                    <div 
                                        className="flex h-full transition-transform duration-1000 ease-in-out"
                                        style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                                    >
                                        {businessSettings.configs.studio_photos.map((photo: string, idx: number) => (
                                            <div key={idx} className="w-full h-full flex-shrink-0 relative">
                                                <img src={photo} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                            </div>
                                        ))}
                                    </div>

                                    {/* Indicators */}
                                    {businessSettings.configs.studio_photos.length > 1 && (
                                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                                            {businessSettings.configs.studio_photos.map((_: any, i: number) => (
                                                <div 
                                                    key={i} 
                                                    className={cn(
                                                        "h-1 rounded-full transition-all duration-300",
                                                        i === currentSlide ? "w-6 bg-white shadow-glow" : "w-1.5 bg-white/20"
                                                    )} 
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div>
                                <h3 className="text-sm font-black text-white uppercase mb-4 pl-1">
                                    {searchTerm ? 'Resultados da Busca' : 'Serviços'}
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {filteredServices.length > 0 ? filteredServices.map((s) => (
                                        <button key={s.id} onClick={() => { setSelectedService(s); setCurrentScreen('BOOKING'); setStep(1); }} className="bg-[#121212] border border-white/5 p-4 rounded-[1.5rem] flex flex-col justify-between h-[130px] hover:border-red-600/30 transition-all group">
                                            <div className="flex justify-between w-full">
                                                <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center group-hover:bg-red-600 transition-colors">
                                                    <Zap size={14} className="text-white" />
                                                </div>
                                                <p className="text-xs font-black text-white">R$ {Number(s.price).toFixed(0)}</p>
                                            </div>
                                            <div className="text-left">
                                                <h4 className="text-[10px] font-black text-white uppercase line-clamp-2">{s.name}</h4>
                                                <div className="flex items-center gap-1 mt-1 text-zinc-500">
                                                    <Clock size={10} />
                                                    <span className="text-[8px] font-bold uppercase">{formatDuration(s.duration_minutes)}</span>
                                                </div>
                                            </div>
                                        </button>
                                    )) : (
                                        <div className="col-span-2 py-10 text-center text-zinc-500 text-[10px] font-bold uppercase">
                                            Nenhum serviço encontrado
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {currentScreen === 'GALLERY' && (
                        <div className="px-5 md:px-8">
                            <div className="flex bg-[#121212] p-1 rounded-xl border border-white/5 mb-6"><button onClick={() => setGalleryTab('PHOTOS')} className={cn("flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2", galleryTab === 'PHOTOS' ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white")}><ImageIcon size={12} /> Showroom</button><button onClick={() => setGalleryTab('REVIEWS')} className={cn("flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2", galleryTab === 'REVIEWS' ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white")}><Star size={12} /> Avaliações</button></div>
                            {galleryTab === 'PHOTOS' ? (
                                <div className="grid grid-cols-2 gap-3">{portfolio.map((item) => <div key={item.id} className="aspect-[4/5] bg-zinc-900 rounded-2xl overflow-hidden relative group"><img src={item.imageUrl} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-700" /><div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4"><p className="text-[9px] text-white font-bold uppercase line-clamp-2">{item.description}</p></div></div>)}{portfolio.length === 0 && <p className="col-span-2 text-center text-zinc-500 text-[10px] font-bold uppercase py-20">Galeria Vazia</p>}</div>
                            ) : (
                                <div className="space-y-4"><button onClick={() => setIsReviewModalOpen(true)} className="w-full py-4 bg-zinc-900 border border-white/10 border-dashed rounded-2xl text-zinc-400 hover:text-white hover:border-red-600/50 hover:bg-red-900/5 transition-all text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"><MessageSquare size={14} /> Avaliar Experiência</button><div className="space-y-3">{dbReviews.length === 0 ? <div className="text-center py-10 opacity-50"><Star size={32} className="text-zinc-700 mx-auto mb-2" /><p className="text-[10px] font-bold text-zinc-500 uppercase">Seja o primeiro a avaliar</p></div> : dbReviews.map(review => <div key={review.id} className="bg-[#121212] border border-white/5 p-4 rounded-2xl space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-black text-white">{review.customerName.charAt(0)}</div>
                                            <div>
                                                <p className="text-[10px] font-black text-white uppercase">{review.customerName}</p>
                                                <p className="text-[8px] text-zinc-500">{review.date ? new Date(review.date).toLocaleDateString() : 'N/A'}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={10} className={i < review.rating ? "text-yellow-500 fill-yellow-500" : "text-zinc-800 fill-zinc-800"} />)}</div>
                                    </div>
                                    <p className="text-[10px] text-zinc-400 leading-relaxed italic">"{review.comment}"</p>
                                    
                                    {review.reply && (
                                        <div className="mt-2 bg-red-900/10 border-l-2 border-red-600 p-3 rounded-r-xl space-y-1 animate-in fade-in slide-in-from-left-2">
                                            <div className="flex items-center gap-1.5 text-red-500">
                                                <Reply size={10} className="-scale-x-100" />
                                                <span className="text-[8px] font-black uppercase tracking-widest">Resposta do Hangar</span>
                                            </div>
                                            <p className="text-[9px] text-zinc-300 leading-relaxed font-medium">{review.reply}</p>
                                        </div>
                                    )}
                                </div>)}</div></div>
                            )}
                        </div>
                    )}

                    {currentScreen === 'AGENDA' && (
                        <div className="px-5 md:px-8 space-y-6 animate-in slide-in-from-right-4">
                            {!currentUser && !identifiedCustomerId ? (
                                <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-6">
                                    <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                                        <Lock size={32} className="text-zinc-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2">Acesso Restrito</h3>
                                        <p className="text-[10px] text-zinc-500 font-medium max-w-xs mx-auto">
                                            Faça login para ver seus agendamentos futuros e histórico de serviços.
                                        </p>
                                    </div>
                                    <button 
                                        onClick={onLoginRequest}
                                        className="py-3 px-8 bg-white text-black rounded-xl font-black uppercase tracking-widest text-[9px] shadow-glow hover:bg-zinc-200 transition-all flex items-center gap-2"
                                    >
                                        <LogIn size={12} /> Entrar
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex bg-[#121212] p-1 rounded-xl border border-white/5">
                                        <button onClick={() => setAgendaTab('UPCOMING')} className={cn("flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all", agendaTab === 'UPCOMING' ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white")}>Próximos</button>
                                        <button onClick={() => setAgendaTab('HISTORY')} className={cn("flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all", agendaTab === 'HISTORY' ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white")}>Histórico</button>
                                    </div>

                                    <div className="space-y-3 pb-32">
                                        {(agendaTab === 'UPCOMING' ? upcomingAppointments : historyAppointments).map(apt => (
                                            <div key={apt.id} className="bg-[#121212] border border-white/5 p-5 rounded-2xl relative overflow-hidden group">
                                                <div className="flex justify-between items-start mb-3 relative z-10">
                                                    <div>
                                                        <p className="text-xs font-black text-white uppercase tracking-tight">{apt.serviceType}</p>
                                                        <p className="text-[9px] font-bold text-zinc-500 uppercase mt-0.5">{new Date(apt.date + 'T12:00:00').toLocaleDateString()} às {apt.time}</p>
                                                    </div>
                                                    <span className={cn(
                                                        "text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded border",
                                                        apt.status === 'CONFIRMADO' ? "bg-white/10 border-white/20 text-white" :
                                                        apt.status === 'FINALIZADO' ? "bg-green-900/20 border-green-500/30 text-green-500" :
                                                        apt.status === 'CANCELADO' ? "bg-red-900/20 border-red-500/30 text-red-500" :
                                                        "bg-zinc-800 border-zinc-700 text-zinc-500"
                                                    )}>
                                                        {apt.status}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[9px] font-bold text-zinc-600 uppercase relative z-10">
                                                    <Car size={12} />
                                                    <span>{userVehicle}</span>
                                                </div>
                                                {/* Decorative BG */}
                                                <div className="absolute right-0 bottom-0 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                                                    <Wrench size={80} />
                                                </div>
                                            </div>
                                        ))}
                                        
                                        {(agendaTab === 'UPCOMING' ? upcomingAppointments : historyAppointments).length === 0 && (
                                            <div className="py-20 text-center opacity-40">
                                                <CalendarX size={48} className="mx-auto mb-4 text-zinc-600" />
                                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Nenhum agendamento encontrado</p>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {currentScreen === 'PROFILE' && (
                        <div className="px-5 md:px-8 space-y-6 animate-in slide-in-from-right-4">
                            {!currentUser && !identifiedCustomerId ? (
                                <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-6">
                                    <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                                        <User size={32} className="text-zinc-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2">Perfil do Cliente</h3>
                                        <p className="text-[10px] text-zinc-500 font-medium max-w-xs mx-auto">
                                            Acesse sua conta para gerenciar seus dados e veículos.
                                        </p>
                                    </div>
                                    <button 
                                        onClick={onLoginRequest}
                                        className="py-3 px-8 bg-white text-black rounded-xl font-black uppercase tracking-widest text-[9px] shadow-glow hover:bg-zinc-200 transition-all flex items-center gap-2"
                                    >
                                        <LogIn size={12} /> Entrar / Cadastrar
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="bg-[#121212] p-6 rounded-[2rem] border border-white/5 relative overflow-hidden text-center">
                                        <div className="w-20 h-20 bg-zinc-800 rounded-2xl mx-auto mb-4 flex items-center justify-center text-2xl font-black text-white shadow-lg border border-white/10">
                                            {(guestForm.name || 'C').charAt(0)}
                                        </div>
                                        <h3 className="text-lg font-black text-white uppercase tracking-tight">{guestForm.name || 'Cliente'}</h3>
                                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">{guestForm.phone || 'Sem telefone'}</p>
                                        
                                        <div className="grid grid-cols-2 gap-4 mt-6">
                                            <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                                                <p className="text-[8px] font-black text-zinc-600 uppercase mb-1">Serviços</p>
                                                <p className="text-lg font-black text-white">{servicesCount}</p>
                                            </div>
                                            <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                                                <p className="text-[8px] font-black text-zinc-600 uppercase mb-1">Fidelidade</p>
                                                <p className="text-lg font-black text-yellow-500">{servicesCount % 10}/10</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-2">Meus Veículos</h4>
                                        <div className="bg-[#121212] p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center">
                                                    <Car size={16} className="text-zinc-500" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-white uppercase">{userVehicle}</p>
                                                    <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Principal</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <button 
                                        onClick={onExit}
                                        className="w-full py-4 mt-8 bg-red-900/10 hover:bg-red-900/20 border border-red-900/30 text-red-500 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all flex items-center justify-center gap-2"
                                    >
                                        <LogOut size={12} /> Sair da Conta
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {currentScreen === 'BOOKING' && (
                        <div className="px-5 md:px-8 pb-32">
                            {step === 1 && (<div className="space-y-6 animate-in slide-in-from-right-4"><div className="bg-[#0c0c0c] border border-white/5 p-4 rounded-[2rem]"><div className="flex items-center justify-between mb-4"><button onClick={() => changeMonth(-1)}><ChevronLeft size={14} className="text-zinc-500" /></button><span className="text-[10px] font-black text-white uppercase tracking-widest">{viewDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</span><button onClick={() => changeMonth(1)}><ChevronLeft size={14} className="text-zinc-500 rotate-180" /></button></div><div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">{calendarDays.map(d => <button key={d.dateStr} disabled={!d.isOpen} onClick={() => setSelectedDate(d.dateStr)} className={cn("min-w-[50px] h-[64px] rounded-xl flex flex-col items-center justify-center transition-all", selectedDate === d.dateStr ? "bg-red-600 text-white shadow-glow-red" : !d.isOpen ? "opacity-20 grayscale" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800")}><span className="text-[8px] font-bold uppercase">{d.dayName}</span><span className="text-lg font-black">{d.dayNumber}</span></button>)}</div></div><div><h3 className="text-xs font-black text-white uppercase mb-4 pl-1">Horários</h3><div className="grid grid-cols-3 sm:grid-cols-4 gap-2">{availableSlots.length > 0 ? availableSlots.map(t => { const full = (slotOccupancy[t] || 0) >= businessSettings.box_capacity; return <button key={t} disabled={full} onClick={() => setSelectedTime(t)} className={cn("py-3 rounded-lg border text-xs font-bold transition-all", full ? "bg-red-900/10 border-red-900/30 text-red-900 cursor-not-allowed" : selectedTime === t ? "bg-white text-black border-white" : "bg-[#121212] border-white/5 text-zinc-400 hover:border-white/20")}>{t}</button> }) : <p className="col-span-4 text-center text-zinc-600 text-[10px] py-4 uppercase font-bold">Selecione uma data disponível</p>}</div></div></div>)}
                            
                            {/* Step 2: Seus Dados + Auth Inline */}
                            {step === 2 && !identifiedCustomerId && !currentUser && (
                                <div className="space-y-4 animate-in slide-in-from-right-4">
                                    <h3 className="text-xs font-black text-white uppercase pl-1">Seus Dados</h3>
                                    <input 
                                        placeholder="Nome Completo" 
                                        className="w-full bg-[#121212] border border-white/5 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none focus:border-red-600 transition-all" 
                                        value={guestForm.name} 
                                        onChange={e => setGuestForm({ ...guestForm, name: e.target.value })} 
                                    />
                                    <input 
                                        placeholder="Telefone" 
                                        className="w-full bg-[#121212] border border-white/5 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none focus:border-red-600 transition-all" 
                                        value={guestForm.phone} 
                                        onChange={e => setGuestForm({ ...guestForm, phone: formatPhone(e.target.value) })} 
                                    />

                                    {/* Glassmorphism Auth Card */}
                                    <AnimatePresence>
                                        {showAuthCard && (
                                            <motion.div 
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                className="mt-6 p-6 rounded-2xl bg-zinc-900/60 backdrop-blur-xl border border-white/10 shadow-2xl relative overflow-hidden"
                                            >
                                                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                                                
                                                <div className="flex flex-col items-center text-center space-y-4 relative z-10">
                                                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                                                        <Lock size={18} className="text-white" />
                                                    </div>
                                                    
                                                    <p className="text-[10px] font-bold text-zinc-300 uppercase leading-relaxed max-w-xs">
                                                        Para continuar seu agendamento e ver o andamento, entre ou crie sua conta:
                                                    </p>

                                                    <div className="flex gap-3 w-full pt-2">
                                                        <button 
                                                            onClick={() => { saveDraft(); onLoginRequest && onLoginRequest(); }}
                                                            className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/5 transition-all flex items-center justify-center gap-2"
                                                        >
                                                            <LogIn size={12} /> Entrar
                                                        </button>
                                                        <button 
                                                            onClick={() => { saveDraft(); onRegisterRequest && onRegisterRequest(guestForm); }}
                                                            className="flex-1 py-3 bg-white text-black hover:bg-zinc-200 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-glow transition-all flex items-center justify-center gap-2"
                                                        >
                                                            <UserPlus size={12} /> Criar Conta
                                                        </button>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}
                            
                            {step === 3 && (<div className="space-y-4 animate-in slide-in-from-right-4"><h3 className="text-xs font-black text-white uppercase pl-1">Veículo</h3><div className="grid grid-cols-2 gap-3"><input placeholder="Marca" className="bg-[#121212] border border-white/5 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none focus:border-red-600" value={vehicleForm.brand} onChange={e => setVehicleForm({ ...vehicleForm, brand: e.target.value })} /><input placeholder="Modelo" className="bg-[#121212] border border-white/5 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none focus:border-red-600" value={vehicleForm.model} onChange={e => setVehicleForm({ ...vehicleForm, model: e.target.value })} /></div><input placeholder="Placa" className="w-full bg-[#121212] border border-white/5 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none focus:border-red-600" value={vehicleForm.plate} onChange={e => setVehicleForm({ ...vehicleForm, plate: formatPlate(e.target.value) })} /></div>)}
                            {step === 4 && (
                                <div className="flex flex-col items-center justify-center py-10 animate-in zoom-in-95 text-center px-4">
                                    <div className="w-20 h-20 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(34,197,94,0.2)]">
                                        <Check size={32} className="text-green-500" />
                                    </div>
                                    <h2 className="text-2xl font-black text-white uppercase mb-2 tracking-tight">Agendamento Confirmado! 🚀</h2>
                                    <p className="text-zinc-400 text-xs font-medium max-w-xs mx-auto leading-relaxed mb-8">
                                        Seu serviço foi agendado para <span className="text-white font-bold">{new Date((confirmedDetails?.date || selectedDate) + 'T12:00:00').toLocaleDateString()}</span> às <span className="text-white font-bold">{confirmedDetails?.time || selectedTime}</span>.
                                    </p>
                                    
                                    {!currentUser && (
                                        <div className="bg-[#09090b] border border-red-600/30 rounded-[2rem] p-6 w-full max-w-sm mb-6 relative overflow-hidden group shadow-[0_0_30px_rgba(220,38,38,0.1)]">
                                            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-600 to-red-500" />
                                            <p className="text-[10px] font-black uppercase text-red-500 tracking-widest mb-3 flex items-center justify-center gap-2">
                                                <User size={12} /> Acompanhe seu Agendamento
                                            </p>
                                            <p className="text-xs text-white mb-6 leading-relaxed">
                                                Crie sua conta agora para receber atualizações, ver o histórico e acumular pontos de fidelidade.
                                            </p>
                                            <button 
                                                onClick={() => { saveDraft(); onRegisterRequest && onRegisterRequest({ name: guestForm.name, phone: guestForm.phone }); }} 
                                                className="w-full py-4 bg-white text-black rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all shadow-glow hover:scale-[1.02] active:scale-[0.98]"
                                            >
                                                Criar Minha Conta <ArrowUpRight size={14} />
                                            </button>
                                        </div>
                                    )}
                                    
                                    <button 
                                        onClick={() => { setCurrentScreen('HOME'); setStep(1); }} 
                                        className="text-zinc-600 hover:text-white text-[10px] font-bold uppercase tracking-widest py-3 px-6 rounded-xl hover:bg-white/5 transition-all"
                                    >
                                        Voltar ao Início
                                    </button>
                                </div>
                            )}
                            {step < 4 && !showAuthCard && (<div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black to-transparent z-50 flex justify-center"><button onClick={handleContinueAction} disabled={loading || (step === 1 && (!selectedDate || !selectedTime))} className={cn("w-full max-w-sm py-4 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-glow-red transition-all flex items-center justify-center gap-2", (step === 1 && (!selectedDate || !selectedTime)) ? "bg-zinc-900 text-zinc-600 cursor-not-allowed" : "bg-red-600 text-white hover:bg-red-500")}>{loading ? <Loader2 className="animate-spin" size={14} /> : (step === 3 ? "Finalizar" : "Continuar")}</button></div>)}
                        </div>
                    )}

                    {isReviewModalOpen && (<div className="absolute inset-0 z-50 bg-[#020202] p-6 animate-in slide-in-from-bottom-10"><div className="h-full flex flex-col"><div className="flex justify-between items-center mb-8"><h3 className="text-lg font-black text-white uppercase">Avaliar Experiência</h3><button onClick={() => setIsReviewModalOpen(false)} className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-500 hover:text-white"><X size={18} /></button></div><form onSubmit={handleSubmitReview} className="flex-1 flex flex-col gap-6"><div className="space-y-2"><label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-2">Sua Nota</label><div className="flex gap-2 justify-center py-6 bg-[#121212] border border-white/5 rounded-2xl">{Array.from({ length: 5 }).map((_, i) => <button key={i} type="button" onClick={() => setReviewForm({ ...reviewForm, rating: i + 1 })} className="p-1 transition-transform active:scale-90 hover:scale-110"><Star key={i} size={32} className={i < reviewForm.rating ? "text-yellow-500 fill-yellow-500" : "text-zinc-800 fill-zinc-800"} strokeWidth={1} /></button>)}</div></div>{!currentUser && <div className="space-y-2"><label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-2">Seu Nome</label><input required className="w-full bg-[#121212] border border-white/5 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none focus:border-yellow-500/50" value={reviewForm.name} onChange={e => setReviewForm({ ...reviewForm, name: e.target.value })} placeholder="Como quer ser identificado?" /></div>}<div className="space-y-2 flex-1"><label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-2">Comentário</label><textarea required className="w-full h-40 bg-[#121212] border border-white/5 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none focus:border-yellow-500/50 resize-none" value={reviewForm.comment} onChange={e => setReviewForm({ ...reviewForm, comment: e.target.value })} placeholder="Conte como foi o serviço..." /></div><button type="submit" disabled={submittingReview} className="w-full py-4 bg-white text-black rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all">{submittingReview ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />} Enviar Avaliação</button></form></div></div>)}
                </div>
                {currentScreen !== 'BOOKING' && !isReviewModalOpen && <BottomNav />}
            </div>
        </div>
    );
};
