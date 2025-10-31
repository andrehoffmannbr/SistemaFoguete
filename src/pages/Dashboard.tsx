import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Users, CheckCircle2, TrendingUp, ListTodo, Plus, Clock, DollarSign, Package, Sparkles } from "lucide-react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, parseISO, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TaskList } from "@/components/TaskList";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart, Cell } from "recharts";
import { StatCard } from "@/components/StatCard";

interface Stats {
  todayAppointments: number;
  weekAppointments: number;
  totalCustomers: number;
  completedToday: number;
}

type Appointment = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  customers?: {
    name: string;
  };
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    todayAppointments: 0,
    weekAppointments: 0,
    totalCustomers: 0,
    completedToday: 0,
  });
  const [loading, setLoading] = useState(true);

  // Buscar agendamentos de hoje
  const { data: todayAppointments = [] } = useQuery({
    queryKey: ["today-appointments"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const today = new Date();
      const todayStart = startOfDay(today);
      const todayEnd = endOfDay(today);

      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          customers(name)
        `)
        .eq("user_id", user.id)
        .gte("start_time", todayStart.toISOString())
        .lte("start_time", todayEnd.toISOString())
        .order("start_time");

      if (error) throw error;
      return data as Appointment[];
    },
  });

  // Buscar serviços populares (últimos 30 dias)
  const { data: popularServices = [] } = useQuery({
    queryKey: ["popular-services"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const thirtyDaysAgo = subDays(new Date(), 30);

      const { data, error } = await supabase
        .from("appointments")
        .select("title")
        .eq("user_id", user.id)
        .gte("start_time", thirtyDaysAgo.toISOString());

      if (error) throw error;

      // Contar ocorrências de cada serviço
      const serviceCounts = (data || []).reduce((acc: Record<string, number>, apt: any) => {
        const service = apt.title || "Outros";
        acc[service] = (acc[service] || 0) + 1;
        return acc;
      }, {});

      // Converter para array e ordenar
      return Object.entries(serviceCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5); // Top 5 serviços
    },
  });

  useEffect(() => {
    const fetchStats = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date();
      const todayStart = startOfDay(today);
      const todayEnd = endOfDay(today);
      const weekStart = startOfWeek(today);
      const weekEnd = endOfWeek(today);

      // Today's appointments
      const { count: todayCount } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("start_time", todayStart.toISOString())
        .lte("start_time", todayEnd.toISOString());

      // This week's appointments
      const { count: weekCount } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("start_time", weekStart.toISOString())
        .lte("start_time", weekEnd.toISOString());

      // Total customers
      const { count: customersCount } = await supabase
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Completed today
      const { count: completedCount } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "completed")
        .gte("start_time", todayStart.toISOString())
        .lte("start_time", todayEnd.toISOString());

      setStats({
        todayAppointments: todayCount || 0,
        weekAppointments: weekCount || 0,
        totalCustomers: customersCount || 0,
        completedToday: completedCount || 0,
      });
      setLoading(false);
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: "Atendimentos Hoje",
      value: stats.todayAppointments,
      icon: Calendar,
      gradient: "from-primary to-secondary",
    },
    {
      title: "Atendimentos Semana",
      value: stats.weekAppointments,
      icon: TrendingUp,
      gradient: "from-secondary to-accent",
    },
    {
      title: "Total de Clientes",
      value: stats.totalCustomers,
      icon: Users,
      gradient: "from-accent to-primary",
    },
    {
      title: "Concluídos Hoje",
      value: stats.completedToday,
      icon: CheckCircle2,
      gradient: "from-primary via-secondary to-accent",
    },
  ];

  const quickActions = [
    {
      title: "Novo Agendamento",
      icon: Calendar,
      color: "from-primary to-secondary",
      action: () => navigate("/agendamentos"),
    },
    {
      title: "Novo Cliente",
      icon: Users,
      color: "from-accent to-primary",
      action: () => navigate("/clientes"),
    },
    {
      title: "Movimentação Financeira",
      icon: DollarSign,
      color: "from-secondary to-accent",
      action: () => navigate("/financeiro"),
    },
    {
      title: "Registrar Estoque",
      icon: Package,
      color: "from-primary via-accent to-secondary",
      action: () => navigate("/estoque"),
    },
  ];

  // Dados para gráfico de serviços com cores dinâmicas
  const colors = [
    "hsl(var(--primary))",
    "hsl(var(--accent))",
    "hsl(142 76% 36%)",
    "hsl(38 92% 50%)",
    "hsl(262 83% 58%)",
  ];

  const serviceData = popularServices.map((service, index) => ({
    ...service,
    color: colors[index % colors.length],
  }));

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Premium com gradiente */}
      <div className="relative rounded-2xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10" />
        <div className="relative p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary via-secondary to-accent shadow-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                Painel
              </h1>
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                <Clock className="w-3 h-3" />
                {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cards de Estatísticas Premium */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={loading ? "-" : stat.value}
            icon={stat.icon}
            gradient={stat.gradient}
          />
        ))}
      </div>

      {/* Gráficos de Tendência */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-0 shadow-xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-muted/50 to-muted/20 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-secondary to-accent">
                <Package className="w-4 h-4 text-white" />
              </div>
              <CardTitle className="text-lg font-bold">Serviços Populares</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {serviceData.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                  <Package className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">Nenhum serviço registrado ainda</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={serviceData}>
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: 12 }}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {serviceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ações Rápidas Premium */}
      <Card className="border-0 shadow-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-muted/50 to-muted/20 pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-1 bg-gradient-to-b from-primary to-accent rounded-full" />
            <CardTitle className="text-xl font-bold">Ações Rápidas</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.title}
                  variant="outline"
                  className="group relative h-auto p-4 flex flex-col items-start gap-3 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/50 overflow-hidden"
                  onClick={action.action}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${action.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                  
                  <div className="relative z-10 w-full space-y-2">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${action.color} w-fit shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-left">{action.title}</span>
                  </div>
                  
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-accent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Agendamentos de Hoje Premium */}
      <Card className="border-0 shadow-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-muted/50 to-muted/20 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-accent to-primary">
                <Clock className="h-4 w-4 text-white" />
              </div>
              <CardTitle className="text-lg font-bold">Atendimentos de Hoje</CardTitle>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => navigate("/agendamentos")}
              className="hover:bg-primary hover:text-white transition-colors"
            >
              Ver Todos
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {todayAppointments.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <Calendar className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">Nenhum agendamento para hoje</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayAppointments.map((apt, index) => (
                <div
                  key={apt.id}
                  className="group relative bg-gradient-to-r from-muted/50 to-muted/20 border-l-4 border-primary p-4 rounded-xl hover:shadow-lg transition-all duration-300 hover:-translate-x-1 animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
                  
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="h-2 w-2 rounded-full bg-primary animate-pulse mt-2" />
                      <div className="flex-1">
                        <p className="font-bold text-lg">{apt.title}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {apt.customers?.name}
                        </p>
                      </div>
                    </div>
                    <div className="text-sm font-bold bg-primary/10 px-4 py-2 rounded-lg">
                      {format(parseISO(apt.start_time), "HH:mm")} - {format(parseISO(apt.end_time), "HH:mm")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tarefas Premium */}
      <Card className="border-0 shadow-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-muted/50 to-muted/20 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-secondary">
                <ListTodo className="h-4 w-4 text-white" />
              </div>
              <CardTitle className="text-lg font-bold">Tarefas Pendentes</CardTitle>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => navigate("/tarefas")}
              className="hover:bg-primary hover:text-white transition-colors"
            >
              Ver Todas
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <TaskList maxItems={5} />
        </CardContent>
      </Card>

    </div>
  );
};

export default Dashboard;
