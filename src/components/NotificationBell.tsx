import { useState, useEffect } from "react";
import { Bell, Calendar, ListTodo, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Appointment {
  id: string;
  title: string;
  start_time: string;
  customer_id: string;
}

interface Task {
  id: string;
  title: string;
  due_date: string;
  priority: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  // Buscar notificações não vistas
  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { appointments: [], tasks: [] };

      // Buscar atendimentos do dia
      const { data: appointmentsData } = await supabase
        .from("appointments")
        .select("id, title, start_time, customer_id")
        .eq("user_id", user.id)
        .gte("start_time", today.toISOString())
        .lt("start_time", tomorrow.toISOString())
        .order("start_time", { ascending: true });

      // Buscar tarefas pendentes
      const { data: tasksData } = await supabase
        .from("tasks")
        .select("id, title, due_date, priority")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .lte("due_date", tomorrow.toISOString())
        .order("due_date", { ascending: true })
        .limit(10);

      // Buscar notificações já vistas
      const { data: viewedData } = await supabase
        .from("notification_views")
        .select("notification_type, notification_id")
        .eq("user_id", user.id);

      const viewedSet = new Set(
        viewedData?.map((v) => `${v.notification_type}-${v.notification_id}`) || []
      );

      // Filtrar apenas não vistas
      const unseenAppointments = (appointmentsData || []).filter(
        (apt) => !viewedSet.has(`appointment-${apt.id}`)
      );
      const unseenTasks = (tasksData || []).filter(
        (task) => !viewedSet.has(`task-${task.id}`)
      );

      return {
        appointments: unseenAppointments,
        tasks: unseenTasks,
      };
    },
    refetchInterval: 30000, // Refetch a cada 30 segundos
    refetchOnWindowFocus: true,
  });

  // Mutation para marcar todas como vistas
  const markAllAsViewed = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !notifications) return;

      const viewsToInsert = [
        ...notifications.appointments.map((apt) => ({
          user_id: user.id,
          notification_type: "appointment",
          notification_id: apt.id,
        })),
        ...notifications.tasks.map((task) => ({
          user_id: user.id,
          notification_type: "task",
          notification_id: task.id,
        })),
      ];

      if (viewsToInsert.length > 0) {
        const { error } = await supabase.from("notification_views").insert(viewsToInsert);
        
        if (error && !error.message.includes("duplicate")) {
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.refetchQueries({ queryKey: ["notifications"] });
    },
  });

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen && notifications && (notifications.appointments.length > 0 || notifications.tasks.length > 0)) {
      // Marcar todas como vistas quando fechar o popover
      markAllAsViewed.mutate();
    }
  };

  const totalNotifications = notifications
    ? notifications.appointments.length + notifications.tasks.length
    : 0;

  const appointments = notifications?.appointments || [];
  const tasks = notifications?.tasks || [];

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
        >
          <Bell className="w-4 h-4" />
          {totalNotifications > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {totalNotifications}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">Notificações</h4>
          <div className="flex items-center gap-2">
            {totalNotifications > 0 && (
              <>
                <Badge variant="secondary">{totalNotifications}</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => markAllAsViewed.mutate()}
                  className="h-7 gap-1 text-xs"
                >
                  <Check className="w-3 h-3" />
                  Marcar todas
                </Button>
              </>
            )}
          </div>
        </div>
        
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Carregando...
            </div>
          ) : totalNotifications === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Nenhuma notificação nova
            </div>
          ) : (
            <div className="p-2">
              {appointments.length > 0 && (
                <div className="mb-2">
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Atendimentos de Hoje</span>
                  </div>
                  <div className="space-y-1">
                    {appointments.map((apt) => (
                      <div
                        key={apt.id}
                        className="flex items-start gap-3 p-2 rounded-md hover:bg-muted transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{apt.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(apt.start_time), "HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {appointments.length > 0 && tasks.length > 0 && (
                <Separator className="my-2" />
              )}

              {tasks.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <ListTodo className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Tarefas Pendentes</span>
                  </div>
                  <div className="space-y-1">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start gap-3 p-2 rounded-md hover:bg-muted transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{task.title}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(task.due_date), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                            {task.priority === "high" && (
                              <Badge variant="destructive" className="h-4 text-[10px] px-1">
                                Alta
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
