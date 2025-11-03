import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { EditTaskDialog } from "@/components/EditTaskDialog";
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  AlertCircle,
  MessageSquare,
  CreditCard,
  UserX,
  Package,
  Calendar,
  Edit,
  Trash2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Task {
  id: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  due_date: string;
  related_entity_type: string;
  related_entity_id: string;
  completed_at?: string;
  updated_at: string;
  metadata?: {
    customer_id?: string;
    [key: string]: any;
  };
}

interface TaskWithCustomer extends Task {
  customer_name?: string;
}

interface TaskListProps {
  showAll?: boolean;
  showCompleted?: boolean;
  maxItems?: number;
  searchQuery?: string;
  selectedType?: string | null;
  selectedPriority?: string;
  selectedStatus?: string;
}

export const TaskList = ({ 
  showAll = false, 
  showCompleted = false, 
  maxItems = 10,
  searchQuery = "",
  selectedType = null,
  selectedPriority = "all",
  selectedStatus = "all"
}: TaskListProps) => {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<TaskWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, [showAll, showCompleted, searchQuery, selectedType, selectedPriority, selectedStatus]);

  const fetchTasks = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let query = supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id);

    // Filtrar por tipo/categoria
    if (selectedType) {
      query = query.eq("type", selectedType);
    }

    // Filtrar por prioridade
    if (selectedPriority && selectedPriority !== "all") {
      query = query.eq("priority", selectedPriority);
    }

    // Filtrar por status
    if (selectedStatus && selectedStatus !== "all") {
      // Filtro específico de status selecionado
      query = query.eq("status", selectedStatus);
      
      // Ordenar baseado no status
      if (selectedStatus === "completed" || selectedStatus === "cancelled") {
        query = query.order("completed_at", { ascending: false });
      } else {
        query = query.order("due_date", { ascending: true });
      }
    } else if (selectedStatus === "all") {
      // Quando "Todos os Status" está selecionado, mostrar realmente TODOS
      query = query.order("due_date", { ascending: false });
    } else {
      // Filtro padrão quando não há selectedStatus (caso do dashboard)
      if (showCompleted) {
        query = query.in("status", ["completed", "cancelled"]).order("completed_at", { ascending: false });
      } else {
        query = query.in("status", ["pending", "in_progress"]).order("due_date", { ascending: true });
        
        if (!showAll) {
          const today = new Date();
          today.setHours(23, 59, 59, 999);
          query = query.lte("due_date", today.toISOString());
        }
      }
    }

    // Filtrar por busca
    if (searchQuery && searchQuery.length >= 2) {
      query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
    }

    if (maxItems) {
      query = query.limit(maxItems);
    }

    const { data, error } = await query;

    if (error) {
      toast({
        title: "Erro ao carregar tarefas",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Buscar nomes dos clientes para tarefas que têm customer_id
    const tasksWithCustomers: TaskWithCustomer[] = (data || []).map(task => ({
      ...task,
      metadata: task.metadata as any,
    }));
    const customerIds = tasksWithCustomers
      .map(task => {
        const metadata = task.metadata as { customer_id?: string };
        return metadata?.customer_id;
      })
      .filter((id): id is string => !!id);

    if (customerIds.length > 0) {
      const { data: customers } = await supabase
        .from("customers")
        .select("id, name")
        .in("id", customerIds);

      if (customers) {
        const customerMap = new Map(customers.map(c => [c.id, c.name]));
        tasksWithCustomers.forEach(task => {
          const metadata = task.metadata as { customer_id?: string };
          if (metadata?.customer_id) {
            task.customer_name = customerMap.get(metadata.customer_id);
          }
        });
      }
    }

    setTasks(tasksWithCustomers);
    setLoading(false);
  };

  const handleCompleteTask = async (taskId: string) => {
    const { error } = await supabase
      .from("tasks")
      .update({ 
        status: "completed",
        completed_at: new Date().toISOString()
      })
      .eq("id", taskId);

    if (error) {
      toast({
        title: "Erro ao completar tarefa",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Tarefa concluída!",
      });
      fetchTasks();
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId);

    if (error) {
      toast({
        title: "Erro ao deletar tarefa",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Tarefa deletada!",
      });
      fetchTasks();
    }
  };

  const getTaskIcon = (type: string) => {
    const icons: Record<string, any> = {
      post_sale: MessageSquare,
      followup: Clock,
      payment: CreditCard,
      reactivation: UserX,
      restock: Package,
      preparation: Calendar,
    };
    const Icon = icons[type] || Circle;
    return <Icon className="h-4 w-4" />;
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      urgent: "destructive",
      high: "default",
      medium: "secondary",
      low: "outline",
    };
    return colors[priority] || "secondary";
  };

  const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
      urgent: "Urgente",
      high: "Alta",
      medium: "Média",
      low: "Baixa",
    };
    return labels[priority] || priority;
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      manual: "Manual",
      post_sale: "Pós-venda",
      followup: "Follow-up",
      payment: "Pagamento",
      reactivation: "Reativação",
      restock: "Reposição",
      preparation: "Preparação",
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      manual: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800",
      post_sale: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800",
      followup: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 border-green-200 dark:border-green-800",
      payment: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
      reactivation: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 border-orange-200 dark:border-orange-800",
      restock: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300 border-pink-200 dark:border-pink-800",
      preparation: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800",
    };
    return colors[type] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700";
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  if (loading) {
    return <div className="text-muted-foreground">Carregando tarefas...</div>;
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10">
          <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {showCompleted 
              ? "Nenhuma tarefa no histórico" 
              : showAll 
                ? "Nenhuma tarefa pendente" 
                : "Nenhuma tarefa para hoje"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <EditTaskDialog
        task={editingTask}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onTaskUpdated={fetchTasks}
      />
      
      <div className="space-y-3">
        {tasks.map((task) => (
        <Card 
          key={task.id} 
          className={`${
            !showCompleted && isOverdue(task.due_date) 
              ? "border-2 border-destructive bg-destructive/5" 
              : ""
          } transition-all hover:shadow-md`}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {!showCompleted && (
                <Checkbox
                  checked={task.status === "completed"}
                  onCheckedChange={() => handleCompleteTask(task.id)}
                  className="mt-1"
                />
              )}
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h4 className="font-medium">{task.title}</h4>
                    {task.customer_name && (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Cliente: {task.customer_name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!showCompleted && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditingTask(task);
                            setEditDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteTask(task.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {task.description && (
                  <p className="text-sm text-muted-foreground">{task.description}</p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge 
                    variant="outline" 
                    className={`${getTypeColor(task.type)} border text-xs px-2 py-0.5`}
                  >
                    {getTypeLabel(task.type)}
                  </Badge>
                  <Badge 
                    variant={getPriorityColor(task.priority) as any}
                    className="text-xs px-2 py-0.5"
                  >
                    {getPriorityLabel(task.priority)}
                  </Badge>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    {showCompleted ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        {format(new Date(task.completed_at || task.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </>
                    ) : isOverdue(task.due_date) ? (
                      <>
                        <AlertCircle className="h-3 w-3 text-destructive" />
                        <span className="text-destructive font-medium">Atrasada</span>
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3" />
                        {format(new Date(task.due_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        ))}
      </div>
    </>
  );
};
