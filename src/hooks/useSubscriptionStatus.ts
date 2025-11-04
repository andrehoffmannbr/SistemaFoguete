import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { parseFunctionsError } from "@/lib/parseFunctionsError";

export interface UserSubscription {
  id: string;
  user_id: string;
  status: "trial" | "active" | "expired" | "cancelled";
  plan: "monthly" | "semiannual" | "annual";
  trial_ends_at: string | null;
  current_period_start: string;
  current_period_end: string;
  auto_renew: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPayment {
  id: string;
  user_subscription_id: string | null;
  user_id: string;
  plan: string;
  amount: number;
  payment_method: "pix" | "credit_card";
  mercado_pago_preference_id: string | null;
  mercado_pago_payment_id: string | null;
  mercado_pago_payment_link: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled" | "refunded";
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useSubscriptionStatus() {
  const [user, setUser] = useState<User | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Buscar status da assinatura do usuário
  const { data: subscription, isLoading, error, refetch } = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("user_subscriptions" as any)
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      return data as unknown as UserSubscription | null;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  // Criar pagamento de assinatura
  const createPaymentMutation = useMutation({
    mutationFn: async ({
      plan,
      paymentMethod,
    }: {
      plan: "monthly" | "semiannual" | "annual";
      paymentMethod: "pix" | "credit_card";
    }) => {
      // Garante sessão e envia Authorization explicitamente (evita 401/verify_jwt)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Você precisa estar logado para assinar.");

      console.log("Chamando Edge Function com:", { plan, paymentMethod, userId: session.user.id });

      const response = await supabase.functions.invoke("create-subscription-payment", {
        body: { plan, paymentMethod },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          // Envia também a apikey do mesmo client (evita edge cases de merge de headers)
          apikey: (supabase as any).rest?.headers?.apikey
            || import.meta.env.VITE_SUPABASE_ANON_KEY
            || "",
        },
      });

      console.log("Resposta da Edge Function:", response);

      if (response.error) {
        console.error("Erro na Edge Function:", response.error);
        const { status, message } = await parseFunctionsError(response.error);
        throw new Error(status ? `(${status}) ${message}` : message);
      }

      if (!response.data) {
        throw new Error("Resposta vazia da Edge Function");
      }

      return response.data;
    },
    onSuccess: (data) => {
      if (data.paymentLink) {
        // Abrir link de pagamento em nova aba com fallback para popup bloqueado
        const win = window.open(data.paymentLink, "_blank");
        if (!win) window.location.href = data.paymentLink; // fallback se popup bloquear
        
        toast({
          title: "Link de pagamento gerado",
          description: "Uma nova aba foi aberta com o link de pagamento.",
        });
      }
      
      // Invalidar queries para atualizar dados
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      queryClient.invalidateQueries({ queryKey: ["subscription-payments"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao gerar pagamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Buscar histórico de pagamentos
  const { data: payments } = useQuery({
    queryKey: ["subscription-payments", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("subscription_payments" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data as unknown as SubscriptionPayment[];
    },
    enabled: !!user?.id,
  });

  // Verificar se assinatura está ativa
  const isActive = subscription?.status === "active" || subscription?.status === "trial";
  
  // Verificar se está em trial
  const isTrial = subscription?.status === "trial";
  
  // Verificar se está expirada
  const isExpired = subscription?.status === "expired";
  
  // Calcular dias restantes do trial ou período atual
  const daysRemaining = subscription
    ? Math.ceil(
        (new Date(subscription.current_period_end).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : 0;

  return {
    subscription,
    isLoading,
    error,
    refetch,
    isActive,
    isTrial,
    isExpired,
    daysRemaining,
    payments,
    createPayment: createPaymentMutation.mutate,
    isCreatingPayment: createPaymentMutation.isPending,
  };
}
