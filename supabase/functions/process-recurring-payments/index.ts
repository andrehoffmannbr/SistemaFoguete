import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Subscription {
  id: string;
  user_id: string;
  customer_id: string;
  plan_id: string;
  next_billing_date: string;
  failed_payments_count: number;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("Starting recurring payment processing...");

    // Fetch subscriptions that are due for billing
    const today = new Date().toISOString();
    const { data: subscriptions, error: subsError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("status", "active")
      .lte("next_billing_date", today);

    if (subsError) {
      console.error("Error fetching subscriptions:", subsError);
      throw subsError;
    }

    console.log(`Found ${subscriptions?.length || 0} subscriptions to process`);

    const results = [];

    for (const subscription of subscriptions || []) {
      try {
        // Fetch plan details
        const { data: plan, error: planError } = await supabase
          .from("subscription_plans")
          .select("*")
          .eq("id", subscription.plan_id)
          .single();

        if (planError) throw planError;

        // Fetch customer details
        const { data: customer, error: customerError } = await supabase
          .from("customers")
          .select("*")
          .eq("id", subscription.customer_id)
          .single();

        if (customerError) throw customerError;

        // Create Pix charge for the subscription payment
        const { data: pixCharge, error: pixError } = await supabase
          .from("pix_charges")
          .insert({
            user_id: subscription.user_id,
            customer_id: subscription.customer_id,
            customer_name: customer.name,
            customer_phone: customer.phone,
            amount: plan.price,
            status: "pending",
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
            metadata: {
              subscription_id: subscription.id,
              plan_name: plan.name,
              billing_type: "recurring",
            },
          })
          .select()
          .single();

        if (pixError) {
          console.error(`Error creating Pix charge for subscription ${subscription.id}:`, pixError);
          
          // Update subscription with failed payment
          await supabase
            .from("subscriptions")
            .update({
              failed_payments_count: subscription.failed_payments_count + 1,
              last_payment_attempt: new Date().toISOString(),
              status: subscription.failed_payments_count + 1 >= 3 ? "payment_failed" : "active",
            })
            .eq("id", subscription.id);

          results.push({
            subscription_id: subscription.id,
            success: false,
            error: pixError.message,
          });
          continue;
        }

        // Calculate next billing date based on frequency
        let nextBillingDate = new Date(subscription.next_billing_date);
        switch (plan.billing_frequency) {
          case "weekly":
            nextBillingDate.setDate(nextBillingDate.getDate() + 7);
            break;
          case "biweekly":
            nextBillingDate.setDate(nextBillingDate.getDate() + 14);
            break;
          case "monthly":
          default:
            nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
            break;
        }

        // Update subscription
        await supabase
          .from("subscriptions")
          .update({
            next_billing_date: nextBillingDate.toISOString(),
            last_billing_date: new Date().toISOString(),
            last_payment_attempt: new Date().toISOString(),
          })
          .eq("id", subscription.id);

        // TODO: Send WhatsApp message with payment link
        console.log(`Created Pix charge for subscription ${subscription.id}, amount: ${plan.price}`);

        results.push({
          subscription_id: subscription.id,
          success: true,
          pix_charge_id: pixCharge.id,
          amount: plan.price,
        });
      } catch (error: any) {
        console.error(`Error processing subscription ${subscription.id}:`, error);
        results.push({
          subscription_id: subscription.id,
          success: false,
          error: error.message,
        });
      }
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in process-recurring-payments:", error);
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
