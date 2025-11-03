import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("Checking for failed payments...");

    // Fetch expired Pix charges related to subscriptions
    const now = new Date().toISOString();
    const { data: expiredCharges, error: chargesError } = await supabase
      .from("pix_charges")
      .select("*")
      .eq("status", "pending")
      .lt("expires_at", now)
      .not("metadata->>subscription_id", "is", null);

    if (chargesError) {
      console.error("Error fetching expired charges:", chargesError);
      throw chargesError;
    }

    console.log(`Found ${expiredCharges?.length || 0} expired subscription charges`);

    const results = [];

    for (const charge of expiredCharges || []) {
      try {
        const subscriptionId = charge.metadata?.subscription_id;
        
        if (!subscriptionId) continue;

        // Fetch subscription
        const { data: subscription, error: subError } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("id", subscriptionId)
          .single();

        if (subError) throw subError;

        const failedCount = subscription.failed_payments_count + 1;

        // Mark the charge as failed
        await supabase
          .from("pix_charges")
          .update({ status: "expired" })
          .eq("id", charge.id);

        if (failedCount < 3) {
          // Create a second Pix charge attempt
          const { data: newCharge, error: newChargeError } = await supabase
            .from("pix_charges")
            .insert({
              user_id: charge.user_id,
              customer_id: charge.customer_id,
              customer_name: charge.customer_name,
              customer_phone: charge.customer_phone,
              amount: charge.amount,
              status: "pending",
              expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours for retry
              metadata: {
                ...charge.metadata,
                retry_attempt: failedCount,
                original_charge_id: charge.id,
              },
            })
            .select()
            .single();

          if (newChargeError) throw newChargeError;

          // Update subscription
          await supabase
            .from("subscriptions")
            .update({
              failed_payments_count: failedCount,
              last_payment_attempt: new Date().toISOString(),
            })
            .eq("id", subscriptionId);

          // TODO: Send WhatsApp message with new payment link
          console.log(`Created retry charge ${newCharge.id} for subscription ${subscriptionId} (attempt ${failedCount})`);

          results.push({
            subscription_id: subscriptionId,
            action: "retry_created",
            new_charge_id: newCharge.id,
            attempt: failedCount,
          });
        } else {
          // Suspend subscription after 3 failed attempts
          await supabase
            .from("subscriptions")
            .update({
              status: "payment_failed",
              failed_payments_count: failedCount,
              last_payment_attempt: new Date().toISOString(),
            })
            .eq("id", subscriptionId);

          // TODO: Send WhatsApp notification about suspension
          console.log(`Subscription ${subscriptionId} suspended after 3 failed payment attempts`);

          results.push({
            subscription_id: subscriptionId,
            action: "suspended",
            failed_attempts: failedCount,
          });
        }
      } catch (error: any) {
        console.error(`Error handling failed payment for charge ${charge.id}:`, error);
        results.push({
          charge_id: charge.id,
          error: error.message,
        });
      }
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in handle-payment-failure:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
