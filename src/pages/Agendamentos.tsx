import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckCircle, Pencil, Filter, Trash2, Check, ChevronsUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, addDays, addWeeks, addMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FinishAppointmentDialog } from "@/components/FinishAppointmentDialog";
import { EditAppointmentDialog } from "@/components/EditAppointmentDialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

type Customer = {
  id: string;
  name: string;
};

type Appointment = {
  id: string;
  title: string;
  description: string | null;
  customer_id: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  customers?: Customer;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  status: string;
  due_date: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
};

const Agendamentos = () => {
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [service, setService] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [notes, setNotes] = useState("");
  const [viewType, setViewType] = useState<"day" | "week" | "month">("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [finishDialogOpen, setFinishDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<{ id: string; title: string } | null>(null);
  const [editAppointmentId, setEditAppointmentId] = useState<string>("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteAppointmentId, setDeleteAppointmentId] = useState<string>("");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  
  // Filtros
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCustomer, setFilterCustomer] = useState<string>("all");
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  
  const queryClient = useQueryClient();

  // Buscar clientes
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name")
        .order("name");
      
      if (error) throw error;
      return data as Customer[];
    },
  });

  // Mutation para excluir agendamento
  const deleteAppointmentMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const { error } = await supabase
        .from("appointments")
        .delete()
        .eq("id", appointmentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Agendamento excluído com sucesso!");
      setDeleteDialogOpen(false);
      setDeleteAppointmentId("");
    },
    onError: (error) => {
      console.error("Erro ao excluir agendamento:", error);
      toast.error("Erro ao excluir agendamento");
    },
  });

  // Buscar agendamentos
  const { data: allAppointments = [], isLoading } = useQuery({
    queryKey: ["appointments", currentDate, viewType],
    queryFn: async () => {
      let startDate: Date;
      let endDate: Date;

      if (viewType === "day") {
        startDate = startOfDay(currentDate);
        endDate = endOfDay(currentDate);
      } else if (viewType === "week") {
        startDate = startOfWeek(currentDate, { weekStartsOn: 0 });
        endDate = endOfWeek(currentDate, { weekStartsOn: 0 });
      } else {
        startDate = startOfMonth(currentDate);
        endDate = endOfMonth(currentDate);
      }

      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          customers(id, name)
        `)
        .gte("start_time", startDate.toISOString())
        .lte("start_time", endDate.toISOString())
        .order("start_time");

      if (error) throw error;
      return data as Appointment[];
    },
  });

  // Buscar tarefas
  const { data: allTasks = [] } = useQuery({
    queryKey: ["tasks-calendar", currentDate, viewType],
    queryFn: async () => {
      let startDate: Date;
      let endDate: Date;

      if (viewType === "day") {
        startDate = startOfDay(currentDate);
        endDate = endOfDay(currentDate);
      } else if (viewType === "week") {
        startDate = startOfWeek(currentDate, { weekStartsOn: 0 });
        endDate = endOfWeek(currentDate, { weekStartsOn: 0 });
      } else {
        startDate = startOfMonth(currentDate);
        endDate = endOfMonth(currentDate);
      }

      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .gte("due_date", startDate.toISOString())
        .lte("due_date", endDate.toISOString())
        .in("status", ["pending", "in_progress"])
        .order("due_date");

      if (error) throw error;
      return data as Task[];
    },
  });

  // Aplicar filtros
  const appointments = allAppointments.filter(apt => {
    if (filterStatus !== "all" && apt.status !== filterStatus) return false;
    if (filterCustomer !== "all" && apt.customer_id !== filterCustomer) return false;
    if (filterPaymentStatus !== "all" && (apt as any).payment_status !== filterPaymentStatus) return false;
    return true;
  });

  // Mutation para criar agendamento
  const createAppointment = useMutation({
    mutationFn: async (appointmentData: {
      customer_id: string;
      title: string;
      description: string;
      start_time: string;
      end_time: string;
      notes: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("appointments")
        .insert({
          ...appointmentData,
          user_id: user.id,
          status: "scheduled",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Agendamento criado com sucesso!");
      setOpen(false);
      setCustomerId("");
      setService("");
      setDate("");
      setTime("");
      setDuration("60");
      setNotes("");
    },
    onError: (error) => {
      toast.error("Erro ao criar agendamento");
      console.error(error);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerId || !service || !date || !time) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    // Criar datetime combinando data e hora
    const startDateTime = new Date(`${date}T${time}`);
    const endDateTime = new Date(startDateTime.getTime() + parseInt(duration) * 60000);

    createAppointment.mutate({
      customer_id: customerId,
      title: service,
      description: service,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      notes: notes || "",
    });
  };

  const handlePrevious = () => {
    if (viewType === "day") {
      setCurrentDate(addDays(currentDate, -1));
    } else if (viewType === "week") {
      setCurrentDate(addWeeks(currentDate, -1));
    } else {
      setCurrentDate(addMonths(currentDate, -1));
    }
  };

  const handleNext = () => {
    if (viewType === "day") {
      setCurrentDate(addDays(currentDate, 1));
    } else if (viewType === "week") {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const getDateRangeText = () => {
    if (viewType === "day") {
      return format(currentDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } else if (viewType === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(start, "dd MMM", { locale: ptBR })} - ${format(end, "dd MMM yyyy", { locale: ptBR })}`;
    } else {
      return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
    }
  };

  const renderDayView = () => {
    const hours = Array.from({ length: 14 }, (_, i) => i + 8);
    const dayAppointments = appointments.filter(apt => {
      const aptDate = parseISO(apt.start_time);
      return isSameDay(aptDate, currentDate);
    });
    
    const dayTasks = allTasks.filter(task => {
      const taskDate = parseISO(task.due_date);
      return isSameDay(taskDate, currentDate);
    });
    
    return (
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted p-3 sm:p-4 border-b">
          <h3 className="font-semibold text-sm sm:text-base capitalize">{format(currentDate, "EEEE", { locale: ptBR })}</h3>
        </div>
        <div className="divide-y">
          {hours.map((hour) => {
            const hourAppointments = dayAppointments.filter(apt => {
              const aptHour = parseISO(apt.start_time).getHours();
              return aptHour === hour;
            });
            
            const hourTasks = dayTasks.filter(task => {
              const taskHour = parseISO(task.due_date).getHours();
              return taskHour === hour;
            });

            return (
              <div key={hour} className="flex items-start p-2 sm:p-4 hover:bg-muted/50 transition-colors min-h-[50px] sm:min-h-[60px]">
                <div className="w-12 sm:w-20 text-xs sm:text-sm text-muted-foreground font-medium pt-0.5">
                  {String(hour).padStart(2, "0")}:00
                </div>
                <div className="flex-1 min-w-0">
                  {hourAppointments.length > 0 || hourTasks.length > 0 ? (
                     <div className="space-y-2">
                         {hourAppointments.map((apt) => (
                         <div key={apt.id} className="bg-primary/10 border-l-4 border-primary p-2 sm:p-3 rounded-md group">
                           <div className="flex flex-col gap-2">
                             <div className="flex items-start justify-between gap-2">
                               <div className="flex-1 min-w-0">
                                 <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                                   <div className="font-semibold text-sm sm:text-base truncate">{apt.title}</div>
                                   <Badge 
                                     variant={apt.status === "completed" ? "default" : "secondary"}
                                     className={`text-xs w-fit ${apt.status === "completed" ? "bg-green-500 hover:bg-green-600" : ""}`}
                                   >
                                     {apt.status === "completed" ? "Concluído" : "Agendado"}
                                   </Badge>
                                 </div>
                                 <div className="text-xs text-muted-foreground">
                                   <span className="font-medium">{apt.customers?.name}</span>
                                   <span className="mx-1">•</span>
                                   <span>{format(parseISO(apt.start_time), "HH:mm")} - {format(parseISO(apt.end_time), "HH:mm")}</span>
                                 </div>
                               </div>
                             </div>
                             
                              <div className="flex gap-1.5 sm:gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 sm:h-9 gap-1 flex-1 sm:flex-none text-xs sm:text-sm"
                                  onClick={() => {
                                    setEditAppointmentId(apt.id);
                                    setEditDialogOpen(true);
                                  }}
                                >
                                  <Pencil className="w-3 h-3" />
                                  <span>Editar</span>
                                </Button>
                                {apt.status !== "completed" && (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="h-8 sm:h-9 gap-1 flex-1 sm:flex-none text-xs sm:text-sm"
                                    onClick={() => {
                                      setSelectedAppointment({ id: apt.id, title: apt.title });
                                      setFinishDialogOpen(true);
                                    }}
                                  >
                                    <CheckCircle className="w-3 h-3" />
                                    <span>Finalizar</span>
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 sm:h-9 gap-1 flex-1 sm:flex-none text-xs sm:text-sm text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    setDeleteAppointmentId(apt.id);
                                    setDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Excluir</span>
                                </Button>
                              </div>
                           </div>
                          </div>
                         ))}
                         
                         {hourTasks.map((task) => (
                          <div key={task.id} className="bg-orange-100 dark:bg-orange-950 border-l-4 border-orange-500 p-2 sm:p-3 rounded-md">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                  <div className="font-semibold text-sm sm:text-base truncate">{task.title}</div>
                                  <Badge variant="outline" className="text-xs w-fit">
                                    Tarefa
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                  {task.description || "Sem descrição"} • {format(parseISO(task.due_date), "HH:mm")}
                                </div>
                              </div>
                            </div>
                          </div>
                         ))}
                      </div>
                   ) : (
                     <div className="text-xs sm:text-sm text-muted-foreground/60 italic py-1">Disponível</div>
                   )}
                 </div>
               </div>
             );
           })}
         </div>
       </div>
     );
   };

  const renderWeekView = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    const end = endOfWeek(currentDate, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start, end });
    const hours = Array.from({ length: 14 }, (_, i) => i + 8);

    return (
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <div className="grid grid-cols-8 border-b bg-muted min-w-[600px] sm:min-w-[700px] lg:min-w-[800px]">
            <div className="p-2 sm:p-3"></div>
            {days.map((day) => (
              <div
                key={day.toISOString()}
                className={`p-2 sm:p-3 text-center border-l ${
                  isSameDay(day, new Date()) ? "bg-primary/10" : ""
                }`}
              >
                <div className="text-[10px] sm:text-xs text-muted-foreground capitalize">
                  {format(day, "EEE", { locale: ptBR })}
                </div>
                <div className={`text-base sm:text-lg font-semibold ${
                  isSameDay(day, new Date()) ? "text-primary" : ""
                }`}>
                  {format(day, "dd")}
                </div>
              </div>
            ))}
          </div>
          <div className="divide-y min-w-[600px] sm:min-w-[700px] lg:min-w-[800px]">
            {hours.map((hour) => (
              <div key={hour} className="grid grid-cols-8">
                <div className="p-2 sm:p-3 text-xs sm:text-sm text-muted-foreground border-r font-medium">
                  {String(hour).padStart(2, "0")}:00
                </div>
                {days.map((day) => {
                  const dayHourAppointments = appointments.filter(apt => {
                    const aptDate = parseISO(apt.start_time);
                    return isSameDay(aptDate, day) && aptDate.getHours() === hour;
                  });

                  return (
                       <div
                         key={`${day.toISOString()}-${hour}`}
                          className="p-1.5 sm:p-2 border-l hover:bg-muted/50 transition-colors min-h-[50px] sm:min-h-[60px]"
                        >
                          {dayHourAppointments.map((apt) => (
                            <div 
                              key={apt.id} 
                              className="bg-primary/10 border-l-2 border-primary p-1 sm:p-1.5 rounded mb-1 text-xs group cursor-pointer hover:bg-primary/20 transition-colors"
                              onClick={() => {
                                if (window.innerWidth < 640) {
                                  // Mobile: abrir dialog com opções
                                  setSelectedAppointment({ id: apt.id, title: apt.title });
                                  setEditAppointmentId(apt.id);
                                  setEditDialogOpen(true);
                                }
                              }}
                            >
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1">
                                  <div className="font-semibold truncate text-[11px] sm:text-xs leading-tight">
                                    {apt.title}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Badge 
                                    variant={apt.status === "completed" ? "default" : "secondary"} 
                                    className={`text-[9px] sm:text-[10px] px-1 py-0 h-3.5 ${apt.status === "completed" ? "bg-green-500 hover:bg-green-600" : ""}`}
                                  >
                                    {apt.status === "completed" ? "✓" : "○"}
                                  </Badge>
                                  <div className="text-muted-foreground truncate text-[10px] sm:text-xs flex-1">
                                    {apt.customers?.name}
                                  </div>
                                </div>
                                
                                {/* Botões apenas no desktop */}
                                <div className="hidden sm:flex gap-1 mt-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-5 w-5 p-0 opacity-70 hover:opacity-100 transition-opacity"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditAppointmentId(apt.id);
                                      setEditDialogOpen(true);
                                    }}
                                    title="Editar"
                                  >
                                    <Pencil className="w-2.5 h-2.5" />
                                  </Button>
                                  {apt.status !== "completed" && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-5 w-5 p-0 opacity-70 hover:opacity-100 transition-opacity"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedAppointment({ id: apt.id, title: apt.title });
                                        setFinishDialogOpen(true);
                                      }}
                                      title="Finalizar"
                                    >
                                      <CheckCircle className="w-2.5 h-2.5" />
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-5 w-5 p-0 opacity-70 hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteAppointmentId(apt.id);
                                      setDeleteDialogOpen(true);
                                    }}
                                    title="Excluir"
                                  >
                                    <Trash2 className="w-2.5 h-2.5" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                           ))}
                        </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start, end });
    
    const startDay = start.getDay();
    const previousDays = startDay === 0 ? 0 : startDay;
    const allDays = [
      ...Array.from({ length: previousDays }, (_, i) => addDays(start, -(previousDays - i))),
      ...days
    ];

    return (
      <div className="overflow-x-auto">
        <div className="border rounded-lg min-w-[280px]">
          <div className="grid grid-cols-7 border-b bg-muted">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
              <div key={day} className="p-2 text-center text-xs sm:text-sm font-semibold border-l first:border-l-0">
                {day}
              </div>
            ))}
          </div>
        <div className="grid grid-cols-7">
          {allDays.map((day, idx) => {
            const isCurrentMonth = day >= start && day <= end;
            const isToday = isSameDay(day, new Date());
            
            const dayAppointments = appointments.filter(apt => {
              const aptDate = parseISO(apt.start_time);
              return isSameDay(aptDate, day);
            });
            
            const hasAppointments = dayAppointments.length > 0;
            const completedCount = dayAppointments.filter(a => a.status === "completed").length;
            const pendingCount = dayAppointments.length - completedCount;
            
            return (
              <div
                key={idx}
                className={`min-h-[80px] sm:min-h-[100px] p-1.5 sm:p-2 border-b border-l first:border-l-0 hover:bg-muted/50 transition-colors ${
                  !isCurrentMonth ? "bg-muted/30 text-muted-foreground" : ""
                } ${hasAppointments ? "cursor-pointer" : ""}`}
                onClick={() => {
                  if (hasAppointments && window.innerWidth < 768) {
                    setCurrentDate(day);
                    setViewType("day");
                  }
                }}
              >
                <div
                  className={`text-xs sm:text-sm font-semibold mb-1 ${
                    isToday ? "bg-primary text-primary-foreground w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs" : ""
                  }`}
                >
                  {format(day, "d")}
                </div>
                
                {/* Mobile: Indicadores simples */}
                <div className="md:hidden">
                  {hasAppointments && (
                    <div className="flex flex-wrap gap-1">
                      {completedCount > 0 && (
                        <div className="flex items-center gap-0.5 text-[10px]">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span className="text-green-700 dark:text-green-400">{completedCount}</span>
                        </div>
                      )}
                      {pendingCount > 0 && (
                        <div className="flex items-center gap-0.5 text-[10px]">
                          <div className="w-2 h-2 rounded-full bg-primary"></div>
                          <span className="text-primary">{pendingCount}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Desktop: Lista detalhada */}
                <div className="hidden md:block space-y-1">
                  {dayAppointments.slice(0, 3).map((apt) => (
                    <div 
                      key={apt.id} 
                      className="bg-primary/10 border-l-2 border-primary p-1 rounded text-xs hover:bg-primary/20 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <div className="font-semibold truncate">{format(parseISO(apt.start_time), "HH:mm")}</div>
                            <Badge 
                              variant={apt.status === "completed" ? "default" : "secondary"} 
                              className={`text-[10px] px-1 py-0 ${apt.status === "completed" ? "bg-green-500 hover:bg-green-600" : ""}`}
                            >
                              {apt.status === "completed" ? "✓" : "○"}
                            </Badge>
                          </div>
                          <div className="truncate">{apt.title}</div>
                        </div>
                        <div className="flex gap-0.5 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 w-5 p-0 hover:bg-primary/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditAppointmentId(apt.id);
                              setEditDialogOpen(true);
                            }}
                            title="Editar"
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          {apt.status !== "completed" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 w-5 p-0 hover:bg-green-500/20"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAppointment({ id: apt.id, title: apt.title });
                                setFinishDialogOpen(true);
                              }}
                              title="Finalizar"
                            >
                              <CheckCircle className="w-3 h-3" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 w-5 p-0 hover:bg-destructive/20 text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteAppointmentId(apt.id);
                              setDeleteDialogOpen(true);
                            }}
                            title="Excluir"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {dayAppointments.length > 3 && (
                    <div className="text-xs text-muted-foreground pl-1">+{dayAppointments.length - 3} mais</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-1 sm:mb-2">Atendimentos</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Gerencie todos os seus atendimentos</p>
        </div>
        <div className="flex gap-2">
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2 h-10">
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">Filtros</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Filtros</Label>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        setFilterStatus("all");
                        setFilterCustomer("all");
                        setFilterPaymentStatus("all");
                      }}
                    >
                      Limpar
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status do Atendimento</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="scheduled">Agendado</SelectItem>
                      <SelectItem value="completed">Concluído</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status do Pagamento</Label>
                  <Select value={filterPaymentStatus} onValueChange={setFilterPaymentStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Cliente</Label>
                  <Select value={filterCustomer} onValueChange={setFilterCustomer}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {customers.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
            <Button className="gap-2 h-10">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Novo Agendamento</span>
              <span className="sm:hidden">Novo</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Novo Agendamento</DialogTitle>
              <DialogDescription>
                Crie um novo agendamento preenchendo os dados abaixo
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="customer">Cliente *</Label>
                <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={customerSearchOpen}
                      className="w-full justify-between h-11"
                    >
                      {customerId
                        ? customers.find((customer) => customer.id === customerId)?.name
                        : "🔍 Buscar cliente por nome..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command shouldFilter>
                      <CommandInput placeholder="Digite para buscar cliente..." className="h-11" />
                      <CommandList>
                        <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                        <CommandGroup>
                          {customers.map((customer) => (
                            <CommandItem
                              key={customer.id}
                              value={customer.name}
                              keywords={[customer.name.toLowerCase()]}
                              onSelect={() => {
                                setCustomerId(customer.id);
                                setCustomerSearchOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  customerId === customer.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {customer.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="service">Serviço *</Label>
                <Input
                  id="service"
                  placeholder="Tipo de serviço"
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Data *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="time">Horário *</Label>
                  <Input
                    id="time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duração (minutos) *</Label>
                <Input
                  id="duration"
                  type="number"
                  min="15"
                  max="480"
                  step="15"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="Ex: 60"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  placeholder="Observações adicionais..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createAppointment.isPending}>
                  {createAppointment.isPending ? "Criando..." : "Criar Agendamento"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <CardTitle className="text-xl sm:text-2xl">Calendário</CardTitle>
              <Tabs value={viewType} onValueChange={(v) => setViewType(v as "day" | "week" | "month")}>
                <TabsList className="h-9 grid grid-cols-3 w-full sm:w-auto">
                  <TabsTrigger value="day" className="text-xs sm:text-sm">Dia</TabsTrigger>
                  <TabsTrigger value="week" className="text-xs sm:text-sm">Semana</TabsTrigger>
                  <TabsTrigger value="month" className="text-xs sm:text-sm">Mês</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            
            <div className="flex items-center gap-2 justify-between sm:justify-start">
              <Button variant="outline" size="sm" onClick={handleToday} className="gap-1 sm:gap-2 h-9 px-2 sm:px-3">
                <CalendarIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm">Hoje</span>
              </Button>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" onClick={handlePrevious} className="h-9 w-9">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleNext} className="h-9 w-9">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-center pt-2">
            <h3 className="text-lg sm:text-xl md:text-2xl font-bold capitalize text-center">{getDateRangeText()}</h3>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Carregando atendimentos...</div>
            </div>
          ) : (
            <>
              {viewType === "day" && renderDayView()}
              {viewType === "week" && renderWeekView()}
              {viewType === "month" && renderMonthView()}
            </>
          )}
        </CardContent>
      </Card>

      {selectedAppointment && (
        <FinishAppointmentDialog
          open={finishDialogOpen}
          onOpenChange={setFinishDialogOpen}
          appointmentId={selectedAppointment.id}
          appointmentTitle={selectedAppointment.title}
        />
      )}
      
      {editAppointmentId && (
        <EditAppointmentDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          appointmentId={editAppointmentId}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O agendamento será permanentemente excluído do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAppointmentMutation.mutate(deleteAppointmentId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Agendamentos;
