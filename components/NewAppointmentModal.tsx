
import React, { useState, useEffect } from 'react';
import { X, Save, User, Store, Boxes, AlertTriangle } from 'lucide-react';
import { Appointment, AppointmentStatus, Customer, Vehicle, BusinessSettings, ServiceItem } from '../types';
import { cn, formatPhone, formatPlate } from '../lib/utils';

interface NewAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (appointment: Appointment, newCustomer?: Customer) => void;
  customers: Customer[];
  existingAppointments?: Appointment[];
  settings: BusinessSettings;
  services?: ServiceItem[];
}

export const NewAppointmentModal: React.FC<NewAppointmentModalProps> = ({ 
    isOpen, onClose, onSave, customers, settings, services = []
}) => {
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [blockedError, setBlockedError] = useState(false);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    durationMinutes: 60,
    boxId: 1,
    price: 0,
    observation: ''
  });

  const [newCustomerData, setNewCustomerData] = useState({
      name: '', phone: '', vehicleBrand: '', vehicleModel: '', vehiclePlate: ''
  });

  useEffect(() => {
    if (!isOpen) {
      setSelectedCustomer(null);
      setSelectedService(null);
      setIsNewCustomer(false);
      setNewCustomerData({ name: '', phone: '', vehicleBrand: '', vehicleModel: '', vehiclePlate: '' });
      setBlockedError(false);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalCustomerId = selectedCustomer?.id || '';
    let finalVehicleId = selectedVehicle?.id || '';
    let newlyCreatedCustomer: Customer | undefined;

    if (isNewCustomer) {
        if (!newCustomerData.name || !newCustomerData.phone) return alert("Preencha os dados do novo cliente.");
        
        newlyCreatedCustomer = {
            id: 'temp_id', // App.tsx tratará a inserção real
            name: newCustomerData.name,
            phone: newCustomerData.phone,
            email: '',
            totalSpent: 0,
            lastVisit: formData.date,
            vehicles: [{
                id: 'temp_v_id',
                brand: newCustomerData.vehicleBrand,
                model: newCustomerData.vehicleModel,
                plate: (newCustomerData.vehiclePlate || '').toUpperCase(),
                color: 'A definir',
                type: 'CARRO'
            }]
        };
    }

    if (!isNewCustomer && !finalCustomerId) return alert("Selecione um cliente da base.");
    if (!selectedService) return alert("Selecione um serviço.");

    // Validate blocked dates
    if (settings.blocked_dates?.some(bd => bd.date === formData.date)) {
        setBlockedError(true);
        return;
    }

    const newAppointment: Appointment = {
      id: `new_${Date.now()}`,
      customerId: finalCustomerId,
      vehicleId: finalVehicleId,
      boxId: formData.boxId,
      serviceId: selectedService.id,
      serviceType: selectedService.name,
      date: formData.date,
      time: formData.time,
      // Fix: changed durationMinutes to duration_minutes
      durationMinutes: selectedService.duration_minutes || 60,
      price: Number(formData.price || selectedService.price),
      status: AppointmentStatus.NOVO,
      observation: formData.observation
    };

    onSave(newAppointment, newlyCreatedCustomer);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
      <div className="bg-[#0c0c0c] border border-white/10 rounded-[3rem] w-full max-w-5xl shadow-2xl animate-in zoom-in duration-300 flex flex-col max-h-[95vh] overflow-hidden relative">
        
        {/* Error Overlay for Blocked Dates */}
        {blockedError && (
             <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center rounded-[3rem]">
                 <div className="bg-zinc-950 border border-red-600/30 p-10 rounded-[2.5rem] max-w-md text-center shadow-2xl animate-in zoom-in-95 duration-300 mx-4">
                     <AlertTriangle size={56} className="text-red-500 mx-auto mb-6" strokeWidth={1.5} />
                     <h3 className="text-2xl font-black text-white uppercase mb-3 tracking-tight">Operação Bloqueada</h3>
                     <p className="text-zinc-500 text-sm mb-8 font-medium leading-relaxed">
                         A data selecionada <span className="text-white font-bold">({new Date(formData.date + 'T12:00:00').toLocaleDateString('pt-BR')})</span> consta como dia não operacional nas configurações do sistema.
                     </p>
                     <button 
                        onClick={() => setBlockedError(false)} 
                        className="px-10 py-4 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-glow-red transition-all"
                     >
                         Corrigir Data
                     </button>
                 </div>
             </div>
        )}

        <div className="flex justify-between items-center p-8 border-b border-white/5 bg-[#09090b]">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3 tracking-tighter uppercase">
               <Store className="text-red-600" /> Agendamento Nominal
            </h2>
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.4em] mt-1">Sincronização Ativa</p>
          </div>
          <button onClick={onClose} className="p-3 bg-white/5 rounded-full text-zinc-500 hover:text-white transition-colors"><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
            <div className="flex flex-col md:flex-row gap-8">
                <div className="flex-1 space-y-6">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <User size={14} className="text-red-600" />
                            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Identidade do Ativo</span>
                        </div>
                        <button type="button" onClick={() => setIsNewCustomer(!isNewCustomer)} className={cn(
                            "px-4 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all",
                            isNewCustomer ? "bg-red-600 text-white border-red-600" : "bg-white/5 text-zinc-500 border-white/5 hover:text-white"
                        )}>
                           {isNewCustomer ? "Voltar à Seleção" : "+ Novo Cliente"}
                        </button>
                    </div>

                    {!isNewCustomer ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <select required className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-4 text-sm text-white outline-none" value={selectedCustomer?.id || ''} onChange={e => {
                                const c = customers.find(cust => cust.id === e.target.value);
                                setSelectedCustomer(c || null);
                                if (c && c.vehicles.length > 0) setSelectedVehicle(c.vehicles[0]);
                            }}>
                                <option value="">Vincular Cliente...</option>
                                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            {selectedCustomer && (
                                <select required className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-4 text-sm text-white outline-none" value={selectedVehicle?.id || ''} onChange={e => setSelectedVehicle(selectedCustomer.vehicles.find(v => v.id === e.target.value) || null)}>
                                    {selectedCustomer.vehicles.map(v => <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.plate})</option>)}
                                </select>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input type="text" placeholder="NOME DO CLIENTE" className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-4 text-[10px] font-bold text-white uppercase outline-none focus:border-red-600" value={newCustomerData.name} onChange={e => setNewCustomerData({...newCustomerData, name: e.target.value})} />
                            <input type="text" placeholder="WHATSAPP / CEL" className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-4 text-[10px] font-bold text-white uppercase outline-none focus:border-red-600" value={newCustomerData.phone} onChange={e => setNewCustomerData({...newCustomerData, phone: formatPhone(e.target.value)})} maxLength={15} />
                            <input type="text" placeholder="PLACA" className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-4 text-[10px] font-bold text-white uppercase outline-none focus:border-red-600" value={newCustomerData.vehiclePlate} onChange={e => setNewCustomerData({...newCustomerData, vehiclePlate: formatPlate(e.target.value)})} maxLength={7} />
                            <div className="grid grid-cols-2 gap-2">
                                <input type="text" placeholder="MARCA" className="bg-zinc-950 border border-white/10 rounded-xl px-4 py-4 text-[10px] font-bold text-white uppercase outline-none" value={newCustomerData.vehicleBrand} onChange={e => setNewCustomerData({...newCustomerData, vehicleBrand: e.target.value})} />
                                <input type="text" placeholder="MODELO" className="bg-zinc-950 border border-white/10 rounded-xl px-4 py-4 text-[10px] font-bold text-white uppercase outline-none" value={newCustomerData.vehicleModel} onChange={e => setNewCustomerData({...newCustomerData, vehicleModel: e.target.value})} />
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-1 space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <Boxes size={14} className="text-red-600" />
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Alocação de Recurso</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {/* Fix: changed boxCapacity to box_capacity */}
                        {Array.from({ length: settings.box_capacity }, (_, i) => i + 1).map(num => (
                            <button key={num} type="button" onClick={() => setFormData({...formData, boxId: num})} className={cn(
                                "py-4 rounded-2xl border text-[10px] font-bold uppercase transition-all",
                                formData.boxId === num ? "bg-red-600 border-red-600 text-white shadow-glow-red" : "bg-zinc-950 border-white/5 text-zinc-500"
                            )}>BOX {num}</button>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <input type="date" className="bg-zinc-900 border border-white/10 rounded-xl px-4 py-4 text-sm text-white outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                        <input type="time" className="bg-zinc-900 border border-white/10 rounded-xl px-4 py-4 text-sm text-white outline-none" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6 border-t border-white/5">
                <div className="space-y-4">
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-2">Protocolo de Serviço</label>
                    <select required className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-4 text-[10px] font-bold text-white uppercase" value={selectedService?.id || ''} onChange={e => {
                        const s = services.find(sv => sv.id === e.target.value);
                        setSelectedService(s || null);
                        if (s) setFormData({...formData, price: s.price});
                    }}>
                        <option value="">Selecione o Serviço...</option>
                        {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                <div className="space-y-4">
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-2">Precificação (R$)</label>
                    <input type="number" className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-4 text-sm font-bold text-white tabular-nums" value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} />
                </div>
                <div className="space-y-4">
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-2">Briefing de Pátio</label>
                    <textarea className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-4 text-[10px] font-bold text-white uppercase h-14 resize-none" placeholder="OBSERVAÇÕES..." value={formData.observation} onChange={e => setFormData({...formData, observation: e.target.value})} />
                </div>
            </div>

            <div className="pt-8 flex justify-end gap-6 border-t border-white/5">
                <button type="button" onClick={onClose} className="px-8 py-2 text-[10px] font-bold text-zinc-600 hover:text-white uppercase tracking-widest transition-colors">Abortar</button>
                <button type="submit" className="bg-red-600 hover:bg-red-700 text-white px-12 py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.4em] shadow-glow-red flex items-center gap-4 transition-all">
                    <Save size={18} /> Consolidar Agendamento
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};
