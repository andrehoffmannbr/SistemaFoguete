import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TrendingUp, 
  TrendingDown, 
  Users, 
  Calendar, 
  DollarSign,
  MessageSquare,
  AlertCircle,
  Clock,
  Target,
  Loader2,
  Package,
  BarChart3,
  PieChart as PieChartIcon
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface InactiveCustomer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  last_visit: string;
  days_inactive: number;
  total_visits: number;
  total_spent: number;
}

interface TimeSlotAnalysis {
  day_of_week: string;
  hour: number;
  appointment_count: number;
  revenue: number;
  conversion_rate: number;
}

interface FinancialSummary {
  total_revenue: number;
  total_expenses: number;
  profit: number;
  canceled_appointments: number;
  pending_payments: number;
  income_transactions: Array<{
    id: string;
    amount: number;
    description: string;
    transaction_date: string;
    payment_method: string;
  }>;
  expense_transactions: Array<{
    id: string;
    amount: number;
    description: string;
    transaction_date: string;
    payment_method: string;
  }>;
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  current_stock: number;
  minimum_stock: number;
  cost_price: number;
  sale_price: number;
}

interface InventoryChartData {
  name: string;
  value: number;
  cost: number;
}

const Relatorios = () => {
  const navigate = useNavigate();
  const [inactiveCustomers, setInactiveCustomers] = useState<InactiveCustomer[]>([]);
  const [timeSlotAnalysis, setTimeSlotAnalysis] = useState<TimeSlotAnalysis[]>([]);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([]);
  const [chartType, setChartType] = useState<"pie" | "bar">("pie");
  const [loading, setLoading] = useState(true);
  const [reactivating, setReactivating] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      // Buscar clientes inativos
      const sixtyDaysAgo = subDays(new Date(), 60);
      
      const { data: allCustomers } = await supabase
        .from("customers")
        .select("*")
        .eq("user_id", user.id);

      if (allCustomers) {
        const inactiveList: InactiveCustomer[] = [];
        
        for (const customer of allCustomers) {
          const { data: lastAppointment } = await supabase
            .from("appointments")
            .select("end_time")
            .eq("user_id", user.id)
            .eq("customer_id", customer.id)
            .eq("status", "completed")
            .order("end_time", { ascending: false })
            .limit(1)
            .single();

          if (lastAppointment && new Date(lastAppointment.end_time) < sixtyDaysAgo) {
            const { data: customerAppointments } = await supabase
              .from("appointments")
              .select("price")
              .eq("customer_id", customer.id)
              .eq("status", "completed");

            const totalVisits = customerAppointments?.length || 0;
            const totalSpent = customerAppointments?.reduce((sum, apt) => sum + Number(apt.price || 0), 0) || 0;
            const daysInactive = Math.floor((Date.now() - new Date(lastAppointment.end_time).getTime()) / (1000 * 60 * 60 * 24));

            inactiveList.push({
              id: customer.id,
              name: customer.name,
              phone: customer.phone,
              email: customer.email,
              last_visit: lastAppointment.end_time,
              days_inactive: daysInactive,
              total_visits: totalVisits,
              total_spent: totalSpent,
            });
          }
        }

        setInactiveCustomers(inactiveList.sort((a, b) => b.total_spent - a.total_spent));
      }

      // Análise de horários (últimos 90 dias)
      const ninetyDaysAgo = subDays(new Date(), 90);
      const { data: appointments } = await supabase
        .from("appointments")
        .select("start_time, end_time, status, price")
        .eq("user_id", user.id)
        .gte("start_time", ninetyDaysAgo.toISOString());

      if (appointments) {
        const slotMap = new Map<string, { count: number; revenue: number }>();
        
        appointments.forEach(apt => {
          const date = new Date(apt.start_time);
          const dayOfWeek = format(date, "EEEE", { locale: ptBR });
          const hour = date.getHours();
          const key = `${dayOfWeek}-${hour}`;
          
          const current = slotMap.get(key) || { count: 0, revenue: 0 };
          slotMap.set(key, {
            count: current.count + 1,
            revenue: current.revenue + (apt.status === "completed" ? Number(apt.price || 0) : 0)
          });
        });

        const analysis: TimeSlotAnalysis[] = [];
        slotMap.forEach((value, key) => {
          const [dayOfWeek, hourStr] = key.split("-");
          const hour = parseInt(hourStr);
          
          // Validar se o hour é um número válido
          if (!isNaN(hour) && hour >= 0 && hour <= 23) {
            analysis.push({
              day_of_week: dayOfWeek,
              hour: hour,
              appointment_count: value.count,
              revenue: value.revenue,
              conversion_rate: value.count > 0 ? (value.revenue / value.count) : 0
            });
          }
        });

        setTimeSlotAnalysis(
          analysis.sort((a, b) => b.appointment_count - a.appointment_count).slice(0, 10)
        );
      }

      // Resumo financeiro (últimos 30 dias)
      const thirtyDaysAgo = subDays(new Date(), 30);
      
      const { data: incomeData } = await supabase
        .from("financial_transactions")
        .select("id, amount, description, transaction_date, payment_method")
        .eq("user_id", user.id)
        .eq("type", "income")
        .eq("status", "completed")
        .gte("transaction_date", thirtyDaysAgo.toISOString())
        .order("transaction_date", { ascending: false });

      const { data: expenseData } = await supabase
        .from("financial_transactions")
        .select("id, amount, description, transaction_date, payment_method")
        .eq("user_id", user.id)
        .eq("type", "expense")
        .eq("status", "completed")
        .gte("transaction_date", thirtyDaysAgo.toISOString())
        .order("transaction_date", { ascending: false });

      const { data: canceledApts } = await supabase
        .from("appointments")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "canceled")
        .gte("created_at", thirtyDaysAgo.toISOString());

      const { data: pendingPayments } = await supabase
        .from("financial_transactions")
        .select("amount")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .gte("transaction_date", thirtyDaysAgo.toISOString());

      const totalRevenue = incomeData?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const totalExpenses = expenseData?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const pendingAmount = pendingPayments?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      console.log("Dados financeiros carregados:", {
        incomeRecords: incomeData?.length || 0,
        expenseRecords: expenseData?.length || 0,
        totalRevenue,
        totalExpenses,
      });

      setFinancialSummary({
        total_revenue: totalRevenue,
        total_expenses: totalExpenses,
        profit: totalRevenue - totalExpenses,
        canceled_appointments: canceledApts?.length || 0,
        pending_payments: pendingAmount,
        income_transactions: incomeData || [],
        expense_transactions: expenseData || [],
      });

      // Buscar dados do estoque
      const { data: inventory } = await supabase
        .from("inventory_items")
        .select("id, name, category, current_stock, minimum_stock, cost_price, sale_price")
        .eq("user_id", user.id)
        .order("current_stock", { ascending: false });

      if (inventory) {
        setInventoryData(inventory);
      }

    } catch (error) {
      console.error("Erro ao carregar relatórios:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os relatórios.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReactivateCustomer = async (customer: InactiveCustomer) => {
    setReactivating(customer.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.functions.invoke("reactivate-customer", {
        body: { 
          customerId: customer.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          daysInactive: customer.days_inactive
        },
      });

      if (error) throw error;

      toast({
        title: "Mensagem enviada!",
        description: `Mensagem de reativação enviada para ${customer.name}`,
      });
    } catch (error) {
      console.error("Erro ao reativar cliente:", error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a mensagem de reativação.",
        variant: "destructive",
      });
    } finally {
      setReactivating(null);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Relatórios Inteligentes</h1>
        <p className="text-muted-foreground">Insights e ações para o crescimento do seu negócio</p>
      </div>

      <Tabs defaultValue="financial" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="financial">Financeiro</TabsTrigger>
          <TabsTrigger value="inventory">Estoque</TabsTrigger>
          <TabsTrigger value="inactive">Clientes Inativos</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        {/* Resumo Financeiro */}
        <TabsContent value="financial" className="space-y-4">
          {financialSummary ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Receita (30 dias)</CardTitle>
                    <TrendingUp className="w-4 h-4 text-accent" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-accent">
                      {formatCurrency(financialSummary.total_revenue)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Despesas (30 dias)</CardTitle>
                    <TrendingDown className="w-4 h-4 text-destructive" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">
                      {formatCurrency(financialSummary.total_expenses)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Lucro</CardTitle>
                    <DollarSign className="w-4 h-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${financialSummary.profit >= 0 ? 'text-accent' : 'text-destructive'}`}>
                      {formatCurrency(financialSummary.profit)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Cancelamentos</CardTitle>
                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{financialSummary.canceled_appointments}</div>
                  </CardContent>
                </Card>
              </div>

              {financialSummary.total_revenue === 0 && financialSummary.total_expenses === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <DollarSign className="w-16 h-16 text-muted-foreground/50 mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Nenhum dado financeiro encontrado</h3>
                    <p className="text-muted-foreground text-center max-w-md mb-4">
                      Comece registrando suas transações na página de Financeiro para visualizar relatórios detalhados aqui.
                    </p>
                    <Button onClick={() => navigate("/financeiro")}>
                      Ir para Financeiro
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-primary" />
                      Próximos Passos Recomendados
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {financialSummary.pending_payments > 0 && (
                        <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-medium">Pagamentos Pendentes</p>
                            <p className="text-sm text-muted-foreground">
                              Você tem {formatCurrency(financialSummary.pending_payments)} em pagamentos pendentes. 
                              Considere enviar lembretes aos clientes.
                            </p>
                          </div>
                        </div>
                      )}

                      {financialSummary.profit < 0 && (
                        <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                          <TrendingDown className="w-5 h-5 text-red-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-medium">Atenção ao Prejuízo</p>
                            <p className="text-sm text-muted-foreground">
                              Suas despesas estão superiores às receitas. Revise seus custos e considere ajustar preços.
                            </p>
                          </div>
                        </div>
                      )}

                      {financialSummary.canceled_appointments > 5 && (
                        <div className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                          <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-medium">Taxa de Cancelamento Alta</p>
                            <p className="text-sm text-muted-foreground">
                              {financialSummary.canceled_appointments} cancelamentos nos últimos 30 dias. 
                              Considere enviar lembretes automáticos antes dos agendamentos.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Lista de Transações */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* Entradas */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-accent">
                      <TrendingUp className="w-5 h-5" />
                      Entradas (30 dias)
                    </CardTitle>
                    <CardDescription>
                      Total: {formatCurrency(financialSummary.total_revenue)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {financialSummary.income_transactions.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhuma entrada registrada
                      </p>
                    ) : (
                      <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {financialSummary.income_transactions.map((transaction) => (
                          <div
                            key={transaction.id}
                            className="flex items-start justify-between p-3 bg-accent/5 rounded-lg border"
                          >
                            <div className="flex-1">
                              <p className="font-medium text-sm">
                                {transaction.description || "Sem descrição"}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-xs">
                                  {transaction.payment_method || "N/A"}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(transaction.transaction_date), "dd/MM/yyyy", { locale: ptBR })}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-accent">
                                {formatCurrency(Number(transaction.amount))}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Saídas */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                      <TrendingDown className="w-5 h-5" />
                      Saídas (30 dias)
                    </CardTitle>
                    <CardDescription>
                      Total: {formatCurrency(financialSummary.total_expenses)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {financialSummary.expense_transactions.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhuma saída registrada
                      </p>
                    ) : (
                      <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {financialSummary.expense_transactions.map((transaction) => (
                          <div
                            key={transaction.id}
                            className="flex items-start justify-between p-3 bg-destructive/5 rounded-lg border"
                          >
                            <div className="flex-1">
                              <p className="font-medium text-sm">
                                {transaction.description || "Sem descrição"}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-xs">
                                  {transaction.payment_method || "N/A"}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(transaction.transaction_date), "dd/MM/yyyy", { locale: ptBR })}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-destructive">
                                {formatCurrency(Number(transaction.amount))}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </TabsContent>

        {/* Relatório de Estoque */}
        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary" />
                    Relatório de Estoque
                  </CardTitle>
                  <CardDescription>
                    Visualização do estoque atual por categoria e produto
                  </CardDescription>
                </div>
                <Select value={chartType} onValueChange={(value: "pie" | "bar") => setChartType(value)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pie">
                      <div className="flex items-center gap-2">
                        <PieChartIcon className="w-4 h-4" />
                        Gráfico Pizza
                      </div>
                    </SelectItem>
                    <SelectItem value="bar">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        Gráfico Barras
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {inventoryData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum item em estoque encontrado.</p>
                  <Button 
                    onClick={() => navigate("/estoque")} 
                    className="mt-4"
                    variant="outline"
                  >
                    Adicionar Itens ao Estoque
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Gráfico */}
                  <div className="h-[400px]">
                    {chartType === "pie" ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={(() => {
                              const categoryMap = new Map<string, { value: number; cost: number }>();
                              inventoryData.forEach(item => {
                                const category = item.category || "Sem categoria";
                                const current = categoryMap.get(category) || { value: 0, cost: 0 };
                                categoryMap.set(category, {
                                  value: current.value + item.current_stock,
                                  cost: current.cost + (item.current_stock * (item.cost_price || 0))
                                });
                              });
                              return Array.from(categoryMap.entries()).map(([name, data]) => ({
                                name,
                                value: data.value,
                                cost: data.cost
                              }));
                            })()}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={120}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {(() => {
                              const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];
                              const categoryMap = new Map<string, { value: number; cost: number }>();
                              inventoryData.forEach(item => {
                                const category = item.category || "Sem categoria";
                                const current = categoryMap.get(category) || { value: 0, cost: 0 };
                                categoryMap.set(category, {
                                  value: current.value + item.current_stock,
                                  cost: current.cost + (item.current_stock * (item.cost_price || 0))
                                });
                              });
                              return Array.from(categoryMap.entries()).map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ));
                            })()}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number, name: string, props: any) => [
                              `${value} unidades (${formatCurrency(props.payload.cost)})`,
                              name
                            ]}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={(() => {
                            const categoryMap = new Map<string, { value: number; cost: number }>();
                            inventoryData.forEach(item => {
                              const category = item.category || "Sem categoria";
                              const current = categoryMap.get(category) || { value: 0, cost: 0 };
                              categoryMap.set(category, {
                                value: current.value + item.current_stock,
                                cost: current.cost + (item.current_stock * (item.cost_price || 0))
                              });
                            });
                            return Array.from(categoryMap.entries()).map(([name, data]) => ({
                              name,
                              quantity: data.value,
                              cost: data.cost
                            }));
                          })()}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis yAxisId="left" />
                          <YAxis yAxisId="right" orientation="right" />
                          <Tooltip />
                          <Legend />
                          <Bar yAxisId="left" dataKey="quantity" fill="hsl(var(--primary))" name="Quantidade" />
                          <Bar yAxisId="right" dataKey="cost" fill="hsl(var(--accent))" name="Valor Total" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* Estatísticas */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-sm font-medium text-muted-foreground mb-1">
                          Total de Itens
                        </div>
                        <div className="text-2xl font-bold">
                          {inventoryData.length}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-sm font-medium text-muted-foreground mb-1">
                          Qtd. Total em Estoque
                        </div>
                        <div className="text-2xl font-bold">
                          {inventoryData.reduce((sum, item) => sum + item.current_stock, 0)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-sm font-medium text-muted-foreground mb-1">
                          Valor Total (Custo)
                        </div>
                        <div className="text-2xl font-bold">
                          {formatCurrency(
                            inventoryData.reduce((sum, item) => 
                              sum + (item.current_stock * (item.cost_price || 0)), 0
                            )
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Alertas de estoque baixo */}
                  {inventoryData.some(item => item.current_stock <= item.minimum_stock) && (
                    <Card className="border-destructive/50 bg-destructive/5">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-destructive">
                          <AlertCircle className="w-5 h-5" />
                          Itens com Estoque Baixo
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {inventoryData
                            .filter(item => item.current_stock <= item.minimum_stock)
                            .map(item => (
                              <div key={item.id} className="flex items-center justify-between p-3 bg-background rounded-lg">
                                <div>
                                  <p className="font-medium">{item.name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {item.category || "Sem categoria"}
                                  </p>
                                </div>
                                <Badge variant="destructive">
                                  {item.current_stock} / {item.minimum_stock}
                                </Badge>
                              </div>
                            ))
                          }
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Clientes Inativos */}
        <TabsContent value="inactive" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Clientes Inativos há 60+ dias ({inactiveCustomers.length})
              </CardTitle>
              <CardDescription>
                Clientes que não retornam há mais de 60 dias - hora de reconquistar!
              </CardDescription>
            </CardHeader>
            <CardContent>
              {inactiveCustomers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Ótimo! Nenhum cliente inativo encontrado.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {inactiveCustomers.map((customer) => (
                    <div
                      key={customer.id}
                      className="flex items-center justify-between p-4 bg-muted rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">{customer.name}</p>
                          <Badge variant="outline">{customer.days_inactive} dias</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {customer.total_visits} visitas • {formatCurrency(customer.total_spent)} gasto total
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Última visita: {format(new Date(customer.last_visit), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <Button
                        onClick={() => handleReactivateCustomer(customer)}
                        disabled={reactivating === customer.id}
                        className="gap-2"
                        size="sm"
                      >
                        {reactivating === customer.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <MessageSquare className="w-4 h-4" />
                            Reativar
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance e Horários */}
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Horários de Maior Conversão
              </CardTitle>
              <CardDescription>
                Análise dos últimos 90 dias - horários com mais agendamentos e receita
              </CardDescription>
            </CardHeader>
            <CardContent>
              {timeSlotAnalysis.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Dados insuficientes para análise. Continue registrando agendamentos!</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 mb-6">
                    {timeSlotAnalysis.map((slot, idx) => (
                      <div
                        key={`${slot.day_of_week}-${slot.hour}`}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                            {idx + 1}
                          </div>
                          <div>
                            <p className="font-medium capitalize">
                              {slot.day_of_week} às {String(slot.hour).padStart(2, '0')}:00
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {slot.appointment_count} agendamentos • {formatCurrency(slot.revenue)}
                            </p>
                          </div>
                        </div>
                        <Badge variant="secondary">
                          {((slot.appointment_count / timeSlotAnalysis[0].appointment_count) * 100).toFixed(0)}%
                        </Badge>
                      </div>
                    ))}
                  </div>

                  {timeSlotAnalysis.length >= 2 && (
                    <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Target className="w-5 h-5 text-primary" />
                        Sugestão Automática
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Seus horários de maior movimento são{" "}
                        <strong className="text-foreground capitalize">
                          {timeSlotAnalysis[0].day_of_week} às {String(timeSlotAnalysis[0].hour).padStart(2, '0')}:00
                        </strong>{" "}
                        e{" "}
                         <strong className="text-foreground capitalize">
                          {timeSlotAnalysis[1]?.day_of_week} às {String(timeSlotAnalysis[1]?.hour).padStart(2, '0')}:00
                         </strong>
                        . Considere:
                      </p>
                      <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc list-inside">
                        <li>Aumentar disponibilidade nesses horários</li>
                        <li>Oferecer promoções em horários menos movimentados</li>
                        <li>Alocar funcionários extras nos picos</li>
                      </ul>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Relatorios;