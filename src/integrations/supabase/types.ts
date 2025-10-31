export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          created_at: string
          customer_id: string
          description: string | null
          end_time: string
          id: string
          notes: string | null
          payment_method: string | null
          payment_status: string | null
          price: number | null
          proposal_id: string | null
          start_time: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          description?: string | null
          end_time: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_status?: string | null
          price?: number | null
          proposal_id?: string | null
          start_time: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          description?: string | null
          end_time?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_status?: string | null
          price?: number | null
          proposal_id?: string | null
          start_time?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_slots: {
        Row: {
          created_at: string
          end_time: string
          id: string
          reason: string | null
          start_time: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          reason?: string | null
          start_time: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          reason?: string | null
          start_time?: string
          user_id?: string
        }
        Relationships: []
      }
      business_settings: {
        Row: {
          address: string | null
          allow_overbooking: boolean | null
          buffer_time: number | null
          business_name: string
          business_type: string | null
          created_at: string
          id: string
          phone: string | null
          profile_image_url: string | null
          slot_duration: number | null
          updated_at: string
          user_id: string
          working_hours: Json | null
        }
        Insert: {
          address?: string | null
          allow_overbooking?: boolean | null
          buffer_time?: number | null
          business_name: string
          business_type?: string | null
          created_at?: string
          id?: string
          phone?: string | null
          profile_image_url?: string | null
          slot_duration?: number | null
          updated_at?: string
          user_id: string
          working_hours?: Json | null
        }
        Update: {
          address?: string | null
          allow_overbooking?: boolean | null
          buffer_time?: number | null
          business_name?: string
          business_type?: string | null
          created_at?: string
          id?: string
          phone?: string | null
          profile_image_url?: string | null
          slot_duration?: number | null
          updated_at?: string
          user_id?: string
          working_hours?: Json | null
        }
        Relationships: []
      }
      coupons: {
        Row: {
          appointment_id: string | null
          code: string
          created_at: string
          customer_id: string
          discount_amount: number | null
          discount_percentage: number | null
          expires_at: string
          id: string
          is_active: boolean
          updated_at: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          appointment_id?: string | null
          code: string
          created_at?: string
          customer_id: string
          discount_amount?: number | null
          discount_percentage?: number | null
          expires_at: string
          id?: string
          is_active?: boolean
          updated_at?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          appointment_id?: string | null
          code?: string
          created_at?: string
          customer_id?: string
          discount_amount?: number | null
          discount_percentage?: number | null
          expires_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupons_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          cpf: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_categories: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          type: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          type: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_transactions: {
        Row: {
          amount: number
          appointment_id: string | null
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          payment_method: string | null
          status: string
          transaction_date: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          payment_method?: string | null
          status?: string
          transaction_date?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          payment_method?: string | null
          status?: string
          transaction_date?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: string | null
          cost_price: number | null
          created_at: string
          current_stock: number
          description: string | null
          id: string
          image_url: string | null
          is_kit: boolean
          kit_items: Json | null
          minimum_stock: number
          name: string
          sale_price: number | null
          sku: string | null
          tags: string[] | null
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          cost_price?: number | null
          created_at?: string
          current_stock?: number
          description?: string | null
          id?: string
          image_url?: string | null
          is_kit?: boolean
          kit_items?: Json | null
          minimum_stock?: number
          name: string
          sale_price?: number | null
          sku?: string | null
          tags?: string[] | null
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          cost_price?: number | null
          created_at?: string
          current_stock?: number
          description?: string | null
          id?: string
          image_url?: string | null
          is_kit?: boolean
          kit_items?: Json | null
          minimum_stock?: number
          name?: string
          sale_price?: number | null
          sku?: string | null
          tags?: string[] | null
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      loyalty_cards: {
        Row: {
          created_at: string
          current_stamps: number
          customer_id: string
          id: string
          last_visit_at: string | null
          rewards_redeemed: number
          stamps_required: number
          total_visits: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_stamps?: number
          customer_id: string
          id?: string
          last_visit_at?: string | null
          rewards_redeemed?: number
          stamps_required?: number
          total_visits?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_stamps?: number
          customer_id?: string
          id?: string
          last_visit_at?: string | null
          rewards_redeemed?: number
          stamps_required?: number
          total_visits?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_cards_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_stamps: {
        Row: {
          appointment_id: string
          created_at: string
          id: string
          loyalty_card_id: string
          stamps_added: number
        }
        Insert: {
          appointment_id: string
          created_at?: string
          id?: string
          loyalty_card_id: string
          stamps_added?: number
        }
        Update: {
          appointment_id?: string
          created_at?: string
          id?: string
          loyalty_card_id?: string
          stamps_added?: number
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_stamps_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_stamps_loyalty_card_id_fkey"
            columns: ["loyalty_card_id"]
            isOneToOne: false
            referencedRelation: "loyalty_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_views: {
        Row: {
          created_at: string
          id: string
          notification_id: string
          notification_type: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notification_id: string
          notification_type: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notification_id?: string
          notification_type?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: []
      }
      pix_charges: {
        Row: {
          amount: number
          appointment_id: string | null
          created_at: string
          customer_name: string
          customer_phone: string | null
          expires_at: string | null
          id: string
          last_reminder_at: string | null
          metadata: Json | null
          paid_at: string | null
          pix_key: string | null
          qr_code: string | null
          qr_code_image: string | null
          reminders_sent: number | null
          status: string
          transaction_id: string | null
          txid: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          expires_at?: string | null
          id?: string
          last_reminder_at?: string | null
          metadata?: Json | null
          paid_at?: string | null
          pix_key?: string | null
          qr_code?: string | null
          qr_code_image?: string | null
          reminders_sent?: number | null
          status?: string
          transaction_id?: string | null
          txid?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          expires_at?: string | null
          id?: string
          last_reminder_at?: string | null
          metadata?: Json | null
          paid_at?: string | null
          pix_key?: string | null
          qr_code?: string | null
          qr_code_image?: string | null
          reminders_sent?: number | null
          status?: string
          transaction_id?: string | null
          txid?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pix_charges_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pix_charges_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          accepted_at: string | null
          after_images: string[] | null
          appointment_id: string | null
          before_images: string[] | null
          created_at: string
          customer_id: string
          deposit_amount: number | null
          deposit_percentage: number | null
          description: string | null
          discount_amount: number | null
          discount_percentage: number | null
          final_amount: number
          follow_up_sent_at: string | null
          id: string
          notes: string | null
          pix_charge_id: string | null
          rejected_at: string | null
          sent_at: string | null
          services: Json
          signature_data: string | null
          signature_ip: string | null
          status: string
          title: string
          total_amount: number
          updated_at: string
          user_id: string
          valid_until: string
          viewed_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          after_images?: string[] | null
          appointment_id?: string | null
          before_images?: string[] | null
          created_at?: string
          customer_id: string
          deposit_amount?: number | null
          deposit_percentage?: number | null
          description?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          final_amount: number
          follow_up_sent_at?: string | null
          id?: string
          notes?: string | null
          pix_charge_id?: string | null
          rejected_at?: string | null
          sent_at?: string | null
          services?: Json
          signature_data?: string | null
          signature_ip?: string | null
          status?: string
          title: string
          total_amount: number
          updated_at?: string
          user_id: string
          valid_until: string
          viewed_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          after_images?: string[] | null
          appointment_id?: string | null
          before_images?: string[] | null
          created_at?: string
          customer_id?: string
          deposit_amount?: number | null
          deposit_percentage?: number | null
          description?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          final_amount?: number
          follow_up_sent_at?: string | null
          id?: string
          notes?: string | null
          pix_charge_id?: string | null
          rejected_at?: string | null
          sent_at?: string | null
          services?: Json
          signature_data?: string | null
          signature_ip?: string | null
          status?: string
          title?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
          valid_until?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_pix_charge_id_fkey"
            columns: ["pix_charge_id"]
            isOneToOne: false
            referencedRelation: "pix_charges"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          appointment_id: string
          comment: string | null
          created_at: string
          customer_id: string
          id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          appointment_id: string
          comment?: string | null
          created_at?: string
          customer_id: string
          id?: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          appointment_id?: string
          comment?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          item_id: string
          new_stock: number
          previous_stock: number
          quantity: number
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          new_stock: number
          previous_stock: number
          quantity: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          new_stock?: number
          previous_stock?: number
          quantity?: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          billing_frequency: string
          created_at: string
          description: string | null
          id: string
          included_services: Json
          is_active: boolean
          name: string
          price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_frequency?: string
          created_at?: string
          description?: string | null
          id?: string
          included_services?: Json
          is_active?: boolean
          name: string
          price: number
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_frequency?: string
          created_at?: string
          description?: string | null
          id?: string
          included_services?: Json
          is_active?: boolean
          name?: string
          price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscription_usage: {
        Row: {
          appointment_id: string | null
          id: string
          service_type: string
          subscription_id: string
          used_at: string
        }
        Insert: {
          appointment_id?: string | null
          id?: string
          service_type: string
          subscription_id: string
          used_at?: string
        }
        Update: {
          appointment_id?: string | null
          id?: string
          service_type?: string
          subscription_id?: string
          used_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          customer_id: string
          failed_payments_count: number
          id: string
          last_billing_date: string | null
          last_payment_attempt: string | null
          next_billing_date: string
          payment_method: string
          plan_id: string
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          failed_payments_count?: number
          id?: string
          last_billing_date?: string | null
          last_payment_attempt?: string | null
          next_billing_date: string
          payment_method?: string
          plan_id: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          failed_payments_count?: number
          id?: string
          last_billing_date?: string | null
          last_payment_attempt?: string | null
          next_billing_date?: string
          payment_method?: string
          plan_id?: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string
          id: string
          metadata: Json | null
          priority: string
          related_entity_id: string | null
          related_entity_type: string | null
          status: string
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          metadata?: Json | null
          priority?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          status?: string
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          metadata?: Json | null
          priority?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_low_stock_and_create_tasks: { Args: never; Returns: undefined }
      update_inventory_stock: {
        Args: {
          p_item_id: string
          p_quantity: number
          p_reason?: string
          p_reference_id?: string
          p_reference_type?: string
          p_type: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
