import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, FileText, DollarSign, CheckCircle, ListTodo } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";

interface CustomerHistoryProps {
  customerId: string;
}

interface HistoryEvent {
  id: string;
  type: "appointment" | "proposal" | "transaction" | "task";
  title: string;
  description?: string;
  date: string;
  status?: string;
  amount?: number;
  icon: any;
  color: string;
}

export const CustomerHistory = ({ customerId }: CustomerHistoryProps) => {
  // Usar useQuery para gerenciar o histórico com cache e atualização automática
  const { data: events = [], isLoading: loading } = useQuery({
    queryKey: ["customer-history", customerId],
    queryFn: async () => {
    try {
      // Buscar agendamentos
      const { data: appointments } = await supabase
        .from("appointments")
        .select("*")
        .eq("customer_id", customerId)
        .order("start_time", { ascending: false });

      // Buscar propostas
      const { data: proposals } = await supabase
        .from("proposals")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      // Buscar transações relacionadas aos agendamentos deste cliente
      const appointmentIds = appointments?.map(a => a.id) || [];
      const { data: transactions } = appointmentIds.length > 0
        ? await supabase
            .from("financial_transactions")
            .select("*")
            .in("appointment_id", appointmentIds)
            .order("transaction_date", { ascending: false })
        : { data: [] };

      // Buscar tarefas
      const { data: tasks } = await supabase
        .from("tasks")
        .select("*")
        .eq("metadata->>customer_id", customerId)
        .order("created_at", { ascending: false });

      // Combinar e ordenar todos os eventos
      const allEvents: HistoryEvent[] = [];

      // Adicionar agendamentos
      appointments?.forEach(apt => {
        allEvents.push({
          id: apt.id,
          type: "appointment",
          title: apt.title,
          description: apt.notes,
          date: apt.start_time,
          status: apt.status,
          icon: Calendar,
          color: "text-blue-500",
        });
      });

      // Adicionar propostas
      proposals?.forEach(prop => {
        allEvents.push({
          id: prop.id,
          type: "proposal",
          title: prop.title,
          description: prop.description,
          date: prop.created_at,
          status: prop.status,
          amount: prop.final_amount,
          icon: FileText,
          color: "text-purple-500",
        });
      });

      // Adicionar transações
      transactions?.forEach(trans => {
        allEvents.push({
          id: trans.id,
          type: "transaction",
          title: trans.description || "Transação",
          date: trans.transaction_date,
          status: trans.status,
          amount: trans.amount,
          icon: DollarSign,
          color: trans.type === "income" ? "text-green-500" : "text-red-500",
        });
      });

      // Adicionar tarefas
      tasks?.forEach(task => {
        allEvents.push({
          id: task.id,
          type: "task",
          title: task.title,
          description: task.description,
          date: task.created_at,
          status: task.status,
          icon: ListTodo,
          color: "text-orange-500",
        });
      });

      // Ordenar por data (mais recente primeiro)
      allEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return allEvents;
    } catch (error) {
      console.error("Erro ao buscar histórico:", error);
      return [];
    }
    },
  });

  const getStatusBadge = (type: string, status?: string) => {
    if (!status) return null;

    const statusConfig: Record<string, { label: string; variant: any; className?: string }> = {
      // Agendamentos
      scheduled: { label: "Agendado", variant: "secondary" },
      completed: { label: "Concluído", variant: "default", className: "bg-green-500 hover:bg-green-600" },
      cancelled: { label: "Cancelado", variant: "destructive" },
      // Propostas
      pending: { label: "Pendente", variant: "secondary" },
      sent: { label: "Enviada", variant: "default" },
      confirmed: { label: "Confirmada", variant: "default" },
      rejected: { label: "Recusada", variant: "destructive" },
      // Transações
      paid: { label: "Pago", variant: "default" },
      // Tarefas
      pending_task: { label: "Pendente", variant: "secondary" },
      completed_task: { label: "Concluída", variant: "default" },
    };

    const config = statusConfig[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (loading) {
    return <div className="text-center py-6 text-muted-foreground">Carregando histórico...</div>;
  }

  if (events.length === 0) {
    return <div className="text-center py-6 text-muted-foreground">Nenhum evento no histórico.</div>;
  }

  return (
    <div className="space-y-4">
      {events.map((event) => {
        const Icon = event.icon;
        return (
          <Card key={`${event.type}-${event.id}`} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`w-5 h-5 ${event.color}`} />
                  <CardTitle className="text-base">{event.title}</CardTitle>
                </div>
                {getStatusBadge(event.type, event.status)}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {event.description && (
                  <p className="text-sm text-muted-foreground">{event.description}</p>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {format(new Date(event.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                  {event.amount && (
                    <span className={`font-semibold ${event.color}`}>
                      {formatCurrency(event.amount)}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};