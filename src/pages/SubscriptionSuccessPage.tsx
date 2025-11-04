import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";

export default function SubscriptionSuccessPage() {
  const navigate = useNavigate();
  const { refetch } = useSubscriptionStatus();

  useEffect(() => {
    // Atualizar status da assinatura após pagamento
    const timer = setTimeout(() => {
      refetch();
    }, 2000);

    return () => clearTimeout(timer);
  }, [refetch]);

  return (
    <div className="container mx-auto py-16 px-4 flex items-center justify-center min-h-[80vh]">
      <Card className="max-w-lg w-full text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="bg-green-100 rounded-full p-6">
              <CheckCircle className="h-16 w-16 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-3xl">Pagamento Aprovado!</CardTitle>
          <CardDescription className="text-lg">
            Sua assinatura foi ativada com sucesso
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Parabéns! Seu pagamento foi processado e sua assinatura está ativa. Agora você tem acesso completo a todos os recursos do sistema.
          </p>
          <div className="flex flex-col gap-3 pt-4">
            <Button onClick={() => navigate("/")} size="lg">
              Ir para o Dashboard
            </Button>
            <Button onClick={() => navigate("/subscription")} variant="outline">
              Ver Detalhes da Assinatura
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
