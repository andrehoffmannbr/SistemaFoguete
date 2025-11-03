import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PixWebhookPayload {
  txid: string;
  status: "paid" | "expired" | "cancelled";
  amount: number;
  paidAt?: string;
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

    // TODO: Verify webhook signature from your payment provider
    // This is critical for security!
    
    const payload: PixWebhookPayload = await req.json();
    console.log("Received Pix webhook:", payload);

    // Find the Pix charge
    const { data: pixCharge, error: findError } = await supabaseClient
      .from("pix_charges")
      .select("*")
      .eq("txid", payload.txid)
      .single();

    if (findError || !pixCharge) {
      console.error("Pix charge not found:", payload.txid);
      return new Response(
        JSON.stringify({ error: "Pix charge not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update Pix charge status
    const updateData: any = {
      status: payload.status,
      updated_at: new Date().toISOString()
    };

    if (payload.status === "paid" && payload.paidAt) {
      updateData.paid_at = payload.paidAt;
    }

    const { error: updateError } = await supabaseClient
      .from("pix_charges")
      .update(updateData)
      .eq("id", pixCharge.id);

    if (updateError) {
      throw updateError;
    }

    // The trigger will automatically:
    // 1. Update appointment payment status
    // 2. Create/update financial transaction
    // 3. Mark as paid in the system

    console.log("Pix charge updated successfully:", pixCharge.id);

    // TODO: Send WhatsApp confirmation message to customer
    // You can call send-whatsapp function here

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Webhook processed successfully" 
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
