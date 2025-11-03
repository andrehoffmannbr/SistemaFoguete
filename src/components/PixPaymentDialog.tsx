import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, Check, QrCode, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PixCharge {
  id: string;
  txid: string;
  amount: number;
  customer_name: string;
  qr_code: string | null;
  qr_code_image: string | null;
  pix_key: string | null;
  status: string;
  expires_at: string | null;
  paid_at: string | null;
  created_at: string;
  metadata?: any;
}

interface PixPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pixCharge: PixCharge | null;
  onPaymentConfirmed?: () => void;
}

export function PixPaymentDialog({ open, onOpenChange, pixCharge, onPaymentConfirmed }: PixPaymentDialogProps) {
  const [copied, setCopied] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);

  const handleCopyPixCode = async () => {
    if (!pixCharge?.qr_code) return;

    try {
      await navigator.clipboard.writeText(pixCharge.qr_code);
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Erro ao copiar código");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Aguardando Pagamento", variant: "secondary" },
      paid: { label: "Pago", variant: "default" },
      expired: { label: "Expirado", variant: "destructive" },
      cancelled: { label: "Cancelado", variant: "outline" },
    };
    const config = variants[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (!pixCharge) return null;

  const isMock = pixCharge.metadata?.mock === true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Pagamento via PIX
          </DialogTitle>
          <DialogDescription>
            Escaneie o QR Code ou copie o código PIX para realizar o pagamento
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status:</span>
            {getStatusBadge(pixCharge.status)}
          </div>

          {/* Mock Warning */}
          {isMock && (
            <Alert>
              <AlertDescription className="text-xs">
                ⚠️ Modo de demonstração. Configure MERCADO_PAGO_ACCESS_TOKEN para pagamentos reais.
              </AlertDescription>
            </Alert>
          )}

          {/* Valor */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">Valor a pagar</p>
                <p className="text-3xl font-bold">{formatCurrency(pixCharge.amount)}</p>
                <p className="text-xs text-muted-foreground">
                  Cliente: {pixCharge.customer_name}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* QR Code */}
          {pixCharge.qr_code_image && (
            <div className="flex justify-center p-4 bg-muted rounded-lg">
              <img
                src={pixCharge.qr_code_image}
                alt="QR Code PIX"
                className="w-48 h-48"
              />
            </div>
          )}

          {/* PIX Code */}
          {pixCharge.qr_code && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Código PIX (Copia e Cola)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={pixCharge.qr_code}
                  className="flex-1 px-3 py-2 text-xs border rounded-md bg-muted font-mono"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyPixCode}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* External Link */}
          {pixCharge.pix_key && !isMock && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open(pixCharge.pix_key!, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir no Mercado Pago
            </Button>
          )}

          {/* Expiration */}
          {pixCharge.expires_at && pixCharge.status === "pending" && (
            <p className="text-xs text-center text-muted-foreground">
              Válido até: {format(new Date(pixCharge.expires_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          )}

          {/* Payment Confirmed */}
          {pixCharge.status === "paid" && pixCharge.paid_at && (
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription>
                Pagamento confirmado em {format(new Date(pixCharge.paid_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </AlertDescription>
            </Alert>
          )}

          {/* Instructions */}
          {pixCharge.status === "pending" && (
            <div className="text-xs text-muted-foreground space-y-1 bg-muted/50 p-3 rounded-lg">
              <p className="font-semibold">Como pagar:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Abra o app do seu banco</li>
                <li>Escolha pagar via PIX</li>
                <li>Escaneie o QR Code ou copie o código</li>
                <li>Confirme o pagamento</li>
              </ol>
              <p className="mt-2 text-center font-medium">
                O pagamento é confirmado automaticamente!
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {pixCharge.status === "pending" && !isMock && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setCheckingPayment(true);
                  // Simulate checking - in real app, query pix_charges table
                  setTimeout(() => {
                    setCheckingPayment(false);
                    toast.info("Pagamento ainda pendente");
                  }, 2000);
                }}
                disabled={checkingPayment}
              >
                {checkingPayment ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  "Verificar Pagamento"
                )}
              </Button>
            )}
            <Button
              variant={pixCharge.status === "paid" ? "default" : "ghost"}
              onClick={() => {
                onOpenChange(false);
                if (pixCharge.status === "paid" && onPaymentConfirmed) {
                  onPaymentConfirmed();
                }
              }}
              className="flex-1"
            >
              {pixCharge.status === "paid" ? "Concluir" : "Fechar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
