
import React from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { openWhatsAppChat } from '../services/whatsappService';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  phone: string;
  message: string;
  customerName: string;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({ isOpen, onClose, phone, message, customerName }) => {
  if (!isOpen) return null;

  const handleSend = () => {
    openWhatsAppChat(phone, message);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0c0c0c] border border-green-500/20 rounded-[2rem] w-full max-w-md p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
        </button>
        
        <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6 bg-green-500/10 border border-green-500/20 text-green-500 shadow-[0_0_30px_rgba(34,197,94,0.2)]">
                <MessageCircle size={32} strokeWidth={1.5} />
            </div>

            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Notificar Cliente</h3>
            <p className="text-zinc-400 text-xs font-medium mb-6 px-4">
                O agendamento de <span className="text-white font-bold">{customerName}</span> foi confirmado. Envie a notificação oficial agora:
            </p>

            <div className="w-full bg-zinc-900/50 border border-white/5 rounded-xl p-4 mb-6 text-left max-h-[200px] overflow-y-auto custom-scrollbar">
                <p className="text-[9px] font-bold text-zinc-500 uppercase mb-2 tracking-widest sticky top-0 bg-zinc-900/0">Prévia da Mensagem</p>
                <p className="text-xs text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed opacity-90 selection:bg-green-500/30 selection:text-green-100">
                    {message}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full">
                <button
                    onClick={onClose}
                    className="py-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-white/5 transition-all border border-transparent"
                >
                    Pular
                </button>
                <button
                    onClick={handleSend}
                    className="py-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-white bg-green-600 hover:bg-green-500 transition-all shadow-glow-green flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                >
                    <Send size={14} /> Enviar WhatsApp
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
