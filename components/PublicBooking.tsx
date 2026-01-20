
import React, { useState, useEffect, useMemo } from 'react';
import { Check, ChevronLeft, Star, MapPin, Search, Zap, X, User, ArrowRight, Clock, Loader2, CalendarX, History, LayoutGrid, Bell, Play, MessageSquare, LogOut, Key, Building2, Phone, Filter, Instagram, ExternalLink, Calendar as CalendarIcon, Wallet, Lock, Car, Wrench, AlertTriangle, Save, ChevronRight as ChevronRightIcon, Ban, Info } from 'lucide-react';
import { BusinessSettings, ServiceItem, Appointment, PortfolioItem, Review, AppointmentStatus } from '../types';
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
}

interface CalendarDay {
    dateStr: string;
    dayName: string;
    dayNumber: string;
    isOpen: boolean;
    isPast: boolean;
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

export const PublicBooking: React.FC<PublicBookingProps> = ({ 
    currentUser, businessSettings, services, portfolio, 
    existingAppointments = [],
    onBookingComplete, onExit, onLoginRequest
}) => {
    // --- STATE ---
    const [currentScreen, setCurrentScreen] = useState<'HOME' | 'BOOKING' | 'PROFILE' | 'GALLERY' | 'AGENDA'>('HOME');
    const [step, setStep] = useState(1); // Booking Step
    const [loading, setLoading] = useState(false);
    const [agendaTab, setAgendaTab] = useState<'UPCOMING' | 'HISTORY'>('UPCOMING');
    
    // Booking Data
    // FIX: Typing as any to prevent TS2339
    const [selectedService, setSelectedService] = useState<any>(null);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedTime, setSelectedTime] = useState<string>(''); 
    const [guestForm, setGuestForm] = useState({ name: '', phone: '' });
    const [vehicleForm, setVehicleForm] = useState({ brand: '', model: '', plate: '' });
    
    // Calendar State
    const [viewDate, setViewDate] = useState(new Date());

    // UI Helpers
    const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    
    // MULTI-BOX STATE
    const [slotOccupancy, setSlotOccupancy] = useState<Record<string, number>>({}); // Armazena contagem exata por slot
    
    const [userVehicle, setUserVehicle] = useState<string>('---');
    const [servicesCount, setServicesCount] = useState(0);

    // Password Modal State
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
    const [passwordStatus, setPasswordStatus] = useState<'IDLE' | 'SAVING' | 'SUCCESS' | 'ERROR'>('IDLE');
    const [passwordFeedback, setPasswordFeedback] = useState('');

    // Real Data
    // FIX: Typing as any[] to prevent TS2339
    const [dbReviews, setDbReviews] = useState<any[]>([]);
    const [dbUserAppointments, setDbUserAppointments] = useState<any[]>([]);
    
    // --- EFFECTS ---
    
