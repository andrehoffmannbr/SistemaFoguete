import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Encontrar propostas enviadas há 48 horas sem resposta
    const fortyEightHoursAgo = new Date();
    fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);

    const { data: proposals, error: fetchError } = await supabaseClient
      .from("proposals")
      .select(`
        *,
        customers (
          name,
          phone,
          email
        ),
        business_settings (
          business_name
        )
      `)
      .eq("status", "sent")
      .lt("sent_at", fortyEightHoursAgo.toISOString())
      .is("follow_up_sent_at", null)
      .limit(50);

    if (fetchError) {
      throw fetchError;
    }

    if (!proposals || proposals.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Nenhuma proposta precisa de seguimento",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const results = [];

    for (const proposal of proposals) {
      try {
        const customer = proposal.customers;
        const businessName = proposal.business_settings?.business_name || "Estabelecimento";

        if (!customer || !customer.phone) {
          console.log(`Sem telefone para proposta ${proposal.id}`);
          continue;
        }

        // Mensagem de seguimento
        const followUpMessage = `
Olá ${customer.name}! 👋

Queríamos saber se você teve tempo de ver nossa proposta:

📋 *${proposal.title}*
💰 Valor: *${formatCurrency(proposal.final_amount)}*
⏰ Válida até: ${new Date(proposal.valid_until).toLocaleDateString("pt-BR")}

${proposal.deposit_amount ? `💳 Podemos começar com apenas *${formatCurrency(proposal.deposit_amount)}* de sinal!\n\n` : ""}Ficou com alguma dúvida? Estamos aqui para ajudar! 😊

Para ver e aceitar a proposta:
👉 ${Deno.env.get("SUPABASE_URL")}/functions/v1/view-proposal?id=${proposal.id}
        `.trim();

        // TODO: Enviar WhatsApp
        const whatsappApiKey = Deno.env.get("WHATSAPP_API_KEY");

        if (whatsappApiKey && customer.phone) {
          console.log(`Would send WhatsApp to ${customer.phone}:`, followUpMessage);
        }

        // Enviar também por email se disponível
        if (customer.email) {
          const resendApiKey = Deno.env.get("RESEND_API_KEY");

          if (resendApiKey) {
            try {
              const emailResponse = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${resendApiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  from: `${businessName} <onboarding@resend.dev>`,
                  to: [customer.email],
                  subject: `Lembrete: Proposta ${proposal.title}`,
                  html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                      <h2>Olá ${customer.name}! 👋</h2>
                      <p>Queríamos saber se você teve tempo de ver nossa proposta:</p>
                      
                      <div style="background: #f5f5f5; padding: 20px; border-radius: 10px; margin: 20px 0;">
                        <h3 style="margin: 0 0 10px 0;">${proposal.title}</h3>
                        <p style="margin: 5px 0;"><strong>Valor:</strong> ${formatCurrency(proposal.final_amount)}</p>
                        ${proposal.deposit_amount ? `<p style="margin: 5px 0;"><strong>Sinal:</strong> ${formatCurrency(proposal.deposit_amount)}</p>` : ""}
                        <p style="margin: 5px 0;"><strong>Válida até:</strong> ${new Date(proposal.valid_until).toLocaleDateString("pt-BR")}</p>
                      </div>

                      <p>Ficou com alguma dúvida? Estamos aqui para ajudar! 😊</p>

                      <div style="text-align: center; margin: 30px 0;">
                        <a href="${Deno.env.get("SUPABASE_URL")}/functions/v1/view-proposal?id=${proposal.id}" 
                           style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                          Ver e Aceitar Proposta
                        </a>
                      </div>
                    </div>
                  `,
                }),
              });

              if (!emailResponse.ok) {
                console.error("Erro ao enviar email:", await emailResponse.text());
              }
            } catch (emailError) {
              console.error("Erro ao enviar email:", emailError);
            }
          }
        }

        // Atualizar registro de seguimento
        const { error: updateError } = await supabaseClient
          .from("proposals")
          .update({
            follow_up_sent_at: new Date().toISOString(),
          })
          .eq("id", proposal.id);

        if (updateError) {
          console.error(`Erro ao atualizar proposta ${proposal.id}:`, updateError);
        }

        results.push({
          proposalId: proposal.id,
          success: true,
        });
      } catch (error: any) {
        console.error(`Erro processando proposta ${proposal.id}:`, error);
        results.push({
          proposalId: proposal.id,
          success: false,
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        proposalsProcessed: proposals.length,
        results: results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Erro na função de seguimento:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Erro ao processar seguimentos",
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});