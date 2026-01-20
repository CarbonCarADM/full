
import React from 'react';
import { X, ShieldCheck, FileText, Lock } from 'lucide-react';
import { cn } from '../lib/utils';

export type LegalDocType = 'TERMS' | 'PRIVACY';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: LegalDocType | null;
}

export const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose, type }) => {
  if (!isOpen || !type) return null;

  const title = type === 'TERMS' ? 'Termos de Uso' : 'Política de Privacidade & LGPD';
  const Icon = type === 'TERMS' ? FileText : ShieldCheck;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-[#0c0c0c] border border-white/10 rounded-[2rem] w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300 relative">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-white/5 bg-[#09090b]">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-3 tracking-tighter uppercase">
               <Icon className="text-red-600" size={20} /> {title}
            </h2>
            <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.4em] mt-1">CarbonCar Legal</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 bg-white/5 rounded-full text-zinc-500 hover:text-white transition-colors hover:bg-red-600"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Scrollable */}
        <div className="flex-1 overflow-y-auto p-8 text-zinc-400 text-sm leading-relaxed space-y-6 custom-scrollbar">
            {type === 'PRIVACY' ? (
                <>
                    <div className="p-4 bg-red-900/10 border border-red-600/20 rounded-xl mb-6">
                        <h4 className="text-red-500 font-bold uppercase text-xs mb-2 flex items-center gap-2">
                            <Lock size={12} /> Compromisso de Proteção de Dados
                        </h4>
                        <p className="text-xs text-red-200/70">
                            Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), a CarbonCar se compromete a proteger sua privacidade.
                        </p>
                    </div>

                    <h3 className="text-white font-bold uppercase text-xs tracking-widest">1. Coleta de Dados</h3>
                    <p>
                        Coletamos apenas os dados essenciais para o funcionamento operacional do sistema: Nome Completo, Telefone (WhatsApp) para notificações de serviço, E-mail para recuperação de conta e Dados do Veículo (Placa, Modelo, Marca) para gestão do pátio.
                    </p>

                    <h3 className="text-white font-bold uppercase text-xs tracking-widest">2. Finalidade</h3>
                    <p>
                        Seus dados são utilizados exclusivamente para:
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>Agendamento de serviços automotivos.</li>
                            <li>Comunicação sobre o status do serviço.</li>
                            <li>Gestão interna da estética automotiva.</li>
                            <li>Histórico de serviços realizados no veículo.</li>
                        </ul>
                    </p>

                    <h3 className="text-white font-bold uppercase text-xs tracking-widest">3. Compartilhamento</h3>
                    <p>
                        Não vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros para fins de marketing. Os dados são acessíveis apenas pela administração da estética contratada.
                    </p>

                    <h3 className="text-white font-bold uppercase text-xs tracking-widest">4. Seus Direitos</h3>
                    <p>
                        Você tem o direito de solicitar a visualização, correção ou exclusão definitiva dos seus dados de nossa base a qualquer momento, entrando em contato com a administração.
                    </p>
                    
                    <h3 className="text-white font-bold uppercase text-xs tracking-widest">5. Cookies</h3>
                    <p>
                        Utilizamos cookies essenciais para manter sua sessão segura e ativa. Não utilizamos cookies de rastreamento publicitário invasivo.
                    </p>
                </>
            ) : (
                <>
                    <p className="text-xs italic text-zinc-500 mb-4">Última atualização: Outubro 2023</p>

                    <h3 className="text-white font-bold uppercase text-xs tracking-widest">1. Aceite dos Termos</h3>
                    <p>
                        Ao acessar e utilizar a plataforma CarbonCar, você concorda em cumprir estes Termos de Uso e todas as leis e regulamentos aplicáveis.
                    </p>

                    <h3 className="text-white font-bold uppercase text-xs tracking-widest">2. Uso da Licença</h3>
                    <p>
                        É concedida permissão para uso temporário do software CarbonCar para gestão pessoal ou comercial, dependendo do plano contratado. Esta é a concessão de uma licença, não uma transferência de título.
                    </p>

                    <h3 className="text-white font-bold uppercase text-xs tracking-widest">3. Responsabilidades</h3>
                    <p>
                        O usuário é responsável por manter a confidencialidade de sua conta e senha. A CarbonCar não se responsabiliza por perdas decorrentes do uso não autorizado de sua conta.
                    </p>

                    <h3 className="text-white font-bold uppercase text-xs tracking-widest">4. Limitações</h3>
                    <p>
                        Em nenhum caso a CarbonCar ou seus fornecedores serão responsáveis por quaisquer danos (incluindo, sem limitação, danos por perda de dados ou lucro) decorrentes do uso ou da incapacidade de usar o sistema.
                    </p>

                    <h3 className="text-white font-bold uppercase text-xs tracking-widest">5. Cancelamento</h3>
                    <p>
                        Você pode cancelar sua conta a qualquer momento. Dados podem ser retidos por um período legalmente exigido antes da exclusão total.
                    </p>
                </>
            )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 bg-[#09090b] flex justify-end">
            <button 
                onClick={onClose}
                className="px-8 py-3 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-zinc-200 transition-colors"
            >
                Entendido
            </button>
        </div>
      </div>
    </div>
  );
};