    // 1. Gera o Calendário Baseado no Mês Selecionado (viewDate)
    useEffect(() => {
        const days: CalendarDay[] = [];
        const opDays = businessSettings.operating_days || [];
        const blockedDates = businessSettings.blocked_dates || [];
        
        // Data atual real para comparação (evitar agendar no passado)
        const realToday = new Date();
        realToday.setHours(0, 0, 0, 0);

        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        
        // Quantos dias tem no mês atual
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let i = 1; i <= daysInMonth; i++) {
            // Cria data em UTC para garantir a string correta YYYY-MM-DD
            // Mas usa setFullYear/Month/Date locais para evitar pular dia
            const date = new Date(year, month, i);
            
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${d}`;
            
            const dayOfWeek = date.getDay(); // 0 = Domingo

            // Verifica se está aberto neste dia da semana
            const rule = opDays.find(r => r.dayOfWeek === dayOfWeek);
            const isOpenDay = rule ? rule.isOpen : false; 

            // Verifica bloqueios manuais (Feriados)
            const isBlocked = blockedDates.some(bd => bd.date === dateStr);
            
            // Verifica se é passado
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
        
        // Auto-seleciona o primeiro dia disponível se a data atual não estiver no mês visível
        // Ou se nenhum dia estiver selecionado
        if (!selectedDate || new Date(selectedDate).getMonth() !== month) {
             const firstAvailable = days.find(d => d.isOpen);
             if (firstAvailable) setSelectedDate(firstAvailable.dateStr);
             else setSelectedDate('');
        }
    }, [businessSettings, viewDate]);

    // 2. Gera Slots de Horário e Verifica Disponibilidade Real (SIMPLE STRING MATCH)
    useEffect(() => {
        if (!selectedDate || !businessSettings.id) return;

        const fetchAndGenerateSlots = async () => {
            // Lógica para determinar o dia da semana da data selecionada
            const [y, m, d] = selectedDate.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d); 
            const dayOfWeek = dateObj.getDay();
            
            const rule = businessSettings.operating_days?.find(r => r.dayOfWeek === dayOfWeek);

            // 2.1. Gera a grade base de horários (Slots Teóricos)
            if (!rule || !rule.isOpen) {
                setAvailableSlots([]);
                setSlotOccupancy({});
                return;
            }

            const slots: string[] = [];
            const interval = businessSettings.slot_interval_minutes || 60;
            
            // Lógica MATEMÁTICA de geração de horário (Minutos desde 00:00)
            const startMins = timeToMinutes(rule.openTime); 
            const endMins = timeToMinutes(rule.closeTime);

            for (let currentMins = startMins; currentMins < endMins; currentMins += interval) {
                slots.push(minutesToTime(currentMins));
            }
            
            setAvailableSlots(slots);

            // 2.2. Busca Agendamentos Reais no Banco
            const { data: busyData, error } = await supabase
                .from('appointments')
                .select('time')
                .eq('business_id', businessSettings.id)
                .eq('date', selectedDate)
                .neq('status', 'CANCELADO');

            if (error) {
                console.error("Erro ao buscar disponibilidade:", error);
                return;
            }

            const occupancyMap: Record<string, number> = {};

            if (busyData) {
                slots.forEach(slotTime => {
                    const count = busyData.filter(apt => {
                        if (!apt.time) return false;
                        const aptTimeShort = apt.time.slice(0, 5); 
                        return aptTimeShort === slotTime;
                    }).length;

                    occupancyMap[slotTime] = count;
                });
            }

            setSlotOccupancy(occupancyMap);
        };

        fetchAndGenerateSlots();
        setSelectedTime(''); // Reseta horário ao trocar dia
    }, [selectedDate, businessSettings]);


    useEffect(() => {
        const fetchRealData = async () => {
            if (!businessSettings.id) return;

            // Reviews
            const { data: revs } = await supabase.from('reviews').select('*').eq('business_id', businessSettings.id).order('created_at', { ascending: false });
            if (revs) setDbReviews(revs as any);

            // User History & Profile Data
            if (currentUser) {
                const { data: customer } = await supabase
                    .from('customers')
                    .select('id, name, phone, vehicles(*)')
                    .eq('business_id', businessSettings.id)
                    .eq('email', currentUser.email)
                    .maybeSingle();

                if (customer) {
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
                    }
                    if (currentUser.user_metadata?.phone) {
                        setGuestForm(prev => ({ ...prev, phone: currentUser.user_metadata.phone }));
                    }
                }
            }
        };
        fetchRealData();
    }, [businessSettings.id, currentUser, currentScreen]);

    // --- COMPUTED DATA ---
    const upcomingAppointments = dbUserAppointments.filter(a => a.status !== 'FINALIZADO' && a.status !== 'CANCELADO');
    const historyAppointments = dbUserAppointments.filter(a => a.status === 'FINALIZADO' || a.status === 'CANCELADO');

    // --- HANDLERS ---
    const changeMonth = (delta: number) => {
        const newDate = new Date(viewDate);
        newDate.setMonth(newDate.getMonth() + delta);
        
        // Bloqueio opcional: não voltar para meses anteriores ao atual
        const today = new Date();
        if (newDate.getMonth() < today.getMonth() && newDate.getFullYear() <= today.getFullYear()) {
            // Se quiser permitir voltar para ver histórico, remova este if
            // Mas para booking, geralmente não queremos ir muito para trás
            // return; 
        }
        
        setViewDate(newDate);
    };

    const startBooking = (service: ServiceItem) => {
        setSelectedService(service);
        setCurrentScreen('BOOKING');
        setStep(1);
    };

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

    const handleSaveNewPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordStatus('SAVING');
        setPasswordFeedback('');

        if (passwordForm.newPassword.length < 6) {
            setPasswordStatus('ERROR');
            setPasswordFeedback('A senha deve ter no mínimo 6 caracteres.');
            return;
        }

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setPasswordStatus('ERROR');
            setPasswordFeedback('As senhas não coincidem.');
            return;
        }

        try {
            const { error } = await supabase.auth.updateUser({ password: passwordForm.newPassword });
            if (error) throw error;
            
            setPasswordStatus('SUCCESS');
            setPasswordFeedback('Senha atualizada com sucesso!');
            setTimeout(() => {
                setIsChangePasswordOpen(false);
                setPasswordStatus('IDLE');
                setPasswordForm({ newPassword: '', confirmPassword: '' });
                setPasswordFeedback('');
            }, 1500);
        } catch (error: any) {
            setPasswordStatus('ERROR');
            setPasswordFeedback(error.message || 'Erro ao atualizar senha.');
        }
    };

    const handleOpenWhatsapp = () => {
        if (businessSettings.whatsapp) {
            window.open(`https://wa.me/${businessSettings.whatsapp.replace(/\D/g, '')}`, '_blank');
        }
    };

    // --- LOADING STATE ---
    if (!businessSettings.id) {
        return (
            <div className="min-h-screen bg-[#020202] flex items-center justify-center font-sans p-4">
                <div className="flex flex-col items-center gap-6">
                    <Loader2 className="w-10 h-10 text-red-600 animate-spin" />
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">Carregando Hangar...</p>
                    <button onClick={onExit} className="px-6 py-3 bg-zinc-900 border border-white/10 rounded-xl text-[9px] font-bold text-zinc-400 hover:text-white uppercase tracking-widest transition-all">Sair / Cancelar</button>
                </div>
            </div>
        );
    }

