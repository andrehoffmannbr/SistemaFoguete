import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Find all unpaid Pix charges that need reminders
    const reminderThreshold = new Date();
    reminderThreshold.setHours(reminderThreshold.getHours() - 4); // 4 hours ago

    const { data: unpaidCharges, error: fetchError } = await supabaseClient
      .from("pix_charges")
      .select("*")
      .eq("status", "pending")
      .lt("created_at", reminderThreshold.toISOString())
      .or(`last_reminder_at.is.null,last_reminder_at.lt.${reminderThreshold.toISOString()}`)
      .limit(50);

    if (fetchError) {
      throw fetchError;
    }

    if (!unpaidCharges || unpaidCharges.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "No charges need reminders" 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const results = [];

    for (const charge of unpaidCharges) {
      try {
        // TODO: Send WhatsApp reminder
        // This is where you integrate with WhatsApp Business API
        
        const whatsappApiKey = Deno.env.get("WHATSAPP_API_KEY");
        const whatsappNumber = Deno.env.get("WHATSAPP_BUSINESS_NUMBER");

        if (whatsappApiKey && whatsappNumber && charge.customer_phone) {
          // Example integration (adjust based on your WhatsApp provider):
          // const message = `
          //   Olá ${charge.customer_name}! 
          //   
          //   Identificamos que o pagamento de R$ ${charge.amount.toFixed(2)} ainda está pendente.
          //   
          //   Para facilitar, você pode pagar agora usando o Pix:
          //   ${charge.qr_code}
          //   
          //   Qualquer dúvida, estamos à disposição! 😊
          // `;
          
          // await fetch("https://api.whatsapp.com/send", {
          //   method: "POST",
          //   headers: {
          //     "Authorization": `Bearer ${whatsappApiKey}`,
          //     "Content-Type": "application/json"
          //   },
          //   body: JSON.stringify({
          //     to: charge.customer_phone,
          //     type: "text",
          //     text: { body: message }
          //   })
          // });

          console.log(`Reminder would be sent to ${charge.customer_phone} for charge ${charge.id}`);
        }

        // Update reminder tracking
        const { error: updateError } = await supabaseClient
          .from("pix_charges")
          .update({
            reminders_sent: (charge.reminders_sent || 0) + 1,
            last_reminder_at: new Date().toISOString()
          })
          .eq("id", charge.id);

        if (updateError) {
          console.error(`Error updating charge ${charge.id}:`, updateError);
        }

        results.push({
          chargeId: charge.id,
          success: true,
          remindersSent: (charge.reminders_sent || 0) + 1
        });

      } catch (error: any) {
        console.error(`Error sending reminder for charge ${charge.id}:`, error);
        results.push({
          chargeId: charge.id,
          success: false,
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        chargesProcessed: unpaidCharges.length,
        results: results
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in payment reminder function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Error sending reminders",
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
