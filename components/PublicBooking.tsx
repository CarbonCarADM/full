
import React, { useState, useEffect, useRef } from 'react';
import { Check, ChevronLeft, Star, MapPin, Search, Zap, X, User, ArrowRight, Clock, Loader2, CalendarX, History, LayoutGrid, Bell, Phone, Filter, Instagram, Calendar as CalendarIcon, Wrench, Car, LogOut, Key, MessageSquare, Send, Image as ImageIcon, ThumbsUp, Lock, ArrowUpRight } from 'lucide-react';
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

// Helper: Converte "HH:mm" para minutos totais do dia
const timeToMinutes = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
};

// Helper: Converte minutos totais para "HH:mm"
const minutesToTime = (minutes: number): string => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

// Helper: Formata duração (ex: 90 -> 1h 30min)
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
    // --- STATE ---
    const [currentScreen, setCurrentScreen] = useState<'HOME' | 'BOOKING' | 'PROFILE' | 'GALLERY' | 'AGENDA'>('HOME');
    const [step, setStep] = useState(1); // Booking Step
    const [loading, setLoading] = useState(false);
    const [agendaTab, setAgendaTab] = useState<'UPCOMING' | 'HISTORY'>('UPCOMING');
    const [galleryTab, setGalleryTab] = useState<'PHOTOS' | 'REVIEWS'>('PHOTOS');
    
    // Booking Data
    const [selectedService, setSelectedService] = useState<any>(null);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedTime, setSelectedTime] = useState<string>(''); 
    const [guestForm, setGuestForm] = useState({ name: '', phone: '' });
    const [vehicleForm, setVehicleForm] = useState({ brand: '', model: '', plate: '' });
    
    // Calendar State
    const [viewDate, setViewDate] = useState(new Date());
    const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [slotOccupancy, setSlotOccupancy] = useState<Record<string, number>>({}); 
    
    // User Data
    const [userVehicle, setUserVehicle] = useState<string>('---');
    const [servicesCount, setServicesCount] = useState(0);
    const [dbReviews, setDbReviews] = useState<Review[]>([]);
    const [dbUserAppointments, setDbUserAppointments] = useState<any[]>([]);

    // Notification State
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);

    // Review Form State
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '', name: '' });
    const [submittingReview, setSubmittingReview] = useState(false);

    // Password Modal State
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
    const [passwordStatus, setPasswordStatus] = useState<'IDLE' | 'SAVING' | 'SUCCESS' | 'ERROR'>('IDLE');
    const [passwordFeedback, setPasswordFeedback] = useState('');

    // Fix for TS2786: Lock cannot be used as a JSX component
    const LockIcon = Lock as any;

    // --- EFFECTS ---

    // Fetch Initial Data
    useEffect(() => {
        const fetchRealData = async () => {
            if (!businessSettings.id) return;

            // Fetch Reviews
            const { data: revs } = await supabase
                .from('reviews')
                .select('*')
                .eq('business_id', businessSettings.id)
                .order('created_at', { ascending: false });
            if (revs) setDbReviews(revs as any);

            // User History & Profile Data
            if (currentUser) {
                // Tenta buscar por email OU user_id se disponível
                let query = supabase
                    .from('customers')
                    .select('id, name, phone, vehicles(*)')
                    .eq('business_id', businessSettings.id);
                
                // Prioriza User ID se vinculado
                query = query.or(`email.eq.${currentUser.email},user_id.eq.${currentUser.id}`);

                const { data: customers } = await query;
                const customer = customers && customers.length > 0 ? customers[0] : null;

                if (customer) {
                    // Pre-fill user data
                    setReviewForm(prev => ({ ...prev, name: customer.name }));
                    
                    if (customer.vehicles && customer.vehicles.length > 0) {
                        const v = customer.vehicles[0];
                        const model = v.model || 'Modelo N/A';
                        const brand = v.brand || '';
                        const plate = v.plate || '---';
                        setUserVehicle(`${brand} ${model} (${plate})`.trim());
                        setVehicleForm({ brand: v.brand || '', model: v.model || '', plate: v.plate || '' });
                    }
                    setGuestForm({ name: customer.name, phone: customer.phone });

                    const { data: apts } = await supabase.from('appointments').select('*').eq('customer_id', customer.id).order('date', { ascending: false });
                    if (apts) {
                        setDbUserAppointments(apts.map(a => ({
                            ...a, serviceType: a.service_type, durationMinutes: a.duration_minutes, customerId: a.customer_id, vehicleId: a.vehicle_id
                        } as any)));
                    }

                    const { count, error: countError } = await supabase
                       .from('appointments')
                       .select('*', { count: 'exact', head: true })
                       .eq('customer_id', customer.id)
                       .eq('business_id', businessSettings.id)
                       .eq('status', 'FINALIZADO');
                     
                    if (!countError) setServicesCount(count || 0);

                } else {
                    if (currentUser.user_metadata?.full_name) {
                        setGuestForm(prev => ({ ...prev, name: currentUser.user_metadata.full_name }));
                        setReviewForm(prev => ({ ...prev, name: currentUser.user_metadata.full_name }));
                    }
                    if (currentUser.user_metadata?.phone) {
                        setGuestForm(prev => ({ ...prev, phone: currentUser.user_metadata.phone }));
                    }
                }
            }
        };
        fetchRealData();
    }, [businessSettings.id, currentUser]);

    // Calendar Generation
    useEffect(() => {
        const days: CalendarDay[] = [];
        const opDays = businessSettings.operating_days || [];
        const blockedDates = businessSettings.blocked_dates || [];
        const realToday = new Date();
        realToday.setHours(0, 0, 0, 0);

        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month, i);
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${d}`;
            const dayOfWeek = date.getDay(); 
            const rule = opDays.find(r => r.dayOfWeek === dayOfWeek);
            const isOpenDay = rule ? rule.isOpen : false; 
            const isBlocked = blockedDates.some(bd => bd.date === dateStr);
            const isPast = date < realToday;

            days.push({ 
                dateStr, 
                dayName: date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase(), 
                dayNumber: d,
                isOpen: isOpenDay && !isBlocked && !isPast,
                isPast: isPast
            });
        }
        setCalendarDays(days);
        
        if (!selectedDate || new Date(selectedDate).getMonth() !== month) {
             const firstAvailable = days.find(d => d.isOpen);
             if (firstAvailable) setSelectedDate(firstAvailable.dateStr);
             else setSelectedDate('');
        }
    }, [businessSettings, viewDate]);

    // Slots Generation
    useEffect(() => {
        if (!selectedDate || !businessSettings.id) return;

        const fetchAndGenerateSlots = async () => {
            const [y, m, d] = selectedDate.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d); 
            const dayOfWeek = dateObj.getDay();
            const rule = businessSettings.operating_days?.find(r => r.dayOfWeek === dayOfWeek);

            if (!rule || !rule.isOpen) {
                setAvailableSlots([]);
                setSlotOccupancy({});
                return;
            }

            const slots: string[] = [];
            const interval = businessSettings.slot_interval_minutes || 60;
            const startMins = timeToMinutes(rule.openTime); 
            const endMins = timeToMinutes(rule.closeTime);

            for (let currentMins = startMins; currentMins < endMins; currentMins += interval) {
                slots.push(minutesToTime(currentMins));
            }
            setAvailableSlots(slots);

            const { data: busyData } = await supabase
                .from('appointments')
                .select('time')
                .eq('business_id', businessSettings.id)
                .eq('date', selectedDate)
                .neq('status', 'CANCELADO');

            const occupancyMap: Record<string, number> = {};
            if (busyData) {
                slots.forEach(slotTime => {
                    const count = busyData.filter(apt => apt.time?.slice(0, 5) === slotTime).length;
                    occupancyMap[slotTime] = count;
                });
            }
            setSlotOccupancy(occupancyMap);
        };

        fetchAndGenerateSlots();
        setSelectedTime('');
    }, [selectedDate, businessSettings]);

    // --- HANDLERS ---

    const handleFinalize = async () => {
        if (!selectedService || !selectedDate || !selectedTime) return;
        setLoading(true);
        const apt: any = { serviceId: selectedService.id, date: selectedDate, time: selectedTime };
        const customerData = { name: guestForm.name, phone: guestForm.phone, vehicles: [{ brand: vehicleForm.brand, model: vehicleForm.model, plate: vehicleForm.plate }] };

        const success = await onBookingComplete(apt, customerData);
        if (success) {
            setStep(4);
        }
        setLoading(false);
    };

    const handleSubmitReview = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmittingReview(true);
        
        const payload = {
            business_id: businessSettings.id,
            customer_name: reviewForm.name || 'Anônimo',
            rating: reviewForm.rating,
            comment: reviewForm.comment,
            // appointment_id logic optional
        };

        const { data, error } = await supabase.from('reviews').insert(payload).select().single();
        
        if (!error && data) {
            setDbReviews(prev => [data as Review, ...prev]);
            setIsReviewModalOpen(false);
            setReviewForm(prev => ({...prev, comment: '', rating: 5}));
        } else {
            alert("Erro ao enviar avaliação.");
        }
        setSubmittingReview(false);
    };

    const changeMonth = (delta: number) => {
        const newDate = new Date(viewDate);
        newDate.setMonth(newDate.getMonth() + delta);
        setViewDate(newDate);
    };

    const handleOpenWhatsapp = () => {
        if (businessSettings.whatsapp) {
            window.open(`https://wa.me/${businessSettings.whatsapp.replace(/\D/g, '')}`, '_blank');
        }
    };

    // Derived Lists for Agenda
    const upcomingAppointments = dbUserAppointments.filter(a => 
        ['NOVO', 'CONFIRMADO', 'EM_EXECUCAO'].includes(a.status)
    ).sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());

    const historyAppointments = dbUserAppointments.filter(a => 
        ['FINALIZADO', 'CANCELADO'].includes(a.status)
    ).sort((a, b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime());

    // --- RENDER HELPERS ---

    const BottomNav = () => (
        <div className="fixed md:absolute bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-[340px] px-6 md:px-4">
            <div className="bg-[#121212]/90 backdrop-blur-xl border border-white/5 rounded-full h-16 flex items-center justify-evenly shadow-2xl">
                {[
                    { id: 'HOME', icon: LayoutGrid, label: 'Home' },
                    { id: 'GALLERY', icon: Search, label: 'Galeria' },
                    { id: 'AGENDA', icon: CalendarIcon, label: 'Agenda' },
                    { id: 'PROFILE', icon: User, label: 'Perfil' },
                ].map((item) => (
                    <button 
                        key={item.id}
                        onClick={() => setCurrentScreen(item.id as any)} 
                        className="relative flex flex-col items-center justify-center w-14 h-full group"
                    >
                        <item.icon 
                            size={20} 
                            className={cn(
                                "transition-all duration-300", 
                                currentScreen === item.id ? "text-white -translate-y-1" : "text-zinc-500 group-hover:text-zinc-300"
                            )} 
                            fill={currentScreen === item.id && item.id !== 'GALLERY' && item.id !== 'AGENDA' ? "currentColor" : "none"}
                        />
                        {currentScreen === item.id && (
                            <motion.div layoutId="nav-dot" className="absolute bottom-3 w-1 h-1 bg-red-600 rounded-full shadow-[0_0_8px_red]" />
                        )}
                    </button>
                ))}
            </div>
        </div>
    );

    if (!businessSettings.id) {
        return (
            <div className="min-h-screen bg-[#020202] flex items-center justify-center font-sans p-4">
                <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#020202] flex flex-col items-center font-sans">
            {/* MASTER CONTAINER - SIMULATES MOBILE APP */}
            <div className="w-full max-w-md h-full md:h-[850px] md:my-auto md:rounded-[3rem] bg-[#020202] border-x border-white/5 md:border border-white/5 relative shadow-2xl flex flex-col overflow-hidden">
                
                {/* --- HEADER (DYNAMIC) --- */}
                <div className="pt-10 md:pt-12 px-5 md:px-8 pb-4 flex justify-between items-center shrink-0 z-30 bg-[#020202]/95 backdrop-blur-sm">
                    {currentScreen === 'BOOKING' || currentScreen === 'GALLERY' && isReviewModalOpen ? (
                        <button onClick={() => { 
                            if(currentScreen === 'BOOKING') {
                                if(step > 1) setStep(step-1); else setCurrentScreen('HOME'); 
                            } else {
                                setIsReviewModalOpen(false);
                            }
                        }} className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white hover:bg-white/5 transition-all">
                            <ChevronLeft size={18} />
                        </button>
                    ) : (
                        <div>
                            {currentScreen === 'HOME' && <h2 className="text-lg font-black text-white uppercase tracking-tight">Olá, {currentUser ? currentUser.email?.split('@')[0] : 'Visitante'}</h2>}
                            {currentScreen === 'GALLERY' && <h2 className="text-lg font-black text-white uppercase tracking-tight">Galeria & Reviews</h2>}
                            {currentScreen === 'AGENDA' && <h2 className="text-lg font-black text-white uppercase tracking-tight">Minha Agenda</h2>}
                            {currentScreen === 'PROFILE' && <h2 className="text-lg font-black text-white uppercase tracking-tight">Meu Perfil</h2>}
                        </div>
                    )}

                    {/* Notification / Action Area */}
                    <div className="relative">
                        {currentScreen === 'HOME' ? (
                            <button onClick={() => setShowNotifications(!showNotifications)} className="w-10 h-10 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all">
                                <Bell size={18} />
                                {hasUnread && <span className="absolute top-0 right-0 w-3 h-3 bg-red-600 rounded-full border-2 border-[#020202] animate-pulse" />}
                            </button>
                        ) : (
                            <div className="w-10" /> 
                        )}
                        
                        {/* Notifications Dropdown */}
                        <AnimatePresence>
                            {showNotifications && (
                                <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0}} className="absolute right-0 top-12 w-64 bg-[#121212] border border-white/10 rounded-2xl shadow-2xl z-50 p-2">
                                    <div className="flex justify-between items-center px-2 pb-2 mb-2 border-b border-white/5">
                                        <span className="text-[10px] font-bold text-zinc-500 uppercase">Notificações</span>
                                        <X size={12} className="text-zinc-500 cursor-pointer" onClick={() => setShowNotifications(false)}/>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto space-y-2">
                                        {notifications.length === 0 && <p className="text-[9px] text-center text-zinc-600 py-4">Sem notificações</p>}
                                        {notifications.map(n => (
                                            <div key={n.id} className="p-2 bg-white/5 rounded-lg border border-white/5">
                                                <p className="text-[9px] font-bold text-white">{n.title}</p>
                                                <p className="text-[8px] text-zinc-400">{n.message}</p>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* --- CONTENT AREA (SWITCH) --- */}
                <div className="flex-1 overflow-y-auto custom-scrollbar pb-32 relative">
                    
                    {/* HOME SCREEN */}
                    {currentScreen === 'HOME' && (
                        <div className="space-y-6 md:space-y-8 px-5 md:px-8">
                            <div className="bg-[#121212] border border-white/5 rounded-2xl h-12 flex items-center px-4 gap-3 text-zinc-500">
                                <Search size={16} />
                                <input placeholder="Buscar serviço..." className="bg-transparent w-full h-full outline-none text-[10px] font-bold uppercase text-white placeholder:text-zinc-700" />
                            </div>

                            {/* Business Card */}
                            <div className="w-full aspect-[1.8/1] rounded-[2rem] relative group overflow-hidden border border-white/5 shadow-2xl">
                                <div className="absolute inset-0 bg-[#050505]/80 backdrop-blur-xl z-10 flex flex-col justify-between p-5">
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-50 pointer-events-none" />
                                    <div className="flex justify-between items-start relative z-20">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center overflow-hidden">
                                                {businessSettings.profile_image_url ? <img src={businessSettings.profile_image_url} className="w-full h-full object-cover"/> : <span className="text-xl font-black text-white">{businessSettings.business_name.charAt(0)}</span>}
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-white uppercase tracking-wider">{businessSettings.business_name}</h3>
                                                <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">Estética Automotiva</p>
                                            </div>
                                        </div>
                                        <button onClick={handleOpenWhatsapp} className="w-10 h-10 rounded-full bg-green-900/20 border border-green-500/20 flex items-center justify-center text-green-500 hover:bg-green-500 hover:text-white transition-all"><Phone size={16} /></button>
                                    </div>
                                    <div className="relative z-20 space-y-1">
                                        <div className="flex items-center gap-2 text-zinc-400"><Instagram size={12}/><span className="text-[9px] font-bold uppercase">{businessSettings.configs?.instagram || '@carboncar'}</span></div>
                                        <div className="flex items-center gap-2 text-zinc-400"><MapPin size={12}/><span className="text-[9px] font-bold uppercase truncate max-w-[200px]">{businessSettings.address || 'Endereço não informado'}</span></div>
                                    </div>
                                </div>
                            </div>

                            {/* Services */}
                            <div>
                                <h3 className="text-sm font-black text-white uppercase mb-4 pl-1">Serviços</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {services.map((s) => (
                                        <button key={s.id} onClick={() => { setSelectedService(s); setCurrentScreen('BOOKING'); setStep(1); }} className="bg-[#121212] border border-white/5 p-4 rounded-[1.5rem] flex flex-col justify-between h-[130px] hover:border-red-600/30 transition-all group">
                                            <div className="flex justify-between w-full">
                                                <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center group-hover:bg-red-600 transition-colors"><Zap size={14} className="text-white"/></div>
                                                <p className="text-xs font-black text-white">R$ {Number(s.price).toFixed(0)}</p>
                                            </div>
                                            <div className="text-left">
                                                <h4 className="text-[10px] font-black text-white uppercase line-clamp-2">{s.name}</h4>
                                                <div className="flex items-center gap-1 mt-1 text-zinc-500"><Clock size={10}/><span className="text-[8px] font-bold uppercase">{formatDuration(s.duration_minutes)}</span></div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* GALLERY SCREEN */}
                    {currentScreen === 'GALLERY' && (
                        <div className="px-5 md:px-8">
                            <div className="flex bg-[#121212] p-1 rounded-xl border border-white/5 mb-6">
                                <button onClick={() => setGalleryTab('PHOTOS')} className={cn("flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2", galleryTab === 'PHOTOS' ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white")}>
                                    <ImageIcon size={12}/> Showroom
                                </button>
                                <button onClick={() => setGalleryTab('REVIEWS')} className={cn("flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2", galleryTab === 'REVIEWS' ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white")}>
                                    <Star size={12}/> Avaliações
                                </button>
                            </div>

                            {galleryTab === 'PHOTOS' ? (
                                <div className="grid grid-cols-2 gap-3">
                                    {portfolio.map((item) => (
                                        <div key={item.id} className="aspect-[4/5] bg-zinc-900 rounded-2xl overflow-hidden relative group">
                                            <img src={item.imageUrl} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-700" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                                                <p className="text-[9px] text-white font-bold uppercase line-clamp-2">{item.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {portfolio.length === 0 && <p className="col-span-2 text-center text-zinc-500 text-[10px] font-bold uppercase py-20">Galeria Vazia</p>}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <button onClick={() => setIsReviewModalOpen(true)} className="w-full py-4 bg-zinc-900 border border-white/10 border-dashed rounded-2xl text-zinc-400 hover:text-white hover:border-red-600/50 hover:bg-red-900/5 transition-all text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                                        <MessageSquare size={14} /> Avaliar Experiência
                                    </button>

                                    <div className="space-y-3">
                                        {dbReviews.length === 0 ? (
                                            <div className="text-center py-10 opacity-50">
                                                <Star size={32} className="text-zinc-700 mx-auto mb-2" />
                                                <p className="text-[10px] font-bold text-zinc-500 uppercase">Seja o primeiro a avaliar</p>
                                            </div>
                                        ) : (
                                            dbReviews.map(review => (
                                                <div key={review.id} className="bg-[#121212] border border-white/5 p-4 rounded-2xl">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-black text-white">
                                                                {review.customerName.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] font-black text-white uppercase">{review.customerName}</p>
                                                                <p className="text-[8px] text-zinc-500">{new Date(review.date).toLocaleDateString()}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-0.5">
                                                            {Array.from({length: 5}).map((_, i) => (
                                                                <Star key={i} size={10} className={i < review.rating ? "text-yellow-500 fill-yellow-500" : "text-zinc-800 fill-zinc-800"} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <p className="text-[10px] text-zinc-400 leading-relaxed italic">"{review.comment}"</p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* AGENDA SCREEN */}
                    {currentScreen === 'AGENDA' && (
                        <div className="px-5 md:px-8">
                            <div className="flex bg-[#121212] p-1 rounded-xl border border-white/5 mb-6">
                                <button onClick={() => setAgendaTab('UPCOMING')} className={cn("flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all", agendaTab === 'UPCOMING' ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white")}>Em Breve</button>
                                <button onClick={() => setAgendaTab('HISTORY')} className={cn("flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all", agendaTab === 'HISTORY' ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white")}>Histórico</button>
                            </div>
                            
                            <div className="space-y-3">
                                {!currentUser ? (
                                    <div className="text-center py-20">
                                        <LockIcon size={32} className="text-zinc-700 mx-auto mb-4" />
                                        <p className="text-zinc-500 text-[10px] font-bold uppercase mb-4">Faça login para ver sua agenda</p>
                                        <button onClick={onLoginRequest} className="px-6 py-3 bg-white text-black rounded-xl text-[9px] font-black uppercase tracking-widest">Entrar</button>
                                    </div>
                                ) : (agendaTab === 'UPCOMING' ? upcomingAppointments : historyAppointments).length === 0 ? (
                                    <div className="text-center py-20 opacity-40">
                                        <CalendarX size={32} className="text-zinc-600 mx-auto mb-4" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nenhum agendamento</p>
                                    </div>
                                ) : (
                                    (agendaTab === 'UPCOMING' ? upcomingAppointments : historyAppointments).map((apt: Appointment) => (
                                        <div key={apt.id} className="bg-[#121212] p-4 rounded-[1.2rem] border border-white/5 flex flex-col gap-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <div className={cn("w-1.5 h-1.5 rounded-full", apt.status === 'CONFIRMADO' ? "bg-white shadow-[0_0_5px_white]" : apt.status === 'EM_EXECUCAO' ? "bg-red-600 animate-pulse" : "bg-zinc-700")} />
                                                        <p className="text-[9px] font-black text-white uppercase tracking-wide">{new Date(apt.date + 'T12:00:00').toLocaleDateString('pt-BR')} às {apt.time}</p>
                                                    </div>
                                                    <p className="text-xs font-black text-white uppercase">{apt.serviceType}</p>
                                                </div>
                                                <span className={cn("text-[8px] font-bold px-2 py-1 rounded border uppercase tracking-widest", apt.status === 'FINALIZADO' ? "bg-green-500/10 text-green-500 border-green-500/20" : "text-zinc-500 bg-zinc-900 border-white/5")}>{apt.status}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* PROFILE SCREEN */}
                    {currentScreen === 'PROFILE' && (
                        <div className="px-5 md:px-8 space-y-6">
                            {currentUser ? (
                                <>
                                    <div className="bg-[#121212] p-6 rounded-[2rem] border border-white/5 flex flex-col items-center text-center relative overflow-hidden">
                                        <div className="absolute top-0 inset-x-0 h-20 bg-gradient-to-b from-red-600/10 to-transparent pointer-events-none" />
                                        <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-500 border-4 border-[#121212] relative z-10 shadow-xl mb-4">
                                            <User size={28}/>
                                        </div>
                                        <h3 className="text-lg font-black text-white uppercase tracking-tight">{currentUser.email?.split('@')[0]}</h3>
                                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-6">{currentUser.email}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-[#121212] p-4 rounded-[1.5rem] border border-white/5">
                                            <div className="flex items-center gap-2 mb-2"><Wrench size={12} className="text-white"/><span className="text-[8px] font-black text-zinc-500 uppercase">Serviços</span></div>
                                            <p className="text-xl font-black text-white pl-1">{servicesCount}</p>
                                        </div>
                                        <div className="bg-[#121212] p-4 rounded-[1.5rem] border border-white/5">
                                            <div className="flex items-center gap-2 mb-2"><Car size={12} className="text-red-500"/><span className="text-[8px] font-black text-zinc-500 uppercase">Veículo</span></div>
                                            <p className="text-xs font-black text-white pl-1 uppercase leading-tight truncate">{userVehicle}</p>
                                        </div>
                                    </div>
                                    <button onClick={onExit} className="w-full py-4 bg-red-900/10 border border-red-600/20 rounded-xl text-[9px] font-black uppercase text-red-500 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2">
                                        <LogOut size={14} /> Sair da Conta
                                    </button>
                                </>
                            ) : (
                                <div className="text-center py-20">
                                    <p className="text-zinc-500 text-[10px] font-bold uppercase mb-4">Você está navegando como visitante</p>
                                    <button onClick={onLoginRequest} className="px-6 py-3 bg-white text-black rounded-xl text-[9px] font-black uppercase tracking-widest">Fazer Login</button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* BOOKING WIZARD */}
                    {currentScreen === 'BOOKING' && (
                        <div className="px-5 md:px-8 pb-32">
                            {/* Step 1: Calendar */}
                            {step === 1 && (
                                <div className="space-y-6 animate-in slide-in-from-right-4">
                                    <div className="bg-[#0c0c0c] border border-white/5 p-4 rounded-[2rem]">
                                        <div className="flex items-center justify-between mb-4">
                                            <button onClick={() => changeMonth(-1)}><ChevronLeft size={14} className="text-zinc-500"/></button>
                                            <span className="text-[10px] font-black text-white uppercase tracking-widest">{viewDate.toLocaleString('pt-BR', {month:'long', year:'numeric'})}</span>
                                            <button onClick={() => changeMonth(1)}><ChevronLeft size={14} className="text-zinc-500 rotate-180"/></button>
                                        </div>
                                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                            {calendarDays.map(d => (
                                                <button key={d.dateStr} disabled={!d.isOpen} onClick={() => setSelectedDate(d.dateStr)} className={cn("min-w-[50px] h-[64px] rounded-xl flex flex-col items-center justify-center transition-all", selectedDate === d.dateStr ? "bg-red-600 text-white shadow-glow-red" : !d.isOpen ? "opacity-20 grayscale" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800")}>
                                                    <span className="text-[8px] font-bold uppercase">{d.dayName}</span>
                                                    <span className="text-lg font-black">{d.dayNumber}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-black text-white uppercase mb-4 pl-1">Horários</h3>
                                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                            {availableSlots.length > 0 ? availableSlots.map(t => {
                                                const full = (slotOccupancy[t] || 0) >= businessSettings.box_capacity;
                                                return (
                                                    <button key={t} disabled={full} onClick={() => setSelectedTime(t)} className={cn("py-3 rounded-lg border text-xs font-bold transition-all", full ? "bg-red-900/10 border-red-900/30 text-red-900 cursor-not-allowed" : selectedTime === t ? "bg-white text-black border-white" : "bg-[#121212] border-white/5 text-zinc-400 hover:border-white/20")}>
                                                        {t}
                                                    </button>
                                                )
                                            }) : <p className="col-span-4 text-center text-zinc-600 text-[10px] py-4 uppercase font-bold">Selecione uma data disponível</p>}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Info */}
                            {step === 2 && (
                                <div className="space-y-4 animate-in slide-in-from-right-4">
                                    <h3 className="text-xs font-black text-white uppercase pl-1">Seus Dados</h3>
                                    <input placeholder="Nome Completo" className="w-full bg-[#121212] border border-white/5 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none focus:border-red-600" value={guestForm.name} onChange={e => setGuestForm({...guestForm, name: e.target.value})} />
                                    <input placeholder="Telefone" className="w-full bg-[#121212] border border-white/5 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none focus:border-red-600" value={guestForm.phone} onChange={e => setGuestForm({...guestForm, phone: formatPhone(e.target.value)})} />
                                </div>
                            )}

                            {/* Step 3: Vehicle */}
                            {step === 3 && (
                                <div className="space-y-4 animate-in slide-in-from-right-4">
                                    <h3 className="text-xs font-black text-white uppercase pl-1">Veículo</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <input placeholder="Marca" className="bg-[#121212] border border-white/5 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none focus:border-red-600" value={vehicleForm.brand} onChange={e => setVehicleForm({...vehicleForm, brand: e.target.value})} />
                                        <input placeholder="Modelo" className="bg-[#121212] border border-white/5 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none focus:border-red-600" value={vehicleForm.model} onChange={e => setVehicleForm({...vehicleForm, model: e.target.value})} />
                                    </div>
                                    <input placeholder="Placa" className="w-full bg-[#121212] border border-white/5 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none focus:border-red-600" value={vehicleForm.plate} onChange={e => setVehicleForm({...vehicleForm, plate: formatPlate(e.target.value)})} />
                                </div>
                            )}

                            {/* Step 4: Success (POST-CONVERSION FLOW) */}
                            {step === 4 && (
                                <div className="flex flex-col items-center justify-center py-10 animate-in zoom-in-95 text-center px-4">
                                    <div className="w-20 h-20 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(34,197,94,0.2)]">
                                        <Check size={32} className="text-green-500" />
                                    </div>
                                    <h2 className="text-2xl font-black text-white uppercase mb-2 tracking-tight">Agendamento Confirmado! 🚀</h2>
                                    <p className="text-zinc-400 text-xs font-medium max-w-xs mx-auto leading-relaxed mb-8">
                                        Seu serviço foi agendado para <span className="text-white font-bold">{new Date(selectedDate+'T12:00:00').toLocaleDateString()}</span> às <span className="text-white font-bold">{selectedTime}</span>.
                                    </p>

                                    {/* CONVERSION CARD */}
                                    {!currentUser && (
                                        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 w-full max-w-sm mb-6 relative overflow-hidden group">
                                            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-600 to-red-500" />
                                            <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-3">Acompanhamento em Tempo Real</p>
                                            <p className="text-xs text-white mb-6 leading-relaxed">
                                                Crie sua senha agora para acompanhar o status do serviço e ver o histórico completo.
                                            </p>
                                            <button 
                                                onClick={() => onRegisterRequest && onRegisterRequest({ name: guestForm.name, phone: guestForm.phone })}
                                                className="w-full py-4 bg-white text-black rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all shadow-glow"
                                            >
                                                Criar Conta e Acompanhar <ArrowUpRight size={14} />
                                            </button>
                                        </div>
                                    )}

                                    <button onClick={() => { setCurrentScreen('HOME'); setStep(1); }} className="text-zinc-600 hover:text-white text-[10px] font-bold uppercase tracking-widest py-3 px-6 rounded-xl hover:bg-white/5 transition-all">
                                        Voltar ao Início
                                    </button>
                                </div>
                            )}

                            {/* Action Bar */}
                            {step < 4 && (
                                <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black to-transparent z-50 flex justify-center">
                                    <button 
                                        onClick={() => {
                                            if (step === 1) { if(selectedDate && selectedTime) setStep(2); }
                                            else if (step === 2) { if(guestForm.name && guestForm.phone) setStep(3); }
                                            else if (step === 3) { if(vehicleForm.brand && vehicleForm.model) handleFinalize(); }
                                        }}
                                        disabled={loading || (step === 1 && (!selectedDate || !selectedTime))}
                                        className={cn("w-full max-w-sm py-4 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-glow-red transition-all flex items-center justify-center gap-2", (step === 1 && (!selectedDate || !selectedTime)) ? "bg-zinc-900 text-zinc-600 cursor-not-allowed" : "bg-red-600 text-white hover:bg-red-500")}
                                    >
                                        {loading ? <Loader2 className="animate-spin" size={14}/> : (step === 3 ? "Finalizar" : "Continuar")}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* REVIEW MODAL (OVERLAY) */}
                    {isReviewModalOpen && (
                        <div className="absolute inset-0 z-50 bg-[#020202] p-6 animate-in slide-in-from-bottom-10">
                            <div className="h-full flex flex-col">
                                <div className="flex justify-between items-center mb-8">
                                    <h3 className="text-lg font-black text-white uppercase">Avaliar Experiência</h3>
                                    <button onClick={() => setIsReviewModalOpen(false)} className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-500 hover:text-white"><X size={18}/></button>
                                </div>
                                
                                <form onSubmit={handleSubmitReview} className="flex-1 flex flex-col gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-2">Sua Nota</label>
                                        <div className="flex gap-2 justify-center py-6 bg-[#121212] border border-white/5 rounded-2xl">
                                            {Array.from({length: 5}).map((_, i) => (
                                                <button key={i} type="button" onClick={() => setReviewForm({...reviewForm, rating: i+1})} className="p-1 transition-transform active:scale-90 hover:scale-110">
                                                    <Star size={32} className={i < reviewForm.rating ? "text-yellow-500 fill-yellow-500" : "text-zinc-800 fill-zinc-800"} strokeWidth={1} />
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {!currentUser && (
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-2">Seu Nome</label>
                                            <input required className="w-full bg-[#121212] border border-white/5 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none focus:border-yellow-500/50" value={reviewForm.name} onChange={e => setReviewForm({...reviewForm, name: e.target.value})} placeholder="Como quer ser identificado?" />
                                        </div>
                                    )}

                                    <div className="space-y-2 flex-1">
                                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-2">Comentário</label>
                                        <textarea required className="w-full h-40 bg-[#121212] border border-white/5 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none focus:border-yellow-500/50 resize-none" value={reviewForm.comment} onChange={e => setReviewForm({...reviewForm, comment: e.target.value})} placeholder="Conte como foi o serviço..." />
                                    </div>

                                    <button type="submit" disabled={submittingReview} className="w-full py-4 bg-white text-black rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all">
                                        {submittingReview ? <Loader2 className="animate-spin" size={14}/> : <Send size={14}/>} Enviar Avaliação
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}

                </div>

                {currentScreen !== 'BOOKING' && !isReviewModalOpen && <BottomNav />}
            </div>
        </div>
    );
};
