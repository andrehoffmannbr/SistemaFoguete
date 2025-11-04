import { ReactNode, createContext, useContext } from "react";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Lock } from "lucide-react";

interface ReadOnlyContextType {
  isReadOnly: boolean;
}

const ReadOnlyContext = createContext<ReadOnlyContextType>({ isReadOnly: false });

export const useReadOnly = () => useContext(ReadOnlyContext);

interface SubscriptionGuardProps {
  children: ReactNode;
}

export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { subscription, isLoading, isExpired, daysRemaining } = useSubscriptionStatus();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Se a assinatura está expirada, aplicar modo read-only
  const isReadOnly = isExpired;

  return (
    <ReadOnlyContext.Provider value={{ isReadOnly }}>
      {isReadOnly && (
        <Alert variant="destructive" className="m-4">
          <Lock className="h-4 w-4" />
          <AlertTitle>Assinatura Expirada - Modo Somente Leitura</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              Sua assinatura expirou. Você pode visualizar seus dados, mas não pode fazer alterações.
              Renove sua assinatura para continuar usando todos os recursos.
            </span>
            <Button
              onClick={() => navigate("/subscription")}
              className="ml-4"
            >
              Renovar Assinatura
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      {subscription?.status === "trial" && daysRemaining <= 3 && daysRemaining > 0 && (
        <Alert className="m-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Período de Teste Acabando</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              Restam apenas {daysRemaining} {daysRemaining === 1 ? "dia" : "dias"} do seu período de teste gratuito.
              Assine agora para não perder o acesso aos seus dados!
            </span>
            <Button
              onClick={() => navigate("/subscription")}
              variant="default"
              className="ml-4"
            >
              Assinar Agora
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      {children}
    </ReadOnlyContext.Provider>
  );
}

interface ReadOnlyWrapperProps {
  children: ReactNode;
  onReadOnlyClick?: () => void;
}

/**
 * Wrapper que desabilita interações quando em modo read-only
 */
export function ReadOnlyWrapper({ children, onReadOnlyClick }: ReadOnlyWrapperProps) {
  const { isReadOnly } = useReadOnly();

  if (!isReadOnly) {
    return <>{children}</>;
  }

  return (
    <div
      className="relative"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onReadOnlyClick) {
          onReadOnlyClick();
        }
      }}
    >
      <div className="pointer-events-none opacity-50">
        {children}
      </div>
      <div className="absolute inset-0 cursor-not-allowed" />
    </div>
  );
}
