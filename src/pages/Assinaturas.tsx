import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, TrendingUp, CreditCard, FileText, Smartphone, XCircle, RefreshCw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  billing_frequency: string;
  included_services: any;
  is_active: boolean;
}

interface Subscription {
  id: string;
  customer_id: string;
  plan_id: string;
  status: string;
  next_billing_date: string;
  failed_payments_count: number;
  customers?: { name: string } | null;
  subscription_plans?: { name: string; price: number } | null;
}

const Assinaturas = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [renewSubscription, setRenewSubscription] = useState<Subscription | null>(null);
  const [cancelSubscription, setCancelSubscription] = useState<Subscription | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("pix");
  
  const [newPlan, setNewPlan] = useState({
    name: "",
    description: "",
    price: "",
    billing_frequency: "monthly",
    duration_months: "3",
    included_services: [{ service: "", quantity: "1", frequency: "month" }],
  });

  useEffect(() => {
    checkAuth();
    fetchPlans();
    fetchSubscriptions();
    fetchCustomers();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchPlans = async () => {
    const { data, error } = await supabase
      .from("subscription_plans")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Erro ao carregar planos",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setPlans(data || []);
    }
  };

  const fetchSubscriptions = async () => {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Erro ao carregar assinaturas",
        description: error.message,
        variant: "destructive",
      });
    } else {
      // Fetch related data separately
      const subsWithDetails = await Promise.all(
        (data || []).map(async (sub) => {
          const [customerRes, planRes] = await Promise.all([
            supabase.from("customers").select("name").eq("id", sub.customer_id).single(),
            supabase.from("subscription_plans").select("name, price").eq("id", sub.plan_id).single(),
          ]);
          return {
            ...sub,
            customers: customerRes.data,
            subscription_plans: planRes.data,
          };
        })
      );
      setSubscriptions(subsWithDetails as any);
    }
    setLoading(false);
  };

  const fetchCustomers = async () => {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .order("name");
    setCustomers(data || []);
  };

  const handleCreatePlan = async () => {
    if (!newPlan.name || !newPlan.price) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("subscription_plans").insert([{
      user_id: user.id,
      name: newPlan.name,
      description: newPlan.description,
      price: parseFloat(newPlan.price),
      billing_frequency: newPlan.billing_frequency,
      included_services: newPlan.included_services,
    }]);

    if (error) {
      toast({
        title: "Erro ao criar plano",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Plano criado com sucesso!",
      });
      setIsDialogOpen(false);
      setNewPlan({
        name: "",
        description: "",
        price: "",
        billing_frequency: "monthly",
        duration_months: "3",
        included_services: [{ service: "", quantity: "1", frequency: "month" }],
      });
      fetchPlans();
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      active: { label: "Ativo", variant: "default" },
      suspended: { label: "Suspenso", variant: "secondary" },
      cancelled: { label: "Cancelado", variant: "outline" },
      payment_failed: { label: "Pagamento Falhou", variant: "destructive" },
    };
    const config = variants[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getFrequencyLabel = (frequency: string) => {
    const labels: Record<string, string> = {
      weekly: "Semanal",
      biweekly: "Quinzenal",
      monthly: "Mensal",
      quarterly: "Trimestral",
      single: "Pagamento Único",
    };
    return labels[frequency] || frequency;
  };

  const handleRenewSubscription = async () => {
    if (!renewSubscription) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      // Calcular próxima data de cobrança
      const nextBillingDate = new Date();
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

      // Atualizar assinatura
      const { error: updateError } = await supabase
        .from("subscriptions")
        .update({
          next_billing_date: nextBillingDate.toISOString(),
          status: "active",
          failed_payments_count: 0,
        })
        .eq("id", renewSubscription.id);

      if (updateError) throw updateError;

      // Se for PIX, criar cobrança
      if (paymentMethod === "pix" && renewSubscription.subscription_plans) {
        const { data: customer } = await supabase
          .from("customers")
          .select("name, phone")
          .eq("id", renewSubscription.customer_id)
          .single();

        if (customer) {
          await supabase.from("pix_charges").insert({
            user_id: user.id,
            customer_id: renewSubscription.customer_id,
            customer_name: customer.name,
            customer_phone: customer.phone,
            amount: renewSubscription.subscription_plans.price,
            status: "pending",
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            metadata: {
              subscription_id: renewSubscription.id,
              type: "subscription_renewal",
            },
          });
        }
      }

      toast({
        title: "Assinatura renovada!",
        description: `Renovação agendada para ${nextBillingDate.toLocaleDateString("pt-BR")}`,
      });

      setRenewSubscription(null);
      fetchSubscriptions();
    } catch (error: any) {
      toast({
        title: "Erro ao renovar assinatura",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCancelSubscription = async () => {
    if (!cancelSubscription) return;

    const { error } = await supabase
      .from("subscriptions")
      .update({ status: "cancelled" })
      .eq("id", cancelSubscription.id);

    if (error) {
      toast({
        title: "Erro ao cancelar assinatura",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Assinatura cancelada!",
        description: "A assinatura foi cancelada com sucesso.",
      });
      setCancelSubscription(null);
      fetchSubscriptions();
    }
  };

  if (loading) {
    return <div className="p-8">Carregando...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Planos</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie planos e pacotes para seus clientes
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Plano
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Novo Plano</DialogTitle>
              <DialogDescription>
                Configure um plano de assinatura recorrente
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nome do Plano *</Label>
                <Input
                  id="name"
                  value={newPlan.name}
                  onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                  placeholder="Ex: Pacote 4 Aulas/Mês"
                />
              </div>
              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={newPlan.description}
                  onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                  placeholder="Descreva o que está incluso no plano"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price">Valor (R$) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={newPlan.price}
                    onChange={(e) => setNewPlan({ ...newPlan, price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="duration">Duração (meses)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    value={newPlan.duration_months}
                    onChange={(e) => setNewPlan({ ...newPlan, duration_months: e.target.value })}
                    placeholder="3"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="frequency">Frequência de Cobrança</Label>
                <Select
                  value={newPlan.billing_frequency}
                  onValueChange={(value) => setNewPlan({ ...newPlan, billing_frequency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="quarterly">Trimestral</SelectItem>
                    <SelectItem value="single">Pagamento Único</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Suporta pagamento via Pix (CobV)
                </p>
              </div>
              <Button onClick={handleCreatePlan} className="w-full">
                Criar Plano
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planos Ativos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{plans.filter(p => p.is_active).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes com Planos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {subscriptions.filter(s => s.status === "active").length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="plans" className="space-y-4">
        <TabsList>
          <TabsTrigger value="plans">Planos Disponíveis</TabsTrigger>
          <TabsTrigger value="subscriptions">Assinantes</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-4">
          {plans.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <p className="text-muted-foreground mb-4">Nenhum plano criado ainda</p>
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Primeiro Plano
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => (
                <Card key={plan.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{plan.name}</CardTitle>
                      {plan.is_active && <Badge>Ativo</Badge>}
                    </div>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-3xl font-bold">{formatCurrency(plan.price)}</div>
                      <div className="text-sm text-muted-foreground">
                        {getFrequencyLabel(plan.billing_frequency)}
                      </div>
                      {plan.description && (
                        <p className="text-sm mt-2">{plan.description}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-4">
          {subscriptions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <p className="text-muted-foreground">Nenhuma assinatura ativa ainda</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {subscriptions.map((subscription) => (
                <Card key={subscription.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{subscription.customers?.name}</CardTitle>
                        <CardDescription>
                          {subscription.subscription_plans?.name}
                        </CardDescription>
                      </div>
                      {getStatusBadge(subscription.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Valor</p>
                          <p className="font-semibold">
                            {formatCurrency(subscription.subscription_plans?.price || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Próximo Pagamento</p>
                          <p className="font-semibold">
                            {new Date(subscription.next_billing_date).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>

                      {subscription.status === "active" && (
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 gap-2"
                            onClick={() => setRenewSubscription(subscription)}
                          >
                            <RefreshCw className="w-4 h-4" />
                            Renovar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 gap-2 text-destructive hover:bg-destructive/10"
                            onClick={() => setCancelSubscription(subscription)}
                          >
                            <XCircle className="w-4 h-4" />
                            Cancelar
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

      </Tabs>

      {/* Dialog de Renovação */}
      <Dialog open={!!renewSubscription} onOpenChange={(open) => !open && setRenewSubscription(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Renovar Assinatura</DialogTitle>
            <DialogDescription>
              Escolha a forma de pagamento para renovar a assinatura
            </DialogDescription>
          </DialogHeader>
          
          {renewSubscription && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="font-medium">{renewSubscription.customers?.name}</p>
                <p className="text-sm text-muted-foreground mt-2">Valor</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(renewSubscription.subscription_plans?.price || 0)}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4" />
                        PIX
                      </div>
                    </SelectItem>
                    <SelectItem value="credit_card">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4" />
                        Cartão de Crédito
                      </div>
                    </SelectItem>
                    <SelectItem value="boleto">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Boleto
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setRenewSubscription(null)}
                >
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={handleRenewSubscription}>
                  Confirmar Renovação
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Cancelamento */}
      <AlertDialog open={!!cancelSubscription} onOpenChange={(open) => !open && setCancelSubscription(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Assinatura</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar a assinatura de{" "}
              <strong>{cancelSubscription?.customers?.name}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSubscription}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Assinaturas;
