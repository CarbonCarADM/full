
import React, { useState, useRef } from 'react';
import { Image as ImageIcon, Star, Trash2, Plus, Upload, Camera, Lock, Loader2, Award, Sparkles, MessageSquare, ExternalLink, X, Send, Reply } from 'lucide-react';
import { PlanType, PortfolioItem, Review } from '../types';
import { cn } from '../lib/utils';
import { useEntitySaver } from '../hooks/useEntitySaver';
import { supabase } from '../lib/supabaseClient';

interface MarketingModuleProps {
    portfolio: PortfolioItem[];
    onAddPortfolioItem: (item: PortfolioItem) => void;
    onDeletePortfolioItem: (id: string) => void;
    reviews: Review[];
    onReplyReview: (reviewId: string, reply: string) => Promise<void>;
    currentPlan?: PlanType;
    onUpgrade?: () => void;
    businessId?: string;
}

export const MarketingModule: React.FC<MarketingModuleProps> = ({ 
    portfolio, onAddPortfolioItem, onDeletePortfolioItem, reviews, onReplyReview, currentPlan, onUpgrade, businessId 
}) => {
    const [activeTab, setActiveTab] = useState<'portfolio' | 'reviews'>('portfolio');
    const [previewUrl, setPreviewUrl] = useState<string>('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [desc, setDesc] = useState('');
    const { save, loading: isSaving } = useEntitySaver();
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reply states
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [isSendingReply, setIsSendingReply] = useState(false);

    if (currentPlan === PlanType.START) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-10 min-h-[600px] animate-fade-in">
                <div className="bg-[#09090b] border border-white/5 p-16 rounded-[4rem] text-center max-w-lg relative overflow-hidden">
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-red-600 to-transparent" />
                    <div className="w-20 h-20 bg-zinc-900 border border-white/10 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl"><Lock className="text-red-600 w-10 h-10" /></div>
                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-4 leading-tight">Portfólio & Reputação<br/>é um recurso PRO</h2>
                    <p className="text-zinc-500 text-xs font-medium mb-10 leading-relaxed px-4">Exiba fotos dos seus serviços, receba depoimentos e mostre para o mundo a qualidade do seu hangar.</p>
                    <button onClick={onUpgrade} className="w-full py-5 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-[0.3em] rounded-2xl shadow-glow-red transition-all">Liberar Acesso Pro</button>
                </div>
            </div>
        );
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setPreviewUrl(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const clearSelection = () => {
        setSelectedFile(null);
        setPreviewUrl('');
        setDesc('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleAddImage = async () => {
        if (!selectedFile || !desc || !businessId || !supabase) return;
        setIsUploading(true);
        
        let finalPublicUrl = '';

        try {
            const fileExt = selectedFile.name.split('.').pop()?.toLowerCase() || 'png';
            const filePath = `${businessId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('portfolio_items')
                .upload(filePath, selectedFile, {
                    contentType: selectedFile.type,
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) throw new Error(uploadError.message);

            const { data } = supabase.storage.from('portfolio_items').getPublicUrl(filePath);
            finalPublicUrl = data.publicUrl;

            const payload = {
                image_url: finalPublicUrl,
                description: desc,
                category: 'Geral',
                business_id: businessId,
                user_id: (await supabase.auth.getSession()).data.session?.user.id
            };

            const { data: dbData, error: dbError } = await supabase
                .from('portfolio_items')
                .insert(payload)
                .select()
                .single();

            if (dbError) throw new Error(dbError.message);

            if (dbData) {
                onAddPortfolioItem({ 
                    ...dbData, 
                    imageUrl: dbData.image_url, 
                    date: dbData.created_at || new Date().toISOString() 
                } as any);
                clearSelection();
            }

        } catch (err: any) {
            alert(`Erro: ${err.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    const handleSendReply = async (reviewId: string) => {
        if (!replyText.trim()) return;
        setIsSendingReply(true);
        try {
            await onReplyReview(reviewId, replyText);
            setReplyingTo(null);
            setReplyText('');
        } catch (error) {
            alert("Erro ao enviar resposta.");
        } finally {
            setIsSendingReply(false);
        }
    };

    return (
        <div className="p-6 md:p-12 pb-24 space-y-12 max-w-[1800px] mx-auto animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-white/5 pb-8">
                <div>
                    <h2 className="text-4xl font-black text-white uppercase tracking-tighter mb-2 flex items-center gap-3">
                        <Award className="text-red-600" size={32} /> Central de Reputação
                    </h2>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.4em] pl-11">Vitrine do seu Hangar</p>
                </div>
                <div className="flex bg-[#09090b] p-1 rounded-xl border border-white/5">
                    <button onClick={() => setActiveTab('portfolio')} className={cn("px-8 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all", activeTab === 'portfolio' ? "bg-white text-black shadow-glow" : "text-zinc-500 hover:text-white")}>Showroom</button>
                    <button onClick={() => setActiveTab('reviews')} className={cn("px-8 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all", activeTab === 'reviews' ? "bg-white text-black shadow-glow" : "text-zinc-500 hover:text-white")}>Feedbacks</button>
                </div>
            </div>

            {activeTab === 'portfolio' && (
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-10">
                    <div className="bg-[#09090b] border border-white/10 rounded-[2.5rem] p-8 h-fit space-y-6 relative overflow-hidden group hover:border-white/20 transition-all shadow-2xl">
                        <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-red-600/10 to-transparent pointer-events-none" />
                        <div className="flex items-center justify-between mb-2 relative z-10">
                            <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                <Sparkles size={12} className="text-red-600"/> Nova Publicação
                            </h4>
                            {isUploading && <Loader2 size={12} className="animate-spin text-zinc-500" />}
                        </div>
                        <div onClick={() => !previewUrl && fileInputRef.current?.click()} className={cn("aspect-square rounded-[2rem] flex flex-col items-center justify-center transition-all relative overflow-hidden group/upload", previewUrl ? "cursor-default" : "cursor-pointer border-2 border-dashed border-zinc-800 bg-black/40 hover:border-red-600/30 hover:bg-red-900/5")}>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                            {previewUrl ? (
                                <div className="relative w-full h-full">
                                    <img src={previewUrl} className="w-full h-full object-cover" />
                                    <button onClick={(e) => { e.stopPropagation(); clearSelection(); }} className="absolute top-3 right-3 p-2 bg-black/60 text-white rounded-full hover:bg-red-600 transition-colors"><X size={14} /></button>
                                </div>
                            ) : (
                                <div className="text-center p-6">
                                    <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center mx-auto mb-4 group-hover/upload:scale-110 transition-transform shadow-lg"><ImageIcon className="text-zinc-600 group-hover/upload:text-red-500 transition-colors" size={24} /></div>
                                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Selecionar Imagem</p>
                                </div>
                            )}
                        </div>
                        <div className="relative z-10"><input className="w-full bg-zinc-950/80 border border-white/5 rounded-xl px-4 py-4 text-xs font-bold text-white uppercase outline-none focus:border-red-600/50 transition-all placeholder:text-zinc-700" placeholder="Título da Obra..." value={desc} onChange={e => setDesc(e.target.value)} /></div>
                        <button onClick={handleAddImage} disabled={!previewUrl || !desc || isUploading} className={cn("w-full py-4 font-black uppercase tracking-widest rounded-xl shadow-lg flex items-center justify-center gap-3 transition-all relative z-10 active:scale-95", (!previewUrl || !desc || isUploading) ? "bg-zinc-900 text-zinc-700 cursor-not-allowed border border-white/5" : "bg-red-600 text-white shadow-glow-red hover:bg-red-500")}>
                            {isUploading ? <Loader2 className="animate-spin" size={14}/> : <Upload size={14}/>}
                            {isUploading ? "Enviando..." : "Publicar no Showroom"}
                        </button>
                    </div>

                    <div className="xl:col-span-3 grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-8">
                        {portfolio.map(item => (
                            <div key={item.id} className="relative aspect-[4/5] rounded-[2.5rem] overflow-hidden bg-zinc-950 border border-white/5 group shadow-2xl transition-transform hover:-translate-y-2 duration-500">
                                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none" />
                                <img src={item.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent opacity-90" />
                                <div className="absolute bottom-0 inset-x-0 p-8 z-20 translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                                    <div className="flex items-center gap-2 mb-2"><Sparkles size={14} className="text-red-600" /><span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Hangar CarbonCar</span></div>
                                    <p className="text-lg font-black text-white uppercase tracking-tight leading-tight line-clamp-2">{item.description}</p>
                                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10 opacity-0 group-hover:opacity-100 transition-opacity delay-100">
                                        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{new Date(item.date).toLocaleDateString('pt-BR')}</span>
                                        <button className="text-white hover:text-red-500 transition-colors"><ExternalLink size={16}/></button>
                                    </div>
                                </div>
                                <button onClick={() => onDeletePortfolioItem(item.id)} className="absolute top-6 right-6 p-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-full text-white/50 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 hover:text-white hover:border-red-500 z-30 transform hover:scale-110"><Trash2 size={16} /></button>
                            </div>
                        ))}
                        {portfolio.length === 0 && (
                            <div className="col-span-full h-96 flex flex-col items-center justify-center border border-white/5 rounded-[3rem] bg-zinc-900/20"><ImageIcon size={48} className="text-zinc-800 mb-4" /><p className="text-xs font-black uppercase text-zinc-600 tracking-[0.3em]">Nenhuma foto no showroom</p></div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'reviews' && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    {reviews.length === 0 ? (
                        <div className="col-span-full py-32 text-center opacity-30"><MessageSquare size={48} className="mx-auto mb-4" /><p className="text-xs font-black uppercase tracking-[0.3em]">Aguardando feedbacks</p></div>
                    ) : (
                        reviews.map(rev => (
                            <div key={rev.id} className="bg-[#09090b] border border-white/10 p-8 rounded-[2.5rem] space-y-6 flex flex-col hover:border-white/20 transition-all group/card shadow-xl">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-sm font-black text-white uppercase mb-1">{rev.customerName}</p>
                                        <div className="flex gap-1">
                                            {Array.from({length: 5}).map((_, i) => <Star key={i} size={12} className={cn(i < rev.rating ? "text-yellow-500 fill-yellow-500" : "text-zinc-800 fill-zinc-800")} />)}
                                        </div>
                                    </div>
                                    <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">{new Date(rev.date).toLocaleDateString('pt-BR')}</span>
                                </div>
                                
                                <p className="text-xs text-zinc-400 leading-relaxed italic flex-1">"{rev.comment}"</p>

                                {rev.reply && (
                                    <div className="bg-red-900/5 border border-red-600/10 p-4 rounded-2xl space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Reply size={12} className="text-red-500 -scale-x-100" />
                                            <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">Sua Resposta</span>
                                        </div>
                                        <p className="text-[11px] text-zinc-300 font-medium">{rev.reply}</p>
                                    </div>
                                )}

                                {!rev.reply && replyingTo !== rev.id && (
                                    <button 
                                        onClick={() => setReplyingTo(rev.id)}
                                        className="mt-4 py-3 bg-zinc-900 border border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:border-red-600/30 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Reply size={14} /> Responder Feedback
                                    </button>
                                )}

                                {replyingTo === rev.id && (
                                    <div className="mt-4 space-y-3 animate-in slide-in-from-bottom-2">
                                        <textarea 
                                            autoFocus
                                            className="w-full bg-zinc-950 border border-white/10 rounded-xl p-4 text-xs font-medium text-white outline-none focus:border-red-600 transition-all min-h-[100px] resize-none"
                                            placeholder="Sua resposta cordial..."
                                            value={replyText}
                                            onChange={e => setReplyText(e.target.value)}
                                        />
                                        <div className="flex gap-2">
                                            <button onClick={() => setReplyingTo(null)} className="flex-1 py-3 text-[10px] font-black uppercase text-zinc-600 hover:text-white">Cancelar</button>
                                            <button 
                                                onClick={() => handleSendReply(rev.id)}
                                                disabled={isSendingReply || !replyText.trim()}
                                                className="flex-1 py-3 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-glow-red hover:bg-red-500 transition-all flex items-center justify-center gap-2"
                                            >
                                                {isSendingReply ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />} Enviar
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
