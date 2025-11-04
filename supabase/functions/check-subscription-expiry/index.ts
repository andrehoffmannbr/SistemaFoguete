import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", // Service role para bypass RLS
    );

    const now = new Date();
    
    // Buscar todas as assinaturas ativas ou em trial que estão vencidas
    const { data: expiredSubscriptions, error: fetchError } = await supabaseClient
      .from("user_subscriptions")
      .select("*")
      .in("status", ["trial", "active"])
      .lt("current_period_end", now.toISOString());

    if (fetchError) {
      console.error("Erro ao buscar assinaturas expiradas:", fetchError);
      throw fetchError;
    }

    console.log(`Encontradas ${expiredSubscriptions?.length || 0} assinaturas expiradas`);

    if (!expiredSubscriptions || expiredSubscriptions.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Nenhuma assinatura expirada encontrada",
          processed: 0
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Atualizar status das assinaturas expiradas
    const expiredIds = expiredSubscriptions.map(sub => sub.id);
    
    const { error: updateError } = await supabaseClient
      .from("user_subscriptions")
      .update({ 
        status: "expired",
        updated_at: now.toISOString()
      })
      .in("id", expiredIds);

    if (updateError) {
      console.error("Erro ao atualizar assinaturas:", updateError);
      throw updateError;
    }

    console.log(`${expiredSubscriptions.length} assinaturas marcadas como expiradas`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${expiredSubscriptions.length} assinaturas atualizadas`,
        processed: expiredSubscriptions.length,
        subscriptions: expiredSubscriptions.map(sub => ({
          user_id: sub.user_id,
          previous_status: sub.status,
          expired_at: sub.current_period_end
        }))
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Erro ao verificar assinaturas expiradas:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