    // --- COMPONENTS ---
    const BottomNav = () => (
        <div className="absolute bottom-6 inset-x-6 z-40">
            <div className="bg-[#121212]/90 backdrop-blur-xl border border-white/5 rounded-[2rem] h-20 px-6 flex items-center justify-between shadow-2xl">
                <button onClick={() => setCurrentScreen('HOME')} className={cn("flex flex-col items-center gap-1 transition-all", currentScreen === 'HOME' ? "text-white scale-110" : "text-zinc-600 hover:text-white")}>
                    <LayoutGrid size={20} fill={currentScreen === 'HOME' ? "currentColor" : "none"} />
                    <span className="text-[9px] font-bold uppercase tracking-wider">Home</span>
                </button>
                <button onClick={() => setCurrentScreen('GALLERY')} className={cn("flex flex-col items-center gap-1 transition-all", currentScreen === 'GALLERY' ? "text-white scale-110" : "text-zinc-600 hover:text-white")}>
                    <Search size={20} />
                    <span className="text-[9px] font-bold uppercase tracking-wider">Galeria</span>
                </button>
                <div className="relative -top-6">
                    <button onClick={() => { setSelectedService(null); setCurrentScreen('BOOKING'); setStep(1); }} className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center text-white shadow-[0_10px_30px_rgba(220,38,38,0.5)] border-4 border-[#020202] hover:scale-105 transition-transform">
                        <Zap size={24} fill="currentColor" />
                    </button>
                </div>
                <button onClick={() => setCurrentScreen('AGENDA')} className={cn("flex flex-col items-center gap-1 transition-all", currentScreen === 'AGENDA' ? "text-white scale-110" : "text-zinc-600 hover:text-white")}>
                    <CalendarIcon size={20} />
                    <span className="text-[9px] font-bold uppercase tracking-wider">Agenda</span>
                </button>
                <button onClick={() => setCurrentScreen('PROFILE')} className={cn("flex flex-col items-center gap-1 transition-all", currentScreen === 'PROFILE' ? "text-white scale-110" : "text-zinc-600 hover:text-white")}>
                    <User size={20} fill={currentScreen === 'PROFILE' ? "currentColor" : "none"} />
                    <span className="text-[9px] font-bold uppercase tracking-wider">Perfil</span>
                </button>
            </div>
        </div>
    );

    // --- SCREEN: HOME ---
    if (currentScreen === 'HOME') {
        return (
            <div className="min-h-screen bg-[#020202] flex items-center justify-center font-sans p-4">
                <div className="w-full max-w-[450px] h-screen md:h-[850px] md:rounded-[3rem] bg-[#020202] border border-white/5 overflow-hidden relative shadow-2xl flex flex-col">
                    
                    {/* Header */}
                    <div className="pt-12 px-8 pb-6 flex justify-between items-start">
                        <div>
                            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 mb-1">
                                <MapPin size={10} className="text-red-600" /> {businessSettings.address ? businessSettings.address.split(',')[0] : 'Brasil'}
                            </p>
                            <h2 className="text-xl font-black text-white uppercase tracking-tight">
                                Olá, {currentUser ? currentUser.email?.split('@')[0] : 'Visitante'}
                            </h2>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center relative">
                            {businessSettings.profile_image_url ? (
                                <img src={businessSettings.profile_image_url} className="w-full h-full rounded-full object-cover" />
                            ) : (
                                <Bell size={18} className="text-white" />
                            )}
                            <div className="absolute top-2 right-2 w-2 h-2 bg-red-600 rounded-full border border-black" />
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar pb-32 space-y-8">
                        
                        {/* Search Bar */}
                        <div className="px-8">
                            <div className="bg-[#121212] border border-white/5 rounded-2xl h-14 flex items-center px-4 gap-3 text-zinc-500">
                                <Search size={20} />
                                <input placeholder="Buscar serviço..." className="bg-transparent w-full h-full outline-none text-xs font-bold uppercase text-white placeholder:text-zinc-700" />
                                <Filter size={18} />
                            </div>
                        </div>

                        {/* BUSINESS CARD (Holographic Premium) */}
                        <div className="px-8 perspective-1000">
                            <div className="w-full aspect-[1.8/1] rounded-[2.5rem] relative group transition-all duration-500 hover:scale-[1.02]">
                                
                                {/* Animated Border Gradient (Pseudo-border) */}
                                <div className="absolute -inset-[1px] rounded-[2.5rem] bg-gradient-to-br from-white/20 via-white/5 to-transparent opacity-50 blur-[1px]" />
                                
                                {/* Main Glass Container */}
                                <div className="absolute inset-0 rounded-[2.5rem] bg-[#050505]/80 backdrop-blur-2xl overflow-hidden flex flex-col justify-between p-7 border border-white/5 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)]">
                                    
                                    {/* 1. Texture & Atmosphere */}
                                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.07] mix-blend-overlay pointer-events-none" />
                                    
                                    {/* Ambient Red Glow (Top Right) */}
                                    <div className="absolute -top-[20%] -right-[20%] w-[70%] h-[70%] bg-red-600/10 blur-[80px] rounded-full pointer-events-none group-hover:bg-red-600/20 transition-all duration-700" />
                                    
                                    {/* Subtle Shine (Top Left) */}
                                    <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-white/5 blur-[60px] rounded-full pointer-events-none" />

                                    {/* 2. Top Section */}
                                    <div className="flex justify-between items-start relative z-10">
                                        <div className="flex items-center gap-5">
                                            {/* Avatar Squircle */}
                                            <div className="w-14 h-14 rounded-2xl bg-zinc-900/50 backdrop-blur-md border border-white/10 flex items-center justify-center overflow-hidden shadow-inner group-hover:border-white/20 transition-colors">
                                                    {businessSettings.profile_image_url ? (
                                                    <img src={businessSettings.profile_image_url} className="w-full h-full object-cover" />
                                                    ) : (
                                                    <span className="text-xl font-black text-white">{businessSettings.business_name.charAt(0)}</span>
                                                    )}
                                            </div>
                                            
                                            {/* Titles */}
                                            <div>
                                                <h3 className="text-lg font-black text-white uppercase tracking-wider drop-shadow-sm">{businessSettings.business_name}</h3>
                                                <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-[0.3em] mt-0.5">Estética Automotiva</p>
                                            </div>
                                        </div>

                                        {/* Glass Button (Call) */}
                                        <div 
                                            onClick={handleOpenWhatsapp} 
                                            className="cursor-pointer w-12 h-12 rounded-full bg-black/20 backdrop-blur-md border border-white/10 flex items-center justify-center text-green-500 shadow-[inset_0_0_15px_rgba(0,0,0,1)] hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:border-green-500/30 hover:bg-green-500/10 hover:text-green-400 transition-all duration-300 group/btn"
                                        >
                                            <Phone size={18} className="drop-shadow-[0_0_5px_rgba(34,197,94,0.5)] group-hover/btn:scale-110 transition-transform" />
                                        </div>
                                    </div>

                                    {/* 3. Bottom Section (Info) */}
                                    <div className="relative z-10 space-y-3 pl-1">
                                        {/* Instagram */}
                                        <div className="flex items-center gap-4 group/item">
                                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5 group-hover/item:border-white/20 transition-colors">
                                                <Instagram size={14} className="text-zinc-400 group-hover/item:text-white transition-colors" />
                                            </div>
                                            <div>
                                                <span className="block text-[8px] font-black text-zinc-600 uppercase tracking-widest">Instagram</span>
                                                <span className="text-[10px] font-bold text-zinc-300 tracking-wider">
                                                    {businessSettings.configs?.instagram || '@' + businessSettings.business_name.replace(/\s+/g, '').toLowerCase()}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Location */}
                                        <div className="flex items-center gap-4 group/item">
                                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5 group-hover/item:border-white/20 transition-colors">
                                                <MapPin size={14} className="text-zinc-400 group-hover/item:text-white transition-colors" />
                                            </div>
                                            <div>
                                                <span className="block text-[8px] font-black text-zinc-600 uppercase tracking-widest">Localização</span>
                                                <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider truncate max-w-[200px] block">
                                                    {businessSettings.address ? businessSettings.address.split(',')[0] : "Endereço não informado"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Bottom Gradient Border Accent */}
                                    <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50" />
                                </div>
                            </div>
                        </div>

                        {/* Services Grid */}
                        <div className="px-8">
                            <div className="flex justify-between items-end mb-6">
                                <h3 className="text-lg font-black text-white uppercase">Serviços</h3>
                                <button className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Ver Todos</button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {services.length === 0 && <p className="col-span-2 text-zinc-500 text-xs text-center py-10">Nenhum serviço disponível</p>}
                                {services.map((s: ServiceItem) => (
                                    <button 
                                        key={s.id}
                                        onClick={() => startBooking(s)} 
                                        className="bg-[#121212] hover:bg-[#181818] border border-white/5 p-5 rounded-[2rem] flex flex-col items-start gap-4 transition-all active:scale-95 group"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center group-hover:bg-red-600 transition-colors">
                                            <Zap size={18} className="text-white" fill="currentColor" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black text-white uppercase leading-tight mb-1 text-left">{s.name}</h4>
                                            <p className="text-[10px] text-zinc-500 font-bold uppercase text-left">{s.duration_minutes} min</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <BottomNav />
                </div>
            </div>
        );
    }

    // --- SCREEN: BOOKING FLOW ---
    if (currentScreen === 'BOOKING') {
        return (
            <div className="min-h-screen bg-[#020202] flex items-center justify-center font-sans p-4">
                <div className="w-full max-w-[450px] h-screen md:h-[850px] md:rounded-[3rem] bg-[#020202] border border-white/5 overflow-hidden relative shadow-2xl flex flex-col">
                    
                    {/* Top Bar */}
                    <div className="pt-12 px-8 pb-4 flex items-center justify-between">
                         <button onClick={() => { if(step > 1) setStep(step-1); else setCurrentScreen('HOME'); }} className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white hover:bg-white/5">
                             <ChevronLeft size={20} />
                         </button>
                         <h2 className="text-sm font-black text-white uppercase tracking-widest">Agendamento</h2>
                         <div className="w-10" />
                    </div>

                    {step === 4 ? (
                        /* SUCCESS SCREEN */
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center animate-in zoom-in-95 duration-500">
                             <div className="w-32 h-32 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/20 mb-8 relative">
                                 <div className="absolute inset-0 bg-green-500/20 blur-xl rounded-full" />
                                 <Check size={48} className="text-green-500 relative z-10" strokeWidth={3} />
                             </div>
                             <h2 className="text-3xl font-black text-white uppercase mb-4 tracking-tight">Confirmado!</h2>
                             <p className="text-zinc-500 text-xs font-medium leading-relaxed mb-12">
                                 Seu agendamento para <strong>{selectedService?.name}</strong> foi realizado com sucesso.
                                 <br/>Data: {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')} às {selectedTime}.
                             </p>
                             <button onClick={() => { setCurrentScreen('HOME'); setStep(1); }} className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-zinc-200 transition-all">
                                 Voltar para Home
                             </button>
                        </div>
                    ) : (
                        /* FORM CONTENT */
                        <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-4 space-y-8">
                            
                            {/* Step 1: Calendar & Time (REDESIGNED) */}
                            {step === 1 && (
                                <div className="space-y-8 animate-in slide-in-from-right-4">
                                    
                                    {/* CALENDAR STRIP */}
                                    <div className="relative isolate">
                                        {/* Cinematic Glow Behind */}
                                        <div className="absolute inset-0 bg-red-600/5 blur-[40px] rounded-[3rem] pointer-events-none" />
                                        
                                        <div className="bg-[#0c0c0c]/80 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/5 relative overflow-hidden">
                                            {/* Noise Texture */}
                                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none" />
                                            
                                            {/* Header */}
                                            <div className="flex items-center justify-between mb-6">
                                                <button onClick={() => changeMonth(-1)} className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
                                                    <ChevronLeft size={16} />
                                                </button>
                                                <p className="text-[10px] font-black text-zinc-300 uppercase tracking-[0.3em]">
                                                    {viewDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
                                                </p>
                                                <button onClick={() => changeMonth(1)} className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
                                                    <ChevronRightIcon size={16} />
                                                </button>
                                            </div>

                                            {/* Dates Scroll */}
                                            <div className="flex justify-between items-center overflow-x-auto pb-4 scrollbar-hide gap-3 snap-x snap-mandatory">
                                                {calendarDays.map((day) => {
                                                    const isSelected = selectedDate === day.dateStr;
                                                    const isBlocked = !day.isOpen;

                                                    return (
                                                        <motion.button 
                                                            key={day.dateStr}
                                                            onClick={() => { if(!isBlocked) setSelectedDate(day.dateStr); }}
                                                            whileTap={{ scale: 0.95 }}
                                                            className={cn(
                                                                "relative flex flex-col items-center justify-center min-w-[64px] h-[84px] rounded-2xl transition-all snap-center",
                                                                isBlocked ? "opacity-20 cursor-not-allowed grayscale" : "cursor-pointer"
                                                            )}
                                                            disabled={isBlocked}
                                                        >
                                                            {isSelected && (
                                                                <motion.div 
                                                                    layoutId="activeDateBg"
                                                                    className="absolute inset-0 bg-gradient-to-b from-red-600 to-red-800 rounded-2xl shadow-[0_0_25px_rgba(220,38,38,0.5)]" 
                                                                    initial={false}
                                                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                                                />
                                                            )}
                                                            
                                                            <span className={cn(
                                                                "relative z-10 text-[9px] font-bold uppercase mb-1 tracking-wider transition-colors",
                                                                isSelected ? "text-white/80" : "text-zinc-500"
                                                            )}>
                                                                {day.dayName}
                                                            </span>
                                                            <span className={cn(
                                                                "relative z-10 text-2xl font-black transition-colors",
                                                                isSelected ? "text-white" : "text-zinc-400"
                                                            )}>
                                                                {day.dayNumber}
                                                            </span>
                                                        </motion.button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* TIME SLOTS GRID */}
                                    <div>
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
                                                <Clock size={14} className="text-red-600" /> Disponibilidade
                                            </h3>
                                            {!selectedService && (
                                                <span className="text-[9px] text-zinc-500 font-bold uppercase bg-zinc-900 px-2 py-1 rounded border border-white/5">
                                                    Horários Padrão (60min)
                                                </span>
                                            )}
                                        </div>
                                        
                                        {availableSlots.length > 0 ? (
                                            <motion.div 
                                                className="grid grid-cols-3 gap-3"
                                                initial="hidden"
                                                animate="visible"
                                                variants={{
                                                    visible: { transition: { staggerChildren: 0.05 } }
                                                }}
                                            >
                                                <AnimatePresence mode='wait'>
                                                    {availableSlots.map((t) => {
                                                        const boxCapacity = businessSettings.box_capacity || 1;
                                                        const currentCount = slotOccupancy[t] || 0;
                                                        const isFull = currentCount >= boxCapacity;
                                                        
                                                        return (
                                                            <motion.button 
                                                                key={t}
                                                                variants={{
                                                                    hidden: { opacity: 0, y: 20 },
                                                                    visible: { opacity: 1, y: 0 }
                                                                }}
                                                                onClick={() => !isFull && setSelectedTime(t)}
                                                                disabled={isFull}
                                                                className={cn(
                                                                    "relative py-3 rounded-xl border text-xs font-bold transition-all overflow-hidden group flex flex-col items-center justify-center gap-1",
                                                                    isFull 
                                                                        ? "bg-red-600 text-white border-red-800 opacity-100 cursor-not-allowed" // VERMELHO TOTAL SOLICITADO
                                                                        : selectedTime === t 
                                                                            ? "bg-white text-black border-white shadow-[0_0_30px_rgba(255,255,255,0.2)] scale-[1.02]" 
                                                                            : "bg-[#121212] text-zinc-400 border-white/5 hover:border-white/20 hover:bg-white/[0.02]"
                                                                )}
                                                            >
                                                                {/* Selected Indicator */}
                                                                {!isFull && selectedTime === t && (
                                                                    <motion.div 
                                                                        layoutId="activeTime"
                                                                        className="absolute inset-0 bg-white"
                                                                        transition={{ duration: 0.2 }}
                                                                    />
                                                                )}
                                                                
                                                                <span className={cn("relative z-10 font-mono tracking-tight")}>{t}</span>
                                                            </motion.button>
                                                        );
                                                    })}
                                                </AnimatePresence>
                                            </motion.div>
                                        ) : (
                                            <div className="text-center py-12 bg-[#121212] rounded-[2rem] border border-white/5 flex flex-col items-center gap-4">
                                                <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center border border-white/5">
                                                    <Clock size={20} className="text-zinc-600" />
                                                </div>
                                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Data sem horários livres</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Info */}
                            {step === 2 && (
                                <div className="space-y-6 animate-in slide-in-from-right-4">
                                    {!selectedService && services.length > 0 && (
                                        <div className="space-y-4">
                                            <h3 className="text-sm font-black text-white uppercase">Selecione o Serviço</h3>
                                            <div className="space-y-2">
                                                {services.map((s: ServiceItem) => (
                                                    <button key={s.id} onClick={() => setSelectedService(s)} className={cn("w-full p-4 rounded-2xl border flex justify-between items-center transition-all", selectedService?.id === s.id ? "bg-red-600/20 border-red-600 text-white" : "bg-[#121212] border-white/5 text-zinc-400")}>
                                                        <span className="text-xs font-bold uppercase">{s.name}</span>
                                                        <span className="text-xs font-black">R$ {Number(s.price).toFixed(0)}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-4">
                                        <h3 className="text-sm font-black text-white uppercase">Seus Dados</h3>
                                        <input placeholder="Nome Completo" className="w-full bg-[#121212] border border-white/5 rounded-2xl p-5 text-xs font-bold text-white uppercase outline-none focus:border-red-600" value={guestForm.name} onChange={e => setGuestForm({...guestForm, name: e.target.value})} />
                                        <input placeholder="Telefone" className="w-full bg-[#121212] border border-white/5 rounded-2xl p-5 text-xs font-bold text-white uppercase outline-none focus:border-red-600" value={guestForm.phone} onChange={e => setGuestForm({...guestForm, phone: formatPhone(e.target.value)})} />
                                    </div>
                                </div>
                            )}

                             {/* Step 3: Vehicle */}
                             {step === 3 && (
                                <div className="space-y-6 animate-in slide-in-from-right-4">
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-black text-white uppercase">Veículo</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                             <input placeholder="Marca (Ex: Honda)" className="w-full bg-[#121212] border border-white/5 rounded-2xl p-5 text-xs font-bold text-white uppercase outline-none focus:border-red-600" value={vehicleForm.brand} onChange={e => setVehicleForm({...vehicleForm, brand: e.target.value})} />
                                             <input placeholder="Modelo (Ex: Civic)" className="w-full bg-[#121212] border border-white/5 rounded-2xl p-5 text-xs font-bold text-white uppercase outline-none focus:border-red-600" value={vehicleForm.model} onChange={e => setVehicleForm({...vehicleForm, model: e.target.value})} />
                                        </div>
                                        <input placeholder="Placa (Opcional)" className="w-full bg-[#121212] border border-white/5 rounded-2xl p-5 text-xs font-bold text-white uppercase outline-none focus:border-red-600" value={vehicleForm.plate} onChange={e => setVehicleForm({...vehicleForm, plate: formatPlate(e.target.value)})} />
                                    </div>
                                    
                                    <div className="bg-white/5 rounded-2xl p-6 border border-white/5 mt-8">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Total Estimado</span>
                                            <span className="text-xl font-black text-white">R$ {selectedService?.price.toFixed(2)}</span>
                                        </div>
                                        <p className="text-[10px] text-zinc-600 uppercase">
                                            {selectedService?.name} • {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')} às {selectedTime}
                                        </p>
                                    </div>
                                </div>
                            )}

                        </div>
                    )}

                    {/* Bottom Action Bar */}
                    {step < 4 && (
                        <div className="p-8 border-t border-white/5 bg-[#020202]">
                            <button 
                                onClick={() => {
                                    if (step === 1) { if(selectedDate && selectedTime) setStep(2); }
                                    else if (step === 2) { if(guestForm.name && guestForm.phone) setStep(3); }
                                    else if (step === 3) { 
                                        if (vehicleForm.brand && vehicleForm.model) handleFinalize(); 
                                        else alert("Por favor, informe pelo menos a Marca e o Modelo do veículo.");
                                    }
                                }}
                                disabled={loading || (step === 1 && (!selectedDate || !selectedTime))}
                                className={cn(
                                    "w-full py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-glow-red transition-all flex items-center justify-center gap-2",
                                    (step === 1 && (!selectedDate || !selectedTime)) 
                                        ? "bg-zinc-900 text-zinc-600 cursor-not-allowed" 
                                        : "bg-red-600 hover:bg-red-500 text-white"
                                )}
                            >
                                {loading ? <Loader2 className="animate-spin" size={16}/> : (step === 3 ? "Finalizar Agendamento" : "Continuar")}
                            </button>
                        </div>
                    )}

                </div>
            </div>
        );
    }

    // --- SCREEN: AGENDA ---
    if (currentScreen === 'AGENDA') {
        return (
            <div className="min-h-screen bg-[#020202] flex items-center justify-center font-sans p-4">
                <div className="w-full max-w-[450px] h-screen md:h-[850px] md:rounded-[3rem] bg-[#020202] border border-white/5 overflow-hidden relative shadow-2xl flex flex-col">
                    <div className="pt-12 px-8 pb-4 flex items-center justify-between border-b border-white/5 bg-[#020202]">
                         <button onClick={() => setCurrentScreen('HOME')} className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white hover:bg-white/5">
                             <ChevronLeft size={20} />
                         </button>
                         <h2 className="text-sm font-black text-white uppercase tracking-widest">Minha Agenda</h2>
                         <div className="w-10" />
                    </div>

                    <div className="p-6">
                        <div className="flex bg-[#121212] p-1 rounded-2xl border border-white/5">
                            <button onClick={() => setAgendaTab('UPCOMING')} className={cn("flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all", agendaTab === 'UPCOMING' ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white")}>Em Breve</button>
                            <button onClick={() => setAgendaTab('HISTORY')} className={cn("flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all", agendaTab === 'HISTORY' ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white")}>Histórico</button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-32 space-y-3">
                        {!currentUser ? (
                            <div className="text-center py-20 flex flex-col items-center">
                                <Lock size={32} className="text-zinc-700 mb-4" />
                                <p className="text-zinc-500 text-xs font-bold uppercase mb-4">Faça login para ver sua agenda</p>
                                <button onClick={onLoginRequest} className="px-8 py-3 bg-white text-black rounded-xl text-xs font-black uppercase tracking-widest">Fazer Login</button>
                            </div>
                        ) : (agendaTab === 'UPCOMING' ? upcomingAppointments : historyAppointments).length === 0 ? (
                            <div className="text-center py-20 flex flex-col items-center opacity-40">
                                <CalendarX size={32} className="text-zinc-600 mb-4" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nenhum agendamento encontrado</p>
                            </div>
                        ) : (
                            (agendaTab === 'UPCOMING' ? upcomingAppointments : historyAppointments).map((apt: Appointment) => (
                                <div key={apt.id} className="bg-[#121212] p-5 rounded-[1.5rem] border border-white/5 flex flex-col gap-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className={cn(
                                                    "w-2 h-2 rounded-full",
                                                    apt.status === 'CONFIRMADO' ? "bg-white shadow-[0_0_5px_white]" : 
                                                    apt.status === 'EM_EXECUCAO' ? "bg-red-600 animate-pulse shadow-[0_0_10px_red]" :
                                                    apt.status === 'FINALIZADO' ? "bg-green-500 shadow-[0_0_5px_lime]" :
                                                    "bg-zinc-700"
                                                )} />
                                                <p className="text-[10px] font-black text-white uppercase tracking-wide">{new Date(apt.date + 'T12:00:00').toLocaleDateString('pt-BR')} às {apt.time}</p>
                                            </div>
                                            <p className="text-sm font-black text-white uppercase">{apt.serviceType}</p>
                                        </div>
                                        <span className={cn(
                                            "text-[9px] font-bold px-2 py-1 rounded border uppercase tracking-widest",
                                            apt.status === 'FINALIZADO' ? "bg-green-500/10 text-green-500 border-green-500/20" :
                                            apt.status === 'CANCELADO' ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                            "text-zinc-500 bg-zinc-900 border-white/5"
                                        )}>
                                            {apt.status}
                                        </span>
                                    </div>
                                    <div className="h-px bg-white/5 w-full" />
                                    <div className="flex justify-between items-center">
                                        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{businessSettings.business_name}</p>
                                        <p className="text-xs font-black text-white">R$ {Number(apt.price).toFixed(2)}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <BottomNav />
                </div>
            </div>
        )
    }

    // --- SCREEN: PROFILE (Refactored) ---
    if (currentScreen === 'PROFILE') {
        return (
            <div className="min-h-screen bg-[#020202] flex items-center justify-center font-sans p-4">
                <div className="w-full max-w-[450px] h-screen md:h-[850px] md:rounded-[3rem] bg-[#020202] border border-white/5 overflow-hidden relative shadow-2xl flex flex-col">
                    <div className="pt-12 px-8 pb-4 flex items-center justify-between border-b border-white/5 bg-[#020202]">
                         <button onClick={() => setCurrentScreen('HOME')} className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white hover:bg-white/5">
                             <ChevronLeft size={20} />
                         </button>
                         <h2 className="text-sm font-black text-white uppercase tracking-widest">Meu Perfil</h2>
                         <div className="w-10" />
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pb-32">
                         {currentUser ? (
                             <div className="space-y-8">
                                 {/* User Card */}
                                 <div className="bg-[#121212] p-8 rounded-[2.5rem] border border-white/5 flex flex-col items-center text-center relative overflow-hidden">
                                     <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-red-600/10 to-transparent pointer-events-none" />
                                     <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-500 border-4 border-[#121212] relative z-10 shadow-xl mb-4">
                                        <User size={32}/>
                                     </div>
                                     <h3 className="text-xl font-black text-white uppercase tracking-tight">{currentUser.email?.split('@')[0]}</h3>
                                     <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-6">{currentUser.email}</p>
                                     <div className="flex gap-2">
                                         <div className="px-3 py-1 bg-white/5 rounded-lg border border-white/5 text-[9px] font-black text-zinc-300 uppercase">Cliente VIP</div>
                                         <div className="px-3 py-1 bg-white/5 rounded-lg border border-white/5 text-[9px] font-black text-zinc-300 uppercase">Membro desde {new Date().getFullYear()}</div>
                                     </div>
                                 </div>

                                 {/* Stats Grid */}
                                 <div className="grid grid-cols-2 gap-4">
                                     <div className="bg-[#121212] p-5 rounded-[2rem] border border-white/5">
                                         <div className="flex items-center gap-2 mb-2">
                                             <div className="p-2 bg-zinc-900 rounded-full"><Wrench size={14} className="text-white"/></div>
                                             <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Serviços Realizados</span>
                                         </div>
                                         <p className="text-2xl font-black text-white pl-1">{servicesCount}</p>
                                     </div>
                                     <div className="bg-[#121212] p-5 rounded-[2rem] border border-white/5">
                                         <div className="flex items-center gap-2 mb-2">
                                             <div className="p-2 bg-zinc-900 rounded-full"><Car size={14} className="text-red-500"/></div>
                                             <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Veículo</span>
                                         </div>
                                         <p className="text-sm font-black text-white pl-1 uppercase leading-tight">{userVehicle}</p>
                                     </div>
                                 </div>

                                 {/* Actions */}
                                 <div className="space-y-3 pt-4">
                                     <button onClick={() => setIsChangePasswordOpen(true)} className="w-full py-4 border border-white/5 bg-[#121212] rounded-2xl text-[10px] font-black uppercase text-zinc-400 hover:text-white flex items-center justify-center gap-3">
                                         <Key size={14} /> Trocar Senha
                                     </button>
                                     <button onClick={onExit} className="w-full py-4 bg-red-900/10 border border-red-600/20 rounded-2xl text-[10px] font-black uppercase text-red-500 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-3">
                                         <LogOut size={14} /> Sair da Conta
                                     </button>
                                 </div>
                             </div>
                         ) : (
                             <div className="text-center py-20">
                                 <p className="text-zinc-500 text-xs font-bold uppercase mb-4">Você está navegando como visitante</p>
                                 <button onClick={onLoginRequest} className="px-8 py-3 bg-white text-black rounded-xl text-xs font-black uppercase tracking-widest">Fazer Login</button>
                             </div>
                         )}
                    </div>
                    <BottomNav />

                    {/* CUSTOM PASSWORD MODAL */}
                    {isChangePasswordOpen && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300 rounded-[3rem]">
                            <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm p-8 rounded-[2rem] shadow-2xl animate-in zoom-in-95 relative">
                                <button 
                                    onClick={() => setIsChangePasswordOpen(false)} 
                                    className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors"
                                >
                                    <X size={20} />
                                </button>
                                
                                <div className="text-center mb-8">
                                    <div className="w-16 h-16 bg-black border border-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-600 shadow-[0_0_30px_rgba(220,38,38,0.1)]">
                                        <Key size={28} />
                                    </div>
                                    <h3 className="text-xl font-black text-white uppercase tracking-tight">Alterar Senha</h3>
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-2">Segurança da Conta</p>
                                </div>

                                <form onSubmit={handleSaveNewPassword} className="space-y-4">
                                    <div>
                                        <input 
                                            type="password" 
                                            placeholder="NOVA SENHA" 
                                            className="w-full bg-black/50 border border-white/10 focus:border-red-600 rounded-xl px-4 py-4 text-xs font-bold text-white placeholder:text-zinc-600 outline-none transition-all"
                                            value={passwordForm.newPassword}
                                            onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <input 
                                            type="password" 
                                            placeholder="CONFIRME A SENHA" 
                                            className="w-full bg-black/50 border border-white/10 focus:border-red-600 rounded-xl px-4 py-4 text-xs font-bold text-white placeholder:text-zinc-600 outline-none transition-all"
                                            value={passwordForm.confirmPassword}
                                            onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                                        />
                                    </div>

                                    {passwordFeedback && (
                                        <div className={cn(
                                            "p-3 rounded-xl text-[10px] font-bold uppercase text-center border",
                                            passwordStatus === 'ERROR' ? "bg-red-900/20 text-red-500 border-red-500/20" : "bg-green-900/20 text-green-500 border-green-500/20"
                                        )}>
                                            {passwordFeedback}
                                        </div>
                                    )}

                                    <div className="pt-2 flex gap-3">
                                        <button 
                                            type="button" 
                                            onClick={() => setIsChangePasswordOpen(false)}
                                            className="flex-1 py-4 rounded-xl text-[10px] font-black uppercase text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
                                        >
                                            Cancelar
                                        </button>
                                        <button 
                                            type="submit" 
                                            disabled={passwordStatus === 'SAVING'}
                                            className="flex-1 py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-glow-red transition-all flex items-center justify-center gap-2"
                                        >
                                            {passwordStatus === 'SAVING' ? <Loader2 className="animate-spin" size={14} /> : 'Salvar'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // --- SCREEN: GALLERY (Simplified Overlay) ---
    return (
        <div className="min-h-screen bg-[#020202] flex items-center justify-center font-sans p-4">
             <div className="w-full max-w-[450px] h-screen md:h-[850px] md:rounded-[3rem] bg-[#020202] border border-white/5 overflow-hidden relative shadow-2xl flex flex-col">
                 <div className="pt-12 px-8 pb-4 flex items-center justify-between border-b border-white/5">
                     <button onClick={() => setCurrentScreen('HOME')} className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white hover:bg-white/5">
                         <ChevronLeft size={20} />
                     </button>
                     <h2 className="text-sm font-black text-white uppercase tracking-widest">Galeria & Showroom</h2>
                     <div className="w-10" />
                 </div>

                 <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pb-32">
                     <div className="grid grid-cols-2 gap-3">
                         {portfolio.map((item: PortfolioItem) => (
                             <div key={item.id} className="aspect-[4/5] bg-zinc-900 rounded-2xl overflow-hidden relative group">
                                 <img src={item.imageUrl} className="w-full h-full object-cover" />
                                 <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                                     <p className="text-[9px] text-white font-bold uppercase">{item.description}</p>
                                 </div>
                             </div>
                         ))}
                         {portfolio.length === 0 && <p className="col-span-2 text-center text-zinc-500 text-xs py-20">Galeria vazia</p>}
                     </div>
                 </div>
                 <BottomNav />
             </div>
        </div>
    );
};
