import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GeneratePixParams {
  amount: number;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  description?: string;
  appointmentId?: string;
  proposalId?: string;
}

export interface PixCharge {
  id: string;
  txid: string;
  amount: number;
  customer_name: string;
  qr_code: string | null;
  qr_code_image: string | null;
  pix_key: string | null;
  status: string;
  expires_at: string | null;
  paid_at: string | null;
  created_at: string;
  metadata?: any;
}

export function usePixPayment() {
  const [loading, setLoading] = useState(false);
  const [pixCharge, setPixCharge] = useState<PixCharge | null>(null);

  const generatePixCharge = async (params: GeneratePixParams): Promise<PixCharge | null> => {
    setLoading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Usuário não autenticado");
      }

      // Call Edge Function to generate PIX
      const { data, error } = await supabase.functions.invoke("generate-pix", {
        body: {
          amount: params.amount,
          customerName: params.customerName,
          customerPhone: params.customerPhone,
          customerEmail: params.customerEmail,
          description: params.description,
          appointmentId: params.appointmentId,
          proposalId: params.proposalId,
        },
      });

      if (error) {
        console.error("Error generating PIX:", error);
        throw error;
      }

      if (!data || !data.success) {
        throw new Error(data?.error || "Erro ao gerar cobrança PIX");
      }

      const charge = data.charge;
      setPixCharge(charge);

      if (data.mock) {
        toast.info("PIX gerado em modo de demonstração");
      } else {
        toast.success("Cobrança PIX gerada com sucesso!");
      }

      return charge;
    } catch (error: any) {
      console.error("Error in generatePixCharge:", error);
      toast.error(error.message || "Erro ao gerar cobrança PIX");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const checkPaymentStatus = async (pixChargeId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from("pix_charges")
        .select("status, paid_at")
        .eq("id", pixChargeId)
        .single();

      if (error) throw error;

      return data.status;
    } catch (error: any) {
      console.error("Error checking payment status:", error);
      toast.error("Erro ao verificar status do pagamento");
      return null;
    }
  };

  const getPixCharge = async (pixChargeId: string): Promise<PixCharge | null> => {
    try {
      const { data, error } = await supabase
        .from("pix_charges")
        .select("*")
        .eq("id", pixChargeId)
        .single();

      if (error) throw error;

      setPixCharge(data as PixCharge);
      return data as PixCharge;
    } catch (error: any) {
      console.error("Error fetching PIX charge:", error);
      return null;
    }
  };

  const cancelPixCharge = async (pixChargeId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("pix_charges")
        .update({ status: "cancelled" })
        .eq("id", pixChargeId);

      if (error) throw error;

      toast.success("Cobrança PIX cancelada");
      return true;
    } catch (error: any) {
      console.error("Error cancelling PIX charge:", error);
      toast.error("Erro ao cancelar cobrança");
      return false;
    }
  };

  return {
    loading,
    pixCharge,
    setPixCharge,
    generatePixCharge,
    checkPaymentStatus,
    getPixCharge,
    cancelPixCharge,
  };
}
