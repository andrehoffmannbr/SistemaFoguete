import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PixChargeRequest {
  appointmentId?: string;
  amount: number;
  customerName: string;
  customerPhone?: string;
  description?: string;
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

    const { appointmentId, amount, customerName, customerPhone, description }: PixChargeRequest = 
      await req.json();

    // TODO: Integrate with your payment provider (Asaas, Mercado Pago, etc)
    // For now, we'll create a mock Pix charge
    
    // Example integration with Asaas (you need to implement this):
    // const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    // const asaasResponse = await fetch("https://api.asaas.com/v3/payments", {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //     "access_token": asaasApiKey
    //   },
    //   body: JSON.stringify({
    //     customer: customerId,
    //     billingType: "PIX",
    //     value: amount,
    //     dueDate: new Date().toISOString().split('T')[0],
    //     description: description || "Pagamento de serviço"
    //   })
    // });
    // const asaasData = await asaasResponse.json();

    // Mock data for demonstration
    const txid = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
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
        status: "pending",
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        metadata: {
          description: description || "Pagamento de serviço"
        }
      })
      .select()
      .single();

    if (pixError) {
      throw pixError;
    }

    // Create pending financial transaction
    const { error: transactionError } = await supabaseClient
      .from("financial_transactions")
      .insert({
        user_id: user.id,
        appointment_id: appointmentId || null,
        type: "income",
        amount: amount,
        description: `Cobrança Pix - ${customerName}`,
        payment_method: "pix",
        status: "pending"
      });

    if (transactionError) {
      console.error("Error creating transaction:", transactionError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        charge: pixCharge,
        message: "Cobrança Pix gerada com sucesso!"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error generating Pix charge:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Erro ao gerar cobrança Pix",
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
