
import React, { useEffect, useState, useMemo } from 'react';
import { 
  DollarSign, Activity, CalendarCheck, Boxes, Play, Check, 
  User as UserIcon, Monitor, ChevronRight, BarChart, 
  Clock, Sparkles, Car, X, Shield, Lock, Zap, MessageSquare, AlertTriangle, Fingerprint, Trash2, Calendar
} from 'lucide-react';
import { PlanType, Appointment, AppointmentStatus, BusinessSettings, Customer } from '../types';
import { openWhatsAppChat } from '../services/whatsappService';
import { PLAN_FEATURES } from '../constants';
import { cn } from '../lib/utils';
import { ConfirmationModal } from './ConfirmationModal';
import { OnboardingWidget } from './OnboardingWidget';

interface DashboardProps {
  currentPlan: PlanType;
  appointments: Appointment[];
  customers: Customer[];
  onUpgrade: () => void;
  setActiveTab: (tab: string) => void;
  businessSettings: BusinessSettings;
  onUpdateStatus: (id: string, status: AppointmentStatus) => void;
  onCancelAppointment: (id: string) => void;
  onDeleteAppointment?: (id: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
    currentPlan, appointments, customers, onUpgrade, setActiveTab, 
    businessSettings, onUpdateStatus, onCancelAppointment, onDeleteAppointment
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'danger'
  });

  // Correção de Data Local (Evita problema de UTC-3 após as 21:00)
  const today = useMemo(() => new Date().toLocaleDateString('en-CA'), []);
  
  // Pending Appointments (Any Date) - Inbox Logic
  const pendingAppointments = useMemo(() => 
    appointments.filter(a => a.status === AppointmentStatus.NOVO)
      .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime()),
    [appointments]
  );

  // Today's Operational List (Excludes NEW ones that are shown in Inbox, unless we want duplicates. 
  // Let's keep NEW ones out of "Production Line" to enforce confirmation workflow)
  const todayProduction = useMemo(() => 
    appointments.filter(a => 
        a.date === today && 
        a.status !== AppointmentStatus.CANCELADO && 
        a.status !== AppointmentStatus.NOVO // Moved to Inbox
    ).sort((a, b) => a.time.localeCompare(b.time)),
    [appointments, today]
  );

  // Fallback: If user confirms a today's appointment, it enters production line.

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const revenueToday = todayProduction
      .filter(a => a.status === AppointmentStatus.FINALIZADO)
      .reduce((acc, curr) => acc + curr.price, 0);

  const occupancyRate = ((todayProduction.filter(a => a.status === AppointmentStatus.EM_EXECUCAO).length / (businessSettings.box_capacity || 1)) * 100).toFixed(0);

  const handleRequestCancel = (id: string) => {
      setConfirmModal({
          isOpen: true,
          title: 'Cancelar Agendamento',
          message: 'Tem certeza que deseja cancelar este agendamento? O horário ficará vago novamente.',
          variant: 'warning',
          onConfirm: () => onCancelAppointment(id)
      });
  };

  const handleRequestDelete = (id: string) => {
      if (!onDeleteAppointment) return;
      setConfirmModal({
          isOpen: true,
          title: 'Excluir Definitivamente',
          message: 'Esta ação removerá permanentemente o registro do banco de dados. Deseja continuar?',
          variant: 'danger',
          onConfirm: () => onDeleteAppointment(id)
      });
  };

  return (
      <div className="relative p-4 md:p-8 pb-32 min-h-full animate-fade-in max-w-[1920px] mx-auto overflow-hidden">
          
          <ConfirmationModal 
             isOpen={confirmModal.isOpen}
             onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
             onConfirm={confirmModal.onConfirm}
             title={confirmModal.title}
             message={confirmModal.message}
             variant={confirmModal.variant}
          />

          <div className="absolute inset-0 pointer-events-none opacity-[0.02]" 
               style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
          </div>

          <div className="relative z-10 flex flex-col xl:flex-row justify-between items-start xl:items-end mb-6 gap-6 md:gap-8 border-b border-white/5 pb-6">
              <div className="flex items-center gap-4 md:gap-5">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-zinc-800 to-black border border-white/10 flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.05)] relative group overflow-hidden shrink-0">
                      <div className="absolute inset-0 bg-red-600/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                      <Fingerprint className="text-zinc-400 group-hover:text-white transition-colors z-10" size={24} strokeWidth={1.5} />
                  </div>
                  <div>
                      <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-0.5">
                          <h2 className="text-xl md:text-2xl font-black text-white tracking-tighter uppercase leading-none">{businessSettings.business_name}</h2>
                          <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-white/10 border border-white/5 text-zinc-300 uppercase tracking-widest whitespace-nowrap">
                            Hangar {businessSettings.slug}
                          </span>
                      </div>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_#22c55e]" />
                          Sistemas Operacionais Online
                      </p>
                  </div>
              </div>

              <div className="flex flex-col md:flex-row flex-wrap items-start md:items-center gap-4 md:gap-6 w-full md:w-auto">
                  <div className="flex flex-col items-start md:items-end md:border-r border-white/5 md:pr-6 w-full md:w-auto">
                      <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-0.5">Hora Local (BRT)</span>
                      <span className="text-lg md:text-xl font-black text-white tabular-nums tracking-tight leading-none">
                          {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          <span className="text-xs md:text-xs text-zinc-600 ml-1 font-medium">{currentTime.toLocaleTimeString('pt-BR', { second: '2-digit' })}</span>
                      </span>
                  </div>
                  
                  <TrialTimer settings={businessSettings} currentPlan={currentPlan} onUpgrade={onUpgrade} />
              </div>
          </div>

          <OnboardingWidget businessId={businessSettings.id || ''} onNavigate={setActiveTab} />

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 md:gap-6 relative z-10">
              <div className="xl:col-span-4 flex flex-col gap-4 md:gap-5">
                  {/* PENDING REQUESTS WIDGET (NEW) */}
                  {pendingAppointments.length > 0 && (
                      <div className="bg-blue-900/10 border border-blue-500/20 rounded-[1.5rem] p-4 md:p-5 relative overflow-hidden animate-in slide-in-from-left">
                          <div className="flex justify-between items-center mb-3">
                              <h4 className="text-xs font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                                  <AlertTriangle size={14} /> Solicitações Pendentes
                              </h4>
                              <span className="bg-blue-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">{pendingAppointments.length}</span>
                          </div>
                          <div className="space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
                              {pendingAppointments.map(apt => {
                                  const customer = customers.find(c => c.id === apt.customerId);
                                  const vehicle = customer?.vehicles?.find(v => v.id === apt.vehicleId);
                                  return (
                                      <div key={apt.id} className="bg-black/40 p-2.5 rounded-xl border border-blue-500/10 hover:border-blue-500/30 transition-colors">
                                          <div className="flex justify-between items-start mb-2">
                                              <div>
                                                  <p className="text-[10px] md:text-[11px] font-bold text-white uppercase">{customer?.name}</p>
                                                  <p className="text-[9px] text-zinc-500 uppercase">{vehicle?.model} • {vehicle?.plate}</p>
                                              </div>
                                              <div className="text-right">
                                                  <p className="text-[9px] font-black text-blue-300 uppercase">{new Date(apt.date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                                                  <p className="text-[9px] font-bold text-zinc-500">{apt.time}</p>
                                              </div>
                                          </div>
                                          <div className="flex gap-2">
                                              <button onClick={() => onUpdateStatus(apt.id, AppointmentStatus.CONFIRMADO)} className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">
                                                  Confirmar
                                              </button>
                                              <button onClick={() => handleRequestCancel(apt.id)} className="px-3 py-1.5 bg-zinc-800 hover:bg-red-900/50 text-zinc-400 hover:text-red-500 rounded-lg text-[9px] font-black uppercase transition-all">
                                                  <X size={12} />
                                              </button>
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      </div>
                  )}

                  <div className="relative group overflow-hidden rounded-[1.5rem] bg-zinc-900/40 border border-white/5 p-5 md:p-6 backdrop-blur-xl transition-all hover:border-white/10">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/5 blur-[80px] rounded-full pointer-events-none group-hover:bg-green-500/10 transition-all duration-700" />
                      
                      <div className="flex justify-between items-start mb-4 md:mb-6 relative z-10">
                          <div className="p-2.5 bg-zinc-950 border border-white/10 rounded-xl">
                              <DollarSign className="text-green-500" size={18} />
                          </div>
                          <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest border border-white/5 px-2 py-1 rounded-full">Consolidado Hoje</span>
                      </div>
                      
                      <div className="relative z-10">
                          <h3 className="text-3xl md:text-5xl font-black text-white tracking-tighter tabular-nums mb-1 leading-none">
                              <span className="text-xl md:text-2xl text-zinc-500 mr-2 align-top mt-1 inline-block">R$</span>
                              {revenueToday.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </h3>
                      </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:gap-4">
                      <KPICard 
                          label="Fluxo de Caixa" 
                          value={todayProduction.length} 
                          suffix="Veículos"
                          icon={CalendarCheck} 
                          trend="Operacional"
                          color="blue"
                      />
                      <KPICard 
                          label="Ocupação" 
                          value={occupancyRate} 
                          suffix="%"
                          icon={Boxes} 
                          trend="Capacidade"
                          color={Number(occupancyRate) > 80 ? 'red' : 'zinc'}
                      />
                  </div>
                  
                  <div className="rounded-[1.5rem] bg-black border border-white/10 p-5 md:p-6 flex flex-col justify-between flex-1 relative overflow-hidden min-h-[150px]">
                      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05]" />
                      <div className="relative z-10">
                          <h4 className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                              <Activity size={12} className="text-red-500" /> Diagnóstico do Sistema
                          </h4>
                          <div className="space-y-2">
                               <StatusRow label="Database Latency" value="12ms" status="good" />
                               <StatusRow label="Cloud Sync" value="Ativo" status="good" />
                          </div>
                      </div>
                  </div>
              </div>

              <div className="xl:col-span-8 flex flex-col h-full">
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 px-1 md:px-2 gap-4">
                      <div className="flex items-center gap-3">
                          <div className="h-5 md:h-6 w-1 bg-red-600 rounded-full shadow-[0_0_15px_#dc2626]" />
                          <h3 className="text-lg md:text-xl font-bold text-white uppercase tracking-tight">Linha de Produção (Hoje)</h3>
                          <span className="bg-zinc-800 text-zinc-400 text-[9px] font-bold px-2 py-0.5 rounded border border-white/5 uppercase tracking-widest">
                             {todayProduction.length} Ativos
                          </span>
                      </div>
                      
                      <button 
                        onClick={() => setActiveTab('schedule')} 
                        className="group flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/5 bg-zinc-900/50 hover:bg-white/5 transition-all self-start md:self-auto"
                      >
                          <span className="text-[9px] font-bold text-zinc-400 group-hover:text-white uppercase tracking-widest transition-colors">Ver Agenda Completa</span>
                          <ChevronRight size={12} className="text-zinc-600 group-hover:text-white transition-colors" />
                      </button>
                  </div>

                  <div className="flex-1 bg-zinc-900/20 border border-white/5 rounded-[1.5rem] p-3 md:p-5 backdrop-blur-sm relative min-h-[400px]">
                      {/* Desktop Header */}
                      <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 border-b border-white/5 text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-2">
                          <div className="col-span-2">Horário</div>
                          <div className="col-span-4">Identificação Veicular</div>
                          <div className="col-span-3">Procedimento</div>
                          <div className="col-span-3 text-right">Status / Controle</div>
                      </div>

                      <div className="space-y-2 md:overflow-y-auto md:max-h-[600px] pr-0 md:pr-2 custom-scrollbar">
                          {todayProduction.length === 0 ? (
                              <div className="flex flex-col items-center justify-center py-16 md:py-20 opacity-50">
                                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4 md:mb-6 animate-pulse">
                                      <Car className="text-zinc-700" size={24} />
                                  </div>
                                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-[0.3em]">Silêncio Operacional</p>
                                  <p className="text-zinc-600 text-[10px] mt-2">Nenhum serviço confirmado para hoje.</p>
                              </div>
                          ) : (
                              todayProduction.map((apt) => (
                                  <OperationalStrip 
                                      key={apt.id} 
                                      appointment={apt} 
                                      customer={customers.find(c => c.id === apt.customerId)}
                                      onUpdateStatus={onUpdateStatus}
                                      onCancelAppointment={handleRequestCancel}
                                      onDeleteAppointment={handleRequestDelete}
                                      currentPlan={currentPlan}
                                      onUpgrade={onUpgrade}
                                  />
                              ))
                          )}
                      </div>
                  </div>
              </div>
          </div>
      </div>
  );
};

const KPICard = ({ label, value, suffix, icon: Icon, trend, color = 'zinc' }: any) => {
    const isRed = color === 'red';
    const isBlue = color === 'blue';

    return (
        <div className={cn(
            "relative p-4 md:p-5 rounded-[1.5rem] border backdrop-blur-xl transition-all group overflow-hidden",
            isRed ? "bg-red-950/10 border-red-500/20 hover:border-red-500/40" : 
            isBlue ? "bg-blue-950/10 border-blue-500/20 hover:border-blue-500/40" :
            "bg-zinc-900/40 border-white/5 hover:border-white/10"
        )}>
            <div className="flex justify-between items-start mb-2 md:mb-3">
                <span className="text-[8px] md:text-[9px] font-black text-zinc-500 uppercase tracking-widest truncate">{label}</span>
                <Icon size={14} className={cn(isRed ? "text-red-500" : isBlue ? "text-blue-500" : "text-zinc-500")} />
            </div>
            <div className="flex items-baseline gap-1">
                <span className="text-2xl md:text-3xl font-black text-white tracking-tighter tabular-nums">{value}</span>
                {suffix && <span className="text-[9px] md:text-[10px] font-bold text-zinc-500">{suffix}</span>}
            </div>
            <div className="mt-2 md:mt-3 pt-2 border-t border-white/5 flex items-center gap-2">
                <div className={cn("w-1.5 h-1.5 rounded-full", isRed ? "bg-red-500" : isBlue ? "bg-blue-500" : "bg-zinc-500")} />
                <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">{trend}</span>
            </div>
        </div>
    )
}

const StatusRow = ({ label, value, status }: { label: string, value: string, status: 'good' | 'neutral' | 'bad' }) => (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">{label}</span>
        <div className="flex items-center gap-2">
            <span className={cn(
                "text-[9px] font-mono font-bold uppercase",
                status === 'good' ? "text-green-500" : status === 'bad' ? "text-red-500" : "text-zinc-500"
            )}>{value}</span>
            <div className={cn(
                "w-1 h-1 rounded-full",
                status === 'good' ? "bg-green-500 shadow-[0_0_5px_#22c55e]" : 
                status === 'bad' ? "bg-red-500 shadow-[0_0_5px_#dc2626]" : "bg-zinc-700"
            )} />
        </div>
    </div>
)

const TrialTimer = ({ settings, currentPlan, onUpgrade }: { settings: BusinessSettings, currentPlan: PlanType, onUpgrade: () => void }) => {
    const isStart = currentPlan === PlanType.START;
    const isPaid = settings.subscription_status === 'ACTIVE';
    const isTrial = !isStart && !isPaid;

    let daysLeft = 0;
    if (isTrial) {
        const start = new Date(settings.trial_start_date || settings.created_at || new Date().toISOString()).getTime();
        const now = new Date().getTime();
        const diffDays = (now - start) / (1000 * 3600 * 24);
        daysLeft = Math.max(0, 7 - Math.floor(diffDays));
    }

    return (
        <button 
            onClick={onUpgrade}
            className={cn(
                "flex items-center gap-3 px-3 py-1.5 rounded-full border shadow-sm transition-all group w-full md:w-auto",
                isPaid 
                    ? "bg-zinc-900 border-green-500/20 shadow-[0_0_15px_-5px_#22c55e]" 
                    : isTrial
                        ? "bg-red-900/10 border-red-500/30 animate-pulse"
                        : "bg-zinc-900 border-white/10 hover:bg-zinc-800"
            )}
        >
             <Shield size={12} className={isPaid ? "text-green-500" : isTrial ? "text-red-500" : "text-zinc-500 group-hover:text-white"} />
             <div className="flex flex-col items-start leading-none">
                 <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">
                    {isPaid ? 'Plano Ativo' : isTrial ? 'Período de Teste' : 'Plano Gratuito'}
                 </span>
                 <span className={cn("text-[9px] font-black uppercase tracking-wider", 
                    isPaid ? "text-green-400" : 
                    isTrial ? "text-red-400" : 
                    "text-zinc-300 group-hover:text-white"
                 )}>
                    {isPaid ? currentPlan : isTrial ? `${daysLeft} dias restantes` : 'Carbon Start'}
                 </span>
             </div>
        </button>
    );
};

const OperationalStrip: React.FC<{ appointment: Appointment, customer?: Customer, onUpdateStatus: any, onCancelAppointment: (id: string) => void, onDeleteAppointment?: (id: string) => void, currentPlan: PlanType, onUpgrade: () => void }> = ({ appointment, customer, onUpdateStatus, onCancelAppointment, onDeleteAppointment, currentPlan, onUpgrade }) => {
    const isRunning = appointment.status === AppointmentStatus.EM_EXECUCAO;
    const isFinished = appointment.status === AppointmentStatus.FINALIZADO;
    const isConfirmed = appointment.status === AppointmentStatus.CONFIRMADO;
    const vehicle = customer?.vehicles?.find(v => v.id === appointment.vehicleId);
    
    const hasWhatsApp = PLAN_FEATURES[currentPlan].hasWhatsapp;

    const handleNotify = () => {
        if (hasWhatsApp) {
            openWhatsAppChat(customer?.phone || '', `Olá! Seu veículo ${vehicle?.model} está pronto no Hangar!`);
        } else {
            if(window.confirm("Notificação via WhatsApp é um recurso PRO. Deseja fazer upgrade?")) onUpgrade();
        }
    };

    return (
        <div className={cn(
            "flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-4 items-start md:items-center p-3 md:p-3 rounded-xl border transition-all duration-300 group relative",
            isRunning ? "bg-[#0f0f0f] border-red-600/30 shadow-[inset_0_0_20px_rgba(220,38,38,0.05)]" : "bg-black/40 border-white/5 hover:border-white/10 hover:bg-white/5",
            isFinished && "opacity-50 grayscale hover:grayscale-0 hover:opacity-100"
        )}>
            {/* Mobile Header: Time + Price */}
            <div className="flex md:hidden w-full justify-between items-center mb-1 border-b border-white/5 pb-2">
                 <div className="flex items-center gap-3">
                     <div className={cn(
                        "w-2 h-2 rounded-full",
                        isRunning ? "bg-red-600 shadow-[0_0_10px_#dc2626]" : isFinished ? "bg-green-600" : isConfirmed ? "bg-white" : "bg-zinc-700"
                     )} />
                     <span className="text-lg font-black text-white tabular-nums tracking-tighter">{appointment.time}</span>
                 </div>
                 <span className="text-[9px] font-black text-zinc-500 bg-zinc-900 px-2 py-1 rounded border border-white/5 uppercase">R$ {appointment.price.toFixed(2)}</span>
            </div>

            <div className="hidden md:flex col-span-2 items-center gap-3 pl-2">
                <div className={cn(
                    "w-1 h-6 rounded-full transition-colors",
                    isRunning ? "bg-red-600 shadow-[0_0_10px_#dc2626]" : isFinished ? "bg-green-600" : isConfirmed ? "bg-white" : "bg-zinc-700"
                )} />
                <span className="text-lg font-black text-white tabular-nums tracking-tighter">{appointment.time}</span>
            </div>

            <div className="w-full md:col-span-4">
                <div className="flex items-center justify-between md:justify-start gap-2 mb-0.5">
                    <span className="text-xs md:text-sm font-bold text-white uppercase tracking-tight truncate">{vehicle?.model || 'Veículo N/A'}</span>
                    <span className="text-[8px] font-black text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-white/5 uppercase tracking-widest">{vehicle?.plate || 'S/P'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <UserIcon size={10} className="text-zinc-600" />
                    <span className="text-[9px] font-bold text-zinc-500 uppercase truncate max-w-[200px]">{customer?.name}</span>
                </div>
            </div>

            <div className="w-full md:col-span-3 flex justify-between md:block">
                <span className="text-[9px] md:text-[10px] font-bold text-zinc-300 uppercase block truncate mb-0.5">{appointment.serviceType}</span>
                <span className="hidden md:block text-[9px] font-bold text-zinc-600 uppercase tracking-widest">R$ {appointment.price.toFixed(2)}</span>
            </div>

            <div className="w-full md:col-span-3 flex justify-end items-center gap-2 relative z-20 mt-2 md:mt-0">
                {!isFinished && (
                    <button 
                        type="button"
                        onClick={(e) => { 
                            e.stopPropagation();
                            onCancelAppointment(appointment.id); 
                        }} 
                        className="p-1.5 text-zinc-600 hover:text-orange-500 hover:bg-orange-900/10 rounded-lg transition-all cursor-pointer flex-1 md:flex-none flex items-center justify-center border border-white/5 md:border-transparent"
                        title="Cancelar"
                    >
                        <X size={12} />
                    </button>
                )}

                {appointment.status === AppointmentStatus.NOVO && (
                    <button onClick={() => onUpdateStatus(appointment.id, AppointmentStatus.CONFIRMADO)} className="flex-1 md:flex-none px-3 py-1.5 bg-zinc-800 hover:bg-white hover:text-black border border-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">Confirmar</button>
                )}
                
                {appointment.status === AppointmentStatus.CONFIRMADO && (
                    <button onClick={() => onUpdateStatus(appointment.id, AppointmentStatus.EM_EXECUCAO)} className="flex-1 md:flex-none px-3 py-1.5 bg-white text-black hover:bg-zinc-200 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-glow">
                        <Play size={8} fill="currentColor" /> Iniciar
                    </button>
                )}
                
                {isRunning && (
                    <button onClick={() => onUpdateStatus(appointment.id, AppointmentStatus.FINALIZADO)} className="flex-1 md:flex-none px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(34,197,94,0.4)]">
                        <Check size={10} strokeWidth={3} /> Finalizar
                    </button>
                )}
                
                {isFinished && (
                    <button onClick={handleNotify} className={cn(
                        "flex-1 md:flex-none px-3 py-1.5 border rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                        hasWhatsApp 
                            ? "bg-green-900/10 border-green-500/20 text-green-500 hover:bg-green-500 hover:text-white"
                            : "bg-zinc-900 border-zinc-800 text-zinc-600 hover:border-red-500/30 hover:text-red-500"
                    )}>
                        {hasWhatsApp ? <MessageSquare size={10} /> : <Lock size={10} />} 
                        {hasWhatsApp ? "Notificar" : "PRO"}
                    </button>
                )}
            </div>
        </div>
    );
}
