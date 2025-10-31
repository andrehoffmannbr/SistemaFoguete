import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileDown, Send, Loader2 } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface DailyClosingData {
  date: string;
  payments: {
    pix: number;
    card: number;
    cash: number;
    total: number;
  };
  services: Array<{
    title: string;
    customer: string;
    amount: number;
    payment_method: string;
  }>;
  expenses: Array<{
    description: string;
    amount: number;
    category: string;
  }>;
  balance: number;
}

export const DailyClosing = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [data, setData] = useState<DailyClosingData | null>(null);
  const { toast } = useToast();

  const loadDailyData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const today = new Date();
      const dayStart = startOfDay(today);
      const dayEnd = endOfDay(today);

      // Buscar transações de receita (serviços)
      const { data: incomeTransactions } = await supabase
        .from("financial_transactions")
        .select(`
          *,
          appointments (
            title,
            customers (name)
          )
        `)
        .eq("user_id", user.id)
        .eq("type", "income")
        .eq("status", "completed")
        .gte("transaction_date", dayStart.toISOString())
        .lte("transaction_date", dayEnd.toISOString());

      // Buscar transações de despesas
      const { data: expenseTransactions } = await supabase
        .from("financial_transactions")
        .select(`
          *,
          financial_categories (name)
        `)
        .eq("user_id", user.id)
        .eq("type", "expense")
        .eq("status", "completed")
        .gte("transaction_date", dayStart.toISOString())
        .lte("transaction_date", dayEnd.toISOString());

      // Calcular totais por método de pagamento
      const paymentsByMethod = {
        pix: 0,
        card: 0,
        cash: 0,
      };

      incomeTransactions?.forEach((t) => {
        const amount = Number(t.amount);
        if (t.payment_method === "pix") paymentsByMethod.pix += amount;
        else if (t.payment_method === "card") paymentsByMethod.card += amount;
        else if (t.payment_method === "cash") paymentsByMethod.cash += amount;
      });

      const totalIncome = incomeTransactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const totalExpenses = expenseTransactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      const services = incomeTransactions?.map((t) => ({
        title: t.appointments?.title || t.description || "Serviço",
        customer: t.appointments?.customers?.name || "Cliente não identificado",
        amount: Number(t.amount),
        payment_method: t.payment_method || "não informado",
      })) || [];

      const expenses = expenseTransactions?.map((t) => ({
        description: t.description || "Despesa",
        amount: Number(t.amount),
        category: t.financial_categories?.name || "Sem categoria",
      })) || [];

      setData({
        date: format(today, "dd/MM/yyyy", { locale: ptBR }),
        payments: {
          pix: paymentsByMethod.pix,
          card: paymentsByMethod.card,
          cash: paymentsByMethod.cash,
          total: totalIncome,
        },
        services,
        expenses,
        balance: totalIncome - totalExpenses,
      });
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados do dia.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateAndSendReport = async () => {
    if (!data) return;

    setGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Chamar edge function para gerar PDF e enviar
      const { error } = await supabase.functions.invoke("generate-daily-report", {
        body: { reportData: data, userEmail: user.email },
      });

      if (error) throw error;

      toast({
        title: "Relatório enviado!",
        description: "O fechamento do dia foi enviado para seu e-mail.",
      });
      setOpen(false);
    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar o relatório. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (isOpen) loadDailyData();
    }}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2">
          <FileDown className="w-5 h-5" />
          Fechamento do Dia
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Fechamento do Dia</DialogTitle>
          <DialogDescription>
            Resumo completo das movimentações financeiras de hoje
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Data */}
            <div className="text-center">
              <h3 className="text-lg font-semibold text-muted-foreground">{data.date}</h3>
            </div>

            {/* Totais por método */}
            <Card>
              <CardContent className="pt-6">
                <h4 className="font-semibold mb-4">Recebimentos por Método</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">Pix</p>
                    <p className="text-xl font-bold text-primary">{formatCurrency(data.payments.pix)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">Cartão</p>
                    <p className="text-xl font-bold text-primary">{formatCurrency(data.payments.card)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">Dinheiro</p>
                    <p className="text-xl font-bold text-primary">{formatCurrency(data.payments.cash)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">Total</p>
                    <p className="text-2xl font-bold text-accent">{formatCurrency(data.payments.total)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Serviços realizados */}
            <Card>
              <CardContent className="pt-6">
                <h4 className="font-semibold mb-4">Serviços Realizados ({data.services.length})</h4>
                {data.services.length > 0 ? (
                  <div className="space-y-3">
                    {data.services.map((service, idx) => (
                      <div key={idx} className="flex justify-between items-start p-3 bg-muted rounded-lg">
                        <div>
                          <p className="font-medium">{service.title}</p>
                          <p className="text-sm text-muted-foreground">{service.customer}</p>
                          <p className="text-xs text-muted-foreground capitalize">Pag: {service.payment_method}</p>
                        </div>
                        <p className="font-bold text-accent">{formatCurrency(service.amount)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">Nenhum serviço realizado hoje</p>
                )}
              </CardContent>
            </Card>

            {/* Despesas */}
            <Card>
              <CardContent className="pt-6">
                <h4 className="font-semibold mb-4">Despesas ({data.expenses.length})</h4>
                {data.expenses.length > 0 ? (
                  <div className="space-y-3">
                    {data.expenses.map((expense, idx) => (
                      <div key={idx} className="flex justify-between items-start p-3 bg-muted rounded-lg">
                        <div>
                          <p className="font-medium">{expense.description}</p>
                          <p className="text-sm text-muted-foreground">{expense.category}</p>
                        </div>
                        <p className="font-bold text-destructive">-{formatCurrency(expense.amount)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">Nenhuma despesa registrada hoje</p>
                )}
              </CardContent>
            </Card>

            {/* Saldo final */}
            <Card className="border-2 border-primary">
              <CardContent className="pt-6">
                <div className="flex justify-between items-center">
                  <h4 className="text-xl font-bold">Saldo do Dia</h4>
                  <p className={`text-3xl font-bold ${data.balance >= 0 ? 'text-accent' : 'text-destructive'}`}>
                    {formatCurrency(data.balance)}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Botão enviar */}
            <div className="flex gap-3">
              <Button 
                onClick={generateAndSendReport} 
                disabled={generating}
                className="flex-1 gap-2"
                size="lg"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Gerar PDF e Enviar
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-12">
            Erro ao carregar dados
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};