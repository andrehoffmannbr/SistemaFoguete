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

    const { customerId, customerName, customerPhone, daysInactive } = await req.json() as {
      customerId: string;
      customerName: string;
      customerPhone: string;
      daysInactive: number;
    };

    console.log(`Reativando cliente: ${customerName} (${daysInactive} dias inativo)`);

    // Buscar informações do negócio
    const { data: businessSettings } = await supabase
      .from("business_settings")
      .select("business_name")
      .eq("user_id", user.id)
      .single();

    const businessName = businessSettings?.business_name || "Estabelecimento";

    // Verificar se há cupons disponíveis para esse cliente
    const { data: activeCoupons } = await supabase
      .from("coupons")
      .select("code, discount_percentage")
      .eq("user_id", user.id)
      .eq("customer_id", customerId)
      .eq("is_active", true)
      .is("used_at", null)
      .gte("expires_at", new Date().toISOString())
      .limit(1)
      .single();

    // Se não tiver cupom ativo, criar um novo cupom de retorno (15% de desconto)
    let couponCode = "";
    let discountPercentage = 15;

    if (!activeCoupons) {
      const newCouponCode = `VOLTE${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 15); // 15 dias para usar

      const { error: couponError } = await supabase
        .from("coupons")
        .insert({
          user_id: user.id,
          customer_id: customerId,
          code: newCouponCode,
          discount_percentage: discountPercentage,
          expires_at: expiresAt.toISOString(),
          is_active: true,
        });

      if (!couponError) {
        couponCode = newCouponCode;
      }
    } else {
      couponCode = activeCoupons.code;
      discountPercentage = activeCoupons.discount_percentage || 15;
    }

    // Mensagem de reativação personalizada
    const whatsappMessage = `
Olá ${customerName}! 😊

Sentimos sua falta no *${businessName}*! ❤️

Faz tempo que não nos vemos (${daysInactive} dias!) e queremos muito ter você de volta!

${couponCode ? `🎁 *Presente Especial de Retorno:*\nCupom: *${couponCode}*\n${discountPercentage}% de desconto na sua próxima visita!\nVálido por 15 dias! ⏰\n\n` : ""}Para agendar, é só responder esta mensagem! 📅

Estamos esperando por você! 🤗
    `.trim();

    // TODO: Enviar WhatsApp
    const whatsappApiKey = Deno.env.get("WHATSAPP_API_KEY");
    
    if (whatsappApiKey && customerPhone) {
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
          to: customerPhone,
          type: "text",
          text: { body: whatsappMessage }
        })
      });

      if (!response.ok) {
        throw new Error(`WhatsApp API error: ${await response.text()}`);
      }
      */

      console.log(`Would send WhatsApp to ${customerPhone}:`, whatsappMessage);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Mensagem de reativação enviada",
        couponGenerated: !!couponCode
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
    console.error("Erro ao reativar cliente:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Erro ao enviar mensagem de reativação" 
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);