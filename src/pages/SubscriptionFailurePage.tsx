import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

export default function SubscriptionFailurePage() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto py-16 px-4 flex items-center justify-center min-h-[80vh]">
      <Card className="max-w-lg w-full text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="bg-red-100 rounded-full p-6">
              <XCircle className="h-16 w-16 text-red-600" />
            </div>
          </div>
          <CardTitle className="text-3xl">Pagamento Não Aprovado</CardTitle>
          <CardDescription className="text-lg">
            Houve um problema ao processar seu pagamento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Infelizmente não conseguimos processar seu pagamento. Verifique os dados e tente novamente.
          </p>
          <div className="bg-muted p-4 rounded-lg text-left space-y-2 text-sm">
            <p className="font-semibold">Possíveis causas:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Saldo insuficiente</li>
              <li>Dados do cartão incorretos</li>
              <li>Problema temporário no processamento</li>
            </ul>
          </div>
          <div className="flex flex-col gap-3 pt-4">
            <Button onClick={() => navigate("/subscription")} size="lg">
              Tentar Novamente
            </Button>
            <Button onClick={() => navigate("/")} variant="outline">
              Voltar ao Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
