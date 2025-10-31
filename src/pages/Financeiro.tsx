import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, TrendingUp, TrendingDown, DollarSign, PieChart, Download, Filter } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DailyClosing } from "@/components/DailyClosing";
import { FinancialTransactionDialog } from "@/components/FinancialTransactionDialog";
import { useToast } from "@/hooks/use-toast";

interface FinancialSummary {
  income: number;
  expenses: number;
  balance: number;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  payment_method: string;
  transaction_date: string;
  status: string;
}

interface PaymentMethodTotal {
  method: string;
  total: number;
  count: number;
}

const Financeiro = () => {
  const { toast } = useToast();
  const [summary, setSummary] = useState<FinancialSummary>({
    income: 0,
    expenses: 0,
    balance: 0,
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paymentMethodTotals, setPaymentMethodTotals] = useState<PaymentMethodTotal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    startDate: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    endDate: format(endOfMonth(new Date()), "yyyy-MM-dd"),
    paymentMethod: "all",
    type: "all",
  });

  useEffect(() => {
    fetchFinancialData();
  }, [filters]);

  const fetchFinancialData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const startDate = new Date(filters.startDate);
    const endDate = new Date(filters.endDate);
    endDate.setHours(23, 59, 59, 999);

    // Base query
    let incomeQuery = supabase
      .from("financial_transactions")
      .select("*")
      .eq("user_id", user.id)
      .eq("type", "income")
      .eq("status", "completed")
      .gte("transaction_date", startDate.toISOString())
      .lte("transaction_date", endDate.toISOString());

    let expenseQuery = supabase
      .from("financial_transactions")
      .select("*")
      .eq("user_id", user.id)
      .eq("type", "expense")
      .eq("status", "completed")
      .gte("transaction_date", startDate.toISOString())
      .lte("transaction_date", endDate.toISOString());

    // Apply payment method filter
    if (filters.paymentMethod !== "all") {
      incomeQuery = incomeQuery.eq("payment_method", filters.paymentMethod);
      expenseQuery = expenseQuery.eq("payment_method", filters.paymentMethod);
    }

    const [incomeRes, expenseRes] = await Promise.all([incomeQuery, expenseQuery]);

    const incomeData = incomeRes.data || [];
    const expenseData = expenseRes.data || [];

    const totalIncome = incomeData.reduce((sum, item) => sum + Number(item.amount), 0);
    const totalExpenses = expenseData.reduce((sum, item) => sum + Number(item.amount), 0);

    setSummary({
      income: totalIncome,
      expenses: totalExpenses,
      balance: totalIncome - totalExpenses,
    });

    // Calculate totals by payment method
    const allTransactions = [...incomeData, ...expenseData];
    const methodMap = new Map<string, { total: number; count: number }>();

    allTransactions.forEach((t) => {
      const method = t.payment_method || "Não especificado";
      const current = methodMap.get(method) || { total: 0, count: 0 };
      methodMap.set(method, {
        total: current.total + Number(t.amount),
        count: current.count + 1,
      });
    });

    const methodTotals: PaymentMethodTotal[] = Array.from(methodMap.entries()).map(([method, data]) => ({
      method,
      total: data.total,
      count: data.count,
    }));

    setPaymentMethodTotals(methodTotals.sort((a, b) => b.total - a.total));

    // Get all transactions for display
    const allQuery = supabase
      .from("financial_transactions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("transaction_date", startDate.toISOString())
      .lte("transaction_date", endDate.toISOString())
      .order("transaction_date", { ascending: false })
      .limit(50);

    const { data: allData } = await allQuery;
    setTransactions(allData || []);

    setLoading(false);
  };

  const exportToPDF = () => {
    // Simple export - in production, use a library like jsPDF
    const content = `
RELATÓRIO FINANCEIRO
Período: ${format(new Date(filters.startDate), "dd/MM/yyyy")} - ${format(new Date(filters.endDate), "dd/MM/yyyy")}

RESUMO:
Receitas: ${formatCurrency(summary.income)}
Despesas: ${formatCurrency(summary.expenses)}
Saldo: ${formatCurrency(summary.balance)}

TOTAIS POR FORMA DE PAGAMENTO:
${paymentMethodTotals.map((m) => `${getPaymentMethodLabel(m.method)}: ${formatCurrency(m.total)} (${m.count} transações)`).join("\n")}
    `.trim();

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-financeiro-${format(new Date(), "yyyy-MM-dd")}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Relatório exportado!",
      description: "O arquivo foi baixado com sucesso.",
    });
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      pix: "Pix",
      credit_card: "Cartão de Crédito",
      debit_card: "Cartão de Débito",
      cash: "Dinheiro",
      bank_transfer: "Transferência Bancária",
    };
    return labels[method] || method;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Financeiro</h1>
          <p className="text-muted-foreground">Controle completo das suas finanças</p>
        </div>
        <div className="flex gap-3">
          <DailyClosing />
          <Button className="gap-2" onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4" />
            Nova Transação
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Data Inicial</Label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              />
            </div>
            <div>
              <Label>Data Final</Label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              />
            </div>
            <div>
              <Label>Forma de Pagamento</Label>
              <Select
                value={filters.paymentMethod}
                onValueChange={(value) => setFilters({ ...filters, paymentMethod: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="pix">Pix</SelectItem>
                  <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                  <SelectItem value="debit_card">Cartão de Débito</SelectItem>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                  <SelectItem value="bank_transfer">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={exportToPDF} variant="outline" className="w-full gap-2">
                <Download className="w-4 h-4" />
                Exportar PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Receitas do Mês
            </CardTitle>
            <div className="p-2 rounded-lg bg-gradient-to-br from-accent to-green-500">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-accent">
              {loading ? "-" : formatCurrency(summary.income)}
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Despesas do Mês
            </CardTitle>
            <div className="p-2 rounded-lg bg-gradient-to-br from-destructive to-red-600">
              <TrendingDown className="w-4 h-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">
              {loading ? "-" : formatCurrency(summary.expenses)}
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo do Mês
            </CardTitle>
            <div className={`p-2 rounded-lg bg-gradient-to-br ${summary.balance >= 0 ? 'from-primary to-primary-hover' : 'from-destructive to-red-600'}`}>
              <DollarSign className="w-4 h-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${summary.balance >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {loading ? "-" : formatCurrency(summary.balance)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Method Breakdown */}
      {paymentMethodTotals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Totais por Forma de Pagamento</CardTitle>
            <CardDescription>Distribuição do período selecionado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {paymentMethodTotals.map((method) => (
                <div key={method.method} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">{getPaymentMethodLabel(method.method)}</p>
                    <p className="text-sm text-muted-foreground">{method.count} transações</p>
                  </div>
                  <p className="text-lg font-bold">{formatCurrency(method.total)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs for different views */}
      <Tabs defaultValue="transactions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="transactions">Transações</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
          <TabsTrigger value="reports">Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Transações Recentes</CardTitle>
              <CardDescription>Histórico de entradas e saídas do período</CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  <p>Nenhuma transação encontrada no período selecionado.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{transaction.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(transaction.transaction_date), "dd/MM/yyyy", { locale: ptBR })} •{" "}
                          {getPaymentMethodLabel(transaction.payment_method)}
                        </p>
                      </div>
                      <p
                        className={`text-lg font-bold ${
                          transaction.type === "income" ? "text-accent" : "text-destructive"
                        }`}
                      >
                        {transaction.type === "income" ? "+" : "-"} {formatCurrency(transaction.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Categorias Financeiras</CardTitle>
                  <CardDescription>
                    Organize suas transações por categoria
                  </CardDescription>
                </div>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Nova Categoria
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-accent" />
                    Receitas
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <span className="font-medium">Serviços</span>
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#10b981' }} />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <span className="font-medium">Produtos</span>
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#3b82f6' }} />
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-destructive" />
                    Despesas
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <span className="font-medium">Aluguel</span>
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#ef4444' }} />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <span className="font-medium">Salários</span>
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Relatórios e DRE</CardTitle>
              <CardDescription>
                Demonstrativo de Resultados do Exercício (DRE) simplificado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">DRE - {format(new Date(), "MMMM/yyyy", { locale: ptBR })}</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-accent font-medium">Receitas Totais</span>
                      <span className="font-bold text-accent">{formatCurrency(summary.income)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-destructive font-medium">Despesas Totais</span>
                      <span className="font-bold text-destructive">- {formatCurrency(summary.expenses)}</span>
                    </div>
                    <div className="border-t border-border pt-2 flex justify-between">
                      <span className="font-bold">Resultado Líquido</span>
                      <span className={`font-bold ${summary.balance >= 0 ? 'text-accent' : 'text-destructive'}`}>
                        {formatCurrency(summary.balance)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <FinancialTransactionDialog open={dialogOpen} onOpenChange={setDialogOpen} onSuccess={fetchFinancialData} />
    </div>
  );
};

export default Financeiro;
