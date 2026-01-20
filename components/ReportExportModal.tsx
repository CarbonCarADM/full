
import React, { useState, useEffect, useMemo } from 'react';
import { X, FileText, Download, Calendar, Loader2, FileSpreadsheet, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { cn } from '../lib/utils';

interface ReportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  businessName: string;
}

type FilterPeriod = '7D' | '15D' | '30D' | 'MONTH';

interface TransactionRow {
  transaction_date: string;
  description: string;
  type: 'RECEITA' | 'DESPESA';
  amount: number;
  payment_method: string;
}

export const ReportExportModal: React.FC<ReportExportModalProps> = ({ isOpen, onClose, businessId, businessName }) => {
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'PDF' | 'EXCEL' | null>(null);
  const [period, setPeriod] = useState<FilterPeriod>('MONTH');
  const [reportData, setReportData] = useState<TransactionRow[]>([]);

  // 1. Calcula datas baseadas no filtro
  const dateRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    
    switch (period) {
      case '7D': start.setDate(end.getDate() - 7); break;
      case '15D': start.setDate(end.getDate() - 15); break;
      case '30D': start.setDate(end.getDate() - 30); break;
      case 'MONTH': 
        start.setDate(1); // Primeiro dia do mês atual
        break;
    }
    
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  }, [period]);

  // 2. Busca dados (Refatorado para Direct Query para evitar erros de RPC)
  useEffect(() => {
    if (!isOpen || !businessId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Buscar Despesas/Receitas Manuais
        const { data: expensesData, error: expensesError } = await supabase
          .from('expenses')
          .select('*')
          .eq('business_id', businessId)
          .gte('date', dateRange.start)
          .lte('date', dateRange.end);

        if (expensesError) throw expensesError;

        // Buscar Agendamentos Finalizados (Receita Operacional)
        const { data: appointmentsData, error: appointmentsError } = await supabase
          .from('appointments')
          .select('*')
          .eq('business_id', businessId)
          .eq('status', 'FINALIZADO')
          .gte('date', dateRange.start)
          .lte('date', dateRange.end);

        if (appointmentsError) throw appointmentsError;

        // Normalizar Dados
        const normalizedExpenses: TransactionRow[] = (expensesData || []).map((e: any) => ({
            transaction_date: e.date,
            description: e.description || 'Movimentação Financeira',
            type: e.type || 'DESPESA',
            amount: Number(e.amount),
            payment_method: e.payment_method || 'OUTROS'
        }));

        const normalizedAppointments: TransactionRow[] = (appointmentsData || []).map((a: any) => ({
            transaction_date: a.date,
            description: `Serviço: ${a.service_type || 'Estética Automotiva'}`,
            type: 'RECEITA',
            amount: Number(a.price),
            payment_method: 'SISTEMA' // Agendamentos não tem método de pagamento explícito no schema atual
        }));

        // Combinar e Ordenar
        const combined = [...normalizedExpenses, ...normalizedAppointments].sort((a, b) => 
            new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
        );

        setReportData(combined);

      } catch (err) {
        console.error("Erro ao buscar dados:", err);
        setReportData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, businessId, dateRange]);

  // 3. Cálculos de Resumo
  const summary = useMemo(() => {
    return reportData.reduce((acc, curr) => {
      const val = Number(curr.amount);
      if (curr.type === 'RECEITA') acc.income += val;
      else acc.expense += val;
      return acc;
    }, { income: 0, expense: 0 });
  }, [reportData]);

  const balance = summary.income - summary.expense;

  // 4. Exportação PDF
  const handleExportPDF = () => {
    setExporting('PDF');
    const doc = new jsPDF();

    // Header
    doc.setFillColor(12, 12, 12); // #0c0c0c
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text(businessName.toUpperCase(), 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(200, 200, 200);
    doc.text(`Relatório Financeiro: ${new Date(dateRange.start).toLocaleDateString('pt-BR')} a ${new Date(dateRange.end).toLocaleDateString('pt-BR')}`, 14, 30);

    // Summary Section
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text("Resumo do Período", 14, 50);
    
    doc.setFontSize(10);
    doc.text(`Entradas: R$ ${summary.income.toFixed(2)}`, 14, 60);
    doc.text(`Saídas: R$ ${summary.expense.toFixed(2)}`, 70, 60);
    doc.text(`Saldo: R$ ${balance.toFixed(2)}`, 130, 60);

    // Table
    const tableData = reportData.map(row => [
      new Date(row.transaction_date).toLocaleDateString('pt-BR'),
      row.description.toUpperCase(),
      row.type,
      row.payment_method || '-',
      `R$ ${Number(row.amount).toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 70,
      head: [['Data', 'Descrição', 'Tipo', 'Método', 'Valor']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' }, // Red Header
      styles: { fontSize: 8, cellPadding: 3 },
      didParseCell: function(data) {
        // Colorir valores
        if (data.section === 'body' && data.column.index === 4) {
           const type = (data.row.raw as any)[2];
           if (type === 'DESPESA') {
               data.cell.styles.textColor = [220, 38, 38]; // Red
           } else {
               data.cell.styles.textColor = [22, 163, 74]; // Green
           }
        }
      }
    });

    doc.save(`Relatorio_${dateRange.start}_${dateRange.end}.pdf`);
    setExporting(null);
  };

  // 5. Exportação Excel
  const handleExportExcel = () => {
    setExporting('EXCEL');
    
    const wsData = [
      ['RELATÓRIO FINANCEIRO - CARBONCAR OS'],
      [`Empresa: ${businessName}`],
      [`Período: ${new Date(dateRange.start).toLocaleDateString('pt-BR')} a ${new Date(dateRange.end).toLocaleDateString('pt-BR')}`],
      [''],
      ['DATA', 'DESCRIÇÃO', 'TIPO', 'MÉTODO', 'VALOR'], // Header
      ...reportData.map(row => [
        new Date(row.transaction_date).toLocaleDateString('pt-BR'),
        row.description,
        row.type,
        row.payment_method,
        Number(row.amount)
      ]),
      [''],
      ['TOTAL RECEITAS', summary.income],
      ['TOTAL DESPESAS', summary.expense],
      ['SALDO FINAL', balance]
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    XLSX.utils.book_append_sheet(wb, ws, "Financeiro");
    XLSX.writeFile(wb, `Relatorio_${dateRange.start}_${dateRange.end}.xlsx`);
    setExporting(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0c0c0c] border border-white/10 rounded-[2rem] w-full max-w-2xl shadow-2xl relative flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-8 border-b border-white/5 flex justify-between items-start">
            <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                    <FileText className="text-red-600" /> Central de Relatórios
                </h2>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em] mt-1">Exportação de Dados Contábeis</p>
            </div>
            <button onClick={onClose} className="p-2 bg-white/5 rounded-full text-zinc-500 hover:text-white transition-colors">
                <X size={20} />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
            
            {/* Filters */}
            <div className="space-y-4">
                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Período de Análise</p>
                <div className="flex flex-wrap gap-3">
                    {[
                        { id: '7D', label: '7 Dias' },
                        { id: '15D', label: '15 Dias' },
                        { id: '30D', label: '30 Dias' },
                        { id: 'MONTH', label: 'Mês Atual' },
                    ].map(opt => (
                        <button 
                            key={opt.id}
                            onClick={() => setPeriod(opt.id as FilterPeriod)}
                            className={cn(
                                "flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                                period === opt.id 
                                    ? "bg-white text-black border-white shadow-glow" 
                                    : "bg-zinc-900 text-zinc-500 border-white/5 hover:border-white/20 hover:text-white"
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-zinc-900/50 p-4 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-2 mb-2 text-green-500">
                        <TrendingUp size={14} />
                        <span className="text-[9px] font-black uppercase tracking-widest">Receitas</span>
                    </div>
                    <span className="text-lg font-bold text-white">R$ {summary.income.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                </div>
                <div className="bg-zinc-900/50 p-4 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-2 mb-2 text-red-500">
                        <TrendingDown size={14} />
                        <span className="text-[9px] font-black uppercase tracking-widest">Despesas</span>
                    </div>
                    <span className="text-lg font-bold text-white">R$ {summary.expense.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                </div>
                <div className={cn("bg-zinc-900/50 p-4 rounded-2xl border border-white/5", balance < 0 ? "border-red-900/30 bg-red-900/5" : "")}>
                    <div className="flex items-center gap-2 mb-2 text-zinc-400">
                        <Wallet size={14} />
                        <span className="text-[9px] font-black uppercase tracking-widest">Resultado</span>
                    </div>
                    <span className={cn("text-lg font-bold", balance >= 0 ? "text-white" : "text-red-500")}>
                        R$ {balance.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                    </span>
                </div>
            </div>

            {/* Preview Info */}
            <div className="bg-black/40 rounded-xl p-4 border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                        {loading ? <Loader2 className="animate-spin text-zinc-500" /> : <Calendar className="text-zinc-500" />}
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase">Registros Encontrados</p>
                        <p className="text-sm font-black text-white">{reportData.length} transações</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[9px] font-bold text-zinc-600 uppercase">{new Date(dateRange.start).toLocaleDateString('pt-BR')}</p>
                    <p className="text-[9px] font-bold text-zinc-600 uppercase">até</p>
                    <p className="text-[9px] font-bold text-zinc-600 uppercase">{new Date(dateRange.end).toLocaleDateString('pt-BR')}</p>
                </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                <button 
                    onClick={handleExportPDF}
                    disabled={loading || reportData.length === 0 || !!exporting}
                    className="py-4 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-glow-red transition-all"
                >
                    {exporting === 'PDF' ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />}
                    Baixar PDF
                </button>
                <button 
                    onClick={handleExportExcel}
                    disabled={loading || reportData.length === 0 || !!exporting}
                    className="py-4 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all"
                >
                    {exporting === 'EXCEL' ? <Loader2 className="animate-spin" size={16} /> : <FileSpreadsheet size={16} />}
                    Baixar Excel
                </button>
            </div>

        </div>
      </div>
    </div>
  );
};
