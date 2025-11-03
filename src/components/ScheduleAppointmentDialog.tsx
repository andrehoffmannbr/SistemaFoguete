import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface ScheduleAppointmentDialogProps {
  proposal: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const ScheduleAppointmentDialog = ({
  proposal,
  open,
  onOpenChange,
  onSuccess,
}: ScheduleAppointmentDialogProps) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    date: "",
    start_time: "09:00",
    end_time: "10:00",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.date || !formData.start_time || !formData.end_time) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const startDateTime = new Date(`${formData.date}T${formData.start_time}`);
      const endDateTime = new Date(`${formData.date}T${formData.end_time}`);

      // Criar agendamento
      const { data: appointment, error: appointmentError } = await supabase
        .from("appointments")
        .insert({
          user_id: user.id,
          customer_id: proposal.customer_id,
          proposal_id: proposal.id,
          title: proposal.title,
          description: proposal.description,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          status: "scheduled",
          price: proposal.final_amount,
          payment_status: "pending",
          notes: formData.notes,
        })
        .select()
        .single();

      if (appointmentError) throw appointmentError;

      // Atualizar proposta com appointment_id
      const { error: updateError } = await supabase
        .from("proposals")
        .update({ appointment_id: appointment.id })
        .eq("id", proposal.id);

      if (updateError) throw updateError;

      toast.success("Atendimento agendado com sucesso!");
      onOpenChange(false);
      onSuccess?.();
      
      // Navegar para a página de agendamentos
      navigate("/agendamentos");
    } catch (error) {
      console.error("Erro ao agendar:", error);
      toast.error("Erro ao agendar atendimento");
    } finally {
      setLoading(false);
    }
  };

  if (!proposal) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Agendar Atendimento</DialogTitle>
          <DialogDescription className="text-sm">
            Agendar atendimento para o orçamento: {proposal.title}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Cliente</p>
            <p className="font-medium">{proposal.customers?.name}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date" className="text-sm">Data *</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="pl-10 h-11"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_time" className="text-sm">Início *</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="start_time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="pl-10 h-11"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_time" className="text-sm">Término *</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="end_time"
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="pl-10 h-11"
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Observações sobre o atendimento..."
              rows={3}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-11"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 h-11" disabled={loading}>
              {loading ? "Agendando..." : "Agendar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
