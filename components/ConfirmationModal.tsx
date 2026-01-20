import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen, onClose, onConfirm, title, message,
  confirmText = 'Confirmar', cancelText = 'Cancelar', variant = 'danger'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0c0c0c] border border-white/10 rounded-[2rem] w-full max-w-md p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center">
            <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center mb-6 border shadow-[0_0_30px_rgba(0,0,0,0.5)]",
                variant === 'danger' ? "bg-red-900/10 border-red-500/20 text-red-500" :
                variant === 'warning' ? "bg-orange-900/10 border-orange-500/20 text-orange-500" :
                "bg-blue-900/10 border-blue-500/20 text-blue-500"
            )}>
                <AlertTriangle size={32} strokeWidth={1.5} />
            </div>

            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">{title}</h3>
            <p className="text-zinc-400 text-sm leading-relaxed mb-8">{message}</p>

            <div className="grid grid-cols-2 gap-4 w-full">
                <button
                    onClick={onClose}
                    className="py-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-white/5 transition-all border border-transparent hover:border-white/5"
                >
                    {cancelText}
                </button>
                <button
                    onClick={() => { onConfirm(); onClose(); }}
                    className={cn(
                        "py-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all shadow-lg flex items-center justify-center gap-2",
                        variant === 'danger' ? "bg-red-600 hover:bg-red-500 shadow-glow-red" :
                        variant === 'warning' ? "bg-orange-600 hover:bg-orange-500 shadow-[0_0_20px_rgba(234,88,12,0.3)]" :
                        "bg-blue-600 hover:bg-blue-500"
                    )}
                >
                    {confirmText}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};