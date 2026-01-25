import React, { useState, useEffect } from 'react';
import { LogIn, UserPlus, ArrowLeft, RefreshCw, Fingerprint, Mail, Phone, User, Key, ShieldCheck, HelpCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { cn, formatPhone } from '../lib/utils';
import { supabase } from '../lib/supabaseClient';
import { PlanType } from '../types';
import { LegalModal, LegalDocType } from './LegalModal';

interface AuthScreenProps {
  role: 'CLIENT' | 'ADMIN';
  onLogin: (user: any) => void;
  onBack: () => void;
  preFillData?: { name: string, phone: string } | null;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ role, onLogin, onBack, preFillData }) => {
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER' | 'RECOVER'>('LOGIN');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [recoverSent, setRecoverSent] = useState(false);

  // Legal Modal State
  const [showLegal, setShowLegal] = useState(false);
  const [legalType, setLegalType] = useState<LegalDocType>('TERMS');

  // Auto-fill logic from props (Conversion Flow)
  useEffect(() => {
      // 1. Check Props
      if (preFillData) {
          setFullName(preFillData.name);
          setPhone(preFillData.phone);
          setAuthMode('REGISTER');
      } 
      // 2. Check URL Parameters (Fallback for direct link access)
      else {
          const params = new URLSearchParams(window.location.search);
          const urlType = params.get('type');
          
          if (urlType === 'client') {
              const urlName = params.get('name');
              const urlPhone = params.get('phone');
              
              if (urlName) setFullName(urlName);
              if (urlPhone) setPhone(urlPhone);
              setAuthMode('REGISTER');
          }
      }
  }, [preFillData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    
    setLoading(true);
    setError(null);

    try {
        if (authMode === 'RECOVER') {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin
            });
            if (error) throw error;
            setRecoverSent(true);
        } 
        else if (authMode === 'REGISTER') {
            const params = new URLSearchParams(window.location.search);
            const isClientFlow = role === 'CLIENT' || params.get('type') === 'client';
            const finalRole = isClientFlow ? 'CLIENT' : 'ADMIN';

            const { data, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { 
                        full_name: fullName, 
                        phone: phone,
                        role: finalRole 
                    }
                }
            });
            
            if (signUpError) throw signUpError;
            if (!data.user) throw new Error("Erro ao criar usuário.");

            // CORREÇÃO CRÍTICA RLS:
            // Se a confirmação de email estiver ativa no Supabase, data.session será null.
            // Tentar inserir em 'business_settings' sem sessão causa erro 401/42501 (RLS violation)
            // pois a request vai como 'anon'.
            
            if (!data.session) {
                alert("Cadastro realizado! Por favor, verifique seu email para confirmar a conta e liberar o acesso.");
                setAuthMode('LOGIN');
                setLoading(false);
                return; // Interrompe aqui. O Hangar será criado no primeiro login ou via trigger se configurado.
            }

            // Se temos sessão, podemos criar o Hangar com segurança
            if (finalRole === 'ADMIN' && data.session) {
                const slug = fullName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Math.floor(Math.random() * 1000);
                
                const { error: bizError } = await supabase.from('business_settings').insert({
                    user_id: data.user.id,
                    business_name: fullName,
                    slug: slug,
                    whatsapp: phone,
                    plan_type: PlanType.START,
                    subscription_status: 'TRIAL',
                    box_capacity: 3,
                    patio_capacity: 10,
                    configs: { operating_days: [] }
                });

                if (bizError) {
                    console.error("Erro ao criar hangar:", bizError);
                    // Não bloqueamos o fluxo aqui, o usuário verá a tela de "Recuperação" no App.tsx
                }
            }

            alert("Cadastro realizado com sucesso!");
            // Se o login for automático (session existe), autenticamos direto
            if (data.session) {
                onLogin(data.user);
            } else {
                setAuthMode('LOGIN');
            }

        } else {
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            if (signInError) throw signInError;
            onLogin(data.user);
        }
    } catch (err: any) {
        setError(err.message || "Erro na autenticação.");
    } finally {
        setLoading(false);
    }
  };

  const openLegal = (type: LegalDocType) => {
      setLegalType(type);
      setShowLegal(true);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#020202] relative overflow-hidden font-sans selection:bg-red-500/30 selection:text-red-200">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1493238792015-1a419bc32836?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20 blur-sm scale-105 contrast-125" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#020202] via-[#020202]/90 to-[#020202]/50" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.04] mix-blend-overlay" />
      <div className="absolute top-[-20%] left-[20%] w-[600px] h-[600px] bg-red-600/10 rounded-full blur-[150px] pointer-events-none animate-pulse-slow mix-blend-screen" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-blue-900/10 rounded-full blur-[150px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-[380px] animate-in fade-in zoom-in-95 duration-700">
        <div className="relative bg-[#0a0a0a]/60 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-6 md:p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden">
             <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
             <div className="absolute -top-24 -left-24 w-48 h-48 bg-white/5 blur-[50px] rounded-full pointer-events-none" />
             <div className="text-center mb-8 relative z-10">
                <div className="w-16 h-16 bg-gradient-to-br from-zinc-900 to-black border border-white/10 rounded-[1.2rem] flex items-center justify-center mx-auto mb-4 shadow-2xl group transition-all duration-500 hover:border-red-500/30 relative overflow-hidden">
                    <div className="absolute inset-0 bg-red-600/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    <Fingerprint className="text-zinc-400 group-hover:text-white transition-colors relative z-10" size={28} strokeWidth={1.5} />
                </div>
                <h1 className="text-2xl font-black text-white uppercase tracking-tighter mb-1 drop-shadow-lg">Carbon OS</h1>
                <p className="text-zinc-500 text-[8px] font-bold uppercase tracking-[0.4em] flex items-center justify-center gap-2"><span className="w-1 h-1 bg-red-600 rounded-full shadow-[0_0_8px_red]" /> {role === 'CLIENT' ? 'Área do Cliente' : 'Gestão de Hangar'}</p>
             </div>

             {authMode !== 'RECOVER' && (
                <div className="bg-black/40 border border-white/5 p-1 rounded-xl flex relative mb-6 backdrop-blur-md">
                    <button onClick={() => setAuthMode('LOGIN')} className={cn("flex-1 py-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2", authMode === 'LOGIN' ? "bg-zinc-800 text-white shadow-lg border border-white/5" : "text-zinc-500 hover:text-zinc-300")}><LogIn size={10} /> Entrar</button>
                    <button onClick={() => setAuthMode('REGISTER')} className={cn("flex-1 py-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2", authMode === 'REGISTER' ? "bg-zinc-800 text-white shadow-lg border border-white/5" : "text-zinc-500 hover:text-zinc-300")}><UserPlus size={10} /> Criar Conta</button>
                </div>
             )}

             {authMode === 'RECOVER' && !recoverSent && (
                 <div className="mb-6 text-center animate-in slide-in-from-right"><h3 className="text-sm font-black text-white uppercase tracking-tight mb-2">Recuperar Acesso</h3><p className="text-[10px] text-zinc-500 max-w-[250px] mx-auto">Informe seu e-mail para receber um link seguro de redefinição.</p></div>
             )}

             <form onSubmit={handleSubmit} className="space-y-3 relative z-10">
                {error && (<div className="p-3 bg-red-500/10 border border-red-500/20 text-red-200 text-[10px] font-medium rounded-xl backdrop-blur-md flex items-center gap-2 animate-in slide-in-from-top-2"><div className="w-1 h-1 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_red]" />{error}</div>)}
                {recoverSent ? (
                    <div className="py-6 text-center animate-in zoom-in-95"><div className="w-14 h-14 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle2 size={24} className="text-green-500" /></div><h3 className="text-white font-black uppercase tracking-wide mb-2 text-sm">Email Enviado!</h3><p className="text-[10px] text-zinc-500 mb-6">Verifique sua caixa de entrada para redefinir sua senha.</p><button type="button" onClick={() => { setRecoverSent(false); setAuthMode('LOGIN'); }} className="w-full py-3 bg-white text-black rounded-xl font-black uppercase tracking-widest text-[9px] hover:bg-zinc-200 transition-all">Voltar ao Login</button></div>
                ) : (
                    <>
                        {authMode === 'REGISTER' && (
                            <div className="space-y-3 animate-in slide-in-from-right-4 duration-300">
                                <div className="group relative"><User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-white transition-colors duration-300" size={14} /><input required className="w-full bg-zinc-900/30 border border-white/5 focus:border-red-500/50 rounded-xl pl-10 pr-4 py-3 text-white text-[10px] font-bold uppercase outline-none transition-all placeholder:text-zinc-700 focus:bg-zinc-900/60" value={fullName} onChange={e => setFullName(e.target.value)} placeholder={role === 'CLIENT' ? "NOME COMPLETO" : "NOME DO HANGAR"} /></div>
                                <div className="group relative"><Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-white transition-colors duration-300" size={14} /><input required className="w-full bg-zinc-900/30 border border-white/5 focus:border-red-500/50 rounded-xl pl-10 pr-4 py-3 text-white text-[10px] font-bold uppercase outline-none transition-all placeholder:text-zinc-700 focus:bg-zinc-900/60" value={phone} onChange={e => setPhone(formatPhone(e.target.value))} placeholder="TELEFONE" /></div>
                            </div>
                        )}
                        <div className="group relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-white transition-colors duration-300" size={14} /><input required type="email" className="w-full bg-zinc-900/30 border border-white/5 focus:border-red-500/50 rounded-xl pl-10 pr-4 py-3 text-white text-[10px] font-bold uppercase outline-none transition-all placeholder:text-zinc-700 focus:bg-zinc-900/60" value={email} onChange={e => setEmail(e.target.value)} placeholder={role === 'CLIENT' ? "SEU MELHOR EMAIL" : "EMAIL CORPORATIVO"} /></div>
                        {authMode !== 'RECOVER' && (
                            <div className="group relative"><Key className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-white transition-colors duration-300" size={14} /><input required type="password" className="w-full bg-zinc-900/30 border border-white/5 focus:border-red-500/50 rounded-xl pl-10 pr-4 py-3 text-white text-[10px] font-bold uppercase outline-none transition-all placeholder:text-zinc-700 focus:bg-zinc-900/60" value={password} onChange={e => setPassword(e.target.value)} placeholder="SENHA DE ACESSO" /></div>
                        )}
                        {authMode === 'LOGIN' && (<div className="flex justify-end"><button type="button" onClick={() => setAuthMode('RECOVER')} className="text-[8px] font-bold text-zinc-500 hover:text-red-500 uppercase tracking-wide flex items-center gap-1 transition-colors"><HelpCircle size={10} /> Esqueci minha senha</button></div>)}
                        <div className="flex gap-2 pt-2">
                            {authMode === 'RECOVER' && (<button type="button" onClick={() => setAuthMode('LOGIN')} className="px-5 py-4 bg-zinc-900 text-zinc-400 rounded-xl font-black uppercase tracking-widest text-[9px] hover:text-white hover:bg-zinc-800 transition-all border border-white/5">Voltar</button>)}
                            <button type="submit" disabled={loading} className="flex-1 py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-xl font-black uppercase tracking-widest text-[9px] transition-all flex items-center justify-center gap-2 shadow-[0_10px_30px_-10px_rgba(220,38,38,0.5)] group">{loading ? <RefreshCw className="animate-spin" size={12} /> : (authMode === 'REGISTER' ? 'INICIAR JORNADA' : authMode === 'RECOVER' ? 'ENVIAR LINK' : 'AUTENTICAR')}</button>
                        </div>
                    </>
                )}
             </form>
             <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-center gap-6 relative z-10"><button onClick={() => openLegal('TERMS')} className="text-[8px] font-bold text-zinc-600 hover:text-white uppercase tracking-widest transition-colors">Termos de Uso</button><button onClick={() => openLegal('PRIVACY')} className="text-[8px] font-bold text-zinc-600 hover:text-white uppercase tracking-widest transition-colors">Políticas & LGPD</button></div>
          </div>
          <button onClick={onBack} className="mt-6 mx-auto text-zinc-600 hover:text-white text-[8px] font-black uppercase tracking-[0.2em] flex items-center gap-2 transition-all opacity-60 hover:opacity-100 group"><ArrowLeft size={10} className="group-hover:-translate-x-1 transition-transform" /> Voltar ao Início</button>
      </div>
      <LegalModal isOpen={showLegal} type={legalType} onClose={() => setShowLegal(false)} />
    </div>
  );
};