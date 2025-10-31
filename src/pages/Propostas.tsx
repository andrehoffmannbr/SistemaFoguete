import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, FileText, Send, Eye, Check, X, Clock, Loader2, Edit, Trash2, Filter, CheckCircle, XCircle, Calendar as CalendarIcon, User, DollarSign, Sparkles, Search, ChevronsUpDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { ProposalViewDialog } from "@/components/ProposalViewDialog";
import { ProposalEditDialog } from "@/components/ProposalEditDialog";
import { ProposalConfirmDialog } from "@/components/ProposalConfirmDialog";
import { ScheduleAppointmentDialog } from "@/components/ScheduleAppointmentDialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface Proposal {
  id: string;
  customer_id: string;
  customers: {
    name: string;
    phone: string;
  };
  title: string;
  description: string | null;
  final_amount: number;
  deposit_amount: number | null;
  status: string;
  valid_until: string;
  sent_at: string | null;
  accepted_at: string | null;
  created_at: string;
  appointment_id: string | null;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface Service {
  description: string;
  quantity: number;
  unit_price: number;
}

const Propostas = () => {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [viewProposal, setViewProposal] = useState<Proposal | null>(null);
  const [editProposal, setEditProposal] = useState<Proposal | null>(null);
  const [confirmProposal, setConfirmProposal] = useState<Proposal | null>(null);
  const [scheduleProposal, setScheduleProposal] = useState<Proposal | null>(null);
  const [deleteProposalId, setDeleteProposalId] = useState<string | null>(null);
  const [lastEmailSent, setLastEmailSent] = useState<{ [key: string]: number }>({});
  const { toast } = useToast();

  // Filtros e tabs
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCustomer, setFilterCustomer] = useState<string>("all");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);

  const [newProposal, setNewProposal] = useState({
    customer_id: "",
    title: "",
    description: "",
    services: [{ description: "", quantity: 1, unit_price: 0 }] as Service[],
    discount_percentage: 0,
    deposit_percentage: 50,
    valid_days: 7,
  });

  // Aplicar filtros usando useMemo para melhor performance e resposta imediata
  const filteredProposals = useMemo(() => {
    let filtered = [...proposals];

    // Filtro por tab (status)
    if (activeTab !== "all") {
      filtered = filtered.filter(p => p.status === activeTab);
    }

    // Filtro por cliente
    if (filterCustomer !== "all") {
      filtered = filtered.filter(p => p.customer_id === filterCustomer);
    }

    // Filtro por busca (título ou nome do cliente)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(term) || 
        p.customers.name.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [proposals, activeTab, filterCustomer, searchTerm]);

  // Estatísticas por status - calculado a partir das propostas filtradas e não filtradas
  const stats = useMemo(() => ({
    all: proposals.length,
    pending: proposals.filter(p => p.status === "pending").length,
    sent: proposals.filter(p => p.status === "sent").length,
    accepted: proposals.filter(p => p.status === "accepted").length,
    confirmed: proposals.filter(p => p.status === "confirmed").length,
    canceled: proposals.filter(p => p.status === "canceled").length,
    expired: proposals.filter(p => p.status === "expired").length,
  }), [proposals]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [proposalsRes, customersRes] = await Promise.all([
      supabase
        .from("proposals")
        .select(`
          *,
          customers (name, phone)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("customers")
        .select("*")
        .eq("user_id", user.id)
        .order("name"),
    ]);

    if (!proposalsRes.error && proposalsRes.data) {
      setProposals(proposalsRes.data as any);
    }
    if (!customersRes.error && customersRes.data) {
      setCustomers(customersRes.data);
    }
    setLoading(false);
  };

  const calculateTotal = () => {
    const subtotal = newProposal.services.reduce(
      (sum, s) => sum + s.quantity * s.unit_price,
      0
    );
    const discount = (subtotal * newProposal.discount_percentage) / 100;
    return subtotal - discount;
  };

  const handleCreateProposal = async () => {
    if (!newProposal.customer_id || !newProposal.title || newProposal.services.length === 0) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos necessários.",
        variant: "destructive",
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const totalAmount = calculateTotal();
    const depositAmount = (totalAmount * newProposal.deposit_percentage) / 100;
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + newProposal.valid_days);

    const { error } = await supabase.from("proposals").insert([{
      user_id: user.id,
      customer_id: newProposal.customer_id,
      title: newProposal.title,
      description: newProposal.description || null,
      services: newProposal.services as any,
      total_amount: totalAmount,
      discount_percentage: newProposal.discount_percentage,
      final_amount: totalAmount,
      deposit_percentage: newProposal.deposit_percentage,
      deposit_amount: depositAmount,
      valid_until: validUntil.toISOString(),
      status: "pending",
    }]);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível criar o orçamento.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Orçamento criado!",
        description: "O orçamento foi criado com sucesso.",
      });
      setDialogOpen(false);
      setNewProposal({
        customer_id: "",
        title: "",
        description: "",
        services: [{ description: "", quantity: 1, unit_price: 0 }],
        discount_percentage: 0,
        deposit_percentage: 50,
        valid_days: 7,
      });
      fetchData();
    }
  };

  const handleSendProposal = async (proposalId: string) => {
    const now = Date.now();
    const lastSent = lastEmailSent[proposalId] || 0;
    const tenMinutesInMs = 10 * 60 * 1000;
    
    if (now - lastSent < tenMinutesInMs) {
      const remainingMinutes = Math.ceil((tenMinutesInMs - (now - lastSent)) / 60000);
      toast({
        title: "Aguarde",
        description: `Você pode enviar novamente em ${remainingMinutes} minuto(s).`,
        variant: "destructive",
      });
      return;
    }

    setSending(proposalId);
    try {
      const { error } = await supabase.functions.invoke("send-proposal", {
        body: { proposalId },
      });

      if (error) throw error;

      setLastEmailSent({ ...lastEmailSent, [proposalId]: now });
      toast({
        title: "Orçamento enviado!",
        description: "O orçamento foi enviado para o cliente.",
      });
      fetchData();
    } catch (error) {
      console.error("Erro ao enviar orçamento:", error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar o orçamento.",
        variant: "destructive",
      });
    } finally {
      setSending(null);
    }
  };

  const handleCancelProposal = async (proposalId: string) => {
    try {
      const { error } = await supabase
        .from("proposals")
        .update({ status: "canceled" })
        .eq("id", proposalId);

      if (error) throw error;
      
      toast({
        title: "Orçamento cancelado!",
        description: "O status foi atualizado com sucesso.",
      });
      await fetchData();
    } catch (error) {
      console.error("Erro ao cancelar orçamento:", error);
      toast({
        title: "Erro",
        description: "Não foi possível cancelar o orçamento.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteProposal = async () => {
    if (!deleteProposalId) return;

    const { error } = await supabase
      .from("proposals")
      .delete()
      .eq("id", deleteProposalId);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o orçamento.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Orçamento excluído!",
      });
      fetchData();
    }
    setDeleteProposalId(null);
  };

  const addService = () => {
    setNewProposal({
      ...newProposal,
      services: [...newProposal.services, { description: "", quantity: 1, unit_price: 0 }],
    });
  };

  const updateService = (index: number, field: keyof Service, value: any) => {
    const updated = [...newProposal.services];
    updated[index] = { ...updated[index], [field]: value };
    setNewProposal({ ...newProposal, services: updated });
  };

  const removeService = (index: number) => {
    if (newProposal.services.length > 1) {
      setNewProposal({
        ...newProposal,
        services: newProposal.services.filter((_, i) => i !== index),
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Pendente", variant: "secondary" },
      sent: { label: "Enviada", variant: "default" },
      viewed: { label: "Visualizada", variant: "outline" },
      accepted: { label: "Aceita", variant: "default" },
      rejected: { label: "Recusada", variant: "destructive" },
      expired: { label: "Expirada", variant: "destructive" },
      confirmed: { label: "Confirmada", variant: "default" },
      canceled: { label: "Cancelada", variant: "destructive" },
      paused: { label: "Pausada", variant: "outline" },
    };
    const config = statusMap[status] || statusMap.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Premium */}
      <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10" />
        <div className="relative p-4 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-2 flex-1 w-full">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 shadow-lg sm:shadow-xl flex-shrink-0">
                <FileText className="w-5 h-5 sm:w-8 sm:h-8 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl sm:text-3xl md:text-5xl font-extrabold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent leading-tight">
                  Orçamentos
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 truncate">Crie e gerencie orçamentos profissionais</p>
              </div>
            </div>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gradient-to-r from-primary to-accent hover:shadow-xl hover:scale-105 transition-all w-full sm:w-auto flex-shrink-0 text-sm sm:text-base">
                <Plus className="w-4 h-4" />
                <span className="sm:inline">Novo Orçamento</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Criar Novo Orçamento</DialogTitle>
                <DialogDescription>
                  Preencha os detalhes do orçamento para o cliente
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Cliente *</Label>
                  <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={customerSearchOpen}
                        className="w-full justify-between"
                      >
                        {newProposal.customer_id
                          ? customers.find((customer) => customer.id === newProposal.customer_id)?.name
                          : "Selecione um cliente..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar cliente..." />
                        <CommandList>
                          <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                          <CommandGroup>
                            {customers.map((customer) => (
                              <CommandItem
                                key={customer.id}
                                value={customer.name}
                                onSelect={() => {
                                  setNewProposal({ ...newProposal, customer_id: customer.id });
                                  setCustomerSearchOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    newProposal.customer_id === customer.id ? "opacity-100" : "opacity-0"
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

                <div>
                  <Label>Título do Orçamento *</Label>
                  <Input
                    value={newProposal.title}
                    onChange={(e) => setNewProposal({ ...newProposal, title: e.target.value })}
                    placeholder="Ex: Reforma de Banheiro"
                  />
                </div>

                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    value={newProposal.description}
                    onChange={(e) => setNewProposal({ ...newProposal, description: e.target.value })}
                    placeholder="Detalhes adicionais do orçamento..."
                    rows={3}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Serviços *</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addService}>
                      <Plus className="w-4 h-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {newProposal.services.map((service, idx) => (
                      <div key={idx} className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Input
                            placeholder="Descrição do serviço"
                            value={service.description}
                            onChange={(e) => updateService(idx, "description", e.target.value)}
                          />
                        </div>
                        <div className="w-24">
                          <Input
                            type="number"
                            placeholder="Qtd"
                            min="1"
                            value={service.quantity}
                            onChange={(e) => updateService(idx, "quantity", parseInt(e.target.value) || 1)}
                          />
                        </div>
                        <div className="w-32">
                          <Input
                            type="number"
                            placeholder="Preço unit."
                            min="0"
                            step="0.01"
                            value={service.unit_price}
                            onChange={(e) => updateService(idx, "unit_price", parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        {newProposal.services.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeService(idx)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Desconto (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={newProposal.discount_percentage}
                      onChange={(e) => setNewProposal({ ...newProposal, discount_percentage: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label>Sinal (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={newProposal.deposit_percentage}
                      onChange={(e) => setNewProposal({ ...newProposal, deposit_percentage: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label>Validade (dias)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={newProposal.valid_days}
                      onChange={(e) => setNewProposal({ ...newProposal, valid_days: parseInt(e.target.value) || 7 })}
                    />
                  </div>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Valor Total:</span>
                    <span className="text-primary">{formatCurrency(calculateTotal())}</span>
                  </div>
                  {newProposal.deposit_percentage > 0 && (
                    <div className="flex justify-between text-sm text-muted-foreground mt-1">
                      <span>Sinal ({newProposal.deposit_percentage}%):</span>
                      <span>{formatCurrency((calculateTotal() * newProposal.deposit_percentage) / 100)}</span>
                    </div>
                  )}
                </div>

                <Button onClick={handleCreateProposal} className="w-full">
                  Criar Orçamento
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Barra de Filtros */}
      <Card className="border-0 shadow-lg">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título ou cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterCustomer} onValueChange={setFilterCustomer}>
              <SelectTrigger className="w-full md:w-[250px]">
                <SelectValue placeholder="Todos os Clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Clientes</SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs por Status */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 sm:grid-cols-7 h-auto p-1 gap-1 overflow-x-auto">
          <TabsTrigger value="all" className="flex flex-col gap-1 py-2 sm:py-3 text-xs sm:text-sm">
            <span className="font-semibold">Todos</span>
            <Badge variant="outline" className="text-[10px] sm:text-xs">{stats.all}</Badge>
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex flex-col gap-1 py-2 sm:py-3 text-xs sm:text-sm">
            <span className="font-semibold">Pendente</span>
            <Badge variant="outline" className="text-[10px] sm:text-xs">{stats.pending}</Badge>
          </TabsTrigger>
          <TabsTrigger value="sent" className="flex flex-col gap-1 py-2 sm:py-3 text-xs sm:text-sm">
            <span className="font-semibold">Enviada</span>
            <Badge variant="outline" className="text-[10px] sm:text-xs">{stats.sent}</Badge>
          </TabsTrigger>
          <TabsTrigger value="accepted" className="flex flex-col gap-1 py-2 sm:py-3 text-xs sm:text-sm">
            <span className="font-semibold">Aceita</span>
            <Badge variant="outline" className="text-[10px] sm:text-xs">{stats.accepted}</Badge>
          </TabsTrigger>
          <TabsTrigger value="confirmed" className="flex flex-col gap-1 py-2 sm:py-3 text-xs sm:text-sm hidden sm:flex">
            <span className="font-semibold">Confirmada</span>
            <Badge variant="outline" className="text-[10px] sm:text-xs">{stats.confirmed}</Badge>
          </TabsTrigger>
          <TabsTrigger value="canceled" className="flex flex-col gap-1 py-2 sm:py-3 text-xs sm:text-sm hidden sm:flex">
            <span className="font-semibold">Cancelada</span>
            <Badge variant="outline" className="text-[10px] sm:text-xs">{stats.canceled}</Badge>
          </TabsTrigger>
          <TabsTrigger value="expired" className="flex flex-col gap-1 py-2 sm:py-3 text-xs sm:text-sm hidden sm:flex">
            <span className="font-semibold">Expirada</span>
            <Badge variant="outline" className="text-[10px] sm:text-xs">{stats.expired}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Conteúdo das Tabs */}
        {["all", "pending", "sent", "accepted", "confirmed", "canceled", "expired"].map((tab) => (
          <TabsContent key={tab} value={tab} className="space-y-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-r-accent rounded-full animate-spin" 
                       style={{ animationDelay: '150ms' }} />
                </div>
                <p className="text-lg font-medium text-muted-foreground animate-pulse">Carregando...</p>
              </div>
            ) : filteredProposals.length === 0 ? (
              <Card className="border-0 shadow-lg">
                <CardContent className="pt-12 pb-12 text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-4">
                    <FileText className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <p className="text-lg font-medium text-muted-foreground">Nenhum orçamento encontrado</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {searchTerm || filterCustomer !== "all" 
                      ? "Tente ajustar os filtros para encontrar o que procura" 
                      : "Crie seu primeiro orçamento para começar"
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredProposals.map((proposal, index) => (
                  <Card 
                    key={proposal.id}
                    className="group relative overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 animate-fade-in pointer-events-auto"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
              {/* Gradient animado de fundo */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                    
                    {/* Barra de status superior */}
                    <div className={`absolute top-0 left-0 right-0 h-1.5 sm:h-2 bg-gradient-to-r ${
                      proposal.status === "confirmed" ? "from-accent to-green-500" :
                      proposal.status === "canceled" ? "from-destructive to-red-600" :
                      proposal.status === "accepted" ? "from-blue-500 to-purple-500" :
                      "from-yellow-500 to-orange-500"
                    }`} />
                    
                    <CardHeader className="space-y-3 sm:space-y-4 pt-4 sm:pt-6 p-3 sm:p-6">
                      <div className="flex items-start justify-between gap-2 sm:gap-3">
                        <div className="flex-1 space-y-1.5 sm:space-y-2 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-gradient-to-br from-primary to-accent shadow-md group-hover:scale-110 transition-transform flex-shrink-0">
                              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                            </div>
                            <h3 className="font-bold text-base sm:text-xl line-clamp-1 group-hover:text-primary transition-colors">
                              {proposal.title}
                            </h3>
                          </div>
                          
                          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                            <User className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                            <span className="font-medium truncate">{proposal.customers.name}</span>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          {getStatusBadge(proposal.status)}
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-6 pt-0">
                      {/* Valor com destaque */}
                      <div 
                        className="relative p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 group-hover:from-primary/20 group-hover:to-accent/20 transition-colors"
                      >
                        <p className="text-xs sm:text-sm text-muted-foreground mb-0.5 sm:mb-1">Valor Total</p>
                        <p className="text-xl sm:text-3xl font-extrabold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                          {formatCurrency(proposal.final_amount)}
                        </p>
                        {proposal.deposit_amount && (
                          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                            Entrada: {formatCurrency(proposal.deposit_amount)}
                          </p>
                        )}
                      </div>
                      
                      {/* Informações adicionais */}
                      <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                        <div className="flex items-center justify-between p-1.5 sm:p-2 rounded-lg bg-muted/50">
                          <span className="text-muted-foreground flex items-center gap-1.5 sm:gap-2">
                            <CalendarIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                            Validade
                          </span>
                          <span className="font-medium">
                            {format(new Date(proposal.valid_until), "dd/MM/yyyy")}
                          </span>
                        </div>
                        
                        {proposal.sent_at && (
                          <div className="flex items-center justify-between p-1.5 sm:p-2 rounded-lg bg-muted/50">
                            <span className="text-muted-foreground flex items-center gap-1.5 sm:gap-2">
                              <Send className="w-3 h-3 sm:w-4 sm:h-4" />
                              Enviada
                            </span>
                            <span className="font-medium">
                              {format(new Date(proposal.sent_at), "dd/MM/yyyy")}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Botões de ação principais */}
                      <div className="flex gap-1.5 sm:gap-2 pt-1 sm:pt-2 relative z-20">
                        {(proposal.status === "pending" || proposal.status === "sent") && (
                          <>
                            <Button 
                              type="button"
                              size="sm" 
                              className="flex-1 gap-1.5 sm:gap-2 bg-gradient-to-r from-accent to-green-500 hover:shadow-lg transition-all relative z-30 pointer-events-auto text-xs sm:text-sm h-8 sm:h-9"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setConfirmProposal(proposal);
                              }}
                            >
                              <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              <span className="hidden xs:inline">Confirmar</span>
                            </Button>
                            <Button 
                              type="button"
                              size="sm" 
                              variant="outline" 
                              className="flex-1 gap-1.5 sm:gap-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive transition-all relative z-30 pointer-events-auto text-xs sm:text-sm h-8 sm:h-9"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleCancelProposal(proposal.id);
                              }}
                            >
                              <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              <span className="hidden xs:inline">Cancelar</span>
                            </Button>
                          </>
                        )}
                        
                        {(proposal.status === "accepted" || proposal.status === "confirmed") && !proposal.appointment_id && (
                          <Button 
                            type="button"
                            size="sm" 
                            className="w-full gap-1.5 sm:gap-2 bg-gradient-to-r from-primary to-accent hover:shadow-lg transition-all relative z-30 pointer-events-auto text-xs sm:text-sm h-8 sm:h-9"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setScheduleProposal(proposal);
                            }}
                          >
                            <CalendarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span className="text-xs sm:text-sm">Agendar</span>
                          </Button>
                        )}
                        
                        {proposal.status === "confirmed" && proposal.appointment_id && (
                          <Button 
                            type="button"
                            size="sm" 
                            variant="outline"
                            className="w-full gap-1.5 sm:gap-2 hover:bg-primary/10 hover:text-primary hover:border-primary transition-all relative z-30 pointer-events-auto text-xs sm:text-sm h-8 sm:h-9"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              navigate("/agendamentos");
                            }}
                          >
                            <CalendarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span className="text-xs sm:text-sm">Ver Agendamento</span>
                          </Button>
                        )}
                        
                        {proposal.status === "canceled" && (
                          <div className="w-full text-center text-xs sm:text-sm text-muted-foreground py-1.5 sm:py-2">
                            Orçamento cancelado
                          </div>
                        )}
                      </div>

                      {/* Botões de ações secundárias */}
                      <div className="flex gap-1.5 sm:gap-2 pt-1.5 sm:pt-2 border-t relative z-20">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="flex-1 gap-1.5 sm:gap-2 relative z-30 pointer-events-auto text-xs sm:text-sm h-8 sm:h-9"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setViewProposal(proposal);
                          }}
                        >
                          <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          <span className="hidden xs:inline">Visualizar</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="flex-1 gap-1.5 sm:gap-2 relative z-30 pointer-events-auto text-xs sm:text-sm h-8 sm:h-9"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setEditProposal(proposal);
                          }}
                        >
                          <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          <span className="hidden xs:inline">Editar</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 sm:gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 relative z-30 pointer-events-auto text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setDeleteProposalId(proposal.id);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </Button>
                      </div>
                    </CardContent>
                    
              {/* Indicador de hover inferior */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 pointer-events-none" />
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <ProposalViewDialog
        proposal={viewProposal}
        open={!!viewProposal}
        onOpenChange={(open) => !open && setViewProposal(null)}
        onScheduleAppointment={(proposal) => {
          setViewProposal(null);
          setScheduleProposal(proposal);
        }}
      />

      <ScheduleAppointmentDialog
        proposal={scheduleProposal}
        open={!!scheduleProposal}
        onOpenChange={(open) => !open && setScheduleProposal(null)}
        onSuccess={fetchData}
      />

      <ProposalEditDialog
        proposal={editProposal}
        open={!!editProposal}
        onOpenChange={(open) => !open && setEditProposal(null)}
        onSuccess={fetchData}
        customers={customers}
      />

      <ProposalConfirmDialog
        proposal={confirmProposal}
        open={!!confirmProposal}
        onOpenChange={(open) => !open && setConfirmProposal(null)}
        onSuccess={fetchData}
      />

      <AlertDialog open={!!deleteProposalId} onOpenChange={(open) => !open && setDeleteProposalId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProposal} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Propostas;
