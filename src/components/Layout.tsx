import React from "react";
import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Settings, User as UserIcon, Bell, Calendar, ListTodo, Check, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SearchBar } from "@/components/SearchBar";
import { SubscriptionButton } from "@/components/SubscriptionButton";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import logo from "@/assets/logo.png";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    };
    
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Buscar foto de perfil
  const { data: profileImage } = useQuery({
    queryKey: ["profile-image", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("business_settings")
        .select("profile_image_url")
        .eq("user_id", user.id)
        .maybeSingle();
      return data?.profile_image_url;
    },
    enabled: !!user,
  });

  // Buscar notificações não vistas
  const { data: notifications } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

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
    enabled: !!user,
    refetchInterval: 60000, // Recarregar a cada minuto
  });

  // Mutation para marcar todas como vistas
  const markAllAsViewed = useMutation({
    mutationFn: async () => {
      if (!user || !notifications) return;

      const viewsToInsert = [
        ...notifications.appointments.map((apt: any) => ({
          user_id: user.id,
          notification_type: "appointment",
          notification_id: apt.id,
        })),
        ...notifications.tasks.map((task: any) => ({
          user_id: user.id,
          notification_type: "task",
          notification_id: task.id,
        })),
      ];

      if (viewsToInsert.length > 0) {
        await supabase.from("notification_views").upsert(viewsToInsert, {
          onConflict: "user_id,notification_type,notification_id",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const totalNotifications = notifications
    ? notifications.appointments.length + notifications.tasks.length
    : 0;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado com sucesso!");
    navigate("/auth");
  };

  if (!user) return null;

  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="sticky top-0 z-40 w-full border-b bg-background">
            <div className="flex h-14 sm:h-16 items-center gap-2 sm:gap-4 px-3 sm:px-6">
              <SidebarTrigger className="-ml-1 sm:-ml-2" />
              
              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                <img src={logo} alt="Foguete Gestão Empresarial" className="h-8 sm:h-10 w-auto" />
              </div>

              <div className="hidden md:flex flex-1 max-w-md mx-4">
                <SearchBar />
              </div>

              <div className="flex items-center gap-1 sm:gap-2 ml-auto">
                <SubscriptionButton />
                <ThemeToggle />
                
                <DropdownMenu open={notificationsOpen} onOpenChange={setNotificationsOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                      <Avatar className="h-9 w-9 border-2 border-primary/20">
                        <AvatarImage src={profileImage || undefined} alt="Perfil" />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70">
                          <UserIcon className="h-4 w-4 text-primary-foreground" />
                        </AvatarFallback>
                      </Avatar>
                      {totalNotifications > 0 && (
                        <Badge
                          variant="destructive"
                          className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs animate-pulse"
                        >
                          {totalNotifications}
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-80" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">Minha Conta</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user?.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    
                    {totalNotifications > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <div className="px-2 py-2">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Bell className="h-4 w-4 text-primary" />
                              <span className="text-sm font-medium">Notificações</span>
                              <Badge variant="secondary" className="h-5">
                                {totalNotifications}
                              </Badge>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => markAllAsViewed.mutate()}
                              className="h-6 gap-1 text-xs"
                            >
                              <Check className="w-3 h-3" />
                              Limpar
                            </Button>
                          </div>
                          
                          <ScrollArea className="h-[250px]">
                            <div className="space-y-2">
                              {notifications?.appointments && notifications.appointments.length > 0 && (
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <Calendar className="w-3 h-3 text-primary" />
                                    <span className="text-xs font-medium">Hoje</span>
                                  </div>
                                  {notifications.appointments.map((apt: any) => (
                                    <div
                                      key={apt.id}
                                      className="p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                                    >
                                      <p className="text-sm font-medium truncate">{apt.title}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {format(new Date(apt.start_time), "HH:mm", { locale: ptBR })}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {notifications?.appointments && notifications.appointments.length > 0 && 
                               notifications?.tasks && notifications.tasks.length > 0 && (
                                <Separator />
                              )}
                              
                              {notifications?.tasks && notifications.tasks.length > 0 && (
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <ListTodo className="w-3 h-3 text-primary" />
                                    <span className="text-xs font-medium">Tarefas</span>
                                  </div>
                                  {notifications.tasks.map((task: any) => (
                                    <div
                                      key={task.id}
                                      className="p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                                    >
                                      <p className="text-sm font-medium truncate">{task.title}</p>
                                      <div className="flex items-center gap-2">
                                        <p className="text-xs text-muted-foreground">
                                          {format(new Date(task.due_date), "dd/MM", { locale: ptBR })}
                                        </p>
                                        {task.priority === "high" && (
                                          <Badge variant="destructive" className="h-4 text-[10px] px-1">
                                            Alta
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </ScrollArea>
                        </div>
                      </>
                    )}
                    
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => { setNotificationsOpen(false); navigate("/configuracoes"); }}>
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Configurações</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Sair</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto pb-16">
            <div className="p-3 sm:p-4 md:p-6">
              {children}
            </div>
          </main>

          {/* Footer */}
          <footer className="sticky bottom-0 z-40 w-full border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center justify-center px-4">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-primary/20 hover:border-primary hover:bg-primary/5 transition-all"
                onClick={() => window.open("https://wa.me/5500000000000?text=Olá,%20preciso%20de%20suporte%20com%20o%20sistema%20Foguete%20Gestão", "_blank")}
              >
                <MessageCircle className="h-4 w-4 text-primary" />
                <span className="text-sm">Suporte via WhatsApp</span>
              </Button>
            </div>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Layout;
