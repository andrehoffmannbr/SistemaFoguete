import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, Gift, Star } from "lucide-react";

interface LoyaltyCardProps {
  customerId: string;
}

interface LoyaltyCardData {
  id: string;
  total_visits: number;
  current_stamps: number;
  stamps_required: number;
  rewards_redeemed: number;
  last_visit_at: string | null;
}

export const LoyaltyCard = ({ customerId }: LoyaltyCardProps) => {
  const [loyaltyCard, setLoyaltyCard] = useState<LoyaltyCardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLoyaltyCard = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("loyalty_cards")
        .select("*")
        .eq("user_id", user.id)
        .eq("customer_id", customerId)
        .single();

      if (!error && data) {
        setLoyaltyCard(data);
      }
      setLoading(false);
    };

    fetchLoyaltyCard();
  }, [customerId]);

  if (loading) {
    return null;
  }

  if (!loyaltyCard) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6 text-center text-muted-foreground">
          <Award className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Nenhuma visita registrada ainda</p>
        </CardContent>
      </Card>
    );
  }

  const progress = (loyaltyCard.current_stamps / loyaltyCard.stamps_required) * 100;
  const isNextFree = loyaltyCard.current_stamps === loyaltyCard.stamps_required - 1;

  return (
    <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Gift className="w-5 h-5 text-primary" />
          Cartão Fidelidade
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Carimbos */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Progresso</span>
            <span className="text-sm font-semibold">
              {loyaltyCard.current_stamps} / {loyaltyCard.stamps_required}
            </span>
          </div>
          
          <div className="flex gap-2 mb-3">
            {Array.from({ length: loyaltyCard.stamps_required }).map((_, idx) => (
              <div
                key={idx}
                className={`flex-1 h-12 rounded-lg flex items-center justify-center transition-all ${
                  idx < loyaltyCard.current_stamps
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted/50 border-2 border-dashed border-muted-foreground/20"
                }`}
              >
                {idx < loyaltyCard.current_stamps && (
                  <Star className="w-6 h-6" fill="currentColor" />
                )}
              </div>
            ))}
          </div>

          {/* Barra de progresso */}
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-primary to-accent h-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Mensagem */}
        {isNextFree ? (
          <Badge className="w-full justify-center py-2 bg-accent text-accent-foreground">
            <Gift className="w-4 h-4 mr-2" />
            Próxima visita GRÁTIS! 🎉
          </Badge>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Faltam <strong>{loyaltyCard.stamps_required - loyaltyCard.current_stamps}</strong> carimbos para ganhar uma visita grátis!
          </p>
        )}

        {/* Estatísticas */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{loyaltyCard.total_visits}</p>
            <p className="text-xs text-muted-foreground">Total de Visitas</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-accent">{loyaltyCard.rewards_redeemed}</p>
            <p className="text-xs text-muted-foreground">Recompensas Resgatadas</p>
          </div>
        </div>

        {loyaltyCard.last_visit_at && (
          <p className="text-xs text-center text-muted-foreground pt-2">
            Última visita: {new Date(loyaltyCard.last_visit_at).toLocaleDateString("pt-BR")}
          </p>
        )}
      </CardContent>
    </Card>
  );
};