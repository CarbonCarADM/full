
import React, { useState, useMemo } from 'react';
import { AppointmentStatus, Appointment, Customer, PlanType, BusinessSettings, ServiceItem } from '../types';
import { Store, Clock, Calendar, ChevronLeft, ChevronRight, Plus, X, Filter, SlidersHorizontal, CheckCircle2, CircleDashed, Trash2, Phone } from 'lucide-react';
import { NewAppointmentModal } from './NewAppointmentModal';
import { ConfirmationModal } from './ConfirmationModal';
import { cn } from '../lib/utils';

interface ScheduleProps {
  appointments: Appointment[];
  customers: Customer[];
  onAddAppointment: (appointment: Appointment, newCustomer?: Customer) => void;
  onUpdateStatus: (id: string, status: AppointmentStatus) => void;
  onCancelAppointment: (id: string) => void;
  onDeleteAppointment?: (id: string) => void;
  currentPlan?: PlanType; 
  onUpgrade: () => void;
  settings: BusinessSettings;
  services?: ServiceItem[];
}

export const Schedule: React.FC<ScheduleProps> = ({ 
  appointments, 
  customers, 
  onAddAppointment, 
  onUpdateStatus, 
  onCancelAppointment,
  onDeleteAppointment,
  settings,
  services = []
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Correção de Data Local para a agenda
  const [selectedDate, setSelectedDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  
  const [viewMode, setViewMode] = useState<'AGENDA' | 'HISTORY'>('AGENDA');

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

  const agendaAppointments = appointments.filter(a => 
    a.date === selectedDate && 
    a.status !== AppointmentStatus.CANCELADO && 
    a.status !== AppointmentStatus.FINALIZADO
  ).sort((a, b) => a.time.localeCompare(b.time));
  
  const historyAppointments = appointments
    .filter(a => a.status === AppointmentStatus.FINALIZADO || a.status === AppointmentStatus.CANCELADO)
    .sort((a, b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime());

  const activeList = viewMode === 'AGENDA' ? agendaAppointments : historyAppointments;

  const changeDate = (days: number) => {
      const d = new Date(selectedDate + 'T12:00:00');
      d.setDate(d.getDate() + days);
      setSelectedDate(d.toLocaleDateString('en-CA'));
  };

  const formatDate = (dateStr: string) => {
      const date = new Date(dateStr + 'T12:00:00');
      return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  };

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
    <div className="p-6 md:p-12 pb-32 animate-fade-in space-y-12 max-w-[1800px] mx-auto">
      
      <ConfirmationModal 
         isOpen={confirmModal.isOpen}
         onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
         onConfirm={confirmModal.onConfirm}
         title={confirmModal.title}
         message={confirmModal.message}
         variant={confirmModal.variant}
      />

      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-8 border-b border-white/5 pb-8">
        <div>
          <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 bg-red-600/10 border border-red-600/20 rounded-xl flex items-center justify-center">
                  <Calendar className="text-red-600" size={24} />
              </div>
              <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">
                Cronograma <span className="text-zinc-600">Mestre</span>
              </h2>
          </div>
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.4em] pl-16">
            Gestão Temporal de Processos
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
            <div className="flex p-1.5 bg-[#09090b] border border-white/5 rounded-2xl">
                <button 
                    onClick={() => setViewMode('AGENDA')}
                    className={cn(
                        "px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2",
                        viewMode === 'AGENDA' ? "bg-white text-black shadow-glow" : "text-zinc-500 hover:text-white"
                    )}
                >
                    <CircleDashed size={14} className={viewMode === 'AGENDA' ? "animate-spin-slow" : ""} /> Fila Ativa
                </button>
                <button 
                    onClick={() => setViewMode('HISTORY')}
                    className={cn(
                        "px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2",
                        viewMode === 'HISTORY' ? "bg-white text-black shadow-glow" : "text-zinc-500 hover:text-white"
                    )}
                >
                    <CheckCircle2 size={14} /> Histórico
                </button>
            </div>
            
            <button 
                onClick={() => setIsModalOpen(true)}
                className="group relative overflow-hidden bg-red-600 hover:bg-red-500 text-white px-8 py-4 rounded-2xl transition-all shadow-glow-red"
            >
                <div className="relative z-10 flex items-center gap-3">
                    <Plus size={18} strokeWidth={3} /> 
                    <span className="text-[10px] font-black uppercase tracking-widest">Novo Box</span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            </button>
        </div>
      </div>

      {viewMode === 'AGENDA' && (
        <div className="flex items-center justify-between bg-[#09090b] p-2 pr-6 pl-2 rounded-full border border-white/5 max-w-2xl mx-auto backdrop-blur-md sticky top-4 z-20 shadow-2xl">
            <button onClick={() => changeDate(-1)} className="w-12 h-12 bg-black border border-white/10 rounded-full text-zinc-400 hover:text-white flex items-center justify-center transition-all hover:scale-110 active:scale-95">
                <ChevronLeft size={20}/>
            </button>
            <div className="flex flex-col items-center">
                <span className="text-[9px] font-black text-red-500 uppercase tracking-[0.3em] mb-0.5">Data Operacional</span>
                <span className="text-sm md:text-lg font-bold text-white uppercase tracking-wider">{formatDate(selectedDate)}</span>
            </div>
            <button onClick={() => changeDate(1)} className="w-12 h-12 bg-black border border-white/10 rounded-full text-zinc-400 hover:text-white flex items-center justify-center transition-all hover:scale-110 active:scale-95">
                <ChevronRight size={20}/>
            </button>
        </div>
      )}

      <div className="relative space-y-4 min-h-[500px]">
        <div className="absolute left-[85px] md:left-[110px] top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent hidden md:block" />

        {activeList.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-32 opacity-40">
                 <div className="w-32 h-32 rounded-full border-2 border-dashed border-zinc-800 flex items-center justify-center mb-6">
                     <Clock className="text-zinc-700 w-12 h-12" />
                 </div>
                 <p className="text-zinc-500 text-xs font-black uppercase tracking-[0.3em]">Nenhum procedimento agendado</p>
             </div>
        ) : (
            activeList.map((apt, index) => {
                const customer = customers.find(c => c.id === apt.customerId);
                const vehicle = customer?.vehicles?.find(v => v.id === apt.vehicleId) || customer?.vehicles?.[0];
                const isRunning = apt.status === AppointmentStatus.EM_EXECUCAO;

                return (
                    <div key={apt.id} className="relative group animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${index * 50}ms` }}>
                        <div className={cn(
                            "absolute left-[110px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 z-10 hidden md:block transition-all",
                            isRunning ? "bg-red-600 border-red-600 shadow-[0_0_15px_#dc2626] scale-125" : "bg-[#020202] border-zinc-700 group-hover:border-white"
                        )} style={{ marginLeft: '-5px' }} />

                        <div className={cn(
                            "flex flex-col md:flex-row items-stretch gap-6 md:gap-10 p-2 md:p-0 rounded-[2rem] transition-all duration-300",
                            isRunning ? "bg-white/[0.02]" : "hover:bg-white/[0.01]"
                        )}>
                            <div className="w-full md:w-[110px] flex flex-row md:flex-col items-center justify-center md:justify-start md:pt-8 gap-4 md:gap-1 shrink-0">
                                <span className={cn(
                                    "text-2xl md:text-3xl font-black tabular-nums tracking-tighter",
                                    isRunning ? "text-red-500" : "text-white"
                                )}>
                                    {apt.time}
                                </span>
                                <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest bg-zinc-900/50 px-2 py-0.5 rounded border border-white/5">
                                    {apt.durationMinutes} min
                                </span>
                            </div>

                            <div className={cn(
                                "flex-1 rounded-[2rem] border p-6 md:p-8 relative overflow-hidden transition-all duration-300 backdrop-blur-sm",
                                isRunning 
                                    ? "bg-[#0c0c0c] border-red-600/30 shadow-[0_10px_40px_-10px_rgba(220,38,38,0.1)]" 
                                    : "bg-[#09090b] border-white/5 group-hover:border-white/10"
                            )}>
                                {isRunning && <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 blur-[60px] rounded-full pointer-events-none" />}
                                
                                <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-8 relative z-10">
                                    <div className="space-y-4 min-w-[200px]">
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="text-xl font-black text-white uppercase tracking-tight">
                                                    {vehicle?.model || 'Modelo N/A'}
                                                </h3>
                                                <span className="text-[9px] font-black text-black bg-zinc-200 px-2 py-0.5 rounded uppercase tracking-widest">
                                                    {vehicle?.plate || '---'}
                                                </span>
                                            </div>
                                            <p className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-2 mb-1">
                                                <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                                                {customer?.name || 'Cliente'}
                                            </p>
                                            <p className="text-[10px] font-bold text-zinc-600 uppercase flex items-center gap-2 pl-3.5">
                                                <Phone size={10} />
                                                {customer?.phone || 'Telefone N/A'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex-1 border-l border-white/5 pl-0 lg:pl-8 space-y-2">
                                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Procedimento</p>
                                        <p className="text-lg font-bold text-zinc-200 uppercase leading-tight max-w-md">
                                            {apt.serviceType}
                                        </p>
                                        {apt.observation && (
                                            <p className="text-[10px] text-zinc-500 italic mt-1 border-l-2 border-red-900 pl-2">
                                                "{apt.observation}"
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex flex-col items-end gap-4 min-w-[150px]">
                                        <div className={cn(
                                            "px-4 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest",
                                            apt.status === AppointmentStatus.NOVO ? "border-blue-500/30 text-blue-500 bg-blue-500/10" :
                                            apt.status === AppointmentStatus.CONFIRMADO ? "border-white/30 text-white bg-white/10" :
                                            apt.status === AppointmentStatus.EM_EXECUCAO ? "border-red-500 text-red-500 bg-red-500/10 animate-pulse" :
                                            apt.status === AppointmentStatus.FINALIZADO ? "border-green-500/30 text-green-500 bg-green-500/10" :
                                            "border-zinc-700 text-zinc-500"
                                        )}>
                                            {apt.status.replace('_', ' ')}
                                        </div>

                                        <p className="text-xl font-black text-white tabular-nums tracking-tighter">
                                            R$ {apt.price.toFixed(2)}
                                        </p>
                                        
                                        <div className="flex gap-2 opacity-100 transition-opacity">
                                            {onDeleteAppointment && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => { 
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleRequestDelete(apt.id); 
                                                    }}
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-900 border border-white/10 hover:border-red-500 text-zinc-500 hover:text-red-500 transition-colors"
                                                    title="Excluir Definitivamente"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}

                                            {viewMode === 'AGENDA' && (
                                                <>
                                                    {apt.status !== AppointmentStatus.FINALIZADO && (
                                                         <button 
                                                            onClick={() => handleRequestCancel(apt.id)}
                                                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-900 border border-white/10 hover:border-orange-500 text-zinc-500 hover:text-orange-500 transition-colors"
                                                            title="Cancelar"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    )}
                                                    
                                                    {apt.status !== AppointmentStatus.EM_EXECUCAO && (
                                                        <button 
                                                            onClick={() => onUpdateStatus(apt.id, AppointmentStatus.EM_EXECUCAO)}
                                                            className="px-4 py-1.5 bg-white text-black text-[9px] font-black uppercase rounded-lg hover:bg-zinc-200 transition-colors"
                                                        >
                                                            Iniciar
                                                        </button>
                                                    )}
                                                    {apt.status === AppointmentStatus.EM_EXECUCAO && (
                                                        <button 
                                                            onClick={() => onUpdateStatus(apt.id, AppointmentStatus.FINALIZADO)}
                                                            className="px-4 py-1.5 bg-green-600 text-white text-[9px] font-black uppercase rounded-lg hover:bg-green-500 transition-colors shadow-glow-green"
                                                        >
                                                            Finalizar
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })
        )}
      </div>

      <NewAppointmentModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={onAddAppointment}
        customers={customers}
        settings={settings}
        services={services}
      />
    </div>
  );
};
