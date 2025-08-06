export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          company_id: string
          content: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          priority: string | null
          target_audience: string | null
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          content: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          priority?: string | null
          target_audience?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          priority?: string | null
          target_audience?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          subscription_tier: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          subscription_tier?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          subscription_tier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      daily_logs: {
        Row: {
          actual_pay: number | null
          company_id: string
          created_at: string
          driver_id: string
          eod_delivered_count: number | null
          eod_notes: string | null
          eod_screenshot_url: string | null
          eod_timestamp: string | null
          estimated_pay: number | null
          id: string
          log_date: string
          round_id: string | null
          sod_mileage: number | null
          sod_notes: string | null
          sod_parcel_count: number | null
          sod_timestamp: string | null
          status: string | null
          updated_at: string
          van_id: string | null
        }
        Insert: {
          actual_pay?: number | null
          company_id: string
          created_at?: string
          driver_id: string
          eod_delivered_count?: number | null
          eod_notes?: string | null
          eod_screenshot_url?: string | null
          eod_timestamp?: string | null
          estimated_pay?: number | null
          id?: string
          log_date?: string
          round_id?: string | null
          sod_mileage?: number | null
          sod_notes?: string | null
          sod_parcel_count?: number | null
          sod_timestamp?: string | null
          status?: string | null
          updated_at?: string
          van_id?: string | null
        }
        Update: {
          actual_pay?: number | null
          company_id?: string
          created_at?: string
          driver_id?: string
          eod_delivered_count?: number | null
          eod_notes?: string | null
          eod_screenshot_url?: string | null
          eod_timestamp?: string | null
          estimated_pay?: number | null
          id?: string
          log_date?: string
          round_id?: string | null
          sod_mileage?: number | null
          sod_notes?: string | null
          sod_parcel_count?: number | null
          sod_timestamp?: string | null
          status?: string | null
          updated_at?: string
          van_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_logs_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_logs_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_logs_van_id_fkey"
            columns: ["van_id"]
            isOneToOne: false
            referencedRelation: "vans"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_invitations: {
        Row: {
          accepted_at: string | null
          company_id: string
          created_at: string
          created_by: string
          driver_profile_id: string | null
          email: string
          expires_at: string
          first_name: string
          hourly_rate: number | null
          id: string
          invite_token: string
          last_name: string
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          company_id: string
          created_at?: string
          created_by: string
          driver_profile_id?: string | null
          email: string
          expires_at?: string
          first_name: string
          hourly_rate?: number | null
          id?: string
          invite_token: string
          last_name: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          driver_profile_id?: string | null
          email?: string
          expires_at?: string
          first_name?: string
          hourly_rate?: number | null
          id?: string
          invite_token?: string
          last_name?: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      driver_profiles: {
        Row: {
          assigned_van_id: string | null
          avatar_url: string | null
          company_id: string
          created_at: string
          driving_license_document: string | null
          driving_license_number: string | null
          employee_id: string | null
          hourly_rate: number | null
          id: string
          insurance_document: string | null
          license_expiry: string | null
          onboarding_completed_at: string | null
          onboarding_progress: Json | null
          parcel_rate: number | null
          right_to_work_document: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_van_id?: string | null
          avatar_url?: string | null
          company_id: string
          created_at?: string
          driving_license_document?: string | null
          driving_license_number?: string | null
          employee_id?: string | null
          hourly_rate?: number | null
          id?: string
          insurance_document?: string | null
          license_expiry?: string | null
          onboarding_completed_at?: string | null
          onboarding_progress?: Json | null
          parcel_rate?: number | null
          right_to_work_document?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_van_id?: string | null
          avatar_url?: string | null
          company_id?: string
          created_at?: string
          driving_license_document?: string | null
          driving_license_number?: string | null
          employee_id?: string | null
          hourly_rate?: number | null
          id?: string
          insurance_document?: string | null
          license_expiry?: string | null
          onboarding_completed_at?: string | null
          onboarding_progress?: Json | null
          parcel_rate?: number | null
          right_to_work_document?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_profiles_assigned_van_id_fkey"
            columns: ["assigned_van_id"]
            isOneToOne: false
            referencedRelation: "vans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_reports: {
        Row: {
          admin_notes: string | null
          company_id: string
          created_at: string
          description: string
          driver_id: string
          id: string
          incident_date: string
          incident_type: string
          location: string | null
          photos: string[] | null
          status: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          company_id: string
          created_at?: string
          description: string
          driver_id: string
          id?: string
          incident_date?: string
          incident_type: string
          location?: string | null
          photos?: string[] | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          company_id?: string
          created_at?: string
          description?: string
          driver_id?: string
          id?: string
          incident_date?: string
          incident_type?: string
          location?: string | null
          photos?: string[] | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_reports_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          is_active: boolean
          last_name: string | null
          phone: string | null
          updated_at: string
          user_id: string
          user_type: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
          user_type: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
          user_type?: string
        }
        Relationships: []
      }
      rounds: {
        Row: {
          base_rate: number | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          parcel_rate: number | null
          round_number: string
          updated_at: string
        }
        Insert: {
          base_rate?: number | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          parcel_rate?: number | null
          round_number: string
          updated_at?: string
        }
        Update: {
          base_rate?: number | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          parcel_rate?: number | null
          round_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rounds_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      vans: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          make: string | null
          model: string | null
          mot_expiry: string | null
          registration: string
          service_due: string | null
          updated_at: string
          year: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          make?: string | null
          model?: string | null
          mot_expiry?: string | null
          registration: string
          service_due?: string | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          make?: string | null
          model?: string | null
          mot_expiry?: string | null
          registration?: string
          service_due?: string | null
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_checks: {
        Row: {
          check_date: string
          created_at: string
          driver_id: string
          exterior_condition: string | null
          fuel_level: number | null
          id: string
          interior_condition: string | null
          issues_reported: string | null
          mileage: number | null
          photos: string[] | null
          status: string | null
          van_id: string
        }
        Insert: {
          check_date?: string
          created_at?: string
          driver_id: string
          exterior_condition?: string | null
          fuel_level?: number | null
          id?: string
          interior_condition?: string | null
          issues_reported?: string | null
          mileage?: number | null
          photos?: string[] | null
          status?: string | null
          van_id: string
        }
        Update: {
          check_date?: string
          created_at?: string
          driver_id?: string
          exterior_condition?: string | null
          fuel_level?: number | null
          id?: string
          interior_condition?: string | null
          issues_reported?: string | null
          mileage?: number | null
          photos?: string[] | null
          status?: string | null
          van_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_checks_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_checks_van_id_fkey"
            columns: ["van_id"]
            isOneToOne: false
            referencedRelation: "vans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_invite_token: {
        Args: Record<PropertyKey, never>
        Returns: string
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
