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
      activity_types: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      addresses: {
        Row: {
          city: string
          country: string
          created_at: string
          customer_id: string
          geo_lat: number | null
          geo_lng: number | null
          id: string
          line1: string
          line2: string | null
          normalized_hash: string | null
          postal_code: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          city: string
          country?: string
          created_at?: string
          customer_id: string
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          line1: string
          line2?: string | null
          normalized_hash?: string | null
          postal_code?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          customer_id?: string
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          line1?: string
          line2?: string | null
          normalized_hash?: string | null
          postal_code?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      approved_media: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          description: string | null
          display_order: number | null
          file_path: string
          file_type: string
          id: string
          is_visible: boolean | null
          order_id: string | null
          original_media_id: string | null
          project_name: string | null
          rejection_reason: string | null
          status: string
          thumbnail_path: string | null
          title: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          file_path: string
          file_type: string
          id?: string
          is_visible?: boolean | null
          order_id?: string | null
          original_media_id?: string | null
          project_name?: string | null
          rejection_reason?: string | null
          status?: string
          thumbnail_path?: string | null
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          file_path?: string
          file_type?: string
          id?: string
          is_visible?: boolean | null
          order_id?: string | null
          original_media_id?: string | null
          project_name?: string | null
          rejection_reason?: string | null
          status?: string
          thumbnail_path?: string | null
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approved_media_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "projects_v3"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          assigned_by_user_id: string
          assignee_user_id: string
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string | null
          project_id: string
          stage_key: string | null
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_by_user_id: string
          assignee_user_id: string
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          project_id: string
          stage_key?: string | null
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_by_user_id?: string
          assignee_user_id?: string
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          project_id?: string
          stage_key?: string | null
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_chat_messages: {
        Row: {
          attachments: Json | null
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          attachments?: Json | null
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          attachments?: Json | null
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string | null
          entity: string
          entity_id: string | null
          id: string
          meta: Json | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string | null
          entity: string
          entity_id?: string | null
          id?: string
          meta?: Json | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string | null
          entity?: string
          entity_id?: string | null
          id?: string
          meta?: Json | null
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          answered_at: string | null
          caller_id: string
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          order_id: string
          receiver_id: string
          started_at: string
          status: string
        }
        Insert: {
          answered_at?: string | null
          caller_id: string
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          order_id: string
          receiver_id: string
          started_at?: string
          status?: string
        }
        Update: {
          answered_at?: string | null
          caller_id?: string
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          order_id?: string
          receiver_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "projects_v3"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_request_messages: {
        Row: {
          collection_request_id: string
          created_at: string
          id: string
          is_staff: boolean | null
          message: string
          user_id: string
        }
        Insert: {
          collection_request_id: string
          created_at?: string
          id?: string
          is_staff?: boolean | null
          message: string
          user_id: string
        }
        Update: {
          collection_request_id?: string
          created_at?: string
          id?: string
          is_staff?: boolean | null
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_request_messages_collection_request_id_fkey"
            columns: ["collection_request_id"]
            isOneToOne: false
            referencedRelation: "collection_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          created_at: string
          customer_id: string
          description: string | null
          id: string
          order_id: string
          requested_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id: string
          description?: string | null
          id?: string
          order_id: string
          requested_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          order_id?: string
          requested_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "projects_v3"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_profiles: {
        Row: {
          activity_type_id: string | null
          created_at: string | null
          id: string
          phone_verified: boolean | null
          region_id: string | null
          rejection_reason: string | null
          service_category_id: string | null
          status: string | null
          updated_at: string | null
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          activity_type_id?: string | null
          created_at?: string | null
          id?: string
          phone_verified?: boolean | null
          region_id?: string | null
          rejection_reason?: string | null
          service_category_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          activity_type_id?: string | null
          created_at?: string | null
          id?: string
          phone_verified?: boolean | null
          region_id?: string | null
          rejection_reason?: string | null
          service_category_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contractor_profiles_activity_type_id_fkey"
            columns: ["activity_type_id"]
            isOneToOne: false
            referencedRelation: "service_activity_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_profiles_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_profiles_service_category_id_fkey"
            columns: ["service_category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_services: {
        Row: {
          contractor_id: string
          created_at: string
          id: string
          service_type: string
          sub_type: string | null
        }
        Insert: {
          contractor_id: string
          created_at?: string
          id?: string
          service_type: string
          sub_type?: string | null
        }
        Update: {
          contractor_id?: string
          created_at?: string
          id?: string
          service_type?: string
          sub_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contractor_services_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_verification_requests: {
        Row: {
          activity_type_id: string | null
          company_name: string
          created_at: string | null
          id: string
          phone_number: string
          region_id: string | null
          rejection_reason: string | null
          service_category_id: string | null
          status: string | null
          updated_at: string | null
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          activity_type_id?: string | null
          company_name: string
          created_at?: string | null
          id?: string
          phone_number: string
          region_id?: string | null
          rejection_reason?: string | null
          service_category_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          activity_type_id?: string | null
          company_name?: string
          created_at?: string | null
          id?: string
          phone_number?: string
          region_id?: string | null
          rejection_reason?: string | null
          service_category_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contractor_verification_requests_activity_type_id_fkey"
            columns: ["activity_type_id"]
            isOneToOne: false
            referencedRelation: "activity_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_verification_requests_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_verification_requests_service_category_id_fkey"
            columns: ["service_category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      contractors: {
        Row: {
          address: string | null
          company_name: string
          contact_person: string
          created_at: string
          description: string | null
          email: string
          experience_years: number | null
          id: string
          is_active: boolean
          is_approved: boolean
          phone_number: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          company_name: string
          contact_person: string
          created_at?: string
          description?: string | null
          email: string
          experience_years?: number | null
          id?: string
          is_active?: boolean
          is_approved?: boolean
          phone_number: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          company_name?: string
          contact_person?: string
          created_at?: string
          description?: string | null
          email?: string
          experience_years?: number | null
          id?: string
          is_active?: boolean
          is_approved?: boolean
          phone_number?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string | null
          customer_code: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          customer_code?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          customer_code?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      daily_report_orders: {
        Row: {
          activity_description: string | null
          created_at: string
          daily_report_id: string
          id: string
          notes: string | null
          order_id: string
          row_color: string | null
          service_details: string | null
          team_name: string | null
          updated_at: string
        }
        Insert: {
          activity_description?: string | null
          created_at?: string
          daily_report_id: string
          id?: string
          notes?: string | null
          order_id: string
          row_color?: string | null
          service_details?: string | null
          team_name?: string | null
          updated_at?: string
        }
        Update: {
          activity_description?: string | null
          created_at?: string
          daily_report_id?: string
          id?: string
          notes?: string | null
          order_id?: string
          row_color?: string | null
          service_details?: string | null
          team_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_report_orders_daily_report_id_fkey"
            columns: ["daily_report_id"]
            isOneToOne: false
            referencedRelation: "daily_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_report_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "projects_v3"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_report_staff: {
        Row: {
          amount_received: number | null
          amount_spent: number | null
          created_at: string
          daily_report_id: string
          id: string
          is_cash_box: boolean | null
          notes: string | null
          overtime_hours: number | null
          receiving_notes: string | null
          spending_notes: string | null
          staff_name: string | null
          staff_user_id: string | null
          updated_at: string
          work_status: string
        }
        Insert: {
          amount_received?: number | null
          amount_spent?: number | null
          created_at?: string
          daily_report_id: string
          id?: string
          is_cash_box?: boolean | null
          notes?: string | null
          overtime_hours?: number | null
          receiving_notes?: string | null
          spending_notes?: string | null
          staff_name?: string | null
          staff_user_id?: string | null
          updated_at?: string
          work_status?: string
        }
        Update: {
          amount_received?: number | null
          amount_spent?: number | null
          created_at?: string
          daily_report_id?: string
          id?: string
          is_cash_box?: boolean | null
          notes?: string | null
          overtime_hours?: number | null
          receiving_notes?: string | null
          spending_notes?: string | null
          staff_name?: string | null
          staff_user_id?: string | null
          updated_at?: string
          work_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_report_staff_daily_report_id_fkey"
            columns: ["daily_report_id"]
            isOneToOne: false
            referencedRelation: "daily_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_reports: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          created_at: string
          created_by: string
          id: string
          is_archived: boolean | null
          notes: string | null
          report_date: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_archived?: boolean | null
          notes?: string | null
          report_date: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_archived?: boolean | null
          notes?: string | null
          report_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      districts: {
        Row: {
          created_at: string | null
          id: string
          name: string
          province_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          province_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          province_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "districts_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_pricing_request_media: {
        Row: {
          created_at: string | null
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          mime_type: string | null
          request_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          file_path: string
          file_size?: number | null
          file_type?: string
          id?: string
          mime_type?: string | null
          request_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          mime_type?: string | null
          request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expert_pricing_request_media_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "expert_pricing_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_pricing_requests: {
        Row: {
          address: string
          assigned_expert_id: string | null
          created_at: string | null
          customer_id: string
          description: string | null
          detailed_address: string | null
          dimensions: Json | null
          district_id: string | null
          end_date: string | null
          expert_notes: string | null
          id: string
          location_lat: number | null
          location_lng: number | null
          province_id: string
          requested_date: string | null
          start_date: string | null
          status: string
          subcategory_id: string
          total_price: number | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          address: string
          assigned_expert_id?: string | null
          created_at?: string | null
          customer_id: string
          description?: string | null
          detailed_address?: string | null
          dimensions?: Json | null
          district_id?: string | null
          end_date?: string | null
          expert_notes?: string | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          province_id: string
          requested_date?: string | null
          start_date?: string | null
          status?: string
          subcategory_id: string
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string
          assigned_expert_id?: string | null
          created_at?: string | null
          customer_id?: string
          description?: string | null
          detailed_address?: string | null
          dimensions?: Json | null
          district_id?: string | null
          end_date?: string | null
          expert_notes?: string | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          province_id?: string
          requested_date?: string | null
          start_date?: string | null
          status?: string
          subcategory_id?: string
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expert_pricing_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_pricing_requests_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_pricing_requests_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_pricing_requests_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_employees: {
        Row: {
          created_at: string
          created_by: string
          department: string | null
          full_name: string
          hire_date: string | null
          id: string
          notes: string | null
          phone_number: string
          position: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          department?: string | null
          full_name: string
          hire_date?: string | null
          id?: string
          notes?: string | null
          phone_number: string
          position?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          department?: string | null
          full_name?: string
          hire_date?: string | null
          id?: string
          notes?: string | null
          phone_number?: string
          position?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      internal_staff_profiles: {
        Row: {
          created_at: string | null
          id: string
          phone_verified: boolean | null
          position_id: string | null
          region_id: string | null
          rejection_reason: string | null
          status: string | null
          updated_at: string | null
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          phone_verified?: boolean | null
          position_id?: string | null
          region_id?: string | null
          rejection_reason?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          phone_verified?: boolean | null
          position_id?: string | null
          region_id?: string | null
          rejection_reason?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_staff_profiles_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "organizational_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_staff_profiles_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          created_at: string
          id: string
          name: string
          qty_on_hand: number | null
          qty_reserved: number | null
          sku: string
          tracking: Database["public"]["Enums"]["inventory_tracking"] | null
          unit: string | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          qty_on_hand?: number | null
          qty_reserved?: number | null
          sku: string
          tracking?: Database["public"]["Enums"]["inventory_tracking"] | null
          unit?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          qty_on_hand?: number | null
          qty_reserved?: number | null
          sku?: string
          tracking?: Database["public"]["Enums"]["inventory_tracking"] | null
          unit?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      inventory_reservations: {
        Row: {
          created_at: string
          id: string
          qty: number
          service_id: string
          sku: string
          status: Database["public"]["Enums"]["reservation_status"] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          qty: number
          service_id: string
          sku: string
          status?: Database["public"]["Enums"]["reservation_status"] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          qty?: number
          service_id?: string
          sku?: string
          status?: Database["public"]["Enums"]["reservation_status"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_reservations_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          currency: string | null
          due_at: string | null
          id: string
          issued_at: string | null
          number: string
          service_id: string
          status: Database["public"]["Enums"]["invoice_status"]
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          due_at?: string | null
          id?: string
          issued_at?: string | null
          number: string
          service_id: string
          status?: Database["public"]["Enums"]["invoice_status"]
          total: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          due_at?: string | null
          id?: string
          issued_at?: string | null
          number?: string
          service_id?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: true
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address_line: string
          created_at: string | null
          district_id: string | null
          id: string
          is_active: boolean | null
          lat: number
          lng: number
          province_id: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address_line: string
          created_at?: string | null
          district_id?: string | null
          id?: string
          is_active?: boolean | null
          lat: number
          lng: number
          province_id?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address_line?: string
          created_at?: string | null
          district_id?: string | null
          id?: string
          is_active?: boolean | null
          lat?: number
          lng?: number
          province_id?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      module_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          assigned_phone_number: string
          assigned_user_id: string | null
          created_at: string
          id: string
          is_active: boolean | null
          module_key: string
          module_name: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          assigned_phone_number: string
          assigned_user_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          module_key: string
          module_name: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          assigned_phone_number?: string
          assigned_user_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          module_key?: string
          module_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      module_hierarchy_states: {
        Row: {
          created_at: string
          custom_names: Json
          hierarchy: Json
          id: string
          owner_user_id: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_names?: Json
          hierarchy?: Json
          id?: string
          owner_user_id: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_names?: Json
          hierarchy?: Json
          id?: string
          owner_user_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      najva_subscriptions: {
        Row: {
          created_at: string
          device_info: Json | null
          id: string
          subscriber_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: Json | null
          id?: string
          subscriber_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: Json | null
          id?: string
          subscriber_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string | null
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      order_approvals: {
        Row: {
          approved_at: string | null
          approver_role: string
          approver_user_id: string | null
          created_at: string | null
          id: string
          order_id: string
          subcategory_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approver_role: string
          approver_user_id?: string | null
          created_at?: string | null
          id?: string
          order_id: string
          subcategory_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approver_role?: string
          approver_user_id?: string | null
          created_at?: string | null
          id?: string
          order_id?: string
          subcategory_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_approvals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "projects_v3"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_approvals_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      order_collaborators: {
        Row: {
          created_at: string
          id: string
          invited_at: string
          invitee_phone_number: string
          invitee_user_id: string | null
          inviter_user_id: string
          order_id: string
          responded_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_at?: string
          invitee_phone_number: string
          invitee_user_id?: string | null
          inviter_user_id: string
          order_id: string
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_at?: string
          invitee_phone_number?: string
          invitee_user_id?: string | null
          inviter_user_id?: string
          order_id?: string
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_collaborators_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "projects_v3"
            referencedColumns: ["id"]
          },
        ]
      }
      order_daily_logs: {
        Row: {
          activity_description: string | null
          created_at: string
          created_by: string
          id: string
          notes: string | null
          order_id: string
          report_date: string
          team_name: string | null
          updated_at: string
        }
        Insert: {
          activity_description?: string | null
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          order_id: string
          report_date: string
          team_name?: string | null
          updated_at?: string
        }
        Update: {
          activity_description?: string | null
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          order_id?: string
          report_date?: string
          team_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_daily_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "projects_v3"
            referencedColumns: ["id"]
          },
        ]
      }
      order_messages: {
        Row: {
          audio_path: string | null
          created_at: string | null
          id: string
          is_staff: boolean | null
          message: string
          order_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          audio_path?: string | null
          created_at?: string | null
          id?: string
          is_staff?: boolean | null
          message: string
          order_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          audio_path?: string | null
          created_at?: string | null
          id?: string
          is_staff?: boolean | null
          message?: string
          order_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "projects_v3"
            referencedColumns: ["id"]
          },
        ]
      }
      order_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          order_id: string
          paid_by: string
          payment_method: string | null
          receipt_number: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          paid_by: string
          payment_method?: string | null
          receipt_number?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          paid_by?: string
          payment_method?: string | null
          receipt_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "projects_v3"
            referencedColumns: ["id"]
          },
        ]
      }
      order_renewals: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          customer_id: string
          id: string
          manager_notes: string | null
          new_end_date: string | null
          new_start_date: string
          order_id: string
          original_price: number | null
          previous_end_date: string | null
          rejection_reason: string | null
          renewal_number: number
          renewal_price: number | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          customer_id: string
          id?: string
          manager_notes?: string | null
          new_end_date?: string | null
          new_start_date: string
          order_id: string
          original_price?: number | null
          previous_end_date?: string | null
          rejection_reason?: string | null
          renewal_number?: number
          renewal_price?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          manager_notes?: string | null
          new_end_date?: string | null
          new_start_date?: string
          order_id?: string
          original_price?: number | null
          previous_end_date?: string | null
          rejection_reason?: string | null
          renewal_number?: number
          renewal_price?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_renewals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_renewals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "projects_v3"
            referencedColumns: ["id"]
          },
        ]
      }
      order_transfer_requests: {
        Row: {
          created_at: string
          from_user_id: string
          id: string
          manager_approved_at: string | null
          manager_approved_by: string | null
          manager_rejection_reason: string | null
          order_id: string
          recipient_rejection_reason: string | null
          recipient_responded_at: string | null
          status: string
          to_phone_number: string
          to_user_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_user_id: string
          id?: string
          manager_approved_at?: string | null
          manager_approved_by?: string | null
          manager_rejection_reason?: string | null
          order_id: string
          recipient_rejection_reason?: string | null
          recipient_responded_at?: string | null
          status?: string
          to_phone_number: string
          to_user_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_user_id?: string
          id?: string
          manager_approved_at?: string | null
          manager_approved_by?: string | null
          manager_rejection_reason?: string | null
          order_id?: string
          recipient_rejection_reason?: string | null
          recipient_responded_at?: string | null
          status?: string
          to_phone_number?: string
          to_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_transfer_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "projects_v3"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          payload: Json
          price: number | null
          project_id: string
          status: Database["public"]["Enums"]["order_status"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          payload?: Json
          price?: number | null
          project_id: string
          status?: Database["public"]["Enums"]["order_status"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          payload?: Json
          price?: number | null
          project_id?: string
          status?: Database["public"]["Enums"]["order_status"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_hierarchy"
            referencedColumns: ["id"]
          },
        ]
      }
      organizational_positions: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizational_positions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "organizational_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_codes: {
        Row: {
          code: string
          created_at: string | null
          expires_at: string
          id: string
          phone_number: string
          verified: boolean | null
        }
        Insert: {
          code: string
          created_at?: string | null
          expires_at: string
          id?: string
          phone_number: string
          verified?: boolean | null
        }
        Update: {
          code?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          phone_number?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          paid_at: string | null
          provider: string | null
          reference: string | null
          status: Database["public"]["Enums"]["payment_status_enum"]
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          paid_at?: string | null
          provider?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status_enum"]
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          paid_at?: string | null
          provider?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_whitelist: {
        Row: {
          added_by: string | null
          allowed_roles: string[]
          created_at: string | null
          id: string
          notes: string | null
          phone_number: string
          updated_at: string | null
        }
        Insert: {
          added_by?: string | null
          allowed_roles?: string[]
          created_at?: string | null
          id?: string
          notes?: string | null
          phone_number: string
          updated_at?: string | null
        }
        Update: {
          added_by?: string | null
          allowed_roles?: string[]
          created_at?: string | null
          id?: string
          notes?: string | null
          phone_number?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profile_photos: {
        Row: {
          created_at: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          sort_order: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          sort_order?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          sort_order?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string | null
          id: string
          phone_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_assignments: {
        Row: {
          accepted_at: string | null
          assigned_at: string
          completed_at: string | null
          contractor_id: string
          created_at: string
          id: string
          notes: string | null
          service_request_id: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          assigned_at?: string
          completed_at?: string | null
          contractor_id: string
          created_at?: string
          id?: string
          notes?: string | null
          service_request_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          assigned_at?: string
          completed_at?: string | null
          contractor_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          service_request_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_assignments_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      project_collaborators: {
        Row: {
          created_at: string
          id: string
          invited_at: string
          invitee_phone_number: string
          invitee_user_id: string | null
          inviter_user_id: string
          project_id: string
          responded_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_at?: string
          invitee_phone_number: string
          invitee_user_id?: string | null
          inviter_user_id: string
          project_id: string
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_at?: string
          invitee_phone_number?: string
          invitee_user_id?: string | null
          inviter_user_id?: string
          project_id?: string
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_collaborators_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_hierarchy"
            referencedColumns: ["id"]
          },
        ]
      }
      project_hierarchy_media: {
        Row: {
          created_at: string
          file_path: string
          file_size: number | null
          file_type: string
          hierarchy_project_id: string
          id: string
          mime_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_path: string
          file_size?: number | null
          file_type?: string
          hierarchy_project_id: string
          id?: string
          mime_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_path?: string
          file_size?: number | null
          file_type?: string
          hierarchy_project_id?: string
          id?: string
          mime_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_hierarchy_media_hierarchy_project_id_fkey"
            columns: ["hierarchy_project_id"]
            isOneToOne: false
            referencedRelation: "projects_hierarchy"
            referencedColumns: ["id"]
          },
        ]
      }
      project_media: {
        Row: {
          created_at: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          mime_type: string
          project_id: string
          thumbnail_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          mime_type: string
          project_id: string
          thumbnail_path?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          mime_type?: string
          project_id?: string
          thumbnail_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_media_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_v3"
            referencedColumns: ["id"]
          },
        ]
      }
      project_progress_media: {
        Row: {
          created_at: string
          description: string | null
          file_name: string
          file_size: number | null
          id: string
          media_type: string | null
          project_id: string
          stage: string
          storage_path: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          media_type?: string | null
          project_id: string
          stage: string
          storage_path: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          media_type?: string | null
          project_id?: string
          stage?: string
          storage_path?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_progress_media_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_v3"
            referencedColumns: ["id"]
          },
        ]
      }
      project_progress_stages: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          id: string
          is_completed: boolean
          notes: string | null
          order_index: number
          project_id: string
          stage_key: string
          stage_title: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          id?: string
          is_completed?: boolean
          notes?: string | null
          order_index?: number
          project_id: string
          stage_key: string
          stage_title: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          id?: string
          is_completed?: boolean
          notes?: string | null
          order_index?: number
          project_id?: string
          stage_key?: string
          stage_title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_progress_stages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          id: string
          location_address: string
          project_name: string
          service_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_address: string
          project_name: string
          service_type: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location_address?: string
          project_name?: string
          service_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects_hierarchy: {
        Row: {
          created_at: string | null
          id: string
          location_id: string
          service_type_id: string
          status: string | null
          subcategory_id: string
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          location_id: string
          service_type_id: string
          status?: string | null
          subcategory_id: string
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          location_id?: string
          service_type_id?: string
          status?: string | null
          subcategory_id?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_hierarchy_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_hierarchy_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types_v3"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_hierarchy_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      projects_v2: {
        Row: {
          address_id: string
          archived_at: string | null
          created_at: string
          customer_id: string
          id: string
          service_type_id: string
          status: Database["public"]["Enums"]["project_status"]
          title: string
          updated_at: string
        }
        Insert: {
          address_id: string
          archived_at?: string | null
          created_at?: string
          customer_id: string
          id?: string
          service_type_id: string
          status?: Database["public"]["Enums"]["project_status"]
          title: string
          updated_at?: string
        }
        Update: {
          address_id?: string
          archived_at?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          service_type_id?: string
          status?: Database["public"]["Enums"]["project_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_v2_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_v2_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      projects_v3: {
        Row: {
          address: string
          approved_at: string | null
          approved_by: string | null
          archived_at: string | null
          archived_by: string | null
          closed_at: string | null
          code: string
          contractor_id: string | null
          created_at: string | null
          customer_completion_date: string | null
          customer_id: string
          customer_name: string | null
          customer_phone: string | null
          deep_archived_at: string | null
          deep_archived_by: string | null
          detailed_address: string | null
          district_id: string | null
          executed_by: string | null
          execution_confirmed_at: string | null
          execution_end_date: string | null
          execution_stage: Database["public"]["Enums"]["execution_stage"] | null
          execution_stage_updated_at: string | null
          execution_start_date: string | null
          executive_completion_date: string | null
          financial_confirmed_at: string | null
          financial_confirmed_by: string | null
          hierarchy_project_id: string | null
          id: string
          is_archived: boolean | null
          is_deep_archived: boolean | null
          is_renewal: boolean | null
          location_confirmed_at: string | null
          location_confirmed_by_customer: boolean | null
          location_lat: number | null
          location_lng: number | null
          notes: string | null
          original_order_id: string | null
          payment_amount: number | null
          payment_confirmed_at: string | null
          payment_confirmed_by: string | null
          payment_method: string | null
          province_id: string
          rejection_reason: string | null
          rental_start_date: string | null
          status: Database["public"]["Enums"]["project_status_v3"] | null
          subcategory_id: string
          total_paid: number | null
          total_price: number | null
          transaction_reference: string | null
          transferred_from_phone: string | null
          transferred_from_user_id: string | null
          updated_at: string | null
        }
        Insert: {
          address: string
          approved_at?: string | null
          approved_by?: string | null
          archived_at?: string | null
          archived_by?: string | null
          closed_at?: string | null
          code: string
          contractor_id?: string | null
          created_at?: string | null
          customer_completion_date?: string | null
          customer_id: string
          customer_name?: string | null
          customer_phone?: string | null
          deep_archived_at?: string | null
          deep_archived_by?: string | null
          detailed_address?: string | null
          district_id?: string | null
          executed_by?: string | null
          execution_confirmed_at?: string | null
          execution_end_date?: string | null
          execution_stage?:
            | Database["public"]["Enums"]["execution_stage"]
            | null
          execution_stage_updated_at?: string | null
          execution_start_date?: string | null
          executive_completion_date?: string | null
          financial_confirmed_at?: string | null
          financial_confirmed_by?: string | null
          hierarchy_project_id?: string | null
          id?: string
          is_archived?: boolean | null
          is_deep_archived?: boolean | null
          is_renewal?: boolean | null
          location_confirmed_at?: string | null
          location_confirmed_by_customer?: boolean | null
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          original_order_id?: string | null
          payment_amount?: number | null
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_method?: string | null
          province_id: string
          rejection_reason?: string | null
          rental_start_date?: string | null
          status?: Database["public"]["Enums"]["project_status_v3"] | null
          subcategory_id: string
          total_paid?: number | null
          total_price?: number | null
          transaction_reference?: string | null
          transferred_from_phone?: string | null
          transferred_from_user_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string
          approved_at?: string | null
          approved_by?: string | null
          archived_at?: string | null
          archived_by?: string | null
          closed_at?: string | null
          code?: string
          contractor_id?: string | null
          created_at?: string | null
          customer_completion_date?: string | null
          customer_id?: string
          customer_name?: string | null
          customer_phone?: string | null
          deep_archived_at?: string | null
          deep_archived_by?: string | null
          detailed_address?: string | null
          district_id?: string | null
          executed_by?: string | null
          execution_confirmed_at?: string | null
          execution_end_date?: string | null
          execution_stage?:
            | Database["public"]["Enums"]["execution_stage"]
            | null
          execution_stage_updated_at?: string | null
          execution_start_date?: string | null
          executive_completion_date?: string | null
          financial_confirmed_at?: string | null
          financial_confirmed_by?: string | null
          hierarchy_project_id?: string | null
          id?: string
          is_archived?: boolean | null
          is_deep_archived?: boolean | null
          is_renewal?: boolean | null
          location_confirmed_at?: string | null
          location_confirmed_by_customer?: boolean | null
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          original_order_id?: string | null
          payment_amount?: number | null
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_method?: string | null
          province_id?: string
          rejection_reason?: string | null
          rental_start_date?: string | null
          status?: Database["public"]["Enums"]["project_status_v3"] | null
          subcategory_id?: string
          total_paid?: number | null
          total_price?: number | null
          transaction_reference?: string | null
          transferred_from_phone?: string | null
          transferred_from_user_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_v3_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_v3_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_v3_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_v3_hierarchy_project_id_fkey"
            columns: ["hierarchy_project_id"]
            isOneToOne: false
            referencedRelation: "projects_hierarchy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_v3_original_order_id_fkey"
            columns: ["original_order_id"]
            isOneToOne: false
            referencedRelation: "projects_v3"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_v3_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_v3_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      provinces: {
        Row: {
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rating_criteria: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          key: string
          rating_type: Database["public"]["Enums"]["rating_type"]
          title: string
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          key: string
          rating_type: Database["public"]["Enums"]["rating_type"]
          title: string
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          key?: string
          rating_type?: Database["public"]["Enums"]["rating_type"]
          title?: string
          weight?: number | null
        }
        Relationships: []
      }
      rating_helpful_votes: {
        Row: {
          created_at: string | null
          id: string
          is_helpful: boolean
          rating_id: string | null
          voter_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_helpful: boolean
          rating_id?: string | null
          voter_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_helpful?: boolean
          rating_id?: string | null
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rating_helpful_votes_rating_id_fkey"
            columns: ["rating_id"]
            isOneToOne: false
            referencedRelation: "ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_helpful_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      rating_responses: {
        Row: {
          created_at: string | null
          id: string
          is_official: boolean | null
          rating_id: string | null
          responder_id: string
          response: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_official?: boolean | null
          rating_id?: string | null
          responder_id: string
          response: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_official?: boolean | null
          rating_id?: string | null
          responder_id?: string
          response?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rating_responses_rating_id_fkey"
            columns: ["rating_id"]
            isOneToOne: false
            referencedRelation: "ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_responses_responder_id_fkey"
            columns: ["responder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string | null
          criteria_scores: Json | null
          helpful_count: number | null
          id: string
          is_anonymous: boolean | null
          is_verified: boolean | null
          overall_score: number | null
          project_id: string | null
          rated_id: string
          rater_id: string
          rating_type: Database["public"]["Enums"]["rating_type"]
          updated_at: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          criteria_scores?: Json | null
          helpful_count?: number | null
          id?: string
          is_anonymous?: boolean | null
          is_verified?: boolean | null
          overall_score?: number | null
          project_id?: string | null
          rated_id: string
          rater_id: string
          rating_type: Database["public"]["Enums"]["rating_type"]
          updated_at?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          criteria_scores?: Json | null
          helpful_count?: number | null
          id?: string
          is_anonymous?: boolean | null
          is_verified?: boolean | null
          overall_score?: number | null
          project_id?: string | null
          rated_id?: string
          rater_id?: string
          rating_type?: Database["public"]["Enums"]["rating_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ratings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_v3"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_rated_id_fkey"
            columns: ["rated_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      regions: {
        Row: {
          code: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          type: string
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          type: string
        }
        Update: {
          code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "regions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_request_media: {
        Row: {
          created_at: string
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          mime_type: string | null
          repair_request_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_path: string
          file_size?: number | null
          file_type: string
          id?: string
          mime_type?: string | null
          repair_request_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          mime_type?: string | null
          repair_request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_request_media_repair_request_id_fkey"
            columns: ["repair_request_id"]
            isOneToOne: false
            referencedRelation: "repair_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_request_messages: {
        Row: {
          audio_path: string | null
          created_at: string
          id: string
          is_staff: boolean | null
          message: string
          repair_request_id: string
          user_id: string
        }
        Insert: {
          audio_path?: string | null
          created_at?: string
          id?: string
          is_staff?: boolean | null
          message: string
          repair_request_id: string
          user_id: string
        }
        Update: {
          audio_path?: string | null
          created_at?: string
          id?: string
          is_staff?: boolean | null
          message?: string
          repair_request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_request_messages_repair_request_id_fkey"
            columns: ["repair_request_id"]
            isOneToOne: false
            referencedRelation: "repair_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          created_at: string
          customer_id: string
          description: string | null
          estimated_cost: number | null
          final_cost: number | null
          id: string
          order_id: string
          paid_at: string | null
          payment_reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id: string
          description?: string | null
          estimated_cost?: number | null
          final_cost?: number | null
          id?: string
          order_id: string
          paid_at?: string | null
          payment_reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string
          description?: string | null
          estimated_cost?: number | null
          final_cost?: number | null
          id?: string
          order_id?: string
          paid_at?: string | null
          payment_reference?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "projects_v3"
            referencedColumns: ["id"]
          },
        ]
      }
      reputation_scores: {
        Row: {
          contractor_score: number | null
          created_at: string | null
          customer_score: number | null
          id: string
          last_calculated_at: string | null
          overall_score: number | null
          staff_score: number | null
          total_ratings: number | null
          trust_level: string | null
          updated_at: string | null
          user_id: string
          verified_projects: number | null
        }
        Insert: {
          contractor_score?: number | null
          created_at?: string | null
          customer_score?: number | null
          id?: string
          last_calculated_at?: string | null
          overall_score?: number | null
          staff_score?: number | null
          total_ratings?: number | null
          trust_level?: string | null
          updated_at?: string | null
          user_id: string
          verified_projects?: number | null
        }
        Update: {
          contractor_score?: number | null
          created_at?: string | null
          customer_score?: number | null
          id?: string
          last_calculated_at?: string | null
          overall_score?: number | null
          staff_score?: number | null
          total_ratings?: number | null
          trust_level?: string | null
          updated_at?: string | null
          user_id?: string
          verified_projects?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reputation_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      scaffolding_requests: {
        Row: {
          address: string | null
          created_at: string
          details: Json | null
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      service_activity_types: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      service_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      service_line_items: {
        Row: {
          created_at: string
          description: string
          id: string
          qty: number
          service_id: string
          sku: string
          source: Database["public"]["Enums"]["service_line_source"] | null
          tax_rate: number | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          qty: number
          service_id: string
          sku: string
          source?: Database["public"]["Enums"]["service_line_source"] | null
          tax_rate?: number | null
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          qty?: number
          service_id?: string
          sku?: string
          source?: Database["public"]["Enums"]["service_line_source"] | null
          tax_rate?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_line_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_media: {
        Row: {
          checksum: string | null
          id: string
          metadata: Json | null
          service_id: string
          type: Database["public"]["Enums"]["media_type"]
          uploaded_at: string
          uploaded_by: string | null
          url: string
        }
        Insert: {
          checksum?: string | null
          id?: string
          metadata?: Json | null
          service_id: string
          type?: Database["public"]["Enums"]["media_type"]
          uploaded_at?: string
          uploaded_by?: string | null
          url: string
        }
        Update: {
          checksum?: string | null
          id?: string
          metadata?: Json | null
          service_id?: string
          type?: Database["public"]["Enums"]["media_type"]
          uploaded_at?: string
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_media_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          created_at: string
          height: number
          id: string
          length: number
          location_address: string | null
          location_coordinates: unknown
          location_distance: number | null
          project_id: string | null
          service_type: string
          status: string
          sub_type: string | null
          updated_at: string
          user_id: string
          width: number
        }
        Insert: {
          created_at?: string
          height: number
          id?: string
          length: number
          location_address?: string | null
          location_coordinates?: unknown
          location_distance?: number | null
          project_id?: string | null
          service_type: string
          status?: string
          sub_type?: string | null
          updated_at?: string
          user_id: string
          width: number
        }
        Update: {
          created_at?: string
          height?: number
          id?: string
          length?: number
          location_address?: string | null
          location_coordinates?: unknown
          location_distance?: number | null
          project_id?: string | null
          service_type?: string
          status?: string
          sub_type?: string | null
          updated_at?: string
          user_id?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_service_requests_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "service_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests_v2: {
        Row: {
          address_id: string | null
          created_at: string
          customer_id: string
          details: Json | null
          id: string
          merged_into_service_id: string | null
          requested_for_at: string | null
          service_type_id: string
          source: Database["public"]["Enums"]["request_source"]
        }
        Insert: {
          address_id?: string | null
          created_at?: string
          customer_id: string
          details?: Json | null
          id?: string
          merged_into_service_id?: string | null
          requested_for_at?: string | null
          service_type_id: string
          source?: Database["public"]["Enums"]["request_source"]
        }
        Update: {
          address_id?: string | null
          created_at?: string
          customer_id?: string
          details?: Json | null
          id?: string
          merged_into_service_id?: string | null
          requested_for_at?: string | null
          service_type_id?: string
          source?: Database["public"]["Enums"]["request_source"]
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_v2_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_v2_merged_into_service_id_fkey"
            columns: ["merged_into_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_v2_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      service_types: {
        Row: {
          code: string
          created_at: string
          default_bom: Json | null
          id: string
          is_active: boolean | null
          name: string
          requires_permit: boolean | null
        }
        Insert: {
          code: string
          created_at?: string
          default_bom?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          requires_permit?: boolean | null
        }
        Update: {
          code?: string
          created_at?: string
          default_bom?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          requires_permit?: boolean | null
        }
        Relationships: []
      }
      service_types_v3: {
        Row: {
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          completion_date: string | null
          contractor_id: string | null
          created_at: string
          id: string
          install_end_at: string | null
          install_start_at: string | null
          notes: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          priority: number | null
          project_id: string
          status: Database["public"]["Enums"]["service_status"]
          updated_at: string
        }
        Insert: {
          completion_date?: string | null
          contractor_id?: string | null
          created_at?: string
          id?: string
          install_end_at?: string | null
          install_start_at?: string | null
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          priority?: number | null
          project_id: string
          status?: Database["public"]["Enums"]["service_status"]
          updated_at?: string
        }
        Update: {
          completion_date?: string | null
          contractor_id?: string | null
          created_at?: string
          id?: string
          install_end_at?: string | null
          install_start_at?: string | null
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          priority?: number | null
          project_id?: string
          status?: Database["public"]["Enums"]["service_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      services_v3: {
        Row: {
          created_at: string
          description: string | null
          execution_end_date: string | null
          execution_start_date: string | null
          id: string
          notes: string | null
          project_id: string
          service_code: string
          service_number: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          execution_end_date?: string | null
          execution_start_date?: string | null
          id?: string
          notes?: string | null
          project_id: string
          service_code: string
          service_number: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          execution_end_date?: string | null
          execution_start_date?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          service_code?: string
          service_number?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_v3_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_v3"
            referencedColumns: ["id"]
          },
        ]
      }
      site_analytics: {
        Row: {
          browser_name: string | null
          browser_version: string | null
          city: string | null
          country: string | null
          created_at: string
          data_transferred_bytes: number | null
          device_model: string | null
          device_type: string | null
          entry_page: string | null
          event_type: string
          id: string
          ip_address: unknown
          is_logged_in: boolean | null
          language: string | null
          os_name: string | null
          os_version: string | null
          page_count: number | null
          page_title: string | null
          page_url: string | null
          phone_number: string | null
          referrer_url: string | null
          screen_height: number | null
          screen_width: number | null
          scroll_depth_percent: number | null
          session_duration_seconds: number | null
          session_id: string
          timezone: string | null
          updated_at: string
          user_agent: string | null
          user_id: string | null
          viewport_height: number | null
          viewport_width: number | null
        }
        Insert: {
          browser_name?: string | null
          browser_version?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          data_transferred_bytes?: number | null
          device_model?: string | null
          device_type?: string | null
          entry_page?: string | null
          event_type: string
          id?: string
          ip_address?: unknown
          is_logged_in?: boolean | null
          language?: string | null
          os_name?: string | null
          os_version?: string | null
          page_count?: number | null
          page_title?: string | null
          page_url?: string | null
          phone_number?: string | null
          referrer_url?: string | null
          screen_height?: number | null
          screen_width?: number | null
          scroll_depth_percent?: number | null
          session_duration_seconds?: number | null
          session_id: string
          timezone?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
          viewport_height?: number | null
          viewport_width?: number | null
        }
        Update: {
          browser_name?: string | null
          browser_version?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          data_transferred_bytes?: number | null
          device_model?: string | null
          device_type?: string | null
          entry_page?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown
          is_logged_in?: boolean | null
          language?: string | null
          os_name?: string | null
          os_version?: string | null
          page_count?: number | null
          page_title?: string | null
          page_url?: string | null
          phone_number?: string | null
          referrer_url?: string | null
          screen_height?: number | null
          screen_width?: number | null
          scroll_depth_percent?: number | null
          session_duration_seconds?: number | null
          session_id?: string
          timezone?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
          viewport_height?: number | null
          viewport_width?: number | null
        }
        Relationships: []
      }
      site_sessions: {
        Row: {
          browser_name: string | null
          city: string | null
          country: string | null
          created_at: string
          device_model: string | null
          device_type: string | null
          ended_at: string | null
          entry_page: string | null
          exit_page: string | null
          id: string
          ip_address: unknown
          is_logged_in: boolean | null
          os_name: string | null
          os_version: string | null
          phone_number: string | null
          session_id: string
          started_at: string
          total_data_bytes: number | null
          total_duration_seconds: number | null
          total_page_views: number | null
          updated_at: string
          user_agent: string | null
          user_id: string | null
          visited_pages: string[] | null
        }
        Insert: {
          browser_name?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_model?: string | null
          device_type?: string | null
          ended_at?: string | null
          entry_page?: string | null
          exit_page?: string | null
          id?: string
          ip_address?: unknown
          is_logged_in?: boolean | null
          os_name?: string | null
          os_version?: string | null
          phone_number?: string | null
          session_id: string
          started_at?: string
          total_data_bytes?: number | null
          total_duration_seconds?: number | null
          total_page_views?: number | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
          visited_pages?: string[] | null
        }
        Update: {
          browser_name?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_model?: string | null
          device_type?: string | null
          ended_at?: string | null
          entry_page?: string | null
          exit_page?: string | null
          id?: string
          ip_address?: unknown
          is_logged_in?: boolean | null
          os_name?: string | null
          os_version?: string | null
          phone_number?: string | null
          session_id?: string
          started_at?: string
          total_data_bytes?: number | null
          total_duration_seconds?: number | null
          total_page_views?: number | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
          visited_pages?: string[] | null
        }
        Relationships: []
      }
      staff_profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          description: string | null
          id: string
          province: string | null
          rejection_reason: string | null
          requested_role: Database["public"]["Enums"]["app_role"]
          staff_category: string | null
          staff_position: string | null
          staff_subcategory: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          province?: string | null
          rejection_reason?: string | null
          requested_role: Database["public"]["Enums"]["app_role"]
          staff_category?: string | null
          staff_position?: string | null
          staff_subcategory?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          province?: string | null
          rejection_reason?: string | null
          requested_role?: Database["public"]["Enums"]["app_role"]
          staff_category?: string | null
          staff_position?: string | null
          staff_subcategory?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      staff_roles: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          notes: string | null
          province_id: string | null
          role: Database["public"]["Enums"]["staff_role_type"]
          service_type_id: string | null
          subcategory_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          notes?: string | null
          province_id?: string | null
          role: Database["public"]["Enums"]["staff_role_type"]
          service_type_id?: string | null
          subcategory_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          notes?: string | null
          province_id?: string | null
          role?: Database["public"]["Enums"]["staff_role_type"]
          service_type_id?: string | null
          subcategory_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_roles_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_roles_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types_v3"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_roles_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_salary_settings: {
        Row: {
          base_daily_salary: number
          bonuses: number | null
          created_at: string
          created_by: string
          deductions: number | null
          id: string
          notes: string | null
          overtime_rate_fraction: number
          previous_month_balance: number | null
          previous_month_extra_received: number | null
          staff_code: string
          staff_name: string
          updated_at: string
        }
        Insert: {
          base_daily_salary?: number
          bonuses?: number | null
          created_at?: string
          created_by?: string
          deductions?: number | null
          id?: string
          notes?: string | null
          overtime_rate_fraction?: number
          previous_month_balance?: number | null
          previous_month_extra_received?: number | null
          staff_code: string
          staff_name: string
          updated_at?: string
        }
        Update: {
          base_daily_salary?: number
          bonuses?: number | null
          created_at?: string
          created_by?: string
          deductions?: number | null
          id?: string
          notes?: string | null
          overtime_rate_fraction?: number
          previous_month_balance?: number | null
          previous_month_extra_received?: number | null
          staff_code?: string
          staff_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff_verification_requests: {
        Row: {
          created_at: string | null
          id: string
          phone_number: string
          position_id: string | null
          region_id: string | null
          rejection_reason: string | null
          requested_role: Database["public"]["Enums"]["app_role"]
          status: string | null
          updated_at: string | null
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          phone_number: string
          position_id?: string | null
          region_id?: string | null
          rejection_reason?: string | null
          requested_role: Database["public"]["Enums"]["app_role"]
          status?: string | null
          updated_at?: string | null
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          phone_number?: string
          position_id?: string | null
          region_id?: string | null
          rejection_reason?: string | null
          requested_role?: Database["public"]["Enums"]["app_role"]
          status?: string | null
          updated_at?: string | null
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_verification_requests_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "organizational_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_verification_requests_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_whitelist: {
        Row: {
          allowed_position_ids: string[] | null
          created_at: string | null
          created_by: string | null
          id: string
          note: string | null
          phone: string
        }
        Insert: {
          allowed_position_ids?: string[] | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          note?: string | null
          phone: string
        }
        Update: {
          allowed_position_ids?: string[] | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          note?: string | null
          phone?: string
        }
        Relationships: []
      }
      subcategories: {
        Row: {
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          service_type_id: string
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          service_type_id: string
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          service_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types_v3"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
          message: string
          ticket_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin?: boolean
          message: string
          ticket_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
          message?: string
          ticket_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          created_at: string
          department: string
          id: string
          message: string
          service_request_id: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department: string
          id?: string
          message: string
          service_request_id?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department?: string
          id?: string
          message?: string
          service_request_id?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      voice_call_signals: {
        Row: {
          caller_id: string
          created_at: string
          id: string
          order_id: string
          receiver_id: string
          signal_data: Json | null
          signal_type: string
        }
        Insert: {
          caller_id: string
          created_at?: string
          id?: string
          order_id: string
          receiver_id: string
          signal_data?: Json | null
          signal_type: string
        }
        Update: {
          caller_id?: string
          created_at?: string
          id?: string
          order_id?: string
          receiver_id?: string
          signal_data?: Json | null
          signal_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_call_signals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "projects_v3"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number | null
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          reference_type: string | null
          title: string
          transaction_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          title: string
          transaction_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          transaction_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workflow_tasks: {
        Row: {
          assignee_role: Database["public"]["Enums"]["app_role"] | null
          created_at: string
          due_at: string | null
          id: string
          payload: Json | null
          service_id: string
          status: Database["public"]["Enums"]["task_status"]
          type: Database["public"]["Enums"]["task_type"]
          updated_at: string
        }
        Insert: {
          assignee_role?: Database["public"]["Enums"]["app_role"] | null
          created_at?: string
          due_at?: string | null
          id?: string
          payload?: Json | null
          service_id: string
          status?: Database["public"]["Enums"]["task_status"]
          type: Database["public"]["Enums"]["task_type"]
          updated_at?: string
        }
        Update: {
          assignee_role?: Database["public"]["Enums"]["app_role"] | null
          created_at?: string
          due_at?: string | null
          id?: string
          payload?: Json | null
          service_id?: string
          status?: Database["public"]["Enums"]["task_status"]
          type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_tasks_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_wallet_transaction: {
        Args: {
          _amount: number
          _description?: string
          _reference_id?: string
          _reference_type?: string
          _title: string
          _transaction_type: string
          _user_id: string
        }
        Returns: string
      }
      approve_order_as_sales_manager: {
        Args: { _order_id: string }
        Returns: undefined
      }
      archive_daily_report: {
        Args: { p_report_id: string }
        Returns: undefined
      }
      assign_role_to_user:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: undefined
          }
        | { Args: { _role: string; _user_id: string }; Returns: undefined }
      calculate_reputation_score: {
        Args: { _user_id: string }
        Returns: undefined
      }
      check_directory_rate_limit: {
        Args: { _user_id: string }
        Returns: boolean
      }
      check_order_ownership: {
        Args: { _order_id: string; _user_id: string }
        Returns: boolean
      }
      check_otp_rate_limit: {
        Args: { _phone_number: string }
        Returns: boolean
      }
      check_phone_whitelist: {
        Args: { _phone: string }
        Returns: {
          allowed_roles: string[]
          is_whitelisted: boolean
        }[]
      }
      check_rate_limit: {
        Args: {
          _action: string
          _limit: number
          _user_id: string
          _window: unknown
        }
        Returns: boolean
      }
      check_service_request_rate_limit: {
        Args: { _user_id: string }
        Returns: boolean
      }
      check_staff_whitelist: {
        Args: { _phone: string }
        Returns: {
          allowed_role: Database["public"]["Enums"]["app_role"]
          is_whitelisted: boolean
        }[]
      }
      cleanup_expired_otps: { Args: never; Returns: undefined }
      create_project_v3: {
        Args: {
          _address: string
          _customer_id: string
          _detailed_address?: string
          _district_id: string
          _hierarchy_project_id: string
          _notes?: Json
          _province_id: string
          _subcategory_id: string
        }
        Returns: {
          address: string
          approved_at: string | null
          approved_by: string | null
          archived_at: string | null
          archived_by: string | null
          closed_at: string | null
          code: string
          contractor_id: string | null
          created_at: string | null
          customer_completion_date: string | null
          customer_id: string
          customer_name: string | null
          customer_phone: string | null
          deep_archived_at: string | null
          deep_archived_by: string | null
          detailed_address: string | null
          district_id: string | null
          executed_by: string | null
          execution_confirmed_at: string | null
          execution_end_date: string | null
          execution_stage: Database["public"]["Enums"]["execution_stage"] | null
          execution_stage_updated_at: string | null
          execution_start_date: string | null
          executive_completion_date: string | null
          financial_confirmed_at: string | null
          financial_confirmed_by: string | null
          hierarchy_project_id: string | null
          id: string
          is_archived: boolean | null
          is_deep_archived: boolean | null
          is_renewal: boolean | null
          location_confirmed_at: string | null
          location_confirmed_by_customer: boolean | null
          location_lat: number | null
          location_lng: number | null
          notes: string | null
          original_order_id: string | null
          payment_amount: number | null
          payment_confirmed_at: string | null
          payment_confirmed_by: string | null
          payment_method: string | null
          province_id: string
          rejection_reason: string | null
          rental_start_date: string | null
          status: Database["public"]["Enums"]["project_status_v3"] | null
          subcategory_id: string
          total_paid: number | null
          total_price: number | null
          transaction_reference: string | null
          transferred_from_phone: string | null
          transferred_from_user_id: string | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "projects_v3"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      daily_report_contains_staff: {
        Args: { p_report_id: string; p_user_id: string }
        Returns: boolean
      }
      generate_customer_code: { Args: never; Returns: string }
      generate_project_code: {
        Args: {
          _customer_id: string
          _province_id: string
          _subcategory_id: string
        }
        Returns: string
      }
      generate_service_code: { Args: { _project_id: string }; Returns: string }
      generate_unique_order_code: { Args: never; Returns: string }
      get_contractor_contact_info: {
        Args: { _contractor_id: string }
        Returns: {
          contact_person: string
          email: string
          phone_number: string
        }[]
      }
      get_incoming_transfer_request_media: {
        Args: { p_request_id: string }
        Returns: {
          created_at: string
          file_path: string
          file_type: string
          id: string
        }[]
      }
      get_incoming_transfer_requests: {
        Args: never
        Returns: {
          created_at: string
          district_id: string
          execution_stage: string
          from_full_name: string
          from_phone_number: string
          from_user_id: string
          id: string
          location_lat: number
          location_lng: number
          order_address: string
          order_code: string
          order_detailed_address: string
          order_id: string
          order_notes: string
          order_status: string
          order_subcategory_id: string
          payment_amount: number
          province_id: string
          service_type_name: string
          status: string
          subcategory_name: string
          to_phone_number: string
          to_user_id: string
        }[]
      }
      get_my_projects_v3: {
        Args: never
        Returns: {
          address: string
          approved_at: string | null
          approved_by: string | null
          archived_at: string | null
          archived_by: string | null
          closed_at: string | null
          code: string
          contractor_id: string | null
          created_at: string | null
          customer_completion_date: string | null
          customer_id: string
          customer_name: string | null
          customer_phone: string | null
          deep_archived_at: string | null
          deep_archived_by: string | null
          detailed_address: string | null
          district_id: string | null
          executed_by: string | null
          execution_confirmed_at: string | null
          execution_end_date: string | null
          execution_stage: Database["public"]["Enums"]["execution_stage"] | null
          execution_stage_updated_at: string | null
          execution_start_date: string | null
          executive_completion_date: string | null
          financial_confirmed_at: string | null
          financial_confirmed_by: string | null
          hierarchy_project_id: string | null
          id: string
          is_archived: boolean | null
          is_deep_archived: boolean | null
          is_renewal: boolean | null
          location_confirmed_at: string | null
          location_confirmed_by_customer: boolean | null
          location_lat: number | null
          location_lng: number | null
          notes: string | null
          original_order_id: string | null
          payment_amount: number | null
          payment_confirmed_at: string | null
          payment_confirmed_by: string | null
          payment_method: string | null
          province_id: string
          rejection_reason: string | null
          rental_start_date: string | null
          status: Database["public"]["Enums"]["project_status_v3"] | null
          subcategory_id: string
          total_paid: number | null
          total_price: number | null
          transaction_reference: string | null
          transferred_from_phone: string | null
          transferred_from_user_id: string | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "projects_v3"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_or_create_project: {
        Args: {
          _location_id: string
          _service_type_id: string
          _subcategory_id: string
          _user_id: string
        }
        Returns: string
      }
      get_orders_with_customer_info: {
        Args: never
        Returns: {
          address: string
          approved_at: string
          approved_by: string
          code: string
          contractor_id: string
          created_at: string
          customer_id: string
          customer_name: string
          customer_phone: string
          detailed_address: string
          district_id: string
          id: string
          notes: string
          project_number: string
          province_id: string
          rejection_reason: string
          service_code: string
          status: Database["public"]["Enums"]["project_status_v3"]
          subcategory_id: string
          updated_at: string
        }[]
      }
      get_public_contractors: {
        Args: never
        Returns: {
          company_name: string
          created_at: string
          description: string
          experience_years: number
          general_location: string
          id: string
          is_approved: boolean
          services: Json
        }[]
      }
      get_sales_pending_orders: {
        Args: never
        Returns: {
          address: string
          code: string
          created_at: string
          detailed_address: string
          id: string
          notes: Json
        }[]
      }
      get_user_id_by_phone: { Args: { _phone: string }; Returns: string }
      get_wallet_balance: { Args: { _user_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_photo_sort_orders: {
        Args: { photo_ids: string[] }
        Returns: undefined
      }
      log_audit:
        | {
            Args: {
              _action: string
              _entity: string
              _entity_id?: string
              _meta?: Json
            }
            Returns: string
          }
        | {
            Args: {
              _action: string
              _actor_user_id: string
              _entity: string
              _entity_id: string
              _meta?: Json
            }
            Returns: string
          }
      next_project_code: { Args: never; Returns: string }
      notify_role: {
        Args: {
          _body: string
          _link: string
          _role: Database["public"]["Enums"]["app_role"]
          _title: string
          _type?: string
        }
        Returns: undefined
      }
      reject_order_as_sales_manager: {
        Args: { _order_id: string; _rejection_reason: string }
        Returns: undefined
      }
      remove_role_from_user: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      send_notification: {
        Args: {
          _body: string
          _link?: string
          _title: string
          _type?: string
          _user_id: string
        }
        Returns: string
      }
      set_order_schedule:
        | {
            Args: { _execution_start_date: string; _order_id: string }
            Returns: undefined
          }
        | {
            Args: {
              _execution_end_date?: string
              _execution_start_date: string
              _order_id: string
            }
            Returns: undefined
          }
      transfer_order_ownership: {
        Args: {
          p_new_customer_id: string
          p_new_hierarchy_id: string
          p_order_id: string
          p_transferred_from_phone: string
          p_transferred_from_user_id: string
        }
        Returns: undefined
      }
      unarchive_daily_report: {
        Args: { p_report_id: string }
        Returns: undefined
      }
      validate_contractor_phone: {
        Args: { _phone_number: string }
        Returns: boolean
      }
      validate_phone_number: { Args: { _phone: string }; Returns: boolean }
      validate_profile_phone: {
        Args: { _phone_number: string }
        Returns: boolean
      }
      verify_otp_code: {
        Args: { _code: string; _phone_number: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "user"
        | "contractor"
        | "scaffold_worker"
        | "scaffold_supervisor"
        | "operations_manager"
        | "finance_manager"
        | "sales_manager"
        | "support_manager"
        | "general_manager"
        | "warehouse_manager"
        | "security_manager"
        | "ceo"
        | "scaffold_executive_manager"
        | "executive_manager_scaffold_execution_with_materials"
        | "rental_executive_manager"
      execution_stage:
        | "awaiting_payment"
        | "order_executed"
        | "awaiting_collection"
        | "in_collection"
        | "collected"
      inventory_tracking: "NONE" | "SN" | "SN_LOT"
      invoice_status: "DRAFT" | "SENT" | "PAID" | "VOID"
      media_type:
        | "INSTALLATION_PROOF"
        | "INSPECTION"
        | "INVOICE_ATTACHMENT"
        | "OTHER"
      notification_channel: "EMAIL" | "SMS" | "INAPP" | "WHATSAPP" | "WEBHOOK"
      order_status:
        | "draft"
        | "pending"
        | "priced"
        | "confirmed"
        | "scheduled"
        | "in_progress"
        | "done"
        | "canceled"
      payment_status: "UNBILLED" | "INVOICED" | "PARTIAL" | "SETTLED"
      payment_status_enum: "PENDING" | "PAID" | "FAILED" | "REFUNDED"
      project_status: "ACTIVE" | "ARCHIVED"
      project_status_v3:
        | "draft"
        | "pending_execution"
        | "active"
        | "completed"
        | "pending"
        | "approved"
        | "rejected"
        | "in_progress"
        | "paid"
        | "closed"
        | "scheduled"
      rating_context:
        | "project_completion"
        | "service_quality"
        | "communication"
        | "professionalism"
        | "punctuality"
      rating_type:
        | "customer_to_contractor"
        | "contractor_to_customer"
        | "staff_to_contractor"
        | "contractor_to_staff"
        | "customer_to_staff"
        | "staff_to_customer"
      request_source: "PORTAL" | "AGENT" | "API"
      reservation_status: "RESERVED" | "PICKED" | "RETURNED"
      service_line_source: "BOM" | "ADHOC"
      service_status:
        | "NEW"
        | "SCHEDULED"
        | "IN_PROGRESS"
        | "DONE_PENDING_QC"
        | "DONE"
        | "CLOSED"
        | "UNDER_REVIEW"
        | "CANCELLED"
      staff_role_type:
        | "manager"
        | "supervisor"
        | "operations_manager"
        | "support"
        | "accounting"
        | "sales"
        | "warehouse"
        | "hr"
      task_status: "OPEN" | "IN_PROGRESS" | "DONE" | "BLOCKED"
      task_type:
        | "execution_schedule"
        | "contractor_assignment"
        | "warehouse_pick"
        | "procurement"
        | "qc"
        | "finance"
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
    Enums: {
      app_role: [
        "admin",
        "user",
        "contractor",
        "scaffold_worker",
        "scaffold_supervisor",
        "operations_manager",
        "finance_manager",
        "sales_manager",
        "support_manager",
        "general_manager",
        "warehouse_manager",
        "security_manager",
        "ceo",
        "scaffold_executive_manager",
        "executive_manager_scaffold_execution_with_materials",
        "rental_executive_manager",
      ],
      execution_stage: [
        "awaiting_payment",
        "order_executed",
        "awaiting_collection",
        "in_collection",
        "collected",
      ],
      inventory_tracking: ["NONE", "SN", "SN_LOT"],
      invoice_status: ["DRAFT", "SENT", "PAID", "VOID"],
      media_type: [
        "INSTALLATION_PROOF",
        "INSPECTION",
        "INVOICE_ATTACHMENT",
        "OTHER",
      ],
      notification_channel: ["EMAIL", "SMS", "INAPP", "WHATSAPP", "WEBHOOK"],
      order_status: [
        "draft",
        "pending",
        "priced",
        "confirmed",
        "scheduled",
        "in_progress",
        "done",
        "canceled",
      ],
      payment_status: ["UNBILLED", "INVOICED", "PARTIAL", "SETTLED"],
      payment_status_enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
      project_status: ["ACTIVE", "ARCHIVED"],
      project_status_v3: [
        "draft",
        "pending_execution",
        "active",
        "completed",
        "pending",
        "approved",
        "rejected",
        "in_progress",
        "paid",
        "closed",
        "scheduled",
      ],
      rating_context: [
        "project_completion",
        "service_quality",
        "communication",
        "professionalism",
        "punctuality",
      ],
      rating_type: [
        "customer_to_contractor",
        "contractor_to_customer",
        "staff_to_contractor",
        "contractor_to_staff",
        "customer_to_staff",
        "staff_to_customer",
      ],
      request_source: ["PORTAL", "AGENT", "API"],
      reservation_status: ["RESERVED", "PICKED", "RETURNED"],
      service_line_source: ["BOM", "ADHOC"],
      service_status: [
        "NEW",
        "SCHEDULED",
        "IN_PROGRESS",
        "DONE_PENDING_QC",
        "DONE",
        "CLOSED",
        "UNDER_REVIEW",
        "CANCELLED",
      ],
      staff_role_type: [
        "manager",
        "supervisor",
        "operations_manager",
        "support",
        "accounting",
        "sales",
        "warehouse",
        "hr",
      ],
      task_status: ["OPEN", "IN_PROGRESS", "DONE", "BLOCKED"],
      task_type: [
        "execution_schedule",
        "contractor_assignment",
        "warehouse_pick",
        "procurement",
        "qc",
        "finance",
      ],
    },
  },
} as const
