import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, RefreshCw } from "lucide-react";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";

export default function SubscriptionPendingPage() {
  const navigate = useNavigate();
  const { refetch, subscription } = useSubscriptionStatus();
  const [checkCount, setCheckCount] = useState(0);

  useEffect(() => {
    // Verificar status a cada 5 segundos
    const interval = setInterval(() => {
      refetch();
      setCheckCount((prev) => prev + 1);
    }, 5000);

    return () => clearInterval(interval);
  }, [refetch]);

  // Se após algumas tentativas a assinatura foi ativada, redirecionar
  useEffect(() => {
    if (subscription?.status === "active" && checkCount > 0) {
      setTimeout(() => {
        navigate("/subscription/success");
      }, 1000);
    }
  }, [subscription, checkCount, navigate]);

  return (
    <div className="container mx-auto py-16 px-4 flex items-center justify-center min-h-[80vh]">
      <Card className="max-w-lg w-full text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="bg-yellow-100 rounded-full p-6">
              <Clock className="h-16 w-16 text-yellow-600 animate-pulse" />
            </div>
          </div>
          <CardTitle className="text-3xl">Pagamento Pendente</CardTitle>
          <CardDescription className="text-lg">
            Aguardando confirmação do pagamento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Seu pagamento está sendo processado. Isso pode levar alguns minutos. Você receberá uma confirmação assim que o pagamento for aprovado.
          </p>
          <div className="bg-muted p-4 rounded-lg text-left space-y-2 text-sm">
            <p className="font-semibold">O que fazer:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Pagamentos via PIX são confirmados em até 2 horas</li>
              <li>Pagamentos via cartão são confirmados em minutos</li>
              <li>Você pode fechar esta página e voltar depois</li>
              <li>Enviaremos uma notificação quando aprovado</li>
            </ul>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Verificando status automaticamente...</span>
          </div>
          <div className="flex flex-col gap-3 pt-4">
            <Button onClick={() => refetch()} variant="outline" size="lg">
              <RefreshCw className="h-4 w-4 mr-2" />
              Verificar Agora
            </Button>
            <Button onClick={() => navigate("/")} variant="ghost">
              Voltar ao Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
