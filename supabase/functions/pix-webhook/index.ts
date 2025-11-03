import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-signature",
};

interface MercadoPagoWebhookPayload {
  id: number;
  live_mode: boolean;
  type: string;
  date_created: string;
  application_id: number;
  user_id: number;
  version: number;
  api_version: string;
  action: string;
  data: {
    id: string;
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

    // Get webhook payload
    const payload: MercadoPagoWebhookPayload = await req.json();
    console.log("Received Mercado Pago webhook:", JSON.stringify(payload, null, 2));

    // Mercado Pago sends different types of notifications
    // We're interested in "payment" type
    if (payload.type !== "payment") {
      console.log("Ignoring non-payment notification:", payload.type);
      return new Response(
        JSON.stringify({ success: true, message: "Notification type ignored" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get payment details from Mercado Pago API
    const mercadoPagoAccessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!mercadoPagoAccessToken) {
      throw new Error("MERCADO_PAGO_ACCESS_TOKEN not configured");
    }

    const paymentId = payload.data.id;
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${mercadoPagoAccessToken}`,
        "Content-Type": "application/json"
      }
    });

    if (!paymentResponse.ok) {
      const errorText = await paymentResponse.text();
      console.error("Error fetching payment from Mercado Pago:", errorText);
      throw new Error(`Mercado Pago API error: ${paymentResponse.status}`);
    }

    const paymentData = await paymentResponse.json();
    console.log("Payment data:", JSON.stringify(paymentData, null, 2));

    // Find the Pix charge by Mercado Pago ID
    const { data: pixCharge, error: findError } = await supabaseClient
      .from("pix_charges")
      .select("*")
      .eq("txid", paymentId.toString())
      .single();

    if (findError || !pixCharge) {
      console.error("Pix charge not found for payment ID:", paymentId);
      // Return 200 to avoid Mercado Pago retrying
      return new Response(
        JSON.stringify({ success: true, message: "Payment not found in database" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Map Mercado Pago status to our status
    let status = "pending";
    let paidAt: string | null = null;

    switch (paymentData.status) {
      case "approved":
        status = "paid";
        paidAt = paymentData.date_approved || new Date().toISOString();
        break;
      case "pending":
      case "in_process":
        status = "pending";
        break;
      case "rejected":
      case "cancelled":
        status = "cancelled";
        break;
      case "refunded":
      case "charged_back":
        status = "cancelled";
        break;
      default:
        status = "pending";
    }

    // Update Pix charge
    const updateData: any = {
      status: status,
      updated_at: new Date().toISOString(),
      metadata: {
        ...(pixCharge.metadata as any || {}),
        mercado_pago_status: paymentData.status,
        mercado_pago_status_detail: paymentData.status_detail,
        last_webhook_at: new Date().toISOString()
      }
    };

    if (paidAt) {
      updateData.paid_at = paidAt;
    }

    const { error: updateError } = await supabaseClient
      .from("pix_charges")
      .update(updateData)
      .eq("id", pixCharge.id);

    if (updateError) {
      throw updateError;
    }

    // Update financial transaction to completed if payment approved
    if (status === "paid" && pixCharge.transaction_id) {
      await supabaseClient
        .from("financial_transactions")
        .update({
          status: "completed",
          transaction_date: paidAt,
          updated_at: new Date().toISOString()
        })
        .eq("id", pixCharge.transaction_id);

      console.log("Financial transaction marked as completed:", pixCharge.transaction_id);
    }

    // Update appointment payment status if applicable
    if (status === "paid" && pixCharge.appointment_id) {
      await supabaseClient
        .from("appointments")
        .update({
          payment_status: "paid",
          updated_at: new Date().toISOString()
        })
        .eq("id", pixCharge.appointment_id);

      console.log("Appointment payment marked as paid:", pixCharge.appointment_id);
    }

    console.log("Pix charge updated successfully:", pixCharge.id, "Status:", status);

    // TODO: Send WhatsApp/Email confirmation to customer
    // if (status === "paid" && pixCharge.customer_phone) {
    //   await supabase.functions.invoke("send-payment-confirmation", {
    //     body: { pixChargeId: pixCharge.id }
    //   });
    // }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Webhook processed successfully",
        status: status
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error processing Pix webhook:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Error processing webhook",
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
