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

    console.log("Checking for inactive customers...");

    // Get all users
    const { data: users, error: usersError } = await supabase
      .from("customers")
      .select("user_id")
      .not("user_id", "is", null);

    if (usersError) throw usersError;

    const uniqueUserIds = [...new Set(users?.map(u => u.user_id) || [])];
    const results = [];

    for (const userId of uniqueUserIds) {
      // Find customers who haven't had an appointment in 60+ days
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const { data: inactiveCustomers, error: customersError } = await supabase
        .from("customers")
        .select(`
          id,
          name,
          phone,
          email
        `)
        .eq("user_id", userId);

      if (customersError) throw customersError;

      for (const customer of inactiveCustomers || []) {
        // Check last appointment
        const { data: lastAppointment } = await supabase
          .from("appointments")
          .select("end_time")
          .eq("customer_id", customer.id)
          .order("end_time", { ascending: false })
          .limit(1)
          .single();

        const isInactive = !lastAppointment || 
          new Date(lastAppointment.end_time) < sixtyDaysAgo;

        if (isInactive) {
          // Check if task already exists
          const { data: existingTask } = await supabase
            .from("tasks")
            .select("id")
            .eq("user_id", userId)
            .eq("type", "reactivation")
            .eq("related_entity_id", customer.id)
            .eq("status", "pending")
            .single();

          if (!existingTask) {
            // Create reactivation task
            const { error: taskError } = await supabase
              .from("tasks")
              .insert({
                user_id: userId,
                title: `Reativar cliente: ${customer.name}`,
                description: `Cliente inativo há mais de 60 dias. Entre em contato para oferecer promoção ou agendar novo serviço.`,
                type: "reactivation",
                priority: "medium",
                due_date: new Date().toISOString(),
                related_entity_type: "customer",
                related_entity_id: customer.id,
                metadata: {
                  customer_name: customer.name,
                  customer_phone: customer.phone,
                  customer_email: customer.email,
                  last_visit: lastAppointment?.end_time || null,
                },
              });

            if (taskError) {
              console.error(`Error creating task for customer ${customer.id}:`, taskError);
            } else {
              console.log(`Created reactivation task for customer ${customer.name}`);
              results.push({
                customer_id: customer.id,
                customer_name: customer.name,
                status: "task_created",
              });
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        inactive_customers_found: results.length,
        results 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in generate-inactive-customer-tasks:", error);
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
