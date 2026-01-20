
import React, { useState } from 'react';
import { Search, Plus, User, Car, Phone, Mail, Trash2, History, Zap, ShieldCheck, Trophy, Target } from 'lucide-react';
import { Customer, BusinessSettings } from '../types';
import { cn, formatPhone, formatPlate } from '../lib/utils';
import { ConfirmationModal } from './ConfirmationModal';

interface CRMProps {
  customers: Customer[];
  onAddCustomer: (customer: any) => void;
  onDeleteCustomer: (id: string) => void;
  businessSettings: BusinessSettings;
  onUpdateSettings: (s: BusinessSettings) => void;
}

export const CRM: React.FC<CRMProps> = ({ customers, onAddCustomer, onDeleteCustomer, businessSettings, onUpdateSettings }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', vehicleBrand: '', vehicleModel: '', vehiclePlate: '' });
  
  // Confirmation Modal State
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

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.vehicles.some(v => (v.plate || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const toggleLoyalty = () => {
    // Fix: changed loyaltyProgramEnabled to loyalty_program_enabled
    onUpdateSettings({ ...businessSettings, loyalty_program_enabled: !businessSettings.loyalty_program_enabled });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddCustomer({
      name: newCustomer.name,
      phone: newCustomer.phone,
      email: newCustomer.email,
      vehicles: [{ brand: newCustomer.vehicleBrand, model: newCustomer.vehicleModel, plate: newCustomer.vehiclePlate.toUpperCase(), color: 'A definir', type: 'CARRO' }]
    });
    setIsModalOpen(false);
    setNewCustomer({ name: '', phone: '', email: '', vehicleBrand: '', vehicleModel: '', vehiclePlate: '' });
  };

  const handleRequestDelete = (id: string, name: string) => {
      setConfirmModal({
          isOpen: true,
          title: 'Excluir Cliente',
          message: `Tem certeza que deseja remover ${name} e todo o seu histórico? Esta ação não pode ser desfeita.`,
          variant: 'danger',
          onConfirm: () => onDeleteCustomer(id)
      });
  };

  return (
    <div className="p-6 md:p-12 pb-24 animate-fade-in space-y-10 max-w-[1800px] mx-auto">
      
      <ConfirmationModal 
         isOpen={confirmModal.isOpen}
         onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
         onConfirm={confirmModal.onConfirm}
         title={confirmModal.title}
         message={confirmModal.message}
         variant={confirmModal.variant}
      />

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 border-b border-white/5 pb-8">
        <div>
          <h2 className="text-4xl font-black text-white uppercase tracking-tighter mb-2 flex items-center gap-3">
            <User className="text-red-600" size={32} /> 
            Base de Ativos
          </h2>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.4em] pl-11">
            Gestão de Carteira e Fidelização
          </p>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          {/* LOYALTY TOGGLE */}
          <button 
            onClick={toggleLoyalty}
            className={cn(
              "hidden md:flex items-center gap-3 px-4 py-3 rounded-xl border transition-all mr-4",
              // Fix: changed loyaltyProgramEnabled to loyalty_program_enabled
              businessSettings.loyalty_program_enabled ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-500" : "bg-zinc-900 border-white/5 text-zinc-600"
            )}
          >
             <Trophy size={16} />
             <div className="text-left">
                <span className="block text-[8px] font-black uppercase tracking-widest opacity-70">Modo Fidelidade</span>
                {/* Fix: changed loyaltyProgramEnabled to loyalty_program_enabled */}
                <span className="block text-[10px] font-bold uppercase">{businessSettings.loyalty_program_enabled ? "Ativado" : "Desativado"}</span>
             </div>
          </button>

          <div className="relative flex-1 md:w-96">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Buscar Nome ou Placa..." 
              className="w-full bg-[#09090b] border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-xs font-bold uppercase tracking-wide text-white focus:outline-none focus:border-red-600/50 transition-all placeholder:text-zinc-700"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-white text-black px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-glow active:scale-95"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* GRID LIST */}
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
        {filteredCustomers.map(c => {
            const washes = c.washes || 0;
            const progress = Math.min(100, (washes / 10) * 100);
            const isVIP = washes >= 10;

            return (
                <div key={c.id} className="group relative bg-[#09090b] rounded-[2rem] border border-white/5 hover:border-white/10 p-8 transition-all duration-300 overflow-hidden">
                    {/* Hover Glow */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    {isVIP && <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 blur-[50px] rounded-full pointer-events-none" />}

                    <div className="relative z-10 flex flex-col h-full">
                        {/* Header */}
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-4">
                                <div className={cn(
                                    "w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black border shadow-lg",
                                    isVIP ? "bg-yellow-950/20 border-yellow-500/30 text-yellow-500" : "bg-zinc-900 border-white/5 text-zinc-500"
                                )}>
                                    {c.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-white uppercase tracking-tight">{c.name}</h3>
                                    <span className={cn(
                                        "text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-widest",
                                        isVIP ? "text-yellow-500 border-yellow-500/20 bg-yellow-500/5" : "text-zinc-500 border-zinc-800 bg-zinc-900"
                                    )}>
                                        {isVIP ? "Cliente Elite" : "Cliente Standard"}
                                    </span>
                                </div>
                            </div>
                            <button 
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleRequestDelete(c.id, c.name);
                                }} 
                                className="text-zinc-700 hover:text-red-500 transition-colors p-2"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>

                        {/* Contacts */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                             <div className="bg-zinc-950/50 p-3 rounded-xl border border-white/5">
                                 <p className="text-[8px] font-black text-zinc-600 uppercase mb-1">Contato</p>
                                 <p className="text-[10px] font-bold text-zinc-300 flex items-center gap-2 truncate"><Phone size={10} /> {c.phone}</p>
                             </div>
                             <div className="bg-zinc-950/50 p-3 rounded-xl border border-white/5">
                                 <p className="text-[8px] font-black text-zinc-600 uppercase mb-1">LTV Total</p>
                                 <p className="text-[10px] font-bold text-white flex items-center gap-2"><Target size={10} className="text-green-500"/> R$ {c.totalSpent.toFixed(2)}</p>
                             </div>
                        </div>

                        {/* Vehicles */}
                        <div className="flex-1 space-y-2 mb-6">
                            <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest pl-1">Garagem</p>
                            <div className="flex flex-wrap gap-2">
                                {(c.vehicles || []).map(v => (
                                    <div key={v.id} className="flex items-center gap-2 bg-zinc-900 border border-white/5 px-3 py-2 rounded-lg">
                                        <Car size={12} className="text-zinc-500" />
                                        <span className="text-[10px] font-bold text-zinc-300 uppercase">{v.brand} {v.model}</span>
                                        <span className="text-[9px] font-black text-red-500 uppercase bg-red-950/10 px-1 rounded">{v.plate}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Loyalty Bar */}
                        {/* Fix: changed loyaltyProgramEnabled to loyalty_program_enabled */}
                        {businessSettings.loyalty_program_enabled && (
                            <div className="mt-auto">
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1"><Zap size={10} className={isVIP ? "text-yellow-500" : "text-zinc-600"}/> Nível de Fidelidade</span>
                                    <span className="text-[10px] font-bold text-white tabular-nums">{washes}/10</span>
                                </div>
                                <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                                    <div 
                                        className={cn("h-full transition-all duration-1000", isVIP ? "bg-yellow-500 shadow-[0_0_10px_#eab308]" : "bg-red-600")} 
                                        style={{ width: `${progress}%` }} 
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )
        })}
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-sm">
             <div className="bg-[#0c0c0c] border border-white/10 rounded-[2.5rem] w-full max-w-lg p-8 animate-in zoom-in duration-300">
                 <h3 className="text-xl font-bold text-white uppercase mb-8 flex items-center gap-2"><Plus className="text-red-600" /> Registrar Ativo</h3>
                 <form onSubmit={handleSubmit} className="space-y-4">
                     <div className="space-y-1">
                        <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest pl-2">Dados Pessoais</label>
                        <input required placeholder="NOME COMPLETO" className="w-full bg-zinc-950 border border-white/10 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none focus:border-red-600 transition-colors" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} />
                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <input required placeholder="TELEFONE" className="w-full bg-zinc-950 border border-white/10 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none focus:border-red-600 transition-colors" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: formatPhone(e.target.value)})} maxLength={15} />
                            <input placeholder="EMAIL (OPCIONAL)" className="w-full bg-zinc-950 border border-white/10 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none focus:border-red-600 transition-colors" value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} />
                        </div>
                     </div>
                     <div className="space-y-1 pt-4 border-t border-white/5">
                        <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest pl-2">Veículo Principal</label>
                        <div className="grid grid-cols-2 gap-4">
                            <input required placeholder="MARCA" className="w-full bg-zinc-950 border border-white/10 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none focus:border-red-600 transition-colors" value={newCustomer.vehicleBrand} onChange={e => setNewCustomer({...newCustomer, vehicleBrand: e.target.value})} />
                            <input required placeholder="MODELO" className="w-full bg-zinc-950 border border-white/10 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none focus:border-red-600 transition-colors" value={newCustomer.vehicleModel} onChange={e => setNewCustomer({...newCustomer, vehicleModel: e.target.value})} />
                        </div>
                        <input required placeholder="PLACA" className="w-full bg-zinc-950 border border-white/10 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none focus:border-red-600 transition-colors mt-2" value={newCustomer.vehiclePlate} onChange={e => setNewCustomer({...newCustomer, vehiclePlate: formatPlate(e.target.value)})} maxLength={7} />
                     </div>
                     <div className="flex gap-4 pt-6">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 rounded-xl text-[10px] font-black uppercase text-zinc-500 hover:text-white">Cancelar</button>
                        <button type="submit" className="flex-1 py-4 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase shadow-glow-red hover:bg-red-500 transition-all">Salvar</button>
                     </div>
                 </form>
             </div>
        </div>
      )}
    </div>
  );
};
