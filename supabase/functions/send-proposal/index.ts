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

const generateProposalHTML = (proposal: any, businessName: string): string => {
  const services = proposal.services as any[];
  const servicesHTML = services
    .map(
      (s) => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px 8px;">${s.description}</td>
        <td style="padding: 12px 8px; text-align: center;">${s.quantity}</td>
        <td style="padding: 12px 8px; text-align: right;">${formatCurrency(s.unit_price)}</td>
        <td style="padding: 12px 8px; text-align: right; font-weight: bold;">${formatCurrency(s.quantity * s.unit_price)}</td>
      </tr>
    `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Proposta - ${proposal.title}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 800px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px;">
        <h1 style="margin: 0 0 10px 0; font-size: 32px;">Proposta de Serviço</h1>
        <p style="margin: 0; font-size: 18px; opacity: 0.9;">${businessName}</p>
      </div>

      <div style="background: white; padding: 25px; border-radius: 10px; margin-bottom: 25px; border: 1px solid #e5e7eb;">
        <h2 style="margin: 0 0 15px 0; color: #374151; font-size: 24px;">${proposal.title}</h2>
        ${proposal.description ? `<p style="color: #6b7280; margin-top: 10px;">${proposal.description}</p>` : ""}
      </div>

      <div style="background: white; padding: 25px; border-radius: 10px; margin-bottom: 25px; border: 1px solid #e5e7eb;">
        <h3 style="margin: 0 0 15px 0; color: #374151; font-size: 20px;">Serviços</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
              <th style="padding: 12px 8px; text-align: left; font-weight: 600;">Descrição</th>
              <th style="padding: 12px 8px; text-align: center; font-weight: 600;">Qtd</th>
              <th style="padding: 12px 8px; text-align: right; font-weight: 600;">Valor Unit.</th>
              <th style="padding: 12px 8px; text-align: right; font-weight: 600;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${servicesHTML}
          </tbody>
        </table>
      </div>

      <div style="background: #ecfdf5; padding: 30px; border-radius: 10px; border: 2px solid #10b981; margin-bottom: 25px;">
        <table style="width: 100%;">
          <tr>
            <td style="font-size: 24px; font-weight: bold; color: #374151;">Valor Total</td>
            <td style="text-align: right; font-size: 36px; font-weight: bold; color: #10b981;">
              ${formatCurrency(proposal.final_amount)}
            </td>
          </tr>
          ${proposal.deposit_amount ? `
          <tr>
            <td style="font-size: 16px; color: #6b7280; padding-top: 10px;">Sinal (${proposal.deposit_percentage}%)</td>
            <td style="text-align: right; font-size: 20px; font-weight: bold; color: #667eea; padding-top: 10px;">
              ${formatCurrency(proposal.deposit_amount)}
            </td>
          </tr>
          ` : ""}
        </table>
      </div>

      <div style="background: #fef3c7; padding: 20px; border-radius: 10px; border: 1px solid #fbbf24; margin-bottom: 25px;">
        <p style="margin: 0; font-size: 14px; color: #92400e;">
          <strong>⏰ Validade:</strong> Esta proposta é válida até ${new Date(proposal.valid_until).toLocaleDateString("pt-BR")}
        </p>
      </div>

      <div style="text-align: center; padding: 20px;">
        <a href="${Deno.env.get("SUPABASE_URL")}/functions/v1/view-proposal?id=${proposal.id}" 
           style="display: inline-block; background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold;">
          Ver Proposta e Aceitar
        </a>
      </div>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
        <p>Proposta gerada em ${new Date().toLocaleDateString("pt-BR")}</p>
      </div>
    </body>
    </html>
  `;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Autorização não fornecida");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Usuário não autenticado");
    }

    const { proposalId } = (await req.json()) as { proposalId: string };

    console.log("Enviando proposta:", proposalId);

    // Buscar proposta com dados do cliente
    const { data: proposal, error: proposalError } = await supabase
      .from("proposals")
      .select(`
        *,
        customers (
          name,
          phone,
          email
        )
      `)
      .eq("id", proposalId)
      .single();

    if (proposalError || !proposal) {
      throw new Error("Proposta não encontrada");
    }

    // Buscar configurações do negócio
    const { data: businessSettings } = await supabase
      .from("business_settings")
      .select("business_name")
      .eq("user_id", user.id)
      .single();

    const businessName = businessSettings?.business_name || "Estabelecimento";

    // Gerar HTML da proposta
    const htmlContent = generateProposalHTML(proposal, businessName);

    // Enviar por email
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey && proposal.customers?.email) {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${businessName} <onboarding@resend.dev>`,
          to: [proposal.customers.email],
          subject: `Proposta: ${proposal.title}`,
          html: htmlContent,
        }),
      });

      if (!emailResponse.ok) {
        console.error("Erro ao enviar email:", await emailResponse.text());
      }
    }

    // TODO: Enviar via WhatsApp
    const whatsappMessage = `
Olá ${proposal.customers?.name}! 👋

Preparamos uma *proposta especial* para você:

📋 *${proposal.title}*
💰 Valor: *${formatCurrency(proposal.final_amount)}*
${proposal.deposit_amount ? `💳 Sinal: *${formatCurrency(proposal.deposit_amount)}*\n` : ""}
⏰ Válida até: ${new Date(proposal.valid_until).toLocaleDateString("pt-BR")}

Para visualizar os detalhes e aceitar a proposta:
👉 ${Deno.env.get("SUPABASE_URL")}/functions/v1/view-proposal?id=${proposal.id}

Estamos à disposição para qualquer dúvida! 😊
    `.trim();

    console.log("Mensagem WhatsApp:", whatsappMessage);

    // Atualizar status da proposta para "sent"
    await supabase
      .from("proposals")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", proposalId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Proposta enviada com sucesso",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Erro ao enviar proposta:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Erro ao enviar proposta",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
});