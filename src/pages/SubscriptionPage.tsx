import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { Check, CreditCard, Sparkles, Zap } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

const plans = [
  {
    id: "monthly",
    name: "Mensal",
    price: 97,
    period: "mês",
    description: "Ideal para começar",
    features: [
      "Acesso completo ao sistema",
      "Agendamentos ilimitados",
      "Propostas e CRM",
      "Gestão financeira",
      "Controle de estoque",
      "Suporte por email",
    ],
    icon: Zap,
    popular: false,
  },
  {
    id: "semiannual",
    name: "Semestral",
    price: 582,
    originalPrice: 679,
    period: "6 meses",
    description: "7 meses pelo preço de 6",
    features: [
      "Tudo do plano mensal",
      "1 mês grátis",
      "Economia de R$ 97",
      "Suporte prioritário",
      "Atualizações antecipadas",
    ],
    icon: Sparkles,
    popular: true,
    discount: "ECONOMIZE 14%",
  },
  {
    id: "annual",
    name: "Anual",
    price: 1164,
    originalPrice: 1358,
    period: "12 meses",
    description: "14 meses pelo preço de 12",
    features: [
      "Tudo do plano mensal",
      "2 meses grátis",
      "Economia de R$ 194",
      "Suporte prioritário VIP",
      "Consultoria mensal",
      "Acesso beta features",
    ],
    icon: CreditCard,
    popular: false,
    discount: "ECONOMIZE 17%",
  },
];

export default function SubscriptionPage() {
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "credit_card">("pix");
  const { subscription, isActive, isTrial, isExpired, daysRemaining, createPayment, isCreatingPayment } = useSubscriptionStatus();

  const handleSubscribe = (planId: "monthly" | "semiannual" | "annual") => {
    createPayment({ plan: planId, paymentMethod });
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Escolha Seu Plano</h1>
        <p className="text-muted-foreground text-lg mb-6">
          Comece com 7 dias grátis. Cancele quando quiser.
        </p>

        {subscription && (
          <Alert className="max-w-2xl mx-auto mb-6">
            <AlertTitle>Status da Sua Assinatura</AlertTitle>
            <AlertDescription>
              {isTrial && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Trial</Badge>
                  <span>
                    {daysRemaining > 0
                      ? `${daysRemaining} ${daysRemaining === 1 ? "dia" : "dias"} restantes do período gratuito`
                      : "Período de teste expirou"}
                  </span>
                </div>
              )}
              {isActive && !isTrial && (
                <div className="flex items-center gap-2">
                  <Badge variant="default">Ativa</Badge>
                  <span>
                    Plano {subscription.plan === "monthly" ? "Mensal" : subscription.plan === "semiannual" ? "Semestral" : "Anual"} até{" "}
                    {new Date(subscription.current_period_end).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              )}
              {isExpired && (
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">Expirada</Badge>
                  <span>Renove sua assinatura para continuar usando o sistema</span>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "pix" | "credit_card")} className="max-w-md mx-auto mb-8">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pix">PIX</TabsTrigger>
            <TabsTrigger value="credit_card">Cartão de Crédito</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid md:grid-cols-3 gap-8 mb-12">
        {plans.map((plan) => {
          const Icon = plan.icon;
          return (
            <Card key={plan.id} className={plan.popular ? "border-primary border-2 shadow-lg" : ""}>
              {plan.popular && (
                <div className="bg-primary text-primary-foreground text-center py-2 rounded-t-lg font-semibold">
                  MAIS POPULAR
                </div>
              )}
              <CardHeader>
                <div className="flex items-center justify-between mb-4">
                  <Icon className="h-10 w-10 text-primary" />
                  {plan.discount && (
                    <Badge variant="secondary" className="text-xs">
                      {plan.discount}
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl font-bold">R$ {plan.price}</span>
                    {plan.originalPrice && (
                      <span className="text-muted-foreground line-through">
                        R$ {plan.originalPrice}
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-sm">por {plan.period}</p>
                  {plan.id !== "monthly" && (
                    <p className="text-primary text-sm font-semibold mt-1">
                      R$ {(plan.price / (plan.id === "semiannual" ? 7 : 14)).toFixed(2)}/mês
                    </p>
                  )}
                </div>

                <Button
                  className="w-full mb-6"
                  size="lg"
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => handleSubscribe(plan.id as "monthly" | "semiannual" | "annual")}
                  disabled={isCreatingPayment}
                >
                  {isCreatingPayment ? "Gerando pagamento..." : "Assinar Agora"}
                </Button>

                <Separator className="mb-6" />

                <div className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Perguntas Frequentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Como funciona o período de teste?</h4>
              <p className="text-sm text-muted-foreground">
                Você tem 7 dias para testar gratuitamente todas as funcionalidades do sistema. Após o período de teste, você precisa assinar um plano para continuar usando.
              </p>
            </div>
            <Separator />
            <div>
              <h4 className="font-semibold mb-2">Posso cancelar a qualquer momento?</h4>
              <p className="text-sm text-muted-foreground">
                Sim, você pode cancelar sua assinatura a qualquer momento. Seus dados ficarão em modo somente leitura após o vencimento.
              </p>
            </div>
            <Separator />
            <div>
              <h4 className="font-semibold mb-2">O que acontece se minha assinatura expirar?</h4>
              <p className="text-sm text-muted-foreground">
                Você continuará tendo acesso para visualizar seus dados, mas não poderá fazer edições até renovar a assinatura.
              </p>
            </div>
            <Separator />
            <div>
              <h4 className="font-semibold mb-2">Como funciona o pagamento?</h4>
              <p className="text-sm text-muted-foreground">
                Ao clicar em "Assinar Agora", você será redirecionado para o Mercado Pago onde poderá realizar o pagamento via PIX ou Cartão de Crédito.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
