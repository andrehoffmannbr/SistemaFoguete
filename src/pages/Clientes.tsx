import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Phone, Mail, User, CalendarPlus, ListTodo, Search, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LoyaltyCard } from "@/components/LoyaltyCard";
import { CustomerCoupons } from "@/components/CustomerCoupons";
import { CustomerHistory } from "@/components/CustomerHistory";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  cpf: string | null;
  notes: string | null;
  created_at: string;
}

const Clientes = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    cpf: "",
    notes: "",
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    due_date: "",
    priority: "medium" as "low" | "medium" | "high",
    status: "pending" as "pending" | "completed" | "cancelled",
  });
  const [appointmentForm, setAppointmentForm] = useState({
    service: "",
    date: "",
    time: "",
    duration: "60",
    notes: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    // Aplicar filtros de busca
    if (!searchTerm) {
      setFilteredCustomers(customers);
      return;
    }

    const filtered = customers.filter(customer => {
      const searchLower = searchTerm.toLowerCase();
      const cpfClean = searchTerm.replace(/\D/g, ''); // Remove pontuação para busca
      
      return (
        customer.name.toLowerCase().includes(searchLower) ||
        customer.phone.includes(searchTerm) ||
        (customer.email?.toLowerCase() || "").includes(searchLower) ||
        (customer.cpf?.replace(/\D/g, '') || "").includes(cpfClean)
      );
    });

    setFilteredCustomers(filtered);
  }, [customers, searchTerm]);

  const fetchCustomers = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setCustomers(data);
    }
    setLoading(false);
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.name || !newCustomer.phone) {
      toast({
        title: "Campos obrigatórios",
        description: "Nome e telefone são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    // Validar formato do CPF se fornecido
    if (newCustomer.cpf && newCustomer.cpf.trim()) {
      const cpfClean = newCustomer.cpf.replace(/\D/g, '');
      if (cpfClean.length !== 11) {
        toast({
          title: "CPF inválido",
          description: "O CPF deve ter 11 dígitos.",
          variant: "destructive",
        });
        return;
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("customers").insert({
      user_id: user.id,
      name: newCustomer.name,
      phone: newCustomer.phone,
      email: newCustomer.email || null,
      cpf: newCustomer.cpf || null,
      notes: newCustomer.notes || null,
    });

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o cliente.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Cliente adicionado!",
        description: "O cliente foi cadastrado com sucesso.",
      });
      setDialogOpen(false);
      setNewCustomer({ name: "", phone: "", email: "", cpf: "", notes: "" });
      fetchCustomers();
    }
  };

  const handleAddTask = async () => {
    if (!selectedCustomer || !taskForm.title || !taskForm.due_date) {
      toast({
        title: "Campos obrigatórios",
        description: "Título e data de vencimento são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("tasks").insert({
      user_id: user.id,
      customer_id: selectedCustomer.id,
      title: taskForm.title,
      description: taskForm.description || null,
      type: "manual",
      due_date: taskForm.due_date,
      priority: taskForm.priority,
      status: taskForm.status,
    });

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível criar a tarefa.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Tarefa criada!",
        description: "A tarefa foi adicionada com sucesso.",
      });
      setTaskDialogOpen(false);
      setTaskForm({
        title: "",
        description: "",
        due_date: "",
        priority: "medium",
        status: "pending",
      });
    }
  };

  const handleAddAppointment = async () => {
    if (!selectedCustomer || !appointmentForm.service || !appointmentForm.date || !appointmentForm.time) {
      toast({
        title: "Campos obrigatórios",
        description: "Serviço, data e horário são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const startDateTime = new Date(`${appointmentForm.date}T${appointmentForm.time}`);
    const endDateTime = new Date(startDateTime.getTime() + parseInt(appointmentForm.duration) * 60000);

    const { error } = await supabase.from("appointments").insert({
      customer_id: selectedCustomer.id,
      user_id: user.id,
      title: appointmentForm.service,
      description: appointmentForm.notes || "",
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      notes: appointmentForm.notes || "",
      status: "scheduled",
    });

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível criar o agendamento.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Agendamento criado!",
        description: "O agendamento foi adicionado com sucesso.",
      });
      setAppointmentDialogOpen(false);
      setAppointmentForm({
        service: "",
        date: "",
        time: "",
        duration: "60",
        notes: "",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-1 sm:mb-2">Clientes</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Gerencie sua base de clientes, fidelidade e cupons</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 w-full sm:w-auto flex-shrink-0">
              <Plus className="w-4 h-4" />
              <span>Novo Cliente</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Novo Cliente</DialogTitle>
              <DialogDescription>
                Cadastre um novo cliente na sua base
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <Label htmlFor="phone">Telefone *</Label>
                <Input
                  id="phone"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  value={newCustomer.cpf}
                  onChange={(e) => {
                    // Formatar CPF automaticamente enquanto digita
                    let value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 11) {
                      value = value.replace(/(\d{3})(\d)/, '$1.$2');
                      value = value.replace(/(\d{3})(\d)/, '$1.$2');
                      value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
                      setNewCustomer({ ...newCustomer, cpf: value });
                    }
                  }}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
              </div>
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={newCustomer.notes}
                  onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })}
                  placeholder="Notas sobre o cliente..."
                  rows={3}
                />
              </div>
              <Button onClick={handleAddCustomer} className="w-full">
                Adicionar Cliente
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Barra de pesquisa */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por título ou cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-10 sm:h-11 text-sm sm:text-base"
        />
      </div>

      {/* Filtro adicional - Select de todos os clientes */}
      <Select value="all">
        <SelectTrigger className="w-full h-10 sm:h-11 text-sm sm:text-base">
          <SelectValue placeholder="Todos os Clientes" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os Clientes</SelectItem>
        </SelectContent>
      </Select>

      {loading ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Carregando clientes...</p>
          </CardContent>
        </Card>
      ) : filteredCustomers.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Lista de Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p>{searchTerm ? "Nenhum cliente encontrado com esse termo." : "Nenhum cliente cadastrado. Adicione seu primeiro cliente!"}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCustomers.map((customer) => (
            <Card 
              key={customer.id} 
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => {
                setSelectedCustomer(customer);
                setDetailsOpen(true);
              }}
            >
              <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-3">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
                  <span className="truncate">{customer.name}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 sm:space-y-2 p-3 sm:p-4 pt-0">
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                  <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="truncate">{customer.phone}</span>
                </div>
                {customer.email && (
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                    <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="truncate">{customer.email}</span>
                  </div>
                )}
                {customer.notes && (
                  <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mt-2 sm:mt-3">
                    {customer.notes}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de detalhes do cliente */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          {selectedCustomer && (
            <>
              <DialogHeader className="space-y-2">
                <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <User className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0" />
                  <span className="truncate">{selectedCustomer.name}</span>
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  Informações completas do cliente
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="info" className="mt-3 sm:mt-4">
                <TabsList className="grid w-full grid-cols-4 h-auto">
                  <TabsTrigger value="info" className="text-xs sm:text-sm py-2">Informações</TabsTrigger>
                  <TabsTrigger value="history" className="text-xs sm:text-sm py-2">Histórico</TabsTrigger>
                  <TabsTrigger value="loyalty" className="text-xs sm:text-sm py-2">Fidelidade</TabsTrigger>
                  <TabsTrigger value="coupons" className="text-xs sm:text-sm py-2">Cupons</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-3 sm:space-y-4">
                  {/* Botões de ação rápida */}
                  <div className="flex flex-col sm:flex-row gap-2">
                <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="flex-1 gap-2 h-9 sm:h-10 text-xs sm:text-sm">
                      <ListTodo className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      Nova Tarefa
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nova Tarefa para {selectedCustomer.name}</DialogTitle>
                      <DialogDescription>
                        Crie uma tarefa relacionada a este cliente
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="task-title">Título *</Label>
                        <Input
                          id="task-title"
                          value={taskForm.title}
                          onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                          placeholder="Ex: Ligar para confirmar agendamento"
                        />
                      </div>
                      <div>
                        <Label htmlFor="task-description">Descrição</Label>
                        <Textarea
                          id="task-description"
                          value={taskForm.description}
                          onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                          placeholder="Detalhes da tarefa..."
                          rows={3}
                        />
                      </div>
                      <div>
                        <Label htmlFor="task-due-date">Data de Vencimento *</Label>
                        <Input
                          id="task-due-date"
                          type="date"
                          value={taskForm.due_date}
                          onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="task-priority">Prioridade</Label>
                        <Select value={taskForm.priority} onValueChange={(value: any) => setTaskForm({ ...taskForm, priority: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Baixa</SelectItem>
                            <SelectItem value="medium">Média</SelectItem>
                            <SelectItem value="high">Alta</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="task-status">Status</Label>
                        <Select value={taskForm.status} onValueChange={(value: any) => setTaskForm({ ...taskForm, status: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pendente</SelectItem>
                            <SelectItem value="completed">Concluída</SelectItem>
                            <SelectItem value="cancelled">Cancelada</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleAddTask} className="w-full">
                        Criar Tarefa
                      </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={appointmentDialogOpen} onOpenChange={setAppointmentDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="flex-1 gap-2 h-9 sm:h-10 text-xs sm:text-sm">
                        <CalendarPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        Novo Agendamento
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Novo Agendamento para {selectedCustomer.name}</DialogTitle>
                        <DialogDescription>
                          Crie um agendamento relacionado a este cliente
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="appointment-service">Serviço *</Label>
                          <Input
                            id="appointment-service"
                            value={appointmentForm.service}
                            onChange={(e) => setAppointmentForm({ ...appointmentForm, service: e.target.value })}
                            placeholder="Ex: Corte de cabelo"
                          />
                        </div>
                        <div>
                          <Label htmlFor="appointment-date">Data *</Label>
                          <Input
                            id="appointment-date"
                            type="date"
                            value={appointmentForm.date}
                            onChange={(e) => setAppointmentForm({ ...appointmentForm, date: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="appointment-time">Horário *</Label>
                          <Input
                            id="appointment-time"
                            type="time"
                            value={appointmentForm.time}
                            onChange={(e) => setAppointmentForm({ ...appointmentForm, time: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="appointment-duration">Duração</Label>
                          <Select value={appointmentForm.duration} onValueChange={(value) => setAppointmentForm({ ...appointmentForm, duration: value })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="30">30 minutos</SelectItem>
                              <SelectItem value="60">1 hora</SelectItem>
                              <SelectItem value="90">1h 30min</SelectItem>
                              <SelectItem value="120">2 horas</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="appointment-notes">Observações</Label>
                          <Textarea
                            id="appointment-notes"
                            value={appointmentForm.notes}
                            onChange={(e) => setAppointmentForm({ ...appointmentForm, notes: e.target.value })}
                            placeholder="Detalhes do agendamento..."
                            rows={3}
                          />
                        </div>
                        <Button onClick={handleAddAppointment} className="w-full">
                          Criar Agendamento
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                
                <div className="space-y-3 sm:space-y-4">
                  {/* Informações básicas */}
                  <Card>
                    <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-3">
                      <CardTitle className="text-sm sm:text-base">Informações de Contato</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 p-3 sm:p-4 pt-0">
                      <div className="flex items-center gap-2 text-xs sm:text-sm">
                        <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                        <span className="break-all">{selectedCustomer.phone}</span>
                      </div>
                      {selectedCustomer.email && (
                        <div className="flex items-center gap-2 text-xs sm:text-sm">
                          <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                          <span className="break-all">{selectedCustomer.email}</span>
                        </div>
                      )}
                      {selectedCustomer.notes && (
                        <div className="pt-2 border-t">
                          <p className="text-xs sm:text-sm text-muted-foreground">{selectedCustomer.notes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
                </TabsContent>

                <TabsContent value="history">
                  <CustomerHistory customerId={selectedCustomer.id} />
                </TabsContent>

                <TabsContent value="loyalty">
                  <LoyaltyCard customerId={selectedCustomer.id} />
                </TabsContent>

                <TabsContent value="coupons">
                  <CustomerCoupons customerId={selectedCustomer.id} />
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Clientes;