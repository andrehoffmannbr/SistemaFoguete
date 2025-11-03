import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProposalViewDialogProps {
  proposal: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScheduleAppointment?: (proposal: any) => void;
}

export const ProposalViewDialog = ({ proposal, open, onOpenChange, onScheduleAppointment }: ProposalViewDialogProps) => {
  if (!proposal) return null;
  
  const canSchedule = proposal.status === 'accepted' || proposal.status === 'confirmed';

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Pendente", variant: "secondary" },
      sent: { label: "Enviada", variant: "default" },
      viewed: { label: "Visualizada", variant: "outline" },
      accepted: { label: "Aceita", variant: "default" },
      rejected: { label: "Recusada", variant: "destructive" },
      expired: { label: "Expirada", variant: "destructive" },
      paused: { label: "Pausada", variant: "outline" },
      confirmed: { label: "Confirmada", variant: "default" },
      cancelled: { label: "Cancelada", variant: "destructive" },
    };
    const config = statusMap[status] || statusMap.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{proposal.title}</DialogTitle>
            {getStatusBadge(proposal.status)}
          </div>
        </DialogHeader>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Cliente</p>
              <p className="font-medium">{proposal.customers.name}</p>
              <p className="text-sm text-muted-foreground">{proposal.customers.phone}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Validade</p>
              <p className="font-medium">
                {format(new Date(proposal.valid_until), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>

          {proposal.description && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Descrição</p>
              <p className="text-sm">{proposal.description}</p>
            </div>
          )}

          <div>
            <p className="text-sm font-medium mb-3">Serviços Inclusos</p>
            <div className="space-y-2">
              {proposal.services.map((service: any, idx: number) => (
                <div key={idx} className="flex justify-between p-3 bg-muted rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{service.description}</p>
                    <p className="text-sm text-muted-foreground">
                      Quantidade: {service.quantity} x {formatCurrency(service.unit_price)}
                    </p>
                  </div>
                  <p className="font-bold">
                    {formatCurrency(service.quantity * service.unit_price)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(proposal.total_amount)}</span>
            </div>
            {proposal.discount_percentage > 0 && (
              <div className="flex justify-between text-sm text-destructive">
                <span>Desconto ({proposal.discount_percentage}%)</span>
                <span>
                  - {formatCurrency((proposal.total_amount * proposal.discount_percentage) / 100)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <span>Valor Total</span>
              <span className="text-primary">{formatCurrency(proposal.final_amount)}</span>
            </div>
            {proposal.deposit_amount && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Sinal ({proposal.deposit_percentage}%)
                </span>
                <span className="font-semibold">{formatCurrency(proposal.deposit_amount)}</span>
              </div>
            )}
          </div>

          {proposal.sent_at && (
            <div className="text-sm text-muted-foreground">
              Enviada em: {format(new Date(proposal.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </div>
          )}

          {canSchedule && onScheduleAppointment && (
            <div className="pt-4 border-t">
              <Button 
                onClick={() => onScheduleAppointment(proposal)} 
                className="w-full gap-2"
              >
                <Calendar className="w-4 h-4" />
                Agendar Atendimento
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
