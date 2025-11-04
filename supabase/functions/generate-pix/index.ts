import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PixChargeRequest {
  appointmentId?: string;
  proposalId?: string;
  amount: number;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  description?: string;
}

interface MercadoPagoPixResponse {
  id: number;
  date_created: string;
  date_approved: string | null;
  date_last_updated: string;
  money_release_date: string | null;
  payment_method_id: string;
  payment_type_id: string;
  status: string;
  status_detail: string;
  currency_id: string;
  description: string;
  transaction_amount: number;
  transaction_details: {
    net_received_amount: number;
    total_paid_amount: number;
    overpaid_amount: number;
    installment_amount: number;
  };
  point_of_interaction: {
    type: string;
    transaction_data: {
      qr_code: string;
      qr_code_base64: string;
      ticket_url: string;
    };
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { appointmentId, proposalId, amount, customerName, customerPhone, customerEmail, description }: PixChargeRequest = 
      await req.json();

    if (!amount || amount <= 0) {
      throw new Error("Valor inválido");
    }

    // Get Mercado Pago Access Token from environment
    const mercadoPagoAccessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    
    if (!mercadoPagoAccessToken) {
      console.warn("Mercado Pago não configurado, usando modo MOCK");
      
      // FALLBACK: Mock data for demonstration
      const txid = `MOCK-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const mockQrCode = "00020126580014br.gov.bcb.pix0136" + txid + "5204000053039865802BR5913" + 
                         customerName.slice(0, 25) + "6009SAO PAULO62070503***6304";
      
      // Create Pix charge in database
      const { data: pixCharge, error: pixError } = await supabaseClient
        .from("pix_charges")
        .insert({
          user_id: user.id,
          appointment_id: appointmentId || null,
          txid: txid,
          amount: amount,
          customer_name: customerName,
          customer_phone: customerPhone || null,
          qr_code: mockQrCode,
          qr_code_image: null,
          pix_key: null,
          status: "pending",
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          metadata: {
            description: description || "Pagamento de serviço",
            mock: true
          }
        })
        .select()
        .single();

      if (pixError) throw pixError;

      // Create pending financial transaction
      const { data: transaction } = await supabaseClient
        .from("financial_transactions")
        .insert({
          user_id: user.id,
          appointment_id: appointmentId || null,
          type: "income",
          amount: amount,
          description: `Cobrança Pix - ${customerName}`,
          payment_method: "pix",
          status: "pending"
        })
        .select()
        .single();

      if (transaction) {
        await supabaseClient
          .from("pix_charges")
          .update({ transaction_id: transaction.id })
          .eq("id", pixCharge.id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          charge: pixCharge,
          mock: true,
          message: "Cobrança Pix MOCK gerada (configure MERCADO_PAGO_ACCESS_TOKEN)"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // REAL INTEGRATION: Mercado Pago API
    console.log("Gerando cobrança PIX real via Mercado Pago...");

    const mercadoPagoPayload = {
      transaction_amount: amount,
      description: description || `Pagamento - ${customerName}`,
      payment_method_id: "pix",
      payer: {
        email: customerEmail || "cliente@email.com",
        first_name: customerName.split(" ")[0],
        last_name: customerName.split(" ").slice(1).join(" ") || customerName,
        identification: {
          type: "CPF",
          number: "00000000000" // Pode ser opcional para PIX
        }
      },
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/pix-webhook`,
      metadata: {
        user_id: user.id,
        appointment_id: appointmentId || null,
        proposal_id: proposalId || null,
        customer_phone: customerPhone || null
      }
    };

    const mercadoPagoResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${mercadoPagoAccessToken}`,
        "X-Idempotency-Key": `${user.id}-${Date.now()}`
      },
      body: JSON.stringify(mercadoPagoPayload)
    });

    if (!mercadoPagoResponse.ok) {
      const errorText = await mercadoPagoResponse.text();
      console.error("Mercado Pago API Error:", errorText);
      throw new Error(`Erro Mercado Pago: ${mercadoPagoResponse.status} - ${errorText}`);
    }

    const mercadoPagoData: MercadoPagoPixResponse = await mercadoPagoResponse.json();
    console.log("Mercado Pago Response:", JSON.stringify(mercadoPagoData, null, 2));

    // Extract PIX data
    const qrCode = mercadoPagoData.point_of_interaction?.transaction_data?.qr_code;
    const qrCodeBase64 = mercadoPagoData.point_of_interaction?.transaction_data?.qr_code_base64;
    const ticketUrl = mercadoPagoData.point_of_interaction?.transaction_data?.ticket_url;

    // Create Pix charge in database
    const { data: pixCharge, error: pixError } = await supabaseClient
      .from("pix_charges")
      .insert({
        user_id: user.id,
        appointment_id: appointmentId || null,
        txid: mercadoPagoData.id.toString(),
        amount: amount,
        customer_name: customerName,
        customer_phone: customerPhone || null,
        qr_code: qrCode,
        qr_code_image: qrCodeBase64 ? `data:image/png;base64,${qrCodeBase64}` : null,
        pix_key: ticketUrl,
        status: "pending",
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        metadata: {
          description: description || "Pagamento de serviço",
          mercado_pago_id: mercadoPagoData.id,
          payment_type: mercadoPagoData.payment_type_id,
          status_detail: mercadoPagoData.status_detail
        }
      })
      .select()
      .single();

    if (pixError) throw pixError;

    // Create pending financial transaction
    const { data: transaction } = await supabaseClient
      .from("financial_transactions")
      .insert({
        user_id: user.id,
        appointment_id: appointmentId || null,
        type: "income",
        amount: amount,
        description: `Cobrança Pix - ${customerName}`,
        payment_method: "pix",
        status: "pending"
      })
      .select()
      .single();

    if (transaction) {
      await supabaseClient
        .from("pix_charges")
        .update({ transaction_id: transaction.id })
        .eq("id", pixCharge.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        charge: {
          ...pixCharge,
          qr_code_image: qrCodeBase64 ? `data:image/png;base64,${qrCodeBase64}` : null,
          ticket_url: ticketUrl
        },
        mercado_pago_id: mercadoPagoData.id,
        message: "Cobrança Pix gerada com sucesso!"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error generating Pix charge:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro ao gerar cobrança Pix";
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
