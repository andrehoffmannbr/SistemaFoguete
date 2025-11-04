import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SubscriptionPaymentRequest {
  plan: 'monthly' | 'semiannual' | 'annual';
  paymentMethod: 'pix' | 'credit_card';
}

const PLAN_PRICES = {
  monthly: 97.00,
  semiannual: 582.00,
  annual: 1164.00,
};

const PLAN_NAMES = {
  monthly: 'Plano Mensal - Foguete Gestão',
  semiannual: 'Plano Semestral - Foguete Gestão (7 meses pelo preço de 6)',
  annual: 'Plano Anual - Foguete Gestão (14 meses pelo preço de 12)',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Client para autenticação do usuário (usa ANON_KEY com JWT)
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Client para operações no banco - com fallback resiliente
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    let adminClient;

    if (serviceRoleKey) {
      adminClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        serviceRoleKey
      );
      console.log("Usando SERVICE_ROLE_KEY para operações no banco");
    } else {
      console.warn("SERVICE_ROLE_KEY não disponível, usando authClient com RLS");
      adminClient = authClient; // Fallback para authClient com RLS
    }

    // Verificar usuário autenticado usando authClient
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      throw new Error("Usuário não autenticado");
    }

    const { plan, paymentMethod }: SubscriptionPaymentRequest = await req.json();

    if (!plan || !PLAN_PRICES[plan]) {
      throw new Error("Plano inválido");
    }

    const amount = PLAN_PRICES[plan];
    const planName = PLAN_NAMES[plan];

    // Buscar assinatura do usuário usando adminClient
    const { data: subscription, error: subError } = await adminClient
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (subError && subError.code !== "PGRST116") {
      throw subError;
    }

    // Criar preferência no Mercado Pago
    const mercadoPagoAccessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    
    if (!mercadoPagoAccessToken) {
      console.warn("MERCADO_PAGO_ACCESS_TOKEN não configurado, usando modo mock");
      
      // Modo MOCK para desenvolvimento
      const mockPaymentId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const { data: paymentRecord, error: insertError } = await adminClient
        .from("subscription_payments")
        .insert({
          user_subscription_id: subscription?.id,
          user_id: user.id,
          plan,
          amount,
          payment_method: paymentMethod,
          mercado_pago_preference_id: `mock_preference_${mockPaymentId}`,
          mercado_pago_payment_link: `https://mpago.la/mock/${mockPaymentId}`,
          status: "pending",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return new Response(
        JSON.stringify({
          success: true,
          paymentLink: paymentRecord.mercado_pago_payment_link,
          paymentId: paymentRecord.id,
          isMockMode: true,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Criar preferência de pagamento no Mercado Pago (MODO REAL)
    const baseUrl = Deno.env.get("BASE_URL") || "http://localhost:8080";
    
    const preferenceData = {
      items: [
        {
          title: planName,
          quantity: 1,
          unit_price: amount,
          currency_id: "BRL",
        },
      ],
      payer: {
        email: user.email,
      },
      back_urls: {
        success: `${baseUrl}/subscription/success`,
        failure: `${baseUrl}/subscription/failure`,
        pending: `${baseUrl}/subscription/pending`,
      },
      auto_return: "approved",
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/subscription-payment-webhook`,
      external_reference: user.id,
      metadata: {
        user_id: user.id,
        plan,
        subscription_id: subscription?.id,
      },
    };

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mercadoPagoAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferenceData),
    });

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text();
      console.error("Erro Mercado Pago:", errorText);
      
      // Mensagens específicas por status code
      let errorMessage = "Erro ao criar preferência no Mercado Pago";
      if (mpResponse.status === 400) {
        errorMessage = "Dados de pagamento inválidos. Verifique as informações.";
      } else if (mpResponse.status === 401) {
        errorMessage = "Erro de autenticação com Mercado Pago. Tente novamente.";
      } else if (mpResponse.status === 429) {
        errorMessage = "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
      } else if (mpResponse.status >= 500) {
        errorMessage = "Mercado Pago temporariamente indisponível. Tente novamente em alguns minutos.";
      }
      
      throw new Error(`${errorMessage} (Status: ${mpResponse.status})`);
    }

    const mpData = await mpResponse.json();

    // Salvar pagamento no banco usando adminClient
    const { data: paymentRecord, error: insertError } = await adminClient
      .from("subscription_payments")
      .insert({
        user_subscription_id: subscription?.id,
        user_id: user.id,
        plan,
        amount,
        payment_method: paymentMethod,
        mercado_pago_preference_id: mpData.id,
        mercado_pago_payment_link: mpData.init_point,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({
        success: true,
        paymentLink: paymentRecord.mercado_pago_payment_link,
        paymentId: paymentRecord.id,
        preferenceId: mpData.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Erro completo:", error);
    
    let errorMessage = "Erro desconhecido";
    let statusCode = 400;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Definir status codes apropriados baseado no tipo de erro
      if (error.message.includes("não autenticado")) {
        statusCode = 401;
      } else if (error.message.includes("Mercado Pago")) {
        statusCode = 502; // Bad Gateway - problema com serviço externo
      } else if (error.message.includes("inválido")) {
        statusCode = 422; // Unprocessable Entity
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        timestamp: new Date().toISOString(),
        service: "create-subscription-payment"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: statusCode,
      }
    );
  }
});
