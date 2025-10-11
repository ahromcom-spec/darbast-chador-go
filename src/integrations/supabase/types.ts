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
          {
            foreignKeyName: "contractor_services_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "public_contractors_directory"
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
          customer_code: string
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          customer_code: string
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          customer_code?: string
          id?: string
          updated_at?: string | null
          user_id?: string
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
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
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
            foreignKeyName: "project_assignments_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "public_contractors_directory"
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
          code: string
          contractor_id: string | null
          created_at: string | null
          customer_id: string
          detailed_address: string | null
          district_id: string | null
          id: string
          notes: string | null
          project_number: string
          province_id: string
          service_code: string
          status: Database["public"]["Enums"]["project_status_v3"] | null
          subcategory_id: string
          updated_at: string | null
        }
        Insert: {
          address: string
          code: string
          contractor_id?: string | null
          created_at?: string | null
          customer_id: string
          detailed_address?: string | null
          district_id?: string | null
          id?: string
          notes?: string | null
          project_number: string
          province_id: string
          service_code: string
          status?: Database["public"]["Enums"]["project_status_v3"] | null
          subcategory_id: string
          updated_at?: string | null
        }
        Update: {
          address?: string
          code?: string
          contractor_id?: string | null
          created_at?: string | null
          customer_id?: string
          detailed_address?: string | null
          district_id?: string | null
          id?: string
          notes?: string | null
          project_number?: string
          province_id?: string
          service_code?: string
          status?: Database["public"]["Enums"]["project_status_v3"] | null
          subcategory_id?: string
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
            foreignKeyName: "projects_v3_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "public_contractors_directory"
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
          location_coordinates: unknown | null
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
          location_coordinates?: unknown | null
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
          location_coordinates?: unknown | null
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
            foreignKeyName: "services_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "public_contractors_directory"
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
      staff_whitelist: {
        Row: {
          allowed_role: Database["public"]["Enums"]["app_role"]
          created_at: string | null
          created_by: string | null
          id: string
          note: string | null
          phone: string
        }
        Insert: {
          allowed_role: Database["public"]["Enums"]["app_role"]
          created_at?: string | null
          created_by?: string | null
          id?: string
          note?: string | null
          phone: string
        }
        Update: {
          allowed_role?: Database["public"]["Enums"]["app_role"]
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
      public_contractors_directory: {
        Row: {
          company_name: string | null
          created_at: string | null
          description: string | null
          experience_years: number | null
          general_location: string | null
          id: string | null
          is_approved: boolean | null
          services: Json | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_directory_rate_limit: {
        Args: { _user_id: string }
        Returns: boolean
      }
      check_otp_rate_limit: {
        Args: { _phone_number: string }
        Returns: boolean
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
      cleanup_expired_otps: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      generate_customer_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_project_code: {
        Args: {
          _customer_id: string
          _province_id: string
          _subcategory_id: string
        }
        Returns: string
      }
      get_contractor_contact_info: {
        Args: { _contractor_id: string }
        Returns: {
          contact_person: string
          email: string
          phone_number: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_audit: {
        Args: {
          _action: string
          _actor_user_id: string
          _entity: string
          _entity_id: string
          _meta?: Json
        }
        Returns: string
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
      inventory_tracking: "NONE" | "SN" | "SN_LOT"
      invoice_status: "DRAFT" | "SENT" | "PAID" | "VOID"
      media_type:
        | "INSTALLATION_PROOF"
        | "INSPECTION"
        | "INVOICE_ATTACHMENT"
        | "OTHER"
      notification_channel: "EMAIL" | "SMS" | "INAPP" | "WHATSAPP" | "WEBHOOK"
      payment_status: "UNBILLED" | "INVOICED" | "PARTIAL" | "SETTLED"
      payment_status_enum: "PENDING" | "PAID" | "FAILED" | "REFUNDED"
      project_status: "ACTIVE" | "ARCHIVED"
      project_status_v3: "draft" | "pending_execution" | "active" | "completed"
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
      payment_status: ["UNBILLED", "INVOICED", "PARTIAL", "SETTLED"],
      payment_status_enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
      project_status: ["ACTIVE", "ARCHIVED"],
      project_status_v3: ["draft", "pending_execution", "active", "completed"],
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
