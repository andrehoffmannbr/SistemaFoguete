import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", // Service role para bypass RLS
    );

    const body = await req.json();
    const { type, data } = body;

    console.log("Webhook recebido:", { type, data });

    // Verificar se é uma notificação de pagamento
    if (type !== "payment") {
      return new Response(
        JSON.stringify({ message: "Tipo de notificação não processado" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const paymentId = data?.id;
    if (!paymentId) {
      throw new Error("ID de pagamento não encontrado");
    }

    // Buscar detalhes do pagamento no Mercado Pago
    const mercadoPagoAccessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    
    if (!mercadoPagoAccessToken) {
      console.warn("MERCADO_PAGO_ACCESS_TOKEN não configurado");
      return new Response(
        JSON.stringify({ error: "Token do Mercado Pago não configurado" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        "Authorization": `Bearer ${mercadoPagoAccessToken}`,
      },
    });

    if (!mpResponse.ok) {
      throw new Error(`Erro ao buscar pagamento: ${mpResponse.status}`);
    }

    const paymentData = await mpResponse.json();
    console.log("Dados do pagamento:", paymentData);

    const userId = paymentData.metadata?.user_id;
    const plan = paymentData.metadata?.plan;
    const status = paymentData.status;

    if (!userId) {
      throw new Error("user_id não encontrado nos metadados");
    }

    // Buscar registro de pagamento no banco
    const { data: paymentRecord, error: fetchError } = await supabaseClient
      .from("subscription_payments")
      .select("*")
      .eq("mercado_pago_preference_id", paymentData.preference_id)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Erro ao buscar pagamento:", fetchError);
    }

    // Atualizar status do pagamento
    const updateData: Record<string, string> = {
      mercado_pago_payment_id: paymentId,
      status: status === "approved" ? "approved" : status,
      updated_at: new Date().toISOString(),
    };

    if (status === "approved") {
      updateData.paid_at = new Date().toISOString();
    }

    if (paymentRecord) {
      const { error: updateError } = await supabaseClient
        .from("subscription_payments")
        .update(updateData)
        .eq("id", paymentRecord.id);

      if (updateError) {
        console.error("Erro ao atualizar pagamento:", updateError);
        throw updateError;
      }
    } else {
      // Criar registro se não existir
      const { error: insertError } = await supabaseClient
        .from("subscription_payments")
        .insert({
          ...updateData,
          user_id: userId,
          plan,
          amount: paymentData.transaction_amount,
          payment_method: paymentData.payment_type_id === "credit_card" ? "credit_card" : "pix",
          mercado_pago_preference_id: paymentData.preference_id,
        });

      if (insertError) {
        console.error("Erro ao inserir pagamento:", insertError);
        throw insertError;
      }
    }

    // Se o pagamento foi aprovado, atualizar assinatura do usuário
    if (status === "approved") {
      const { data: subscription } = await supabaseClient
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", userId)
        .single();

      const now = new Date();
      const periodEnd = new Date(now);

      // Calcular fim do período baseado no plano
      switch (plan) {
        case "monthly":
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          break;
        case "semiannual":
          periodEnd.setMonth(periodEnd.getMonth() + 7); // 7 meses
          break;
        case "annual":
          periodEnd.setMonth(periodEnd.getMonth() + 14); // 14 meses
          break;
        default:
          periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      const subscriptionUpdate = {
        status: "active",
        plan,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        trial_ends_at: null, // Remove trial se existir
        updated_at: now.toISOString(),
      };

      if (subscription) {
        // Atualizar assinatura existente
        const { error: subUpdateError } = await supabaseClient
          .from("user_subscriptions")
          .update(subscriptionUpdate)
          .eq("user_id", userId);

        if (subUpdateError) {
          console.error("Erro ao atualizar assinatura:", subUpdateError);
          throw subUpdateError;
        }
      } else {
        // Criar nova assinatura
        const { error: subInsertError } = await supabaseClient
          .from("user_subscriptions")
          .insert({
            ...subscriptionUpdate,
            user_id: userId,
          });

        if (subInsertError) {
          console.error("Erro ao criar assinatura:", subInsertError);
          throw subInsertError;
        }
      }

      console.log(`Assinatura ativada para usuário ${userId} com plano ${plan}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Webhook processado com sucesso" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Erro ao processar webhook:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
