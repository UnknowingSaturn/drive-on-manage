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
          {
            foreignKeyName: "fk_announcements_company"
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
          created_by: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          allow_late_submissions: boolean | null
          company_id: string
          created_at: string
          default_base_pay: number | null
          default_cover_rate: number | null
          default_parcel_rate: number | null
          email_notifications: boolean | null
          id: string
          late_submission_hours: number | null
          overtime_rate_multiplier: number | null
          payment_day: number | null
          payment_frequency: string | null
          require_eod_screenshot: boolean | null
          require_insurance_upload: boolean | null
          require_license_upload: boolean | null
          require_right_to_work: boolean | null
          require_vehicle_check: boolean | null
          sms_notifications: boolean | null
          standard_work_hours: number | null
          updated_at: string
        }
        Insert: {
          allow_late_submissions?: boolean | null
          company_id: string
          created_at?: string
          default_base_pay?: number | null
          default_cover_rate?: number | null
          default_parcel_rate?: number | null
          email_notifications?: boolean | null
          id?: string
          late_submission_hours?: number | null
          overtime_rate_multiplier?: number | null
          payment_day?: number | null
          payment_frequency?: string | null
          require_eod_screenshot?: boolean | null
          require_insurance_upload?: boolean | null
          require_license_upload?: boolean | null
          require_right_to_work?: boolean | null
          require_vehicle_check?: boolean | null
          sms_notifications?: boolean | null
          standard_work_hours?: number | null
          updated_at?: string
        }
        Update: {
          allow_late_submissions?: boolean | null
          company_id?: string
          created_at?: string
          default_base_pay?: number | null
          default_cover_rate?: number | null
          default_parcel_rate?: number | null
          email_notifications?: boolean | null
          id?: string
          late_submission_hours?: number | null
          overtime_rate_multiplier?: number | null
          payment_day?: number | null
          payment_frequency?: string | null
          require_eod_screenshot?: boolean | null
          require_insurance_upload?: boolean | null
          require_license_upload?: boolean | null
          require_right_to_work?: boolean | null
          require_vehicle_check?: boolean | null
          sms_notifications?: boolean | null
          standard_work_hours?: number | null
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
      driver_achievements: {
        Row: {
          achievement_name: string
          achievement_type: string
          badge_icon: string | null
          company_id: string
          created_at: string
          description: string | null
          driver_id: string
          earned_at: string
          id: string
          is_completed: boolean
          progress_value: number | null
          target_value: number | null
        }
        Insert: {
          achievement_name: string
          achievement_type: string
          badge_icon?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          driver_id: string
          earned_at?: string
          id?: string
          is_completed?: boolean
          progress_value?: number | null
          target_value?: number | null
        }
        Update: {
          achievement_name?: string
          achievement_type?: string
          badge_icon?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          driver_id?: string
          earned_at?: string
          id?: string
          is_completed?: boolean
          progress_value?: number | null
          target_value?: number | null
        }
        Relationships: []
      }
      driver_earnings: {
        Row: {
          adjustments: number | null
          base_pay: number | null
          bonus_pay: number | null
          company_id: string
          created_at: string
          driver_id: string
          earning_date: string
          eod_report_id: string | null
          id: string
          overtime_pay: number | null
          parcel_pay: number | null
          total_earnings: number
          updated_at: string
        }
        Insert: {
          adjustments?: number | null
          base_pay?: number | null
          bonus_pay?: number | null
          company_id: string
          created_at?: string
          driver_id: string
          earning_date?: string
          eod_report_id?: string | null
          id?: string
          overtime_pay?: number | null
          parcel_pay?: number | null
          total_earnings: number
          updated_at?: string
        }
        Update: {
          adjustments?: number | null
          base_pay?: number | null
          bonus_pay?: number | null
          company_id?: string
          created_at?: string
          driver_id?: string
          earning_date?: string
          eod_report_id?: string | null
          id?: string
          overtime_pay?: number | null
          parcel_pay?: number | null
          total_earnings?: number
          updated_at?: string
        }
        Relationships: []
      }
      driver_expenses: {
        Row: {
          admin_notes: string | null
          amount: number
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string
          description: string | null
          driver_id: string
          expense_date: string
          expense_type: string
          id: string
          is_approved: boolean | null
          receipt_url: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          driver_id: string
          expense_date?: string
          expense_type: string
          id?: string
          is_approved?: boolean | null
          receipt_url?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          driver_id?: string
          expense_date?: string
          expense_type?: string
          id?: string
          is_approved?: boolean | null
          receipt_url?: string | null
          updated_at?: string
        }
        Relationships: []
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
      driver_invoices: {
        Row: {
          billing_period_end: string
          billing_period_start: string
          company_id: string
          created_at: string
          driver_id: string
          generated_by: string
          id: string
          invoice_number: string
          paid_at: string | null
          parcel_rate: number
          sent_at: string | null
          status: string
          total_amount: number
          total_parcels: number
          updated_at: string
        }
        Insert: {
          billing_period_end: string
          billing_period_start: string
          company_id: string
          created_at?: string
          driver_id: string
          generated_by: string
          id?: string
          invoice_number: string
          paid_at?: string | null
          parcel_rate?: number
          sent_at?: string | null
          status?: string
          total_amount?: number
          total_parcels?: number
          updated_at?: string
        }
        Update: {
          billing_period_end?: string
          billing_period_start?: string
          company_id?: string
          created_at?: string
          driver_id?: string
          generated_by?: string
          id?: string
          invoice_number?: string
          paid_at?: string | null
          parcel_rate?: number
          sent_at?: string | null
          status?: string
          total_amount?: number
          total_parcels?: number
          updated_at?: string
        }
        Relationships: []
      }
      driver_profiles: {
        Row: {
          assigned_van_id: string | null
          avatar_url: string | null
          company_id: string
          cover_rate: number | null
          created_at: string
          driving_license_document: string | null
          driving_license_number: string | null
          employee_id: string | null
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
          cover_rate?: number | null
          created_at?: string
          driving_license_document?: string | null
          driving_license_number?: string | null
          employee_id?: string | null
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
          cover_rate?: number | null
          created_at?: string
          driving_license_document?: string | null
          driving_license_number?: string | null
          employee_id?: string | null
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
          {
            foreignKeyName: "fk_driver_profiles_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_driver_profiles_user_id"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      driver_ratings: {
        Row: {
          communication: number
          company_id: string
          created_at: string
          customer_service: number
          driver_id: string
          feedback_text: string | null
          id: string
          is_anonymous: boolean
          overall_rating: number
          punctuality: number
          rated_by: string
          rating_period_end: string
          rating_period_start: string
          vehicle_care: number
        }
        Insert: {
          communication?: number
          company_id: string
          created_at?: string
          customer_service?: number
          driver_id: string
          feedback_text?: string | null
          id?: string
          is_anonymous?: boolean
          overall_rating?: number
          punctuality?: number
          rated_by: string
          rating_period_end: string
          rating_period_start: string
          vehicle_care?: number
        }
        Update: {
          communication?: number
          company_id?: string
          created_at?: string
          customer_service?: number
          driver_id?: string
          feedback_text?: string | null
          id?: string
          is_anonymous?: boolean
          overall_rating?: number
          punctuality?: number
          rated_by?: string
          rating_period_end?: string
          rating_period_start?: string
          vehicle_care?: number
        }
        Relationships: []
      }
      eod_reports: {
        Row: {
          actual_pay: number | null
          admin_notes: string | null
          approved_at: string | null
          approved_by: string | null
          company_id: string
          cover_confirmed: boolean | null
          cover_confirmed_at: string | null
          cover_confirmed_by: string | null
          cover_parcels: number | null
          created_at: string
          driver_id: string
          estimated_pay: number | null
          id: string
          issues_reported: string | null
          log_date: string
          manager_notes: string | null
          parcels_delivered: number
          screenshot_url: string | null
          status: string
          timestamp: string
          updated_at: string
          van_id: string | null
        }
        Insert: {
          actual_pay?: number | null
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          cover_confirmed?: boolean | null
          cover_confirmed_at?: string | null
          cover_confirmed_by?: string | null
          cover_parcels?: number | null
          created_at?: string
          driver_id: string
          estimated_pay?: number | null
          id?: string
          issues_reported?: string | null
          log_date?: string
          manager_notes?: string | null
          parcels_delivered: number
          screenshot_url?: string | null
          status?: string
          timestamp?: string
          updated_at?: string
          van_id?: string | null
        }
        Update: {
          actual_pay?: number | null
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          cover_confirmed?: boolean | null
          cover_confirmed_at?: string | null
          cover_confirmed_by?: string | null
          cover_parcels?: number | null
          created_at?: string
          driver_id?: string
          estimated_pay?: number | null
          id?: string
          issues_reported?: string | null
          log_date?: string
          manager_notes?: string | null
          parcels_delivered?: number
          screenshot_url?: string | null
          status?: string
          timestamp?: string
          updated_at?: string
          van_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_eod_reports_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_eod_reports_driver"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
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
            foreignKeyName: "fk_incident_reports_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_incident_reports_driver"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
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
      invitation_audit_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          invitation_id: string | null
          ip_address: string | null
          performed_by: string
          user_agent: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          invitation_id?: string | null
          ip_address?: string | null
          performed_by: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          invitation_id?: string | null
          ip_address?: string | null
          performed_by?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      invitation_rate_limits: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          invitations_sent: number | null
          updated_at: string | null
          user_id: string
          window_start: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          invitations_sent?: number | null
          updated_at?: string | null
          user_id: string
          window_start?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          invitations_sent?: number | null
          updated_at?: string | null
          user_id?: string
          window_start?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          company_id: string
          content: string
          created_at: string
          id: string
          is_edited: boolean
          message_type: string
          replied_to: string | null
          sender_id: string
          sender_name: string
          sender_role: string
          updated_at: string
        }
        Insert: {
          company_id: string
          content: string
          created_at?: string
          id?: string
          is_edited?: boolean
          message_type?: string
          replied_to?: string | null
          sender_id: string
          sender_name: string
          sender_role?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string
          id?: string
          is_edited?: boolean
          message_type?: string
          replied_to?: string | null
          sender_id?: string
          sender_name?: string
          sender_role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_replied_to_fkey"
            columns: ["replied_to"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      operating_costs: {
        Row: {
          amount: number
          category: string
          company_id: string
          created_at: string
          created_by: string
          date: string
          description: string
          id: string
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          company_id: string
          created_at?: string
          created_by: string
          date: string
          description: string
          id?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          company_id?: string
          created_at?: string
          created_by?: string
          date?: string
          description?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          admin_notes: string | null
          base_pay: number | null
          company_id: string
          cover_parcels: number | null
          cover_rate: number | null
          created_at: string
          created_by: string
          driver_id: string
          eod_report_id: string
          exported_at: string | null
          exported_by: string | null
          id: string
          locked: boolean
          manually_adjusted: boolean
          parcel_count: number
          parcel_rate: number
          period_end: string
          period_start: string
          rate_breakdown: Json | null
          route_rate: number | null
          status: string
          total_pay: number
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          base_pay?: number | null
          company_id: string
          cover_parcels?: number | null
          cover_rate?: number | null
          created_at?: string
          created_by: string
          driver_id: string
          eod_report_id: string
          exported_at?: string | null
          exported_by?: string | null
          id?: string
          locked?: boolean
          manually_adjusted?: boolean
          parcel_count?: number
          parcel_rate: number
          period_end: string
          period_start: string
          rate_breakdown?: Json | null
          route_rate?: number | null
          status?: string
          total_pay: number
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          base_pay?: number | null
          company_id?: string
          cover_parcels?: number | null
          cover_rate?: number | null
          created_at?: string
          created_by?: string
          driver_id?: string
          eod_report_id?: string
          exported_at?: string | null
          exported_by?: string | null
          id?: string
          locked?: boolean
          manually_adjusted?: boolean
          parcel_count?: number
          parcel_rate?: number
          period_end?: string
          period_start?: string
          rate_breakdown?: Json | null
          route_rate?: number | null
          status?: string
          total_pay?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_payments_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_payments_driver"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_payments_eod_report"
            columns: ["eod_report_id"]
            isOneToOne: false
            referencedRelation: "eod_reports"
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
          rate: number | null
          road_lists: string[] | null
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
          rate?: number | null
          road_lists?: string[] | null
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
          rate?: number | null
          road_lists?: string[] | null
          round_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_rounds_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      route_feedback: {
        Row: {
          company_id: string
          created_at: string
          depot_experience: number | null
          driver_id: string
          eod_report_id: string | null
          feedback_date: string
          id: string
          notes: string | null
          round_id: string | null
          route_difficulty: number | null
          traffic_rating: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          depot_experience?: number | null
          driver_id: string
          eod_report_id?: string | null
          feedback_date?: string
          id?: string
          notes?: string | null
          round_id?: string | null
          route_difficulty?: number | null
          traffic_rating?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          depot_experience?: number | null
          driver_id?: string
          eod_report_id?: string | null
          feedback_date?: string
          id?: string
          notes?: string | null
          round_id?: string | null
          route_difficulty?: number | null
          traffic_rating?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      schedules: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          driver_id: string
          driver_rate: number | null
          id: string
          round_id: string
          scheduled_date: string
          status: string
          updated_at: string
          week_start_date: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          driver_id: string
          driver_rate?: number | null
          id?: string
          round_id: string
          scheduled_date: string
          status?: string
          updated_at?: string
          week_start_date: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          driver_id?: string
          driver_rate?: number | null
          id?: string
          round_id?: string
          scheduled_date?: string
          status?: string
          updated_at?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_schedules_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_schedules_driver"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_schedules_round"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      sod_logs: {
        Row: {
          company_id: string
          created_at: string
          driver_id: string
          id: string
          log_date: string
          notes: string | null
          parcel_count: number
          starting_mileage: number
          timestamp: string
          updated_at: string
          van_confirmed: boolean
          van_id: string | null
          vehicle_check_completed: boolean
          vehicle_check_items: Json | null
        }
        Insert: {
          company_id: string
          created_at?: string
          driver_id: string
          id?: string
          log_date?: string
          notes?: string | null
          parcel_count: number
          starting_mileage: number
          timestamp?: string
          updated_at?: string
          van_confirmed?: boolean
          van_id?: string | null
          vehicle_check_completed?: boolean
          vehicle_check_items?: Json | null
        }
        Update: {
          company_id?: string
          created_at?: string
          driver_id?: string
          id?: string
          log_date?: string
          notes?: string | null
          parcel_count?: number
          starting_mileage?: number
          timestamp?: string
          updated_at?: string
          van_confirmed?: boolean
          van_id?: string | null
          vehicle_check_completed?: boolean
          vehicle_check_items?: Json | null
        }
        Relationships: []
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
            foreignKeyName: "fk_vans_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
      audit_rls_coverage: {
        Args: Record<PropertyKey, never>
        Returns: {
          table_name: string
          rls_enabled: boolean
          policy_count: number
          security_status: string
        }[]
      }
      calculate_driver_invoice_data: {
        Args: {
          driver_id_param: string
          period_start: string
          period_end: string
        }
        Returns: {
          total_parcels: number
          parcel_rate: number
          total_amount: number
        }[]
      }
      calculate_driver_pay: {
        Args: {
          driver_id_param: string
          parcel_count_param: number
          base_pay_param?: number
        }
        Returns: number
      }
      calculate_driver_pay_with_rates: {
        Args: {
          driver_id_param: string
          route_id_param: string
          regular_parcels_param: number
          cover_parcels_param?: number
          base_pay_param?: number
        }
        Returns: Json
      }
      generate_invite_token: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_invoice_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_cleanup_recommendations: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_validation_summary: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      identify_cleanup_candidates: {
        Args: Record<PropertyKey, never>
        Returns: {
          bucket_name: string
          file_path: string
          file_age_days: number
          file_size: number
          should_cleanup: boolean
        }[]
      }
      test_auth_context: {
        Args: Record<PropertyKey, never>
        Returns: {
          current_uid: string
          current_db_role: string
          jwt_claims: Json
          profile_exists: boolean
          profile_data: Json
        }[]
      }
      test_validation_system: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      validate_invitation_token: {
        Args: { token_param: string }
        Returns: boolean
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
