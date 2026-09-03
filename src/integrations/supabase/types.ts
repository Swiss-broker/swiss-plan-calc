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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_actions: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      admin_messages: {
        Row: {
          broker_id: string
          content: string
          created_at: string
          id: string
          read: boolean
          sender: string
          sender_name: string
        }
        Insert: {
          broker_id: string
          content: string
          created_at?: string
          id?: string
          read?: boolean
          sender: string
          sender_name: string
        }
        Update: {
          broker_id?: string
          content?: string
          created_at?: string
          id?: string
          read?: boolean
          sender?: string
          sender_name?: string
        }
        Relationships: []
      }
      admin_notifications: {
        Row: {
          admin_id: string
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          type: string
        }
        Insert: {
          admin_id: string
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          type: string
        }
        Update: {
          admin_id?: string
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notifications_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string
          display_name: string
          email: string
          id: string
          settings: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          email: string
          id?: string
          settings?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          settings?: Json
          user_id?: string
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          broker_id: string
          client_id: string | null
          created_at: string | null
          id: string
          messages: Json
          updated_at: string | null
        }
        Insert: {
          broker_id: string
          client_id?: string | null
          created_at?: string | null
          id?: string
          messages?: Json
          updated_at?: string | null
        }
        Update: {
          broker_id?: string
          client_id?: string | null
          created_at?: string | null
          id?: string
          messages?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_followup_reminders: {
        Row: {
          appointment_id: string
          id: string
          offset_days: number
          sent_at: string
        }
        Insert: {
          appointment_id: string
          id?: string
          offset_days: number
          sent_at?: string
        }
        Update: {
          appointment_id?: string
          id?: string
          offset_days?: number
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_followup_reminders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_reminders: {
        Row: {
          appointment_id: string
          created_at: string
          id: string
          notified: boolean
          remind_before_minutes: number
        }
        Insert: {
          appointment_id: string
          created_at?: string
          id?: string
          notified?: boolean
          remind_before_minutes: number
        }
        Update: {
          appointment_id?: string
          created_at?: string
          id?: string
          notified?: boolean
          remind_before_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "appointment_reminders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_reports: {
        Row: {
          appointment_id: string
          broker_id: string
          client_id: string | null
          content: string
          created_at: string
          generated_by: string
          id: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          broker_id: string
          client_id?: string | null
          content?: string
          created_at?: string
          generated_by?: string
          id?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          broker_id?: string
          client_id?: string | null
          content?: string
          created_at?: string
          generated_by?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_reports_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_type: string | null
          broker_id: string
          client_id: string | null
          completed_at: string | null
          created_at: string
          duration_minutes: number
          id: string
          location: string | null
          note: string | null
          starts_at: string
          status: string
          title: string
          updated_at: string
          video_link: string | null
        }
        Insert: {
          appointment_type?: string | null
          broker_id: string
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          location?: string | null
          note?: string | null
          starts_at: string
          status?: string
          title: string
          updated_at?: string
          video_link?: string | null
        }
        Update: {
          appointment_type?: string | null
          broker_id?: string
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          location?: string | null
          note?: string | null
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
          video_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_connect_accounts: {
        Row: {
          broker_id: string
          created_at: string
          id: string
          onboarding_complete: boolean
          stripe_account_id: string
          updated_at: string
        }
        Insert: {
          broker_id: string
          created_at?: string
          id?: string
          onboarding_complete?: boolean
          stripe_account_id: string
          updated_at?: string
        }
        Update: {
          broker_id?: string
          created_at?: string
          id?: string
          onboarding_complete?: boolean
          stripe_account_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      cabinet_invites: {
        Row: {
          accepted_at: string | null
          cabinet_root_id: string
          created_at: string
          email: string
          expires_at: string
          first_name: string | null
          id: string
          invited_by: string
          last_name: string | null
          payer: string
          role: string
          status: string
          stripe_subscription_item_id: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          cabinet_root_id: string
          created_at?: string
          email: string
          expires_at?: string
          first_name?: string | null
          id?: string
          invited_by: string
          last_name?: string | null
          payer?: string
          role: string
          status?: string
          stripe_subscription_item_id?: string | null
          token: string
        }
        Update: {
          accepted_at?: string | null
          cabinet_root_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          first_name?: string | null
          id?: string
          invited_by?: string
          last_name?: string | null
          payer?: string
          role?: string
          status?: string
          stripe_subscription_item_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "cabinet_invites_cabinet_root_id_fkey"
            columns: ["cabinet_root_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cabinet_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_assets: {
        Row: {
          bank_accounts: number
          broker_id: string
          client_id: string
          created_at: string
          id: string
          mortgage_debt: number
          mortgage_interest: number
          other_assets: number
          other_debts: number
          real_estate_maintenance: number
          real_estate_rental_value: number
          real_estate_value: number
          securities: number
          updated_at: string
          vehicles: number
        }
        Insert: {
          bank_accounts?: number
          broker_id: string
          client_id: string
          created_at?: string
          id?: string
          mortgage_debt?: number
          mortgage_interest?: number
          other_assets?: number
          other_debts?: number
          real_estate_maintenance?: number
          real_estate_rental_value?: number
          real_estate_value?: number
          securities?: number
          updated_at?: string
          vehicles?: number
        }
        Update: {
          bank_accounts?: number
          broker_id?: string
          client_id?: string
          created_at?: string
          id?: string
          mortgage_debt?: number
          mortgage_interest?: number
          other_assets?: number
          other_debts?: number
          real_estate_maintenance?: number
          real_estate_rental_value?: number
          real_estate_value?: number
          securities?: number
          updated_at?: string
          vehicles?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_assets_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_assets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_document_links: {
        Row: {
          broker_id: string
          client_id: string
          created_at: string
          expires_at: string
          id: string
          last_used_at: string | null
          max_uploads: number
          revoked: boolean
          token: string
          upload_count: number
        }
        Insert: {
          broker_id: string
          client_id: string
          created_at?: string
          expires_at: string
          id?: string
          last_used_at?: string | null
          max_uploads?: number
          revoked?: boolean
          token: string
          upload_count?: number
        }
        Update: {
          broker_id?: string
          client_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          last_used_at?: string | null
          max_uploads?: number
          revoked?: boolean
          token?: string
          upload_count?: number
        }
        Relationships: []
      }
      client_document_requests: {
        Row: {
          broker_id: string
          category: Database["public"]["Enums"]["client_document_category"]
          client_id: string
          created_at: string
          document_id: string | null
          id: string
          link_id: string | null
          note: string | null
          received_at: string | null
          reminder_sent_at: string | null
          requested_at: string
          status: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          broker_id: string
          category: Database["public"]["Enums"]["client_document_category"]
          client_id: string
          created_at?: string
          document_id?: string | null
          id?: string
          link_id?: string | null
          note?: string | null
          received_at?: string | null
          reminder_sent_at?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          broker_id?: string
          category?: Database["public"]["Enums"]["client_document_category"]
          client_id?: string
          created_at?: string
          document_id?: string | null
          id?: string
          link_id?: string | null
          note?: string | null
          received_at?: string | null
          reminder_sent_at?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_document_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_document_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "client_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_document_requests_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "client_document_links"
            referencedColumns: ["id"]
          },
        ]
      }
      client_documents: {
        Row: {
          broker_id: string
          category: Database["public"]["Enums"]["client_document_category"]
          client_id: string
          created_at: string
          id: string
          mime_type: string
          original_filename: string
          size_bytes: number
          storage_path: string
          upload_link_id: string | null
          uploaded_by: Database["public"]["Enums"]["client_document_source"]
        }
        Insert: {
          broker_id: string
          category: Database["public"]["Enums"]["client_document_category"]
          client_id: string
          created_at?: string
          id?: string
          mime_type: string
          original_filename: string
          size_bytes: number
          storage_path: string
          upload_link_id?: string | null
          uploaded_by?: Database["public"]["Enums"]["client_document_source"]
        }
        Update: {
          broker_id?: string
          category?: Database["public"]["Enums"]["client_document_category"]
          client_id?: string
          created_at?: string
          id?: string
          mime_type?: string
          original_filename?: string
          size_bytes?: number
          storage_path?: string
          upload_link_id?: string | null
          uploaded_by?: Database["public"]["Enums"]["client_document_source"]
        }
        Relationships: []
      }
      client_email_log: {
        Row: {
          broker_id: string
          client_id: string
          id: string
          sent_at: string
          subject: string
          template_key: string | null
        }
        Insert: {
          broker_id: string
          client_id: string
          id?: string
          sent_at?: string
          subject: string
          template_key?: string | null
        }
        Update: {
          broker_id?: string
          client_id?: string
          id?: string
          sent_at?: string
          subject?: string
          template_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_email_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_errors: {
        Row: {
          broker_id: string | null
          context: Json | null
          created_at: string
          id: string
          message: string
          stack: string | null
          url: string | null
          user_agent: string | null
        }
        Insert: {
          broker_id?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          message: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
        }
        Update: {
          broker_id?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          message?: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_errors_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_followups: {
        Row: {
          appointment_id: string | null
          broker_id: string
          client_id: string
          created_at: string
          due_date: string | null
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          broker_id: string
          client_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          broker_id?: string
          client_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_followups_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_followups_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          body: string
          broker_id: string
          client_id: string
          created_at: string
          id: string
        }
        Insert: {
          body: string
          broker_id: string
          client_id: string
          created_at?: string
          id?: string
        }
        Update: {
          body?: string
          broker_id?: string
          client_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_pension: {
        Row: {
          broker_id: string
          client_id: string
          created_at: string
          id: string
          lpp_assumptions: Json | null
          lpp_buybacks_done: Json
          lpp_conversion_rate: number | null
          lpp_coordination_deduction: number
          lpp_current_balance: number
          lpp_early_withdrawals: Json
          lpp_insured_salary: number
          lpp_max_buyback: number
          lpp_plan: Database["public"]["Enums"]["lpp_plan_type"]
          lpp_planned_buybacks: Json
          pillar_3a_accounts: Json
          pillar_3a_annual_contribution: number
          pillar_3a_opening_date: string | null
          pillar_3b_accounts: Json
          spouse_lpp_balance: number
          spouse_pillar_3a_balance: number
          updated_at: string
          vested_benefits_accounts: Json
        }
        Insert: {
          broker_id: string
          client_id: string
          created_at?: string
          id?: string
          lpp_assumptions?: Json | null
          lpp_buybacks_done?: Json
          lpp_conversion_rate?: number | null
          lpp_coordination_deduction?: number
          lpp_current_balance?: number
          lpp_early_withdrawals?: Json
          lpp_insured_salary?: number
          lpp_max_buyback?: number
          lpp_plan?: Database["public"]["Enums"]["lpp_plan_type"]
          lpp_planned_buybacks?: Json
          pillar_3a_accounts?: Json
          pillar_3a_annual_contribution?: number
          pillar_3a_opening_date?: string | null
          pillar_3b_accounts?: Json
          spouse_lpp_balance?: number
          spouse_pillar_3a_balance?: number
          updated_at?: string
          vested_benefits_accounts?: Json
        }
        Update: {
          broker_id?: string
          client_id?: string
          created_at?: string
          id?: string
          lpp_assumptions?: Json | null
          lpp_buybacks_done?: Json
          lpp_conversion_rate?: number | null
          lpp_coordination_deduction?: number
          lpp_current_balance?: number
          lpp_early_withdrawals?: Json
          lpp_insured_salary?: number
          lpp_max_buyback?: number
          lpp_plan?: Database["public"]["Enums"]["lpp_plan_type"]
          lpp_planned_buybacks?: Json
          pillar_3a_accounts?: Json
          pillar_3a_annual_contribution?: number
          pillar_3a_opening_date?: string | null
          pillar_3b_accounts?: Json
          spouse_lpp_balance?: number
          spouse_pillar_3a_balance?: number
          updated_at?: string
          vested_benefits_accounts?: Json
        }
        Relationships: [
          {
            foreignKeyName: "client_pension_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_pension_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          activity_rate: number | null
          activity_sector: string | null
          archived: boolean
          arrival_year_ch: number | null
          avs_contribution_start_year: number | null
          bonus: number | null
          broker_id: string
          canton: string | null
          children: Json
          civil_status: Database["public"]["Enums"]["civil_status"]
          commune: string | null
          company_id: string | null
          company_role: string | null
          confession: Database["public"]["Enums"]["confession"]
          country_of_residence: string | null
          created_at: string
          cross_border_start_year: number | null
          date_of_birth: string | null
          email: string | null
          employer: string | null
          first_name: string
          gender: Database["public"]["Enums"]["gender"] | null
          gross_annual_salary: number | null
          id: string
          last_name: string
          mortgage_interest_france: number | null
          nationality: string | null
          other_income: number | null
          parish: string | null
          permit: Database["public"]["Enums"]["permit_type"]
          phone: string | null
          postal_code: string | null
          source_tax_scale: string | null
          spouse_date_of_birth: string | null
          spouse_first_name: string | null
          spouse_gross_annual_salary: number | null
          spouse_last_name: string | null
          spouse_salary_is_fictif: boolean
          spouse_work_location: string | null
          tax_status: Database["public"]["Enums"]["tax_status"]
          tax_status_migrated: boolean
          updated_at: string
          work_status: Database["public"]["Enums"]["work_status"]
        }
        Insert: {
          activity_rate?: number | null
          activity_sector?: string | null
          archived?: boolean
          arrival_year_ch?: number | null
          avs_contribution_start_year?: number | null
          bonus?: number | null
          broker_id: string
          canton?: string | null
          children?: Json
          civil_status?: Database["public"]["Enums"]["civil_status"]
          commune?: string | null
          company_id?: string | null
          company_role?: string | null
          confession?: Database["public"]["Enums"]["confession"]
          country_of_residence?: string | null
          created_at?: string
          cross_border_start_year?: number | null
          date_of_birth?: string | null
          email?: string | null
          employer?: string | null
          first_name: string
          gender?: Database["public"]["Enums"]["gender"] | null
          gross_annual_salary?: number | null
          id?: string
          last_name: string
          mortgage_interest_france?: number | null
          nationality?: string | null
          other_income?: number | null
          parish?: string | null
          permit?: Database["public"]["Enums"]["permit_type"]
          phone?: string | null
          postal_code?: string | null
          source_tax_scale?: string | null
          spouse_date_of_birth?: string | null
          spouse_first_name?: string | null
          spouse_gross_annual_salary?: number | null
          spouse_last_name?: string | null
          spouse_salary_is_fictif?: boolean
          spouse_work_location?: string | null
          tax_status?: Database["public"]["Enums"]["tax_status"]
          tax_status_migrated?: boolean
          updated_at?: string
          work_status?: Database["public"]["Enums"]["work_status"]
        }
        Update: {
          activity_rate?: number | null
          activity_sector?: string | null
          archived?: boolean
          arrival_year_ch?: number | null
          avs_contribution_start_year?: number | null
          bonus?: number | null
          broker_id?: string
          canton?: string | null
          children?: Json
          civil_status?: Database["public"]["Enums"]["civil_status"]
          commune?: string | null
          company_id?: string | null
          company_role?: string | null
          confession?: Database["public"]["Enums"]["confession"]
          country_of_residence?: string | null
          created_at?: string
          cross_border_start_year?: number | null
          date_of_birth?: string | null
          email?: string | null
          employer?: string | null
          first_name?: string
          gender?: Database["public"]["Enums"]["gender"] | null
          gross_annual_salary?: number | null
          id?: string
          last_name?: string
          mortgage_interest_france?: number | null
          nationality?: string | null
          other_income?: number | null
          parish?: string | null
          permit?: Database["public"]["Enums"]["permit_type"]
          phone?: string | null
          postal_code?: string | null
          source_tax_scale?: string | null
          spouse_date_of_birth?: string | null
          spouse_first_name?: string | null
          spouse_gross_annual_salary?: number | null
          spouse_last_name?: string | null
          spouse_salary_is_fictif?: boolean
          spouse_work_location?: string | null
          tax_status?: Database["public"]["Enums"]["tax_status"]
          tax_status_migrated?: boolean
          updated_at?: string
          work_status?: Database["public"]["Enums"]["work_status"]
        }
        Relationships: [
          {
            foreignKeyName: "clients_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          annual_profit: number | null
          annual_revenue: number | null
          archived: boolean
          broker_id: string
          canton: string | null
          created_at: string
          founding_year: number | null
          headcount_fte: number | null
          id: string
          ide_number: string | null
          legal_form: Database["public"]["Enums"]["company_legal_form"]
          legal_name: string
          notes: string | null
          retained_earnings: number | null
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          annual_profit?: number | null
          annual_revenue?: number | null
          archived?: boolean
          broker_id: string
          canton?: string | null
          created_at?: string
          founding_year?: number | null
          headcount_fte?: number | null
          id?: string
          ide_number?: string | null
          legal_form?: Database["public"]["Enums"]["company_legal_form"]
          legal_name: string
          notes?: string | null
          retained_earnings?: number | null
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          annual_profit?: number | null
          annual_revenue?: number | null
          archived?: boolean
          broker_id?: string
          canton?: string | null
          created_at?: string
          founding_year?: number | null
          headcount_fte?: number | null
          id?: string
          ide_number?: string | null
          legal_form?: Database["public"]["Enums"]["company_legal_form"]
          legal_name?: string
          notes?: string | null
          retained_earnings?: number | null
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          broker_id: string
          created_at: string
          id: string
          subject: string
          template_key: string
          updated_at: string
        }
        Insert: {
          body: string
          broker_id: string
          created_at?: string
          id?: string
          subject: string
          template_key: string
          updated_at?: string
        }
        Update: {
          body?: string
          broker_id?: string
          created_at?: string
          id?: string
          subject?: string
          template_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      feedback_messages: {
        Row: {
          content: string
          created_at: string
          feedback_id: string
          id: string
          sender: string
          sender_name: string
        }
        Insert: {
          content: string
          created_at?: string
          feedback_id: string
          id?: string
          sender: string
          sender_name: string
        }
        Update: {
          content?: string
          created_at?: string
          feedback_id?: string
          id?: string
          sender?: string
          sender_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_messages_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "user_feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          broker_id: string
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          broker_id: string
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          type: string
        }
        Update: {
          body?: string | null
          broker_id?: string
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          type?: string
        }
        Relationships: []
      }
      plan_events: {
        Row: {
          broker_id: string
          changed_by: string | null
          created_at: string
          id: string
          new_plan: Database["public"]["Enums"]["broker_plan"]
          previous_plan: Database["public"]["Enums"]["broker_plan"] | null
          reason: string
          stripe_event_id: string | null
        }
        Insert: {
          broker_id: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_plan: Database["public"]["Enums"]["broker_plan"]
          previous_plan?: Database["public"]["Enums"]["broker_plan"] | null
          reason: string
          stripe_event_id?: string | null
        }
        Update: {
          broker_id?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_plan?: Database["public"]["Enums"]["broker_plan"]
          previous_plan?: Database["public"]["Enums"]["broker_plan"] | null
          reason?: string
          stripe_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_events_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_quota_events: {
        Row: {
          broker_id: string
          entity_id: string
          entity_type: string
          id: string
          occurred_at: string
        }
        Insert: {
          broker_id: string
          entity_id: string
          entity_type: string
          id?: string
          occurred_at?: string
        }
        Update: {
          broker_id?: string
          entity_id?: string
          entity_type?: string
          id?: string
          occurred_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          brokerage_name: string | null
          cabinet_role: string | null
          cabinet_root_id: string | null
          created_at: string
          default_canton: string | null
          email: string
          email_signature: string | null
          first_name: string | null
          guides_seen: string[]
          id: string
          last_name: string | null
          logo_url: string | null
          manager_id: string | null
          monthly_target_amount: number | null
          monthly_target_clients: number | null
          pdf_accent_color: string
          pdf_footer_note: string | null
          pdf_primary_color: string
          phone: string | null
          plan: Database["public"]["Enums"]["broker_plan"]
          preferred_language: Database["public"]["Enums"]["app_language"]
          updated_at: string
        }
        Insert: {
          brokerage_name?: string | null
          cabinet_role?: string | null
          cabinet_root_id?: string | null
          created_at?: string
          default_canton?: string | null
          email: string
          email_signature?: string | null
          first_name?: string | null
          guides_seen?: string[]
          id: string
          last_name?: string | null
          logo_url?: string | null
          manager_id?: string | null
          monthly_target_amount?: number | null
          monthly_target_clients?: number | null
          pdf_accent_color?: string
          pdf_footer_note?: string | null
          pdf_primary_color?: string
          phone?: string | null
          plan?: Database["public"]["Enums"]["broker_plan"]
          preferred_language?: Database["public"]["Enums"]["app_language"]
          updated_at?: string
        }
        Update: {
          brokerage_name?: string | null
          cabinet_role?: string | null
          cabinet_root_id?: string | null
          created_at?: string
          default_canton?: string | null
          email?: string
          email_signature?: string | null
          first_name?: string | null
          guides_seen?: string[]
          id?: string
          last_name?: string | null
          logo_url?: string | null
          manager_id?: string | null
          monthly_target_amount?: number | null
          monthly_target_clients?: number | null
          pdf_accent_color?: string
          pdf_footer_note?: string | null
          pdf_primary_color?: string
          phone?: string | null
          plan?: Database["public"]["Enums"]["broker_plan"]
          preferred_language?: Database["public"]["Enums"]["app_language"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_cabinet_root_id_fkey"
            columns: ["cabinet_root_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rdv_invoices: {
        Row: {
          amount_chf: number
          broker_id: string
          client_id: string | null
          created_at: string
          id: string
          pdf_unlocked: boolean
          snapshot_date_of_birth: string | null
          snapshot_email: string | null
          snapshot_first_name: string | null
          snapshot_gender: string | null
          snapshot_last_name: string | null
          snapshot_nationality: string | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_payment_link: string | null
          updated_at: string
        }
        Insert: {
          amount_chf: number
          broker_id: string
          client_id?: string | null
          created_at?: string
          id?: string
          pdf_unlocked?: boolean
          snapshot_date_of_birth?: string | null
          snapshot_email?: string | null
          snapshot_first_name?: string | null
          snapshot_gender?: string | null
          snapshot_last_name?: string | null
          snapshot_nationality?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_payment_link?: string | null
          updated_at?: string
        }
        Update: {
          amount_chf?: number
          broker_id?: string
          client_id?: string | null
          created_at?: string
          id?: string
          pdf_unlocked?: boolean
          snapshot_date_of_birth?: string | null
          snapshot_email?: string | null
          snapshot_first_name?: string | null
          snapshot_gender?: string | null
          snapshot_last_name?: string | null
          snapshot_nationality?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_payment_link?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdv_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_history: {
        Row: {
          broker_id: string
          client_id: string | null
          created_at: string
          gain_dismissed: boolean
          id: string
          inputs: Json
          is_baseline: boolean
          kind: Database["public"]["Enums"]["simulation_kind"]
          note: string | null
          summary: Json
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          broker_id: string
          client_id?: string | null
          created_at?: string
          gain_dismissed?: boolean
          id?: string
          inputs?: Json
          is_baseline?: boolean
          kind: Database["public"]["Enums"]["simulation_kind"]
          note?: string | null
          summary?: Json
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          broker_id?: string
          client_id?: string | null
          created_at?: string
          gain_dismissed?: boolean
          id?: string
          inputs?: Json
          is_baseline?: boolean
          kind?: Database["public"]["Enums"]["simulation_kind"]
          note?: string | null
          summary?: Json
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      simulation_shares: {
        Row: {
          broker_id: string
          created_at: string
          expires_at: string | null
          failed_password_attempts: number
          id: string
          last_viewed_at: string | null
          locked_until: string | null
          max_views: number | null
          password_hash: string | null
          revoked: boolean
          simulation_id: string
          token: string
          updated_at: string
          view_count: number
        }
        Insert: {
          broker_id: string
          created_at?: string
          expires_at?: string | null
          failed_password_attempts?: number
          id?: string
          last_viewed_at?: string | null
          locked_until?: string | null
          max_views?: number | null
          password_hash?: string | null
          revoked?: boolean
          simulation_id: string
          token: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          broker_id?: string
          created_at?: string
          expires_at?: string | null
          failed_password_attempts?: number
          id?: string
          last_viewed_at?: string | null
          locked_until?: string | null
          max_views?: number | null
          password_hash?: string | null
          revoked?: boolean
          simulation_id?: string
          token?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: []
      }
      tax_year_data: {
        Row: {
          canton: string | null
          created_at: string
          data_kind: string
          id: string
          payload: Json
          source: string | null
          tax_year: number
        }
        Insert: {
          canton?: string | null
          created_at?: string
          data_kind: string
          id?: string
          payload: Json
          source?: string | null
          tax_year: number
        }
        Update: {
          canton?: string | null
          created_at?: string
          data_kind?: string
          id?: string
          payload?: Json
          source?: string | null
          tax_year?: number
        }
        Relationships: []
      }
      team_announcements: {
        Row: {
          cabinet_root_id: string
          created_at: string
          id: string
          message: string
          posted_by: string
          target_id: string | null
        }
        Insert: {
          cabinet_root_id: string
          created_at?: string
          id?: string
          message: string
          posted_by: string
          target_id?: string | null
        }
        Update: {
          cabinet_root_id?: string
          created_at?: string
          id?: string
          message?: string
          posted_by?: string
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_announcements_cabinet_root_id_fkey"
            columns: ["cabinet_root_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_announcements_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_announcements_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feedback: {
        Row: {
          admin_reply: string | null
          admin_reply_at: string | null
          admin_reply_by: string | null
          archived: boolean
          broker_id: string
          category: Database["public"]["Enums"]["feedback_category"]
          context: Json
          created_at: string
          id: string
          message: string
          page_path: string | null
          rating: number | null
          status: Database["public"]["Enums"]["feedback_status"]
          subject: string
          updated_at: string
        }
        Insert: {
          admin_reply?: string | null
          admin_reply_at?: string | null
          admin_reply_by?: string | null
          archived?: boolean
          broker_id: string
          category?: Database["public"]["Enums"]["feedback_category"]
          context?: Json
          created_at?: string
          id?: string
          message: string
          page_path?: string | null
          rating?: number | null
          status?: Database["public"]["Enums"]["feedback_status"]
          subject: string
          updated_at?: string
        }
        Update: {
          admin_reply?: string | null
          admin_reply_at?: string | null
          admin_reply_by?: string | null
          archived?: boolean
          broker_id?: string
          category?: Database["public"]["Enums"]["feedback_category"]
          context?: Json
          created_at?: string
          id?: string
          message?: string
          page_path?: string | null
          rating?: number | null
          status?: Database["public"]["Enums"]["feedback_status"]
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      wiki_article_translations: {
        Row: {
          article_id: string
          body_markdown: string
          language: string
          title: string
        }
        Insert: {
          article_id: string
          body_markdown: string
          language: string
          title: string
        }
        Update: {
          article_id?: string
          body_markdown?: string
          language?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "wiki_article_translations_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "wiki_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      wiki_articles: {
        Row: {
          category: string
          created_at: string
          id: string
          published_at: string | null
          slug: string
          sources: Json
          status: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          published_at?: string | null
          slug: string
          sources?: Json
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          published_at?: string | null
          slug?: string
          sources?: Json
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      access_shared_simulation: {
        Args: { _password?: string; _token: string }
        Returns: {
          broker_display: string
          error_code: string
          expires_at: string
          inputs: Json
          kind: string
          note: string
          remaining_views: number
          shared_at: string
          simulation_created_at: string
          summary: Json
          tags: string[]
          title: string
        }[]
      }
      can_view_broker_appointments: {
        Args: { _owner_id: string; _viewer_id: string }
        Returns: boolean
      }
      get_upload_link_info: {
        Args: { _token: string }
        Returns: {
          broker_display: string
          client_first_name: string
          expires_at: string
          link_id: string
          uploads_remaining: number
        }[]
      }
      hash_share_password: {
        Args: { _password: string; _share_id: string }
        Returns: string
      }
      is_admin: { Args: { _uid: string }; Returns: boolean }
      register_client_upload: {
        Args: {
          _category: Database["public"]["Enums"]["client_document_category"]
          _mime_type: string
          _original_filename: string
          _size_bytes: number
          _storage_path: string
          _token: string
        }
        Returns: string
      }
      run_appointment_followup_reminders: { Args: never; Returns: undefined }
      run_check_stuck_rdv_payments: { Args: never; Returns: undefined }
      run_document_request_reminders: { Args: never; Returns: undefined }
      verify_internal_alert_token: {
        Args: { secret_name: string; token: string }
        Returns: boolean
      }
    }
    Enums: {
      app_language: "fr" | "de" | "en" | "it"
      broker_plan:
        | "free"
        | "pro"
        | "enterprise"
        | "trial"
        | "starter"
        | "cabinet"
        | "internal"
        | "expired"
      civil_status:
        | "single"
        | "married"
        | "registered_partnership"
        | "divorced"
        | "widowed"
        | "separated"
      client_document_category:
        | "attestation_lpp"
        | "fiche_salaire"
        | "declaration_fiscale"
        | "piece_identite"
        | "police_3e_pilier"
        | "police_lca"
        | "certificat_avs"
        | "documents_bancaires"
        | "autres"
        | "libre_passage"
      client_document_source: "broker" | "client_link"
      company_legal_form:
        | "sarl"
        | "sa"
        | "cooperative"
        | "association"
        | "other"
      confession:
        | "none"
        | "roman_catholic"
        | "protestant"
        | "christian_catholic"
        | "jewish"
        | "other"
      feedback_category: "bug" | "suggestion" | "calculation" | "ux" | "other"
      feedback_status:
        | "new"
        | "in_review"
        | "planned"
        | "resolved"
        | "dismissed"
      gender: "male" | "female" | "other"
      lpp_plan_type:
        | "mandatory"
        | "extra_mandatory"
        | "executive"
        | "mixed"
        | "plan_1e"
      permit_type: "none" | "B" | "C" | "L" | "Ci" | "F" | "G" | "swiss"
      scenario_kind:
        | "baseline"
        | "marriage"
        | "divorce"
        | "child_birth"
        | "move_canton"
        | "activity_change"
        | "become_self_employed"
        | "real_estate_purchase"
        | "lpp_buyback"
        | "pillar_3a_strategy"
        | "retirement"
        | "other"
      simulation_kind:
        | "income_tax"
        | "source_tax"
        | "lpp"
        | "pillar3a"
        | "retirement"
        | "canton_compare"
        | "investment_compare"
        | "avs_ai"
        | "vested_benefits"
        | "cross_border"
        | "tou"
        | "director_compensation"
        | "tax_global"
        | "health_insurance_france"
        | "overtime"
        | "fx_claim"
      tax_status:
        | "resident"
        | "source_taxed"
        | "cross_border_fr_1983"
        | "cross_border_ge"
        | "tou"
      work_status:
        | "employee"
        | "self_employed"
        | "mixed"
        | "retired"
        | "unemployed"
        | "student"
        | "director"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_language: ["fr", "de", "en", "it"],
      broker_plan: [
        "free",
        "pro",
        "enterprise",
        "trial",
        "starter",
        "cabinet",
        "internal",
        "expired",
      ],
      civil_status: [
        "single",
        "married",
        "registered_partnership",
        "divorced",
        "widowed",
        "separated",
      ],
      client_document_category: [
        "attestation_lpp",
        "fiche_salaire",
        "declaration_fiscale",
        "piece_identite",
        "police_3e_pilier",
        "police_lca",
        "certificat_avs",
        "documents_bancaires",
        "autres",
        "libre_passage",
      ],
      client_document_source: ["broker", "client_link"],
      company_legal_form: ["sarl", "sa", "cooperative", "association", "other"],
      confession: [
        "none",
        "roman_catholic",
        "protestant",
        "christian_catholic",
        "jewish",
        "other",
      ],
      feedback_category: ["bug", "suggestion", "calculation", "ux", "other"],
      feedback_status: ["new", "in_review", "planned", "resolved", "dismissed"],
      gender: ["male", "female", "other"],
      lpp_plan_type: [
        "mandatory",
        "extra_mandatory",
        "executive",
        "mixed",
        "plan_1e",
      ],
      permit_type: ["none", "B", "C", "L", "Ci", "F", "G", "swiss"],
      scenario_kind: [
        "baseline",
        "marriage",
        "divorce",
        "child_birth",
        "move_canton",
        "activity_change",
        "become_self_employed",
        "real_estate_purchase",
        "lpp_buyback",
        "pillar_3a_strategy",
        "retirement",
        "other",
      ],
      simulation_kind: [
        "income_tax",
        "source_tax",
        "lpp",
        "pillar3a",
        "retirement",
        "canton_compare",
        "investment_compare",
        "avs_ai",
        "vested_benefits",
        "cross_border",
        "tou",
        "director_compensation",
        "tax_global",
        "health_insurance_france",
        "overtime",
        "fx_claim",
      ],
      tax_status: [
        "resident",
        "source_taxed",
        "cross_border_fr_1983",
        "cross_border_ge",
        "tou",
      ],
      work_status: [
        "employee",
        "self_employed",
        "mixed",
        "retired",
        "unemployed",
        "student",
        "director",
      ],
    },
  },
} as const
