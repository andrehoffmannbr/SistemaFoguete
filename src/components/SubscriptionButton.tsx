import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { useNavigate } from "react-router-dom";
import { CreditCard, AlertCircle, CheckCircle, Clock } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function SubscriptionButton() {
  const { subscription, isLoading, isActive, isTrial, isExpired, daysRemaining } = useSubscriptionStatus();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <Clock className="h-5 w-5 animate-spin" />
      </Button>
    );
  }

  const getStatusInfo = () => {
    if (isExpired) {
      return {
        icon: <AlertCircle className="h-5 w-5" />,
        label: "Expirada",
        variant: "destructive" as const,
        tooltip: "Sua assinatura expirou. Clique para renovar.",
      };
    }
    
    if (isTrial) {
      return {
        icon: <Clock className="h-5 w-5" />,
        label: daysRemaining > 0 ? `Trial (${daysRemaining}d)` : "Trial",
        variant: "secondary" as const,
        tooltip: `Período de teste: ${daysRemaining} dias restantes`,
      };
    }
    
    if (isActive) {
      const planNames = {
        monthly: "Mensal",
        semiannual: "Semestral",
        annual: "Anual",
      };
      
      return {
        icon: <CheckCircle className="h-5 w-5" />,
        label: planNames[subscription?.plan as keyof typeof planNames] || "Ativa",
        variant: "default" as const,
        tooltip: `Assinatura ativa até ${new Date(subscription?.current_period_end || "").toLocaleDateString("pt-BR")}`,
      };
    }

    return {
      icon: <CreditCard className="h-5 w-5" />,
      label: "Assinar",
      variant: "outline" as const,
      tooltip: "Clique para escolher um plano",
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/subscription")}
            className="gap-2"
          >
            {statusInfo.icon}
            <span className="hidden sm:inline">{statusInfo.label}</span>
            {(isExpired || (isTrial && daysRemaining <= 3)) && (
              <Badge variant={statusInfo.variant} className="ml-1 hidden md:inline-flex">
                !
              </Badge>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{statusInfo.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
