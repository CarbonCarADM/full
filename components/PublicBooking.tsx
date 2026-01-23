
import React, { useState, useEffect, useRef } from 'react';
import { Check, ChevronLeft, Star, MapPin, Search, Zap, X, User, ArrowRight, Clock, Loader2, CalendarX, History, LayoutGrid, Bell, Phone, Filter, Instagram, Calendar as CalendarIcon, Wrench, Car, LogOut, Key, MessageSquare, Send, Image as ImageIcon, ThumbsUp, Lock, ArrowUpRight, Trophy, Reply, LogIn, UserPlus, AlertCircle, RefreshCw } from 'lucide-react';
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

const getDurationParts = (minutes: number) => {
    if (minutes >= 1440) {
        const days = Math.floor(minutes / 1440);
        return { val: days, unit: 'DIAS', full: `${days} Dias` };
    }
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return { val: h, unit: 'H', full: m > 0 ? `${h}h ${m}m` : `${h}H` };
    return { val: m, unit: 'MIN', full: `${m} min` };
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
    
    const [searchTerm, setSearchTerm] = useState('');
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
    const [showAuthCard, setShowAuthCard] = useState(false);
    const [pendingResume, setPendingResume] = useState<any>(null);
    const [confirmedDetails, setConfirmedDetails] = useState<{date: string, time: string} | null>(null);
    const [currentSlide, setCurrentSlide] = useState(0);

    const filteredServices = services.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (s.description && s.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

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

    useEffect(() => {
        const photos = businessSettings.configs?.studio_photos || [];
        if (photos.length <= 1) return;
        const timer = setInterval(() => { setCurrentSlide(prev => (prev + 1) % photos.length); }, 3000);
        return () => clearInterval(timer);
    }, [businessSettings.configs?.studio_photos]);

    const saveDraft = () => {
        if (selectedService && selectedDate && selectedTime) {
            const draft = { service: selectedService, date: selectedDate, time: selectedTime, guestData: guestForm };
            sessionStorage.setItem('carbon_booking_draft', JSON.stringify(draft));
        }
    };

    const confirmResume = () => {
        if (!pendingResume) return;
        setSelectedService(pendingResume.service);
        setSelectedDate(pendingResume.date);
        setSelectedTime(pendingResume.time);
        setCurrentScreen('BOOKING');
        setStep(3);
        setPendingResume(null);
        sessionStorage.removeItem('carbon_booking_draft');
    };

    const cancelResume = () => { setPendingResume(null); sessionStorage.removeItem('carbon_booking_draft'); };

    useEffect(() => {
        if (currentUser && currentScreen === 'BOOKING' && step === 1 && selectedDate && selectedTime) {
            setStep(3);
        } else if (currentUser && currentScreen === 'BOOKING' && step === 2) {
            setStep(3);
        }
    }, [currentUser, currentScreen, step, selectedDate, selectedTime]);

    useEffect(() => { setShowAuthCard(false); }, [step, currentScreen]);

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

    const fetchRealData = async () => {
        if (!businessSettings.id) return;
        const { data: revs } = await supabase.from('reviews').select('*').eq('business_id', businessSettings.id).order('created_at', { ascending: false });
        if (revs) setDbReviews(revs.map(r => ({ ...r, customerName: r.customer_name, date: r.created_at })) as any);
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
                if (currentUser.user_metadata?.full_name) { setGuestForm(prev => ({ ...prev, name: currentUser.user_metadata.full_name })); setReviewForm(prev => ({ ...prev, name: currentUser.user_metadata.full_name })); }
                if (currentUser.user_metadata?.phone) setGuestForm(prev => ({ ...prev, phone: currentUser.user_metadata.phone }));
            }
        }
    };

    useEffect(() => { fetchRealData(); }, [businessSettings.id, currentUser]);

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
            days.push({ dateStr, dayName: date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase(), dayNumber: String(i).padStart(2, '0'), isOpen: isOpenDay && !isBlocked && !isPast, isPast: isPast });
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
            if (endMins > startMins) { for (let currentMins = startMins; currentMins < endMins; currentMins += interval) slots.push(minutesToTime(currentMins)); }
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
            if (currentUser) setStep(3); else setStep(2);
        } else if (step === 2) {
            if (currentUser) { setStep(3); return; }
            if (!guestForm.name || !guestForm.phone || guestForm.phone.length < 10) { alert("Preencha seus dados."); return; }
            setShowAuthCard(true);
        } else if (step === 3) {
            handleFinalize();
        }
    };

    const handleFinalize = async () => {
        if (!selectedService || !selectedDate || !selectedTime) return;
        setLoading(true);
        const apt: any = { serviceId: selectedService.id, date: selectedDate, time: selectedTime, customerId: identifiedCustomerId, vehicleId: identifiedVehicleId, serviceType: selectedService.name, price: selectedService.price, durationMinutes: selectedService.duration_minutes };
        const customerData = identifiedCustomerId ? undefined : { name: guestForm.name, phone: guestForm.phone, vehicles: [{ brand: vehicleForm.brand, model: vehicleForm.model, plate: vehicleForm.plate }] };
        const success = await onBookingComplete(apt, customerData);
        if (success) { setConfirmedDetails({ date: selectedDate, time: selectedTime }); setStep(4); sessionStorage.removeItem('carbon_booking_draft'); }
        setLoading(false);
    };

    const handleSubmitReview = async (e: React.FormEvent) => {
        e.preventDefault(); 
        if (!businessSettings.id) return;
        setSubmittingReview(true);
        const { data, error } = await supabase.from('reviews').insert({ business_id: businessSettings.id, customer_name: reviewForm.name || 'Anônimo', rating: reviewForm.rating, comment: reviewForm.comment }).select().single();
        if (!error && data) { await fetchRealData(); setIsReviewModalOpen(false); setReviewForm(prev => ({ ...prev, comment: '', rating: 5 })); }
        setSubmittingReview(false);
    };

    const changeMonth = (delta: number) => { const newDate = new Date(viewDate); newDate.setMonth(newDate.getMonth() + delta); setViewDate(newDate); };
    const handleOpenWhatsapp = () => { if (businessSettings.whatsapp) window.open(`https://wa.me/${businessSettings.whatsapp.replace(/\D/g, '')}`, '_blank'); };

    const BottomNav = () => (
        <div className="fixed md:absolute bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-[340px] px-6 md:px-4">
            <div className="bg-[#121212]/90 backdrop-blur-xl border border-white/5 rounded-full h-16 flex items-center justify-evenly shadow-2xl">
                {[{ id: 'HOME', icon: LayoutGrid, label: 'Home' }, { id: 'GALLERY', icon: Search, label: 'Galeria' }, { id: 'AGENDA', icon: CalendarIcon, label: 'Agenda' }, { id: 'PROFILE', icon: User, label: 'Perfil' }].map((item) => (
                    <button key={item.id} onClick={() => setCurrentScreen(item.id as any)} className="relative flex flex-col items-center justify-center w-14 h-full group">
                        <item.icon size={20} className={cn("transition-all duration-300", currentScreen === item.id ? "text-white -translate-y-1" : "text-zinc-500 group-hover:text-zinc-300")} fill={currentScreen === item.id && item.id !== 'GALLERY' && item.id !== 'AGENDA' ? "currentColor" : "none"} />
                        {currentScreen === item.id && <motion.div layoutId="nav-dot" className="absolute bottom-3 w-1 h-1 bg-red-600 rounded-full shadow-[0_0_8px_red]" />}
                    </button>
                ))}
            </div>
        </div>
    );

    if (!businessSettings.id) return <div className="min-h-screen bg-[#020202] flex items-center justify-center p-4"><Loader2 className="w-8 h-8 text-red-600 animate-spin" /></div>;

    return (
        <div className="min-h-screen bg-[#020202] flex flex-col items-center font-sans bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800/40 via-[#050505] to-black relative">
            <style>{`.carbon-card-pattern { background-color: #080808; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='14' viewBox='0 0 8 14'%3E%3Cpath d='M4 0l4 2.3v4.6L4 9.2 0 6.9V2.3z' fill='%23181818'/%3E%3C/svg%3E"); background-size: 8px 14px; } .ribbed-grid-pattern { background-image: repeating-linear-gradient(0deg, transparent, transparent 2px, #000 3px, #000 6px); background-size: 100% 6px; }`}</style>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none" />
            
            <AnimatePresence>
                {pendingResume && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-[#0c0c0c] border border-white/10 rounded-[2rem] w-full max-w-sm p-6 shadow-2xl relative">
                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="w-16 h-16 bg-red-900/10 border border-red-600/20 rounded-full flex items-center justify-center"><History size={32} className="text-red-500" /></div>
                                <div><h3 className="text-lg font-black text-white uppercase mb-2">Continuar?</h3><p className="text-[10px] text-zinc-400">Retomar agendamento anterior?</p></div>
                                <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-4 w-full text-[10px] text-zinc-300"><div className="flex justify-between mb-1"><span>Dia</span><span className="text-white font-black">{new Date(pendingResume.date + 'T12:00:00').toLocaleDateString('pt-BR')}</span></div><div className="flex justify-between"><span>Serviço</span><span className="text-white font-black">{pendingResume.service?.name}</span></div></div>
                                <div className="flex gap-3 w-full"><button onClick={cancelResume} className="flex-1 py-3 text-[10px] uppercase text-zinc-500">Não</button><button onClick={confirmResume} className="flex-1 py-3 bg-white text-black rounded-xl text-[10px] font-black uppercase shadow-glow">Sim</button></div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <div className="w-full max-w-md h-full md:h-[850px] md:my-auto md:rounded-[3rem] bg-[#020202]/50 border-x border-white/5 md:border border-white/5 relative shadow-2xl flex flex-col overflow-hidden backdrop-blur-sm z-10">
                <div className="pt-10 md:pt-12 px-5 md:px-8 pb-4 flex justify-between items-center shrink-0 z-30">
                    {currentScreen === 'BOOKING' || (currentScreen === 'GALLERY' && isReviewModalOpen) ? (
                        <button onClick={() => { if (currentScreen === 'BOOKING') { if (step > 1) setStep(step - 1); else if (step === 2 && showAuthCard) setShowAuthCard(false); else if (step === 2) setStep(1); else setCurrentScreen('HOME'); } else { setIsReviewModalOpen(false); } }} className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white"><ChevronLeft size={18} /></button>
                    ) : (
                        <div><h2 className="text-lg font-black text-white uppercase tracking-tight">{currentScreen === 'HOME' ? `Olá, ${currentUser ? currentUser.user_metadata?.full_name?.split(' ')[0] : 'Visitante'}` : currentScreen}</h2></div>
                    )}
                    <div className="relative">
                        {currentScreen === 'HOME' ? (<button onClick={() => setShowNotifications(!showNotifications)} className="w-10 h-10 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-400">{hasUnread && <span className="absolute top-0 right-0 w-3 h-3 bg-red-600 rounded-full border-2 border-[#020202] animate-pulse" />}<Bell size={18} /></button>) : <div className="w-10" />}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto pb-32 relative">
                    {currentScreen === 'HOME' && (
                        <div className="space-y-6 md:space-y-8 px-5 md:px-8">
                            <div className="bg-[#121212] border border-white/5 rounded-2xl h-12 flex items-center px-4 gap-3 text-zinc-500"><Search size={16} /><input placeholder="Buscar serviço..." className="bg-transparent w-full h-full outline-none text-[10px] font-bold uppercase text-white placeholder:text-zinc-700" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                            
                            <div className="w-full aspect-[1.8/1] rounded-[2rem] relative group overflow-hidden border border-white/10 shadow-2xl">
                                <img src="https://i.postimg.cc/QNy9xgpt/a46bffcccc88cf92ef08d1e542177d1a-(1).jpg" className="absolute inset-0 w-full h-full object-cover opacity-60 z-0 transition-transform duration-700 group-hover:scale-105" />
                                <div className="absolute inset-0 carbon-card-pattern opacity-40 z-0 mix-blend-overlay" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-0" />
                                <div className="absolute inset-0 z-10 flex flex-col justify-between p-6">
                                    <div className="flex justify-between items-start relative z-20">
                                        <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-zinc-900/80 border border-white/10 flex items-center justify-center overflow-hidden backdrop-blur-sm">{businessSettings.profile_image_url ? <img src={businessSettings.profile_image_url} className="w-full h-full object-cover" /> : <span className="text-xl font-black text-white">{businessSettings.business_name.charAt(0)}</span>}</div><div><h3 className="text-sm font-black text-white uppercase tracking-wider">{businessSettings.business_name}</h3><p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">Estética Automotiva</p></div></div>
                                        <button onClick={handleOpenWhatsapp} className="w-10 h-10 rounded-full bg-green-900/30 border border-green-500/30 flex items-center justify-center text-green-500"><Phone size={16} /></button>
                                    </div>
                                    <div className="relative z-20 space-y-2"><div className="flex items-center gap-2 mb-1"><div className={cn("w-2 h-2 rounded-full animate-pulse", isOpenNow ? "bg-green-500" : "bg-red-500")} /><span className={cn("text-[9px] font-bold uppercase tracking-widest", isOpenNow ? "text-green-500" : "text-red-500")}>{isOpenNow ? "Aberto" : "Fechado"}</span></div><div className="flex items-center gap-2 text-zinc-300"><Instagram size={12} /><span className="text-[9px] font-bold uppercase">{businessSettings.configs?.instagram || '@carboncar'}</span></div><div className="flex items-start gap-2 text-zinc-300"><MapPin size={12} className="shrink-0 mt-0.5" /><span className="text-[9px] font-bold uppercase leading-tight max-w-[90%]">{businessSettings.address || 'Endereço N/A'}</span></div></div>
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
                                            <div key={s.id} className="group relative h-[190px] w-full overflow-hidden rounded-[20px] bg-zinc-950 shadow-2xl border border-white/10 transition-transform duration-500 hover:-translate-y-1">
                                                <div className="absolute inset-0 z-0 ribbed-grid-pattern opacity-30" />
                                                {serviceImg ? (
                                                    <img src={serviceImg} alt={s.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-100" />
                                                ) : (
                                                    <div className="absolute inset-0 w-full h-full flex items-center justify-center opacity-20"><Car size={40} className="text-zinc-700" /></div>
                                                )}
                                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent/20" />
                                                <div className="absolute top-2 inset-x-2 z-20 flex justify-between items-center bg-black/40 backdrop-blur-xl border border-white/10 rounded-[14px] py-2 px-3">
                                                     <div className="flex flex-col"><span className="text-[5px] font-bold text-zinc-400 uppercase leading-none mb-0.5">Tempo</span><span className="text-[8px] font-black text-white uppercase">{dur.full}</span></div>
                                                     <div className="flex flex-col items-end"><span className="text-[5px] font-bold text-zinc-400 uppercase leading-none mb-0.5">Valor</span><span className="text-[8px] font-black text-white">R$ {Number(s.price).toFixed(0)}</span></div>
                                                </div>
                                                <div className="absolute bottom-0 inset-x-0 p-3 z-20 flex flex-col justify-end h-full">
                                                    <div className="mb-2 text-center"><h3 className="text-[9px] font-black text-white uppercase leading-tight mb-1">{s.name}</h3>{s.description && <p className="text-[6px] text-zinc-300 font-medium leading-tight line-clamp-2 opacity-70">{s.description}</p>}</div>
                                                    <button onClick={() => { setSelectedService(s); setCurrentScreen('BOOKING'); setStep(1); }} className="w-full py-2 bg-white hover:bg-zinc-200 text-black rounded-xl font-black uppercase tracking-[0.2em] text-[7px] shadow-glow">Agendar</button>
                                                </div>
                                            </div>
                                        );
                                    }) : <div className="col-span-2 py-10 text-center text-zinc-500 text-[10px] font-bold uppercase">Nenhum serviço</div>}
                                </div>
                            </div>
                        </div>
                    )}

                    {currentScreen === 'GALLERY' && (
                        <div className="px-5 md:px-8">
                            <div className="flex bg-[#121212] p-1 rounded-xl border border-white/5 mb-6"><button onClick={() => setGalleryTab('PHOTOS')} className={cn("flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all", galleryTab === 'PHOTOS' ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white")}>Showroom</button><button onClick={() => setGalleryTab('REVIEWS')} className={cn("flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all", galleryTab === 'REVIEWS' ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white")}>Avaliações</button></div>
                            {galleryTab === 'PHOTOS' ? (<div className="grid grid-cols-2 gap-3">{portfolio.map((item) => <div key={item.id} className="aspect-[4/5] bg-zinc-900 rounded-2xl overflow-hidden relative group"><img src={item.imageUrl} className="w-full h-full object-cover group-hover:scale-110 duration-700" /><div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 flex items-end p-4"><p className="text-[9px] text-white font-bold uppercase">{item.description}</p></div></div>)}</div>) : (<div className="space-y-4"><button onClick={() => setIsReviewModalOpen(true)} className="w-full py-4 bg-zinc-900 border border-white/10 rounded-2xl text-zinc-400 text-[10px] font-black uppercase tracking-widest">Avaliar Experiência</button><div className="space-y-3">{dbReviews.map(review => <div key={review.id} className="bg-[#121212] border border-white/5 p-4 rounded-2xl"><div className="flex justify-between mb-2"><p className="text-[10px] font-black text-white uppercase">{review.customerName}</p><div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={10} className={i < review.rating ? "text-yellow-500 fill-yellow-500" : "text-zinc-800 fill-zinc-800"} />)}</div></div><p className="text-[10px] text-zinc-400 italic">"{review.comment}"</p></div>)}</div></div>)}
                        </div>
                    )}

                    {currentScreen === 'BOOKING' && (
                        <div className="px-5 md:px-8 pb-32">
                            {step === 1 && (
                                <div className="space-y-6 animate-in slide-in-from-right-4">
                                    {/* SELECTED SERVICE CARD PREVIEW (GLASSMORPHISM) */}
                                    {selectedService && (
                                        <div className="relative overflow-hidden bg-white/5 backdrop-blur-3xl rounded-[2.5rem] p-6 mb-6 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] animate-in slide-in-from-top-4 duration-700">
                                            {/* Upper Highlight Line */}
                                            <div className="absolute top-0 inset-x-0 h-[0.5px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                                            
                                            <div className="flex justify-between items-center mb-5 relative z-10">
                                                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.3em]">Serviço Selecionado</span>
                                                <button 
                                                    onClick={() => { setCurrentScreen('HOME'); setStep(1); setSelectedService(null); }} 
                                                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600/10 border border-red-500/20 text-red-500 text-[8px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all active:scale-95"
                                                >
                                                    <RefreshCw size={10} /> Alterar
                                                </button>
                                            </div>

                                            <div className="flex items-center gap-5 relative z-10">
                                                {/* Image Container with depth */}
                                                <div className="w-16 h-16 rounded-2xl bg-zinc-950 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-2xl relative group">
                                                    {businessSettings.configs?.service_images?.[selectedService.id] || selectedService.image_url ? (
                                                        <img 
                                                            src={businessSettings.configs?.service_images?.[selectedService.id] || selectedService.image_url} 
                                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                                                            alt={selectedService.name} 
                                                        />
                                                    ) : (
                                                        <Wrench className="text-zinc-700" size={24} />
                                                    )}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-sm font-black text-white uppercase truncate leading-tight mb-1.5 tracking-tight">{selectedService.name}</h4>
                                                    <div className="flex items-center gap-2">
                                                        <Clock size={10} className="text-red-600" />
                                                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.15em]">{getDurationParts(selectedService.duration_minutes).full}</p>
                                                    </div>
                                                </div>

                                                <div className="text-right">
                                                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5 opacity-60">Total</p>
                                                    <p className="text-2xl font-black text-white tabular-nums tracking-tighter leading-none shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                                                        <span className="text-[10px] mr-1 text-zinc-500">R$</span>
                                                        {Number(selectedService.price).toFixed(0)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-[#0c0c0c] border border-white/5 p-4 rounded-[2rem]">
                                        <div className="flex items-center justify-between mb-4">
                                            <button onClick={() => changeMonth(-1)}><ChevronLeft size={14} className="text-zinc-500" /></button>
                                            <span className="text-[10px] font-black text-white uppercase">{viewDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</span>
                                            <button onClick={() => changeMonth(1)}><ChevronLeft size={14} className="text-zinc-500 rotate-180" /></button>
                                        </div>
                                        <div className="flex gap-2 overflow-x-auto pb-2">{calendarDays.map(d => <button key={d.dateStr} disabled={!d.isOpen} onClick={() => setSelectedDate(d.dateStr)} className={cn("min-w-[50px] h-[64px] rounded-xl flex flex-col items-center justify-center transition-all", selectedDate === d.dateStr ? "bg-red-600 text-white shadow-glow-red" : !d.isOpen ? "opacity-20" : "bg-zinc-900 text-zinc-400")}><span className="text-[8px] font-bold uppercase">{d.dayName}</span><span className="text-lg font-black">{d.dayNumber}</span></button>)}</div>
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-black text-white uppercase mb-4">Horários</h3>
                                        <div className="grid grid-cols-3 gap-2">{availableSlots.map(t => { const full = (slotOccupancy[t] || 0) >= businessSettings.box_capacity; return <button key={t} disabled={full} onClick={() => setSelectedTime(t)} className={cn("py-3 rounded-lg border text-xs font-bold transition-all", full ? "bg-red-900/10 border-red-900/30 text-red-900" : selectedTime === t ? "bg-white text-black" : "bg-[#121212] border-white/5 text-zinc-400")}>{t}</button> })}</div>
                                    </div>
                                </div>
                            )}
                            {step === 2 && !identifiedCustomerId && !currentUser && (<div className="space-y-4 animate-in slide-in-from-right-4"><h3 className="text-xs font-black text-white uppercase">Seus Dados</h3><input placeholder="Nome Completo" className="w-full bg-[#121212] border border-white/5 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none focus:border-red-600" value={guestForm.name} onChange={e => setGuestForm({ ...guestForm, name: e.target.value })} /><input placeholder="Telefone" className="w-full bg-[#121212] border border-white/5 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none focus:border-red-600" value={guestForm.phone} onChange={e => setGuestForm({ ...guestForm, phone: formatPhone(e.target.value) })} />{showAuthCard && (<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 p-6 rounded-2xl bg-zinc-900/60 backdrop-blur-xl border border-white/10 shadow-2xl flex flex-col items-center text-center space-y-4"><Lock size={18} className="text-white" /><p className="text-[10px] font-bold text-zinc-300 uppercase leading-relaxed">Para continuar, entre ou crie sua conta:</p><div className="flex gap-3 w-full"><button onClick={() => { saveDraft(); onLoginRequest && onLoginRequest(); }} className="flex-1 py-3 bg-zinc-800 text-white rounded-xl text-[9px] font-black uppercase">Entrar</button><button onClick={() => { saveDraft(); onRegisterRequest && onRegisterRequest(guestForm); }} className="flex-1 py-3 bg-white text-black rounded-xl text-[9px] font-black uppercase">Criar Conta</button></div></motion.div>)}</div>)}
                            {step === 3 && (<div className="space-y-4 animate-in slide-in-from-right-4"><h3 className="text-xs font-black text-white uppercase">Veículo</h3><div className="grid grid-cols-2 gap-3"><input placeholder="Marca" className="bg-[#121212] border border-white/5 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none" value={vehicleForm.brand} onChange={e => setVehicleForm({ ...vehicleForm, brand: e.target.value })} /><input placeholder="Modelo" className="bg-[#121212] border border-white/5 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none" value={vehicleForm.model} onChange={e => setVehicleForm({ ...vehicleForm, model: e.target.value })} /></div><input placeholder="Placa" className="w-full bg-[#121212] border border-white/5 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none" value={vehicleForm.plate} onChange={e => setVehicleForm({ ...vehicleForm, plate: formatPlate(e.target.value) })} /></div>)}
                            {step === 4 && (<div className="flex flex-col items-center justify-center py-10 text-center"><div className="w-20 h-20 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mb-6"><Check size={32} className="text-green-500" /></div><h2 className="text-2xl font-black text-white uppercase mb-2">Confirmado! 🚀</h2><p className="text-zinc-400 text-xs mb-8">Data: <span className="text-white">{new Date((confirmedDetails?.date || selectedDate) + 'T12:00:00').toLocaleDateString()}</span> às <span className="text-white">{confirmedDetails?.time || selectedTime}</span>.</p><button onClick={() => { setCurrentScreen('HOME'); setStep(1); }} className="text-zinc-600 hover:text-white text-[10px] font-bold uppercase tracking-widest">Voltar ao Início</button></div>)}
                            {step < 4 && !showAuthCard && (<div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black to-transparent z-50 flex justify-center"><button onClick={handleContinueAction} disabled={loading || (step === 1 && (!selectedDate || !selectedTime))} className={cn("w-full max-w-sm py-4 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all", (step === 1 && (!selectedDate || !selectedTime)) ? "bg-zinc-900 text-zinc-600" : "bg-red-600 text-white shadow-glow-red")}>{loading ? <Loader2 className="animate-spin" size={14} /> : (step === 3 ? "Finalizar" : "Continuar")}</button></div>)}
                        </div>
                    )}
                </div>
                {currentScreen !== 'BOOKING' && !isReviewModalOpen && <BottomNav />}
            </div>
        </div>
    );
};
