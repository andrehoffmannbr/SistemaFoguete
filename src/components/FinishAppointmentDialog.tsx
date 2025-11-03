import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type InventoryItem = {
  id: string;
  name: string;
  current_stock: number;
  unit: string;
};

type StockUsage = {
  item_id: string;
  quantity: number;
};

interface FinishAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  appointmentTitle: string;
}

export function FinishAppointmentDialog({
  open,
  onOpenChange,
  appointmentId,
  appointmentTitle,
}: FinishAppointmentDialogProps) {
  const [stockUsages, setStockUsages] = useState<StockUsage[]>([]);
  const [appointmentValue, setAppointmentValue] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("dinheiro");
  const queryClient = useQueryClient();

  // Buscar dados do appointment e proposta quando abrir o diálogo
  useEffect(() => {
    if (open && appointmentId) {
      const fetchAppointmentData = async () => {
        // Buscar appointment com proposal_id
        const { data: appointment } = await supabase
          .from("appointments")
          .select("proposal_id, price")
          .eq("id", appointmentId)
          .single();

        if (appointment?.proposal_id) {
          // Buscar valor da proposta
          const { data: proposal } = await supabase
            .from("proposals")
            .select("final_amount")
            .eq("id", appointment.proposal_id)
            .single();

          if (proposal?.final_amount) {
            setAppointmentValue(proposal.final_amount.toString());
          }
        } else if (appointment?.price) {
          // Se já tiver preço cadastrado no appointment, usar esse
          setAppointmentValue(appointment.price.toString());
        }
      };

      fetchAppointmentData();
    } else if (!open) {
      // Limpar quando fechar
      setAppointmentValue("");
      setPaymentMethod("dinheiro");
      setStockUsages([]);
    }
  }, [open, appointmentId]);

  // Buscar itens do estoque
  const { data: inventoryItems = [] } = useQuery({
    queryKey: ["inventory-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, name, current_stock, unit")
        .order("name");
      
      if (error) throw error;
      return data as InventoryItem[];
    },
  });

  // Mutation para finalizar atendimento
  const finishAppointment = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar informações do appointment antes de atualizar
      const { data: appointment } = await supabase
        .from("appointments")
        .select("customer_id")
        .eq("id", appointmentId)
        .single();

      if (!appointment) throw new Error("Agendamento não encontrado");

      // Buscar cartão fidelidade antes da atualização
      const { data: loyaltyCardBefore } = await supabase
        .from("loyalty_cards")
        .select("current_stamps, stamps_required")
        .eq("user_id", user.id)
        .eq("customer_id", appointment.customer_id)
        .single();

      // 1. Atualizar status do agendamento (com valor opcional)
      const updateData: any = { 
        status: "completed",
        payment_status: "paid"
      };

      if (appointmentValue && parseFloat(appointmentValue) > 0) {
        updateData.price = parseFloat(appointmentValue);
        updateData.payment_method = paymentMethod;
      }

      const { error: updateError } = await supabase
        .from("appointments")
        .update(updateData)
        .eq("id", appointmentId);

      if (updateError) throw updateError;

      // 1.5 Criar transação financeira se houver valor
      if (appointmentValue && parseFloat(appointmentValue) > 0) {
        const { error: transactionError } = await supabase
          .from("financial_transactions")
          .insert({
            user_id: user.id,
            type: "income",
            amount: parseFloat(appointmentValue),
            description: `Atendimento: ${appointmentTitle}`,
            payment_method: paymentMethod,
            status: "completed",
            transaction_date: new Date().toISOString(),
            appointment_id: appointmentId
          });

        if (transactionError) throw transactionError;
      }

      // Aguardar um pouco para o trigger executar
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Buscar cartão fidelidade após a atualização
      const { data: loyaltyCardAfter } = await supabase
        .from("loyalty_cards")
        .select("current_stamps, stamps_required, rewards_redeemed")
        .eq("user_id", user.id)
        .eq("customer_id", appointment.customer_id)
        .single();

      // 2. Atualizar estoque para cada item usado
      for (const usage of stockUsages) {
        const { error: stockError } = await supabase.rpc("update_inventory_stock", {
          p_item_id: usage.item_id,
          p_quantity: usage.quantity,
          p_type: "out",
          p_reason: `Usado no atendimento: ${appointmentTitle}`,
          p_reference_type: "appointment",
          p_reference_id: appointmentId,
        });

        if (stockError) throw stockError;
      }

      return { loyaltyCardBefore, loyaltyCardAfter };
    },
    onSuccess: (data) => {
      // Invalidar todas as queries relacionadas para atualizar a UI
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["loyalty-cards"] });
      queryClient.invalidateQueries({ queryKey: ["customer-history"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["financial-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      
      // Verificar se o cartão foi completado
      const { loyaltyCardBefore, loyaltyCardAfter } = data;
      
      if (loyaltyCardBefore && loyaltyCardAfter) {
        const wasCompleted = loyaltyCardBefore.current_stamps + 1 >= loyaltyCardBefore.stamps_required;
        const rewardsIncreased = loyaltyCardAfter.rewards_redeemed > (loyaltyCardBefore as any).rewards_redeemed;
        
        if (wasCompleted || rewardsIncreased) {
          toast.success("🎉 Parabéns! O cliente completou o cartão fidelidade e ganhou uma visita grátis!", {
            duration: 5000,
          });
        } else {
          toast.success("Atendimento finalizado com sucesso!");
        }
      } else {
        toast.success("Atendimento finalizado com sucesso!");
      }
      
      onOpenChange(false);
      setStockUsages([]);
      setAppointmentValue("");
      setPaymentMethod("dinheiro");
    },
    onError: (error) => {
      toast.error("Erro ao finalizar atendimento");
      console.error(error);
    },
  });

  const addStockUsage = () => {
    setStockUsages([...stockUsages, { item_id: "", quantity: 1 }]);
  };

  const removeStockUsage = (index: number) => {
    setStockUsages(stockUsages.filter((_, i) => i !== index));
  };

  const updateStockUsage = (index: number, field: keyof StockUsage, value: string | number) => {
    const updated = [...stockUsages];
    updated[index] = { ...updated[index], [field]: value };
    setStockUsages(updated);
  };

  const handleFinish = () => {
    finishAppointment.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Finalizar Atendimento</DialogTitle>
          <DialogDescription className="text-sm">
            Registre os itens do estoque utilizados e finalize o atendimento
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted p-3 rounded-lg">
            <p className="text-sm font-medium">{appointmentTitle}</p>
          </div>

          {/* Campo opcional de valor */}
          <div className="space-y-3 sm:space-y-4 border rounded-lg p-3 sm:p-4 bg-muted/30">
            <h4 className="text-sm font-semibold">Valor do Atendimento (Opcional)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">Valor (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={appointmentValue}
                  onChange={(e) => setAppointmentValue(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Forma de Pagamento</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                    <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Preencha para registrar o valor no relatório e criar transação financeira automaticamente
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <Label className="text-sm">Itens Utilizados</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addStockUsage}
                className="gap-2 h-10 w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" />
                Adicionar Item
              </Button>
            </div>

            {stockUsages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum item adicionado. Clique em "Adicionar Item" para registrar uso de estoque.
              </p>
            ) : (
              <div className="space-y-3">
                {stockUsages.map((usage, index) => (
                  <div key={index} className="flex gap-2 items-end">
                    <div className="flex-1 space-y-2">
                      <Label>Item</Label>
                      <Select
                        value={usage.item_id}
                        onValueChange={(value) => updateStockUsage(index, "item_id", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um item" />
                        </SelectTrigger>
                        <SelectContent>
                          {inventoryItems.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name} (Estoque: {item.current_stock} {item.unit})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="w-32 space-y-2">
                      <Label>Quantidade</Label>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={usage.quantity}
                        onChange={(e) => updateStockUsage(index, "quantity", parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeStockUsage(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setStockUsages([]);
              setAppointmentValue("");
              setPaymentMethod("dinheiro");
            }}
            className="h-11 w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleFinish}
            disabled={finishAppointment.isPending}
            className="h-11 w-full sm:w-auto"
          >
            {finishAppointment.isPending ? "Finalizando..." : "Finalizar Atendimento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
