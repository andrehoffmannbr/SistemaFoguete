import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Ticket, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CustomerCouponsProps {
  customerId: string;
}

interface Coupon {
  id: string;
  code: string;
  discount_percentage: number | null;
  discount_amount: number | null;
  expires_at: string;
  used_at: string | null;
  is_active: boolean;
}

export const CustomerCoupons = ({ customerId }: CustomerCouponsProps) => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchCoupons = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("user_id", user.id)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setCoupons(data);
      }
      setLoading(false);
    };

    fetchCoupons();
  }, [customerId]);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast({
      title: "Código copiado!",
      description: "O código do cupom foi copiado para a área de transferência.",
    });
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (loading) {
    return null;
  }

  const activeCoupons = coupons.filter(c => c.is_active && !c.used_at && new Date(c.expires_at) > new Date());

  if (activeCoupons.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Ticket className="w-5 h-5 text-accent" />
          Cupons Disponíveis ({activeCoupons.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {activeCoupons.map((coupon) => {
          const isExpiringSoon = new Date(coupon.expires_at).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;
          
          return (
            <div
              key={coupon.id}
              className="p-4 rounded-lg border-2 border-dashed border-accent/30 bg-accent/5 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono font-bold text-lg text-accent">{coupon.code}</p>
                  <p className="text-sm text-muted-foreground">
                    {coupon.discount_percentage 
                      ? `${coupon.discount_percentage}% de desconto`
                      : `R$ ${Number(coupon.discount_amount).toFixed(2)} de desconto`
                    }
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyCode(coupon.code)}
                  className="gap-2"
                >
                  {copiedCode === coupon.code ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Válido até {new Date(coupon.expires_at).toLocaleDateString("pt-BR")}
                </span>
                {isExpiringSoon && (
                  <Badge variant="destructive" className="text-xs">
                    Expira em breve
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};