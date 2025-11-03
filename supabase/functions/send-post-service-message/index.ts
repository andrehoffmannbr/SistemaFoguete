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

    // Encontrar agendamentos completados há 24 horas que ainda não receberam feedback
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const twentyFiveHoursAgo = new Date();
    twentyFiveHoursAgo.setHours(twentyFiveHoursAgo.getHours() - 25);

    const { data: completedAppointments, error: fetchError } = await supabaseClient
      .from("appointments")
      .select(`
        *,
        customers (
          id,
          name,
          phone
        ),
        business_settings (
          business_name
        )
      `)
      .eq("status", "completed")
      .gte("end_time", twentyFiveHoursAgo.toISOString())
      .lte("end_time", twentyFourHoursAgo.toISOString())
      .limit(50);

    if (fetchError) {
      throw fetchError;
    }

    if (!completedAppointments || completedAppointments.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "No appointments need post-service messages" 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const results = [];

    for (const appointment of completedAppointments) {
      try {
        // Verificar se já existe review para este agendamento
        const { data: existingReview } = await supabaseClient
          .from("reviews")
          .select("id")
          .eq("appointment_id", appointment.id)
          .single();

        if (existingReview) {
          console.log(`Review already exists for appointment ${appointment.id}`);
          continue;
        }

        const customer = appointment.customers;
        const businessName = appointment.business_settings?.business_name || "Estabelecimento";

        if (!customer || !customer.phone) {
          console.log(`No customer or phone for appointment ${appointment.id}`);
          continue;
        }

        // Gerar cupom de retorno (10% de desconto)
        const couponCode = `RETORNO${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 dias para usar

        const { data: coupon, error: couponError } = await supabaseClient
          .from("coupons")
          .insert({
            user_id: appointment.user_id,
            customer_id: customer.id,
            code: couponCode,
            discount_percentage: 10,
            expires_at: expiresAt.toISOString(),
            is_active: true
          })
          .select()
          .single();

        if (couponError) {
          console.error(`Error creating coupon for appointment ${appointment.id}:`, couponError);
        }

        // Buscar cartão fidelidade do cliente
        const { data: loyaltyCard } = await supabaseClient
          .from("loyalty_cards")
          .select("*")
          .eq("user_id", appointment.user_id)
          .eq("customer_id", customer.id)
          .single();

        const loyaltyMessage = loyaltyCard 
          ? `\n\n🎁 *Cartão Fidelidade:* ${loyaltyCard.current_stamps}/${loyaltyCard.stamps_required} carimbos${loyaltyCard.current_stamps === loyaltyCard.stamps_required - 1 ? " - Próxima visita GRÁTIS! 🎉" : ""}`
          : "";

        // Montar mensagem de WhatsApp
        const whatsappMessage = `
Olá ${customer.name}! 👋

Obrigado por escolher o *${businessName}*! 

Como foi sua experiência conosco? 
Sua opinião é muito importante! ⭐

Por favor, avalie nosso atendimento:
⭐⭐⭐⭐⭐

Deixe sua avaliação no Google:
[LINK_GOOGLE_REVIEW]

Ou no Instagram:
[LINK_INSTAGRAM]
${coupon ? `\n\n🎉 *Cupom de Retorno:* ${couponCode}\n10% de desconto na próxima visita!\nVálido até ${new Date(expiresAt).toLocaleDateString("pt-BR")}` : ""}
${loyaltyMessage}

Esperamos vê-lo(a) em breve! 😊
        `.trim();

        // TODO: Enviar WhatsApp
        const whatsappApiKey = Deno.env.get("WHATSAPP_API_KEY");
        
        if (whatsappApiKey && customer.phone) {
          // Implementar integração com WhatsApp Business API
          // Exemplo (ajustar conforme seu provedor):
          /*
          const response = await fetch("https://api.whatsapp.com/send", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${whatsappApiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              to: customer.phone,
              type: "text",
              text: { body: whatsappMessage }
            })
          });

          if (!response.ok) {
            throw new Error(`WhatsApp API error: ${await response.text()}`);
          }
          */

          console.log(`Would send WhatsApp to ${customer.phone}:`, whatsappMessage);
        }

        // Enviar também por email se disponível
        if (appointment.customers?.email) {
          const resendApiKey = Deno.env.get("RESEND_API_KEY");
          
          if (resendApiKey) {
            try {
              const emailResponse = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${resendApiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  from: `${businessName} <onboarding@resend.dev>`,
                  to: [appointment.customers.email],
                  subject: `Como foi sua experiência no ${businessName}?`,
                  html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                      <h2>Olá ${customer.name}! 👋</h2>
                      <p>Obrigado por escolher o <strong>${businessName}</strong>!</p>
                      <p>Como foi sua experiência conosco? Sua opinião é muito importante! ⭐</p>
                      
                      <div style="background: #f5f5f5; padding: 20px; border-radius: 10px; margin: 20px 0;">
                        <p style="margin: 0;"><strong>Deixe sua avaliação:</strong></p>
                        <p style="font-size: 32px; margin: 10px 0;">⭐⭐⭐⭐⭐</p>
                      </div>

                      <div style="margin: 20px 0;">
                        <a href="[LINK_GOOGLE_REVIEW]" style="display: inline-block; background: #4285f4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Avaliar no Google</a>
                        <a href="[LINK_INSTAGRAM]" style="display: inline-block; background: #e4405f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Avaliar no Instagram</a>
                      </div>

                      ${coupon ? `
                      <div style="background: #10b981; color: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
                        <h3 style="margin: 0 0 10px 0;">🎉 Cupom de Retorno!</h3>
                        <p style="font-size: 24px; font-weight: bold; margin: 10px 0;">${couponCode}</p>
                        <p style="margin: 0;">10% de desconto na próxima visita!</p>
                        <p style="margin: 5px 0; font-size: 14px;">Válido até ${new Date(expiresAt).toLocaleDateString("pt-BR")}</p>
                      </div>
                      ` : ""}

                      ${loyaltyCard ? `
                      <div style="background: #667eea; color: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
                        <h3 style="margin: 0 0 10px 0;">🎁 Cartão Fidelidade</h3>
                        <p style="font-size: 32px; margin: 10px 0;">${loyaltyCard.current_stamps}/${loyaltyCard.stamps_required}</p>
                        <p style="margin: 0;">${loyaltyCard.current_stamps === loyaltyCard.stamps_required - 1 ? "Próxima visita GRÁTIS! 🎉" : `Faltam ${loyaltyCard.stamps_required - loyaltyCard.current_stamps} carimbos para ganhar uma visita grátis!`}</p>
                      </div>
                      ` : ""}

                      <p>Esperamos vê-lo(a) em breve! 😊</p>
                    </div>
                  `,
                }),
              });

              if (!emailResponse.ok) {
                console.error("Error sending email:", await emailResponse.text());
              } else {
                console.log(`Email sent to ${appointment.customers.email}`);
              }
            } catch (emailError) {
              console.error("Error sending email:", emailError);
            }
          }
        }

        results.push({
          appointmentId: appointment.id,
          customerId: customer.id,
          success: true,
          couponGenerated: !!coupon,
        });

      } catch (error: any) {
        console.error(`Error processing appointment ${appointment.id}:`, error);
        results.push({
          appointmentId: appointment.id,
          success: false,
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        appointmentsProcessed: completedAppointments.length,
        results: results
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in post-service message function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Error sending post-service messages",
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