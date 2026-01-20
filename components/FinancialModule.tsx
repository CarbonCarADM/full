
import React, { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { DollarSign, TrendingUp, Wallet, ArrowUpRight, Plus, X, Save, AlertCircle, ArrowDownLeft, CreditCard, Calendar, Tag, BarChart3, Pencil, Trash2, Loader2, PieChart as PieChartIcon, FileText } from 'lucide-react';
import { Appointment, AppointmentStatus, Expense, PlanType } from '../types';
import { cn } from '../lib/utils';
import { ConfirmationModal } from './ConfirmationModal';
import { ReportExportModal } from './ReportExportModal';
import { useEntitySaver } from '../hooks/useEntitySaver';
import { supabase } from '../lib/supabaseClient';

interface FinancialModuleProps {
  appointments: Appointment[];
  expenses: Expense[];
  onAddExpense: (expense: Expense) => void;
  onEditExpense?: (expense: Expense) => void;
  onDeleteExpense?: (id: string) => void;
  currentPlan: PlanType;
  onUpgrade: () => void;
  businessId?: string;
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'];
const EXPENSE_CATEGORIES = ['FIXO', 'VARIÁVEL', 'PESSOAL', 'MANUTENÇÃO', 'PRODUTOS', 'MARKETING', 'IMPOSTOS'];
const INCOME_CATEGORIES = ['SERVIÇO', 'PRODUTO', 'OUTROS'];
const PAYMENT_METHODS = [
    { id: 'DINHEIRO', label: 'Dinheiro' },
    { id: 'PIX', label: 'Pix' },
    { id: 'CREDITO', label: 'Crédito' },
    { id: 'DEBITO', label: 'Débito' },
    { id: 'BOLETO', label: 'Boleto' }
];

export const FinancialModule: React.FC<FinancialModuleProps> = ({ appointments, expenses, onAddExpense, onEditExpense, onDeleteExpense, currentPlan, onUpgrade, businessId }) => {
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
    const { save, loading: savingEntity } = useEntitySaver();
    
    const [transactionType, setTransactionType] = useState<'RECEITA' | 'DESPESA'>('DESPESA');
    const [newTransaction, setNewTransaction] = useState<Partial<Expense>>({
        description: '', amount: 0, category: 'FIXO', date: new Date().toISOString().split('T')[0],
        type: 'DESPESA', payment_method: 'DINHEIRO'
    });

    const [confirmModal, setConfirmModal] = useState<{
      isOpen: boolean; title: string; message: string; onConfirm: () => void; variant: 'danger' | 'warning' | 'info';
    }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, variant: 'danger' });

    const totalRevenue = useMemo(() => {
        const rev = appointments.filter(a => a.status === AppointmentStatus.FINALIZADO).reduce((acc, curr) => acc + curr.price, 0);
        const manual = expenses.filter(e => e.type === 'RECEITA').reduce((acc, curr) => acc + Number(curr.amount), 0);
        return rev + manual;
    }, [appointments, expenses]);
    
    const totalExpenses = useMemo(() => expenses.filter(e => e.type === 'DESPESA' || !e.type).reduce((acc, curr) => acc + Number(curr.amount), 0), [expenses]);
    const netProfit = totalRevenue - totalExpenses;

    const chartData = useMemo(() => {
        const data = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dateStr = d.toLocaleDateString('en-CA');
            
            let income = 0;
            let expense = 0;

            appointments.forEach(a => {
                if (a.status === AppointmentStatus.FINALIZADO && a.date === dateStr) {
                    income += a.price;
                }
            });

            expenses.forEach(e => {
                const eDate = e.date.split('T')[0];
                if (eDate === dateStr) {
                    if (e.type === 'RECEITA') income += Number(e.amount);
                    else expense += Number(e.amount);
                }
            });

            data.push({ date: dateStr, income, expense });
        }
        return data;
    }, [appointments, expenses]);

    const pieData = useMemo(() => {
        const map = new Map();
        expenses.filter(e => e.type === 'DESPESA' || !e.type).forEach(e => {
            map.set(e.category, (map.get(e.category) || 0) + Number(e.amount));
        });
        return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
    }, [expenses]);

    const handleSaveTransaction = async () => {
        if (!newTransaction.description || !newTransaction.amount) return;
        
        // Obter sessão atual para injetar user_id RLS
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
            console.error("Usuário não autenticado");
            return;
        }

        const payload = {
            ...newTransaction,
            id: editingExpenseId, 
            type: transactionType,
            business_id: businessId,
            user_id: session.user.id, // REQUIRED FOR RLS
            amount: Number(newTransaction.amount)
        };
        
        const result = await save('expenses', payload);
        if (result.success && result.data) {
            if (editingExpenseId && onEditExpense) onEditExpense(result.data as Expense);
            else onAddExpense(result.data as Expense);
            setIsTransactionModalOpen(false);
        }
    };

    const handleRequestDelete = (id: string) => {
        if (!onDeleteExpense) return;
        setConfirmModal({
            isOpen: true,
            title: 'Excluir Transação',
            message: 'Tem certeza que deseja excluir este registro financeiro?',
            variant: 'danger',
            onConfirm: () => onDeleteExpense(id)
        });
    };

    return (
        <div className="p-6 md:p-12 pb-24 animate-fade-in max-w-[1800px] mx-auto space-y-12">
            <ConfirmationModal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal(p => ({ ...p, isOpen: false }))} onConfirm={confirmModal.onConfirm} title={confirmModal.title} message={confirmModal.message} variant={confirmModal.variant} />
            <ReportExportModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} businessId={businessId || ''} businessName="CarbonCar Hangar" />
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-8">
                <div>
                    <h2 className="text-4xl font-black text-white uppercase tracking-tighter mb-2 flex items-center gap-3"><BarChart3 className="text-red-600" size={32} /> Terminal Financeiro</h2>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.4em] pl-11">Análise de Performance e Fluxo</p>
                </div>
                
                <div className="flex gap-4 w-full md:w-auto">
                    {currentPlan !== PlanType.START && (
                        <button 
                            onClick={() => setIsReportModalOpen(true)}
                            className="bg-zinc-900 border border-white/10 text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all flex items-center gap-3 w-full md:w-auto justify-center"
                        >
                            <FileText size={16} /> Relatórios
                        </button>
                    )}
                    
                    <button onClick={() => { setEditingExpenseId(null); setNewTransaction({ description: '', amount: 0, category: 'FIXO', date: new Date().toISOString().split('T')[0], type: 'DESPESA', payment_method: 'DINHEIRO' }); setIsTransactionModalOpen(true); }} className="bg-white text-black px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-glow active:scale-95 flex items-center gap-3 w-full md:w-auto justify-center"><Plus size={16} /> Nova Transação</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: 'Receita Bruta', value: totalRevenue, color: 'text-green-500', icon: ArrowUpRight },
                    { label: 'Despesas Operacionais', value: totalExpenses, color: 'text-red-500', icon: ArrowDownLeft },
                    { label: 'Resultado Líquido', value: netProfit, color: netProfit >= 0 ? 'text-white' : 'text-red-500', icon: Wallet }
                ].map((stat, i) => (
                    <div key={i} className="bg-[#09090b] border border-white/5 rounded-[2rem] p-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity"><stat.icon size={64} className={stat.color} /></div>
                        <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-4">{stat.label}</p>
                        <h3 className={cn("text-4xl lg:text-5xl font-black tabular-nums tracking-tighter", stat.color)}><span className="text-lg align-top opacity-50 mr-2">R$</span>{stat.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-auto lg:h-[400px]">
                <div className="lg:col-span-2 bg-[#09090b] border border-white/5 rounded-[2rem] p-8 flex flex-col h-[400px] lg:h-auto">
                    <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <TrendingUp size={14} className="text-white"/> Fluxo de Caixa (7 Dias)
                    </h3>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                <XAxis dataKey="date" stroke="#666" fontSize={10} tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})} tickLine={false} axisLine={false} />
                                <YAxis stroke="#666" fontSize={10} tickFormatter={(value) => `R$${value}`} tickLine={false} axisLine={false} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#333', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}
                                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                    labelStyle={{ color: '#999', marginBottom: '8px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                                />
                                <Area type="monotone" dataKey="income" name="Receitas" stroke="#22c55e" fillOpacity={1} fill="url(#colorIncome)" strokeWidth={2} />
                                <Area type="monotone" dataKey="expense" name="Despesas" stroke="#ef4444" fillOpacity={1} fill="url(#colorExpense)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-[#09090b] border border-white/5 rounded-[2rem] p-8 flex flex-col h-[400px] lg:h-auto">
                     <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <PieChartIcon size={14} className="text-white"/> Despesas por Categoria
                    </h3>
                    <div className="flex-1 w-full min-h-0 relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#333', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}
                                    itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                                />
                                <Legend 
                                    layout="vertical" 
                                    verticalAlign="bottom" 
                                    align="center"
                                    iconSize={8}
                                    wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: '#666' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        {pieData.length === 0 && (
                             <div className="absolute inset-0 flex items-center justify-center text-[10px] uppercase text-zinc-600 font-bold">Sem dados</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-[#09090b] border border-white/5 rounded-[2rem] p-8 h-full">
                    <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-2"><ArrowUpRight className="text-green-500" size={14}/> Entradas</h3>
                    <div className="space-y-1">
                        {expenses.filter(e => e.type === 'RECEITA').map(t => (
                            <div key={t.id} className="flex justify-between items-center p-3 hover:bg-white/5 rounded-xl transition-colors group">
                                <div><p className="text-xs font-bold text-white uppercase">{t.description}</p><p className="text-[9px] font-bold text-zinc-600 uppercase">{new Date(t.date).toLocaleDateString()} • {t.category}</p></div>
                                <div className="flex items-center gap-4"><span className="text-sm font-black text-green-500">R$ {Number(t.amount).toFixed(2)}</span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => { setEditingExpenseId(t.id); setNewTransaction(t); setTransactionType('RECEITA'); setIsTransactionModalOpen(true); }} className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white"><Pencil size={12}/></button>
                                    <button onClick={() => handleRequestDelete(t.id)} className="p-1.5 hover:bg-red-900/20 rounded-md text-zinc-400 hover:text-red-500"><Trash2 size={12}/></button>
                                </div></div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-[#09090b] border border-white/5 rounded-[2rem] p-8 h-full">
                    <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-2"><ArrowDownLeft className="text-red-500" size={14}/> Saídas</h3>
                    <div className="space-y-1">
                        {expenses.filter(e => e.type === 'DESPESA' || !e.type).map(t => (
                            <div key={t.id} className="flex justify-between items-center p-3 hover:bg-white/5 rounded-xl transition-colors group">
                                <div><p className="text-xs font-bold text-white uppercase">{t.description}</p><p className="text-[9px] font-bold text-zinc-600 uppercase">{new Date(t.date).toLocaleDateString()} • {t.category}</p></div>
                                <div className="flex items-center gap-4"><span className="text-sm font-black text-red-500">R$ {Number(t.amount).toFixed(2)}</span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => { setEditingExpenseId(t.id); setNewTransaction(t); setTransactionType('DESPESA'); setIsTransactionModalOpen(true); }} className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white"><Pencil size={12}/></button>
                                    <button onClick={() => handleRequestDelete(t.id)} className="p-1.5 hover:bg-red-900/20 rounded-md text-zinc-400 hover:text-red-500"><Trash2 size={12}/></button>
                                </div></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {isTransactionModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-sm">
                    <div className="bg-[#0c0c0c] border border-white/10 rounded-[2.5rem] w-full max-w-lg p-8 animate-in zoom-in duration-300">
                        <h3 className="text-xl font-bold text-white uppercase mb-8">{editingExpenseId ? 'Editar Movimentação' : 'Registrar Movimentação'}</h3>
                        <div className="space-y-4">
                            <div className="flex bg-zinc-950 p-1 rounded-xl border border-white/5">
                                <button onClick={() => setTransactionType('DESPESA')} className={cn("flex-1 py-3 rounded-lg text-[10px] font-black uppercase transition-all", transactionType === 'DESPESA' ? "bg-red-600 text-white shadow-glow-red" : "text-zinc-500")}>Despesa</button>
                                <button onClick={() => setTransactionType('RECEITA')} className={cn("flex-1 py-3 rounded-lg text-[10px] font-black uppercase transition-all", transactionType === 'RECEITA' ? "bg-green-600 text-white shadow-glow-green" : "text-zinc-500")}>Receita</button>
                            </div>
                            <input placeholder="DESCRIÇÃO" className="w-full bg-zinc-950 border border-white/10 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none" value={newTransaction.description} onChange={e => setNewTransaction({...newTransaction, description: e.target.value})} />
                            <div className="grid grid-cols-2 gap-4">
                                <input type="number" placeholder="VALOR" className="w-full bg-zinc-950 border border-white/10 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none" value={newTransaction.amount || ''} onChange={e => setNewTransaction({...newTransaction, amount: Number(e.target.value)})} />
                                <input type="date" className="w-full bg-zinc-950 border border-white/10 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none" value={newTransaction.date} onChange={e => setNewTransaction({...newTransaction, date: e.target.value})} />
                            </div>
                            <select className="w-full bg-zinc-950 border border-white/10 rounded-xl p-4 text-xs font-bold text-white uppercase outline-none" value={newTransaction.category} onChange={e => setNewTransaction({...newTransaction, category: e.target.value})}>
                                {(transactionType === 'RECEITA' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                            <div className="flex gap-4 pt-4">
                                <button onClick={() => setIsTransactionModalOpen(false)} className="flex-1 py-4 text-[10px] font-black uppercase text-zinc-500">Cancelar</button>
                                <button onClick={handleSaveTransaction} disabled={savingEntity} className="flex-1 py-4 bg-white text-black rounded-xl text-[10px] font-black uppercase hover:bg-zinc-200 flex items-center justify-center gap-2">{savingEntity ? <Loader2 className="animate-spin" size={14}/> : 'Confirmar'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
