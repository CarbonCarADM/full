
import React, { useState, useEffect, useRef } from 'react';
import { Save, LayoutGrid, Clock, ListPlus, Gem, Check, Building2, Image as ImageIcon, RefreshCw, Upload, Store, Loader2, CalendarX, Plus, Trash2, Zap, Gauge, MapPin, Copy, ExternalLink, AlertTriangle, Calendar as CalendarIcon, Instagram, Boxes } from 'lucide-react';
import { PlanType, BusinessSettings, ServiceItem, OperatingRule, BlockedDate } from '../types';
import { PLAN_FEATURES } from '../constants';
import { cn } from '../lib/utils';
import { useEntitySaver } from '../hooks/useEntitySaver';
import { supabase } from '../lib/supabaseClient';

interface SettingsProps {
  currentPlan: PlanType;
  onUpgrade: (plan: PlanType) => void;
  settings: BusinessSettings;
  onUpdateSettings: (s: BusinessSettings) => void;
  services: ServiceItem[];
  onAddService: (s: ServiceItem) => void;
  onDeleteService: (id: string) => void;
}

const DAYS_OF_WEEK = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export const Settings: React.FC<SettingsProps> = ({ 
    currentPlan, onUpgrade, settings, onUpdateSettings, services = [], onAddService, onDeleteService
}) => {
  const [activeTab, setActiveTab] = useState<'operacional' | 'servicos' | 'geral' | 'assinatura'>('geral');
  const [savingSettings, setSavingSettings] = useState(false);
  const { save, loading: savingEntity } = useEntitySaver();
  const [localSettings, setLocalSettings] = useState<BusinessSettings>(settings);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [newService, setNewService] = useState({ name: '', price: 0, duration_minutes: 60, description: '' });
  const [newBlockedDate, setNewBlockedDate] = useState<BlockedDate>({ date: '', reason: '' });
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Ref para input de fotos do espaço
  const studioPhotosInputRef = useRef<HTMLInputElement>(null);
  const [uploadingStudioPhoto, setUploadingStudioPhoto] = useState(false);

  useEffect(() => { 
    setLocalSettings({ 
        ...settings, 
        operating_days: settings.operating_days || settings.configs?.operating_days || [],
        blocked_dates: settings.blocked_dates || settings.configs?.blocked_dates || [],
        configs: {
            ...settings.configs,
            studio_photos: settings.configs?.studio_photos || []
        }
    }); 
  }, [settings]);

  const bookingUrl = `${window.location.origin}${window.location.pathname}?studio=${settings.slug}`;
  const isLimitReached = currentPlan === PlanType.START && services.length >= 5;

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return setSavingSettings(false);
    
    const { operating_days, blocked_dates, ...rest } = localSettings;
    const payload = { 
        ...rest, 
        user_id: session.user.id, 
        configs: { 
            ...(rest.configs || {}), 
            operating_days: operating_days || [],
            blocked_dates: blocked_dates || [],
            instagram: localSettings.configs?.instagram, // Ensure instagram is saved in configs
            studio_photos: localSettings.configs?.studio_photos || [] // Ensure photos are saved
        } 
    };
    
    const result = await save('business_settings', payload as any);
    if (result.success && result.data) {
        const updated = result.data as any;
        onUpdateSettings({ 
            ...updated, 
            operating_days: updated.configs?.operating_days || [],
            blocked_dates: updated.configs?.blocked_dates || [],
            configs: updated.configs // Update configs in local state parent
        });
    }
    setSavingSettings(false);
  };

  const handleAddBlockedDate = () => {
      if (!newBlockedDate.date) return;
      const updated = [...(localSettings.blocked_dates || []), newBlockedDate];
      setLocalSettings({...localSettings, blocked_dates: updated});
      setNewBlockedDate({ date: '', reason: '' });
  };

  const removeBlockedDate = (date: string) => {
      setLocalSettings({
          ...localSettings,
          blocked_dates: localSettings.blocked_dates?.filter(d => d.date !== date)
      });
  };

  // Lógica para upload de fotos do espaço
  const handleUploadStudioPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploadingStudioPhoto(true);
      try {
          const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
          const filePath = `studio-photos/${settings.id}/${Date.now()}.${fileExt}`;

          // Reutilizando bucket 'portfolio_items' para evitar mexer no backend/policies
          const { error: uploadError } = await supabase.storage
              .from('portfolio_items') 
              .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
              .from('portfolio_items')
              .getPublicUrl(filePath);

          const currentPhotos = localSettings.configs?.studio_photos || [];
          setLocalSettings({
              ...localSettings,
              configs: {
                  ...localSettings.configs,
                  studio_photos: [...currentPhotos, publicUrl]
              }
          });

      } catch (error: any) {
          console.error("Erro no upload:", error);
          alert("Erro ao fazer upload da imagem.");
      } finally {
          setUploadingStudioPhoto(false);
          if (studioPhotosInputRef.current) studioPhotosInputRef.current.value = '';
      }
  };

  const handleRemoveStudioPhoto = (urlToRemove: string) => {
      const currentPhotos = localSettings.configs?.studio_photos || [];
      setLocalSettings({
          ...localSettings,
          configs: {
              ...localSettings.configs,
              studio_photos: currentPhotos.filter((url: string) => url !== urlToRemove)
          }
      });
  };

  const handleAddServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLimitReached) return alert("Limite de 5 serviços atingido no plano START. Faça upgrade para PRO!");
    const { data: { session } } = await supabase.auth.getSession();
    const result = await save('services', { ...newService, business_id: settings.id, user_id: session?.user?.id, is_active: true });
    if (result.success) { onAddService(result.data as any); setIsServiceModalOpen(false); setNewService({ name: '', price: 0, duration_minutes: 60, description: '' }); }
  };

  return (
    <div className="p-6 md:p-8 pb-32 animate-fade-in max-w-[1400px] mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-white/5 pb-6">
        <div><h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2 flex items-center gap-4"><LayoutGrid className="text-red-600" size={28} /> Configurações</h2></div>
        <button onClick={handleSaveSettings} disabled={savingSettings} className="bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 transition-all shadow-glow-red active:scale-95 w-full md:w-auto justify-center">{savingSettings ? <RefreshCw className="animate-spin" size={16}/> : <Save size={16} />} <span>Salvar Alterações</span></button>
      </div>

      <div className="flex gap-2 p-1 bg-[#09090b] border border-white/5 rounded-2xl w-full md:w-fit overflow-x-auto custom-scrollbar">
        {[{ id: 'geral', label: 'Identidade', icon: Zap }, { id: 'operacional', label: 'Operacional', icon: Clock }, { id: 'servicos', label: 'Serviços', icon: ListPlus }, { id: 'assinatura', label: 'Assinatura', icon: Gem }].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={cn("px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all whitespace-nowrap", activeTab === tab.id ? "bg-white text-black shadow-glow" : "text-zinc-500 hover:text-white")}>
                <tab.icon size={14} /> {tab.label}
            </button>
        ))}
      </div>

      <div className="min-h-[500px]">
        {activeTab === 'geral' && (
            <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-[#09090b] border border-white/10 rounded-[2.5rem] p-6 space-y-6">
                        <h3 className="text-lg font-black text-white uppercase flex items-center gap-3"><Building2 size={18} className="text-red-600"/> Dados do Hangar</h3>
                        <div className="space-y-6">
                            <div className="flex flex-col md:flex-row gap-6 items-start">
                                <div onClick={() => fileInputRef.current?.click()} className="w-20 h-20 rounded-2xl bg-zinc-950 border border-white/10 flex items-center justify-center cursor-pointer hover:border-red-600 transition-colors overflow-hidden relative group shrink-0">
                                    {localSettings.profile_image_url ? <img src={localSettings.profile_image_url} className="w-full h-full object-cover" /> : <ImageIcon className="text-zinc-700"/>}
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Upload size={16} className="text-white"/></div>
                                </div>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={e => { const file = e.target.files?.[0]; if (!file) return; const r = new FileReader(); r.onloadend = () => setLocalSettings({...localSettings, profile_image_url: r.result as string}); r.readAsDataURL(file); }} />
                                <div className="flex-1 space-y-3 w-full">
                                    <input className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-xs font-bold text-white uppercase outline-none focus:border-red-600" value={localSettings.business_name} onChange={e => setLocalSettings({...localSettings, business_name: e.target.value})} placeholder="Nome da Estética" />
                                    <div className="grid grid-cols-2 gap-3">
                                        <input 
                                            className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-xs font-bold text-white uppercase outline-none focus:border-red-600" 
                                            value={localSettings.whatsapp || ''} 
                                            onChange={e => setLocalSettings({...localSettings, whatsapp: e.target.value})} 
                                            placeholder="WHATSAPP" 
                                        />
                                        <input 
                                            className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-red-600" 
                                            value={localSettings.configs?.instagram || ''} 
                                            onChange={e => setLocalSettings({
                                                ...localSettings, 
                                                configs: { ...localSettings.configs, instagram: e.target.value }
                                            })} 
                                            placeholder="@INSTAGRAM" 
                                        />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-2 block ml-2">Endereço Físico</label>
                                <input className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-xs font-bold text-white uppercase outline-none focus:border-red-600" value={localSettings.address || ''} onChange={e => setLocalSettings({...localSettings, address: e.target.value})} placeholder="Rua, Número, Bairro, Cidade - UF" />
                            </div>
                        </div>
                    </div>
                    <div className="bg-[#09090b] border border-white/10 rounded-[2.5rem] p-6 space-y-4">
                        <h3 className="text-lg font-black text-white uppercase flex items-center gap-3"><ExternalLink size={18} className="text-red-600"/> Link de Agendamento</h3>
                        <div className="bg-black/50 border border-white/5 p-4 rounded-2xl flex items-center justify-between">
                            <code className="text-[10px] text-zinc-400 font-mono truncate mr-4">{bookingUrl}</code>
                            <button onClick={() => { navigator.clipboard.writeText(bookingUrl); alert("Link copiado!"); }} className="p-3 bg-white/5 rounded-xl text-zinc-400 hover:text-white"><Copy size={16} /></button>
                        </div>
                    </div>
                </div>

                {/* Seção Fotos do Espaço */}
                <div className="bg-[#09090b] border border-white/10 rounded-[2.5rem] p-6 space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-black text-white uppercase flex items-center gap-3">
                            <ImageIcon size={18} className="text-red-600"/> Fotos do Espaço
                        </h3>
                        <button 
                            onClick={() => studioPhotosInputRef.current?.click()}
                            disabled={uploadingStudioPhoto}
                            className="bg-zinc-900 hover:bg-white hover:text-black text-white border border-white/10 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all disabled:opacity-50"
                        >
                            {uploadingStudioPhoto ? <Loader2 className="animate-spin" size={12} /> : <Plus size={12} />}
                            Adicionar Foto
                        </button>
                        <input 
                            type="file" 
                            ref={studioPhotosInputRef} 
                            className="hidden" 
                            accept="image/*" 
                            onChange={handleUploadStudioPhoto} 
                        />
                    </div>
                    
                    {(!localSettings.configs?.studio_photos || localSettings.configs.studio_photos.length === 0) ? (
                        <div className="h-32 rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center text-zinc-600">
                            <ImageIcon size={24} className="mb-2 opacity-50"/>
                            <p className="text-[10px] font-bold uppercase tracking-widest">Nenhuma foto adicionada</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {localSettings.configs.studio_photos.map((url: string, idx: number) => (
                                <div key={idx} className="aspect-square rounded-2xl bg-zinc-950 relative group overflow-hidden border border-white/5">
                                    <img src={url} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button 
                                            onClick={() => handleRemoveStudioPhoto(url)}
                                            className="p-2 bg-red-600 rounded-lg text-white hover:bg-red-500 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}

        {activeTab === 'operacional' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
                <div className="space-y-6">
                    {/* Capacidade */}
                    <div className="bg-[#09090b] border border-white/10 rounded-[2.5rem] p-6">
                        <h3 className="text-lg font-black text-white uppercase flex items-center gap-3 mb-4">
                            <Boxes size={18} className="text-red-600"/> Capacidade de Atendimento
                        </h3>
                        <div className="flex flex-col md:flex-row gap-6 items-center">
                            <div className="flex-1">
                                <p className="text-sm font-bold text-white uppercase mb-1">Boxes Simultâneos</p>
                                <p className="text-xs text-zinc-500">Defina quantos veículos podem ser atendidos ao mesmo tempo.</p>
                            </div>
                            <div className="flex items-center gap-4 bg-zinc-950 border border-white/5 rounded-2xl p-2">
                                <button onClick={() => setLocalSettings(s => ({...s, box_capacity: Math.max(1, (s.box_capacity || 1) - 1)}))} className="w-10 h-10 rounded-xl bg-zinc-900 text-white hover:bg-red-600 transition-colors flex items-center justify-center font-bold text-lg">-</button>
                                <input 
                                    type="number" 
                                    className="w-12 bg-transparent text-center text-xl font-black text-white outline-none appearance-none"
                                    value={localSettings.box_capacity || 1}
                                    onChange={(e) => setLocalSettings({...localSettings, box_capacity: Math.max(1, parseInt(e.target.value) || 1)})}
                                />
                                <button onClick={() => setLocalSettings(s => ({...s, box_capacity: (s.box_capacity || 1) + 1}))} className="w-10 h-10 rounded-xl bg-zinc-900 text-white hover:bg-green-600 transition-colors flex items-center justify-center font-bold text-lg">+</button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#09090b] border border-white/10 rounded-[2.5rem] p-6">
                        <h3 className="text-lg font-black text-white uppercase flex items-center gap-3 mb-6"><Clock size={18} className="text-red-600"/> Horários Operacionais</h3>
                        <div className="space-y-2">
                            {DAYS_OF_WEEK.map((day, idx) => {
                                const rule = localSettings.operating_days?.find(r => r.dayOfWeek === idx) || { dayOfWeek: idx, isOpen: false, openTime: '08:00', closeTime: '18:00' };
                                return (
                                    <div key={day} className={cn("flex flex-col md:flex-row md:items-center gap-4 p-3 rounded-xl border transition-all", rule.isOpen ? "bg-zinc-950 border-white/10" : "bg-black border-white/5 opacity-40")}>
                                        <div className="flex items-center gap-4">
                                            <button onClick={() => {
                                                const newDays = [...(localSettings.operating_days || [])];
                                                const i = newDays.findIndex(r => r.dayOfWeek === idx);
                                                if (i >= 0) newDays[i] = { ...newDays[i], isOpen: !rule.isOpen };
                                                else newDays.push({ dayOfWeek: idx, isOpen: true, openTime: '08:00', closeTime: '18:00' });
                                                setLocalSettings({...localSettings, operating_days: newDays});
                                            }} className={cn("w-8 h-5 rounded-full p-0.5 transition-all relative shrink-0", rule.isOpen ? "bg-red-600" : "bg-zinc-800")}>
                                                <div className={cn("w-4 h-4 bg-white rounded-full shadow-md transition-all", rule.isOpen ? "translate-x-3" : "translate-x-0")} />
                                            </button>
                                            <span className="w-32 text-[10px] font-black text-white uppercase tracking-widest">{day}</span>
                                        </div>
                                        {rule.isOpen && (
                                            <div className="flex items-center gap-2 md:ml-auto">
                                                <input type="time" className="bg-black border border-white/10 rounded p-1 text-[10px] text-white" value={rule.openTime} onChange={e => {
                                                    const newDays = [...(localSettings.operating_days || [])];
                                                    const i = newDays.findIndex(r => r.dayOfWeek === idx);
                                                    newDays[i] = {...newDays[i], openTime: e.target.value};
                                                    setLocalSettings({...localSettings, operating_days: newDays});
                                                }} />
                                                <span className="text-zinc-600">às</span>
                                                <input type="time" className="bg-black border border-white/10 rounded p-1 text-[10px] text-white" value={rule.closeTime} onChange={e => {
                                                    const newDays = [...(localSettings.operating_days || [])];
                                                    const i = newDays.findIndex(r => r.dayOfWeek === idx);
                                                    newDays[i] = {...newDays[i], closeTime: e.target.value};
                                                    setLocalSettings({...localSettings, operating_days: newDays});
                                                }} />
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                <div className="bg-[#09090b] border border-white/10 rounded-[2.5rem] p-6 h-fit">
                    <h3 className="text-lg font-black text-white uppercase flex items-center gap-3 mb-6"><CalendarX size={18} className="text-red-600"/> Datas de Exceção</h3>
                    <div className="space-y-4 mb-6 p-4 bg-zinc-950 border border-white/5 rounded-2xl">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase mb-4">Bloquear agenda em dias específicos (Feriados/Folgas)</p>
                        <div className="grid grid-cols-2 gap-4">
                            <input type="date" className="bg-black border border-white/10 rounded-xl p-3 text-xs text-white" value={newBlockedDate.date} onChange={e => setNewBlockedDate({...newBlockedDate, date: e.target.value})} />
                            <input placeholder="MOTIVO (OPCIONAL)" className="bg-black border border-white/10 rounded-xl p-3 text-xs text-white uppercase font-bold" value={newBlockedDate.reason} onChange={e => setNewBlockedDate({...newBlockedDate, reason: e.target.value})} />
                        </div>
                        <button onClick={handleAddBlockedDate} className="w-full py-3 bg-white text-black rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all">
                            <Plus size={14} /> Adicionar Bloqueio
                        </button>
                    </div>

                    <div className="space-y-2">
                        {localSettings.blocked_dates?.map(d => (
                            <div key={d.date} className="flex items-center justify-between p-3 bg-zinc-950 border border-white/5 rounded-xl group">
                                <div className="flex items-center gap-3">
                                    <CalendarIcon size={14} className="text-red-500" />
                                    <div>
                                        <p className="text-[10px] font-black text-white uppercase tracking-widest">{new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                                        <p className="text-[9px] font-bold text-zinc-600 uppercase">{d.reason || 'Data Bloqueada'}</p>
                                    </div>
                                </div>
                                <button onClick={() => removeBlockedDate(d.date)} className="p-2 text-zinc-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14}/></button>
                            </div>
                        ))}
                        {!localSettings.blocked_dates?.length && (
                            <div className="py-12 text-center opacity-30"><p className="text-[10px] font-black uppercase tracking-widest">Nenhuma data bloqueada</p></div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'servicos' && (
            <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-black text-white uppercase">Catálogo de Serviços</h3>
                        <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">{services.length} {currentPlan === PlanType.START ? '/ 5' : ''} serviços ativos</p>
                    </div>
                    <button onClick={() => setIsServiceModalOpen(true)} className="bg-white text-black px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all flex items-center gap-2"><Plus size={16} /> <span className="hidden md:inline">Adicionar Serviço</span></button>
                </div>
                {isLimitReached && (
                    <div className="bg-red-900/10 border border-red-600/20 p-4 rounded-2xl flex items-center gap-4 text-red-500">
                        <AlertTriangle size={20} />
                        <p className="text-[10px] font-black uppercase tracking-widest">Limite do Plano Start atingido. Faça upgrade para adicionar mais serviços.</p>
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {services.map(s => (
                        <div key={s.id} className="bg-[#09090b] border border-white/5 p-5 rounded-[1.5rem] hover:border-white/10 transition-all group relative">
                            <button 
                                onClick={(e) => { 
                                    e.stopPropagation();
                                    onDeleteService(s.id); 
                                }} 
                                className="absolute top-5 right-5 p-2 text-zinc-700 hover:text-red-500 hover:bg-red-900/10 rounded-lg transition-all z-10"
                            >
                                <Trash2 size={14}/>
                            </button>
                            <h4 className="text-sm font-black text-white uppercase mb-1">{s.name}</h4>
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">{s.duration_minutes} min • R$ {Number(s.price).toFixed(2)}</p>
                            <p className="text-xs text-zinc-600 leading-relaxed line-clamp-2">{s.description || 'Sem descrição.'}</p>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'assinatura' && (
             <div>
                 <div className="flex justify-center mb-8">
                    <div className="inline-flex items-center p-1 bg-zinc-950 border border-white/5 rounded-xl">
                        <button onClick={() => setBillingCycle('MONTHLY')} className={cn("px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", billingCycle === 'MONTHLY' ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-white")}>Mensal</button>
                        <button onClick={() => setBillingCycle('ANNUAL')} className={cn("px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1", billingCycle === 'ANNUAL' ? "bg-white text-black" : "text-zinc-500 hover:text-white")}>Anual <span className="text-[8px] text-green-600 bg-green-100 px-1 rounded ml-1">-15%</span></button>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     {(Object.keys(PLAN_FEATURES) as PlanType[]).map(plan => {
                         const f = PLAN_FEATURES[plan];
                         const isActive = currentPlan === plan;
                         // Pega o link de checkout correto (se existir) para o ciclo de pagamento selecionado
                         const checkoutLink = billingCycle === 'MONTHLY' ? f.stripeLinkMonthly : f.stripeLinkAnnual;

                         return (
                             <div key={plan} className={cn("p-8 rounded-[2.5rem] border flex flex-col transition-all relative overflow-hidden", isActive ? "bg-zinc-900 border-red-600/50" : "bg-[#09090b] border-white/5")}>
                                 {isActive && <div className="absolute top-4 right-4"><Check className="text-red-600" /></div>}
                                 <h4 className="text-xl font-black uppercase text-white mb-1">{f.label}</h4>
                                 <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-6">{f.description}</p>
                                 <div className="mb-8">
                                     <span className="text-4xl font-black text-white">R$ {billingCycle === 'MONTHLY' ? f.monthlyPrice : f.annualPrice}</span>
                                     <span className="text-zinc-600 text-[10px] font-bold ml-1">/ MÊS</span>
                                     {billingCycle === 'ANNUAL' && f.annualPrice > 0 && (
                                         <p className="text-[9px] text-green-500 font-bold uppercase mt-2">Total Anual: R$ {(f.annualPrice * 12).toFixed(2)}</p>
                                     )}
                                 </div>
                                 <ul className="space-y-4 mb-10 flex-1">{f.features.map((feat, idx) => (<li key={idx} className="flex items-center gap-3 text-[10px] font-bold text-zinc-300 uppercase tracking-wide"><div className="w-1.5 h-1.5 rounded-full bg-red-600" /> {feat}</li>))}</ul>
                                 
                                 {/* Botão de Ação: Se ativo, desabilitado. Se não, abre link de checkout ou executa fallback */}
                                 <button 
                                    onClick={() => {
                                        if (checkoutLink) {
                                            window.open(checkoutLink, '_blank');
                                        } else {
                                            onUpgrade(plan);
                                        }
                                    }} 
                                    disabled={isActive} 
                                    className={cn(
                                        "w-full py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", 
                                        isActive 
                                            ? "bg-red-600/10 text-red-500 cursor-default" 
                                            : "bg-white text-black hover:bg-zinc-200 active:scale-95"
                                    )}
                                >
                                    {isActive ? "Plano Atual" : "Upgrade de Hangar"}
                                </button>
                             </div>
                         )
                     })}
                 </div>
             </div>
        )}
      </div>

      {isServiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-sm">
             <div className="bg-[#0c0c0c] border border-white/10 rounded-[2.5rem] w-full max-w-lg p-8 animate-in zoom-in duration-300">
                 <h3 className="text-xl font-bold text-white uppercase mb-8">Novo Serviço</h3>
                 <form onSubmit={handleAddServiceSubmit} className="space-y-4">
                     <input required placeholder="NOME DO SERVIÇO" className="w-full bg-zinc-950 border border-white/10 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none" value={newService.name} onChange={e => setNewService({...newService, name: e.target.value})} />
                     <div className="grid grid-cols-2 gap-4">
                        <input type="number" required placeholder="PREÇO (R$)" className="w-full bg-zinc-950 border border-white/10 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none" value={newService.price || ''} onChange={e => setNewService({...newService, price: Number(e.target.value)})} />
                        <input type="number" required placeholder="DURAÇÃO (MIN)" className="w-full bg-zinc-950 border border-white/10 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none" value={newService.duration_minutes || ''} onChange={e => setNewService({...newService, duration_minutes: Number(e.target.value)})} />
                     </div>
                     <textarea placeholder="DESCRIÇÃO BREVE" className="w-full bg-zinc-950 border border-white/10 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none h-24" value={newService.description} onChange={e => setNewService({...newService, description: e.target.value})} />
                     <div className="flex gap-4 pt-4">
                        <button type="button" onClick={() => setIsServiceModalOpen(false)} className="flex-1 py-4 text-[10px] font-black uppercase text-zinc-500">Cancelar</button>
                        <button type="submit" className="flex-1 py-4 bg-white text-black rounded-xl text-[10px] font-black uppercase hover:bg-zinc-200 transition-all">Salvar</button>
                     </div>
                 </form>
             </div>
        </div>
      )}
    </div>
  );
};
