import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Service {
  description: string;
  quantity: number;
  unit_price: number;
}

interface ProposalEditDialogProps {
  proposal: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  customers: any[];
}

export const ProposalEditDialog = ({
  proposal,
  open,
  onOpenChange,
  onSuccess,
  customers,
}: ProposalEditDialogProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    customer_id: "",
    title: "",
    description: "",
    services: [] as Service[],
    discount_percentage: 0,
    deposit_percentage: 50,
    valid_days: 7,
    status: "pending",
  });

  useEffect(() => {
    if (proposal) {
      const validUntil = new Date(proposal.valid_until);
      const createdAt = new Date(proposal.created_at);
      const diffDays = Math.ceil((validUntil.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

      setFormData({
        customer_id: proposal.customer_id,
        title: proposal.title,
        description: proposal.description || "",
        services: proposal.services || [],
        discount_percentage: proposal.discount_percentage || 0,
        deposit_percentage: proposal.deposit_percentage || 50,
        valid_days: diffDays > 0 ? diffDays : 7,
        status: proposal.status || "pending",
      });
    }
  }, [proposal]);

  const calculateTotal = () => {
    const subtotal = formData.services.reduce((sum, s) => sum + s.quantity * s.unit_price, 0);
    const discount = (subtotal * formData.discount_percentage) / 100;
    return subtotal - discount;
  };

  const handleSubmit = async () => {
    if (!formData.customer_id || !formData.title || formData.services.length === 0) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos necessários.",
        variant: "destructive",
      });
      return;
    }

    const totalAmount = calculateTotal();
    const depositAmount = (totalAmount * formData.deposit_percentage) / 100;
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + formData.valid_days);

    const { error } = await supabase
      .from("proposals")
      .update({
        customer_id: formData.customer_id,
        title: formData.title,
        description: formData.description || null,
        services: formData.services as any,
        total_amount: totalAmount,
        discount_percentage: formData.discount_percentage,
        final_amount: totalAmount,
        deposit_percentage: formData.deposit_percentage,
        deposit_amount: depositAmount,
        valid_until: validUntil.toISOString(),
        status: formData.status,
      })
      .eq("id", proposal.id);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o orçamento.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Orçamento atualizado!",
      });
      onSuccess();
      onOpenChange(false);
    }
  };

  const addService = () => {
    setFormData({
      ...formData,
      services: [...formData.services, { description: "", quantity: 1, unit_price: 0 }],
    });
  };

  const updateService = (index: number, field: keyof Service, value: any) => {
    const updated = [...formData.services];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, services: updated });
  };

  const removeService = (index: number) => {
    if (formData.services.length > 1) {
      setFormData({
        ...formData,
        services: formData.services.filter((_, i) => i !== index),
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Orçamento</DialogTitle>
          <DialogDescription>Atualize os detalhes do orçamento</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Cliente *</Label>
            <Select
              value={formData.customer_id}
              onValueChange={(value) => setFormData({ ...formData, customer_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Título do Orçamento *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Reforma de Banheiro"
            />
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detalhes adicionais do orçamento..."
              rows={3}
            />
          </div>

          <div>
            <Label>Status do Orçamento</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="sent">Enviado</SelectItem>
                <SelectItem value="accepted">Aceito</SelectItem>
                <SelectItem value="rejected">Rejeitado</SelectItem>
              </SelectContent>
            </Select>
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
              {formData.services.map((service, idx) => (
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
                  {formData.services.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeService(idx)}>
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
                value={formData.discount_percentage}
                onChange={(e) =>
                  setFormData({ ...formData, discount_percentage: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <Label>Sinal (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={formData.deposit_percentage}
                onChange={(e) =>
                  setFormData({ ...formData, deposit_percentage: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <Label>Validade (dias)</Label>
              <Input
                type="number"
                min="1"
                value={formData.valid_days}
                onChange={(e) => setFormData({ ...formData, valid_days: parseInt(e.target.value) || 7 })}
              />
            </div>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <div className="flex justify-between text-lg font-bold">
              <span>Valor Total:</span>
              <span className="text-primary">{formatCurrency(calculateTotal())}</span>
            </div>
            {formData.deposit_percentage > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground mt-1">
                <span>Sinal ({formData.deposit_percentage}%):</span>
                <span>{formatCurrency((calculateTotal() * formData.deposit_percentage) / 100)}</span>
              </div>
            )}
          </div>

          <Button onClick={handleSubmit} className="w-full">
            Salvar Alterações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
