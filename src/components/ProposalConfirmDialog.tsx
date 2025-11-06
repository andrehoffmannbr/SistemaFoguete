import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { normalizeConfirmStatus } from "@/lib/proposalStatus";

interface ProposalConfirmDialogProps {
  proposal: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const ProposalConfirmDialog = ({
  proposal,
  open,
  onOpenChange,
  onSuccess,
}: ProposalConfirmDialogProps) => {
  const { toast } = useToast();
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!date || !time) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione a data e o horário do agendamento.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Criar data/hora de início e fim
      const startDateTime = new Date(`${format(date, "yyyy-MM-dd")}T${time}`);
      const endDateTime = new Date(startDateTime.getTime() + parseInt(duration) * 60000);

      // Criar o agendamento
      const { data: appointment, error: appointmentError } = await supabase
        .from("appointments")
        .insert({
          user_id: user.id,
          customer_id: proposal.customer_id,
          title: proposal.title,
          description: proposal.description || "",
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          status: "scheduled",
          notes: notes || "",
          proposal_id: proposal.id,
        })
        .select()
        .single();

      if (appointmentError) throw appointmentError;

      // Atualizar status do orçamento para status permitido
      const { error: proposalError } = await supabase
        .from("proposals")
        .update({
          status: normalizeConfirmStatus("confirmed"),
          appointment_id: appointment.id,
          accepted_at: new Date().toISOString(),
        })
        .eq("id", proposal.id);

      if (proposalError) throw proposalError;

      toast({
        title: "Orçamento confirmado!",
        description: "O agendamento foi criado com sucesso.",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao confirmar orçamento:", error);
      const reason = error?.details || error?.message || "Não foi possível confirmar o orçamento.";
      toast({
        title: "Erro",
        description: reason,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar Orçamento</DialogTitle>
          <DialogDescription>
            Selecione a data e horário para criar o agendamento
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Data do Agendamento *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label htmlFor="time">Horário *</Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="duration">Duração (minutos)</Label>
            <Input
              id="duration"
              type="number"
              min="15"
              step="15"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações sobre o agendamento..."
              rows={3}
            />
          </div>

          <Button onClick={handleConfirm} className="w-full" disabled={loading}>
            {loading ? "Confirmando..." : "Confirmar e Criar Agendamento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};