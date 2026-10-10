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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      analytics_snapshots: {
        Row: {
          created_at: string
          data: Json
          id: number
          snapshot_date: string
        }
        Insert: {
          created_at?: string
          data: Json
          id?: number
          snapshot_date?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: number
          snapshot_date?: string
        }
        Relationships: []
      }
      brands: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      business_statuses: {
        Row: {
          created_at: string
          description: string | null
          id: number
          status_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: number
          status_code: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          status_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      change_proposals: {
        Row: {
          agent_run_id: string | null
          applied_at: string | null
          created_at: string
          id: string
          notes: string | null
          raw_snapshot: Json
          reviewed_at: string | null
          reviewed_by: string | null
          shop_id: string
          source_url: string
          status: 'pending' | 'reviewing' | 'applied' | 'partially_applied' | 'rejected'
          summary_counts: Json
          updated_at: string
        }
        Insert: {
          agent_run_id?: string | null
          applied_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          raw_snapshot: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          shop_id: string
          source_url: string
          status?: 'pending' | 'reviewing' | 'applied' | 'partially_applied' | 'rejected'
          summary_counts?: Json
          updated_at?: string
        }
        Update: {
          agent_run_id?: string | null
          applied_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          raw_snapshot?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          shop_id?: string
          source_url?: string
          status?: 'pending' | 'reviewing' | 'applied' | 'partially_applied' | 'rejected'
          summary_counts?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_proposals_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "rental_shops"
            referencedColumns: ["id"]
          },
        ]
      }
      change_proposal_items: {
        Row: {
          action: 'add' | 'update' | 'delist'
          brand_name: string | null
          created_at: string
          diff_summary: Json | null
          entity_id: string | null
          entity_type: 'motorcycle' | 'rental_shop' | 'rental_rate_tier' | 'motorcycle_condition' | 'rental_shop_inclusion'
          id: string
          model_name: string | null
          original_data: Json | null
          proposed_data: Json
          proposal_id: string
          status: 'pending' | 'approved' | 'rejected' | 'applied'
        }
        Insert: {
          action: 'add' | 'update' | 'delist'
          brand_name?: string | null
          created_at?: string
          diff_summary?: Json | null
          entity_id?: string | null
          entity_type: 'motorcycle' | 'rental_shop' | 'rental_rate_tier' | 'motorcycle_condition' | 'rental_shop_inclusion'
          id?: string
          model_name?: string | null
          original_data?: Json | null
          proposed_data: Json
          proposal_id: string
          status?: 'pending' | 'approved' | 'rejected' | 'applied'
        }
        Update: {
          action?: 'add' | 'update' | 'delist'
          brand_name?: string | null
          created_at?: string
          diff_summary?: Json | null
          entity_id?: string | null
          entity_type?: 'motorcycle' | 'rental_shop' | 'rental_rate_tier' | 'motorcycle_condition' | 'rental_shop_inclusion'
          id?: string
          model_name?: string | null
          original_data?: Json | null
          proposed_data?: Json
          proposal_id?: string
          status?: 'pending' | 'approved' | 'rejected' | 'applied'
        }
        Relationships: [
          {
            foreignKeyName: "change_proposal_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "change_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          created_at: string
          id: string
          name: string
          province_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          province_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          province_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cities_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      condition_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      countries: {
        Row: {
          code: string
          content_sections: Json | null
          created_at: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          content_sections?: Json | null
          created_at?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          content_sections?: Json | null
          created_at?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      data_freshness: {
        Row: {
          content_type: Database["public"]["Enums"]["freshness_content_type"]
          created_at: string | null
          data_source: string | null
          days_since_update: number
          entity_id: string
          freshness_status: Database["public"]["Enums"]["freshness_status"]
          id: string
          last_updated_at: string
          metadata: Json | null
          updated_at: string | null
        }
        Insert: {
          content_type: Database["public"]["Enums"]["freshness_content_type"]
          created_at?: string | null
          data_source?: string | null
          days_since_update: number
          entity_id: string
          freshness_status: Database["public"]["Enums"]["freshness_status"]
          id?: string
          last_updated_at: string
          metadata?: Json | null
          updated_at?: string | null
        }
        Update: {
          content_type?: Database["public"]["Enums"]["freshness_content_type"]
          created_at?: string | null
          data_source?: string | null
          days_since_update?: number
          entity_id?: string
          freshness_status?: Database["public"]["Enums"]["freshness_status"]
          id?: string
          last_updated_at?: string
          metadata?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      features: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      flagged_content: {
        Row: {
          admin_notes: string | null
          applied_at: string | null
          applied_by_admin_id: string | null
          content_type: Database["public"]["Enums"]["content_type"]
          created_at: string | null
          entity_id: string
          flag_category: Database["public"]["Enums"]["flag_category"]
          flag_reason: string
          flagged_by_email: string | null
          flagged_by_user_id: string | null
          id: string
          is_verified: boolean | null
          original_data: Json
          priority: number | null
          proposed_data: Json
          reviewed_at: string | null
          reviewed_by_admin_id: string | null
          status: Database["public"]["Enums"]["flag_status"]
        }
        Insert: {
          admin_notes?: string | null
          applied_at?: string | null
          applied_by_admin_id?: string | null
          content_type: Database["public"]["Enums"]["content_type"]
          created_at?: string | null
          entity_id: string
          flag_category: Database["public"]["Enums"]["flag_category"]
          flag_reason: string
          flagged_by_email?: string | null
          flagged_by_user_id?: string | null
          id?: string
          is_verified?: boolean | null
          original_data: Json
          priority?: number | null
          proposed_data: Json
          reviewed_at?: string | null
          reviewed_by_admin_id?: string | null
          status?: Database["public"]["Enums"]["flag_status"]
        }
        Update: {
          admin_notes?: string | null
          applied_at?: string | null
          applied_by_admin_id?: string | null
          content_type?: Database["public"]["Enums"]["content_type"]
          created_at?: string | null
          entity_id?: string
          flag_category?: Database["public"]["Enums"]["flag_category"]
          flag_reason?: string
          flagged_by_email?: string | null
          flagged_by_user_id?: string | null
          id?: string
          is_verified?: boolean | null
          original_data?: Json
          priority?: number | null
          proposed_data?: Json
          reviewed_at?: string | null
          reviewed_by_admin_id?: string | null
          status?: Database["public"]["Enums"]["flag_status"]
        }
        Relationships: []
      }
      flagged_content_changes: {
        Row: {
          change_type: string
          created_at: string | null
          field_name: string
          field_path: string | null
          flagged_content_id: string
          id: string
          is_critical: boolean | null
          original_value: string | null
          proposed_value: string
        }
        Insert: {
          change_type?: string
          created_at?: string | null
          field_name: string
          field_path?: string | null
          flagged_content_id: string
          id?: string
          is_critical?: boolean | null
          original_value?: string | null
          proposed_value: string
        }
        Update: {
          change_type?: string
          created_at?: string | null
          field_name?: string
          field_path?: string | null
          flagged_content_id?: string
          id?: string
          is_critical?: boolean | null
          original_value?: string | null
          proposed_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "flagged_content_changes_flagged_content_id_fkey"
            columns: ["flagged_content_id"]
            isOneToOne: false
            referencedRelation: "flagged_content"
            referencedColumns: ["id"]
          },
        ]
      }
      images: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          url: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          url: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          url?: string
        }
        Relationships: []
      }
      insurance_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      motorcycle_conditions: {
        Row: {
          condition_type_id: string
          motorcycle_id: string
          notes: string | null
        }
        Insert: {
          condition_type_id: string
          motorcycle_id: string
          notes?: string | null
        }
        Update: {
          condition_type_id?: string
          motorcycle_id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "motorcycle_conditions_condition_type_id_fkey"
            columns: ["condition_type_id"]
            isOneToOne: false
            referencedRelation: "condition_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motorcycle_conditions_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycle_rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      motorcycle_features: {
        Row: {
          feature_id: string
          motorcycle_id: string
        }
        Insert: {
          feature_id: string
          motorcycle_id: string
        }
        Update: {
          feature_id?: string
          motorcycle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "motorcycle_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motorcycle_features_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycle_rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      motorcycle_images: {
        Row: {
          image_id: string
          motorcycle_id: string
          sort_order: number | null
        }
        Insert: {
          image_id: string
          motorcycle_id: string
          sort_order?: number | null
        }
        Update: {
          image_id?: string
          motorcycle_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "motorcycle_images_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motorcycle_images_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycle_rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      motorcycle_insurance_details: {
        Row: {
          cost_currency: string | null
          cost_per_day: number | null
          deductible: number | null
          deductible_currency: string | null
          id: string
          insurance_type_id: string
          is_included: boolean
          motorcycle_id: string
          notes: string | null
        }
        Insert: {
          cost_currency?: string | null
          cost_per_day?: number | null
          deductible?: number | null
          deductible_currency?: string | null
          id?: string
          insurance_type_id: string
          is_included?: boolean
          motorcycle_id: string
          notes?: string | null
        }
        Update: {
          cost_currency?: string | null
          cost_per_day?: number | null
          deductible?: number | null
          deductible_currency?: string | null
          id?: string
          insurance_type_id?: string
          is_included?: boolean
          motorcycle_id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "motorcycle_insurance_details_insurance_type_id_fkey"
            columns: ["insurance_type_id"]
            isOneToOne: false
            referencedRelation: "insurance_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motorcycle_insurance_details_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycle_rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      motorcycle_rentals: {
        Row: {
          availability_status: string | null
          brand_id: string
          category_id: string | null
          conditions_details: Json | null
          created_at: string
          engine_capacity_cc: number | null
          id: string
          model: string
          rental_rate_currency: string | null
          rental_rate_per_day: number | null
          shop_id: string
          source_url: string | null
          specifications_details: Json | null
          updated_at: string
          year: number | null
        }
        Insert: {
          availability_status?: string | null
          brand_id: string
          category_id?: string | null
          conditions_details?: Json | null
          created_at?: string
          engine_capacity_cc?: number | null
          id?: string
          model: string
          rental_rate_currency?: string | null
          rental_rate_per_day?: number | null
          shop_id: string
          source_url?: string | null
          specifications_details?: Json | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          availability_status?: string | null
          brand_id?: string
          category_id?: string | null
          conditions_details?: Json | null
          created_at?: string
          engine_capacity_cc?: number | null
          id?: string
          model?: string
          rental_rate_currency?: string | null
          rental_rate_per_day?: number | null
          shop_id?: string
          source_url?: string | null
          specifications_details?: Json | null
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "motorcycle_rentals_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motorcycle_rentals_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motorcycle_rentals_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "rental_shops"
            referencedColumns: ["id"]
          },
        ]
      }
      motorcycle_required_documents: {
        Row: {
          document_type_id: string
          motorcycle_id: string
        }
        Insert: {
          document_type_id: string
          motorcycle_id: string
        }
        Update: {
          document_type_id?: string
          motorcycle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "motorcycle_required_documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "required_document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motorcycle_required_documents_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycle_rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      premium_analytics: {
        Row: {
          created_at: string | null
          id: string
          metadata: Json | null
          metric_type: Database["public"]["Enums"]["premium_metric_type"]
          metric_value: number
          premium_listing_id: string
          recorded_date: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          metric_type: Database["public"]["Enums"]["premium_metric_type"]
          metric_value?: number
          premium_listing_id: string
          recorded_date: string
        }
        Update: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          metric_type?: Database["public"]["Enums"]["premium_metric_type"]
          metric_value?: number
          premium_listing_id?: string
          recorded_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "premium_analytics_premium_listing_id_fkey"
            columns: ["premium_listing_id"]
            isOneToOne: false
            referencedRelation: "premium_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      premium_listings: {
        Row: {
          admin_notes: string | null
          auto_renew: boolean | null
          content_type: Database["public"]["Enums"]["premium_content_type"]
          created_at: string | null
          created_by: string | null
          currency: string | null
          end_date: string
          entity_id: string
          id: string
          premium_tier: Database["public"]["Enums"]["premium_tier"]
          price_paid: number | null
          pricing_plan_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["premium_status"]
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          admin_notes?: string | null
          auto_renew?: boolean | null
          content_type: Database["public"]["Enums"]["premium_content_type"]
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          end_date: string
          entity_id: string
          id?: string
          premium_tier: Database["public"]["Enums"]["premium_tier"]
          price_paid?: number | null
          pricing_plan_id?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["premium_status"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          admin_notes?: string | null
          auto_renew?: boolean | null
          content_type?: Database["public"]["Enums"]["premium_content_type"]
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          end_date?: string
          entity_id?: string
          id?: string
          premium_tier?: Database["public"]["Enums"]["premium_tier"]
          price_paid?: number | null
          pricing_plan_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["premium_status"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "premium_listings_pricing_plan_id_fkey"
            columns: ["pricing_plan_id"]
            isOneToOne: false
            referencedRelation: "premium_pricing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      premium_pricing_plans: {
        Row: {
          created_at: string | null
          currency: string
          description: string | null
          duration_days: number
          features: Json | null
          id: string
          is_active: boolean | null
          price: number
          tier: Database["public"]["Enums"]["premium_tier"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string
          description?: string | null
          duration_days: number
          features?: Json | null
          id?: string
          is_active?: boolean | null
          price: number
          tier: Database["public"]["Enums"]["premium_tier"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string
          description?: string | null
          duration_days?: number
          features?: Json | null
          id?: string
          is_active?: boolean | null
          price?: number
          tier?: Database["public"]["Enums"]["premium_tier"]
          updated_at?: string | null
        }
        Relationships: []
      }
      provinces: {
        Row: {
          country_code: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          country_code: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          country_code?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provinces_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      rental_rate_tiers: {
        Row: {
          currency: string
          id: string
          max_days: number | null
          min_days: number
          motorcycle_id: string
          rate_per_day: number
        }
        Insert: {
          currency: string
          id?: string
          max_days?: number | null
          min_days: number
          motorcycle_id: string
          rate_per_day: number
        }
        Update: {
          currency?: string
          id?: string
          max_days?: number | null
          min_days?: number
          motorcycle_id?: string
          rate_per_day?: number
        }
        Relationships: [
          {
            foreignKeyName: "rental_rate_tiers_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycle_rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_shop_conditions: {
        Row: {
          condition_type_id: string
          condition_value: string
          created_at: string | null
          id: string
          notes: string | null
          shop_id: string
          updated_at: string | null
        }
        Insert: {
          condition_type_id: string
          condition_value: string
          created_at?: string | null
          id?: string
          notes?: string | null
          shop_id: string
          updated_at?: string | null
        }
        Update: {
          condition_type_id?: string
          condition_value?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          shop_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rental_shop_conditions_condition_type_id_fkey"
            columns: ["condition_type_id"]
            isOneToOne: false
            referencedRelation: "condition_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_shop_conditions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "rental_shops"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_shop_inclusions: {
        Row: {
          created_at: string
          id: string
          inclusion_text: string
          shop_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          inclusion_text: string
          shop_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          inclusion_text?: string
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_shop_inclusions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "rental_shops"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_shop_service_locations: {
        Row: {
          created_at: string
          id: string
          location_name: string
          shop_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_name: string
          shop_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          location_name?: string
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_shop_service_locations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "rental_shops"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_shop_tours: {
        Row: {
          created_at: string
          currency: string | null
          distance_km: number | null
          duration_text: string | null
          id: string
          name: string
          price_text: string | null
          shop_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          distance_km?: number | null
          duration_text?: string | null
          id?: string
          name: string
          price_text?: string | null
          shop_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          distance_km?: number | null
          duration_text?: string | null
          id?: string
          name?: string
          price_text?: string | null
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_shop_tours_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "rental_shops"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_shops: {
        Row: {
          business_description: string | null
          business_status_id: number | null
          city_id: string | null
          created_at: string
          full_address: string
          google_maps_url: string | null
          id: string
          latitude: number | null
          location_name: string | null
          longitude: number | null
          phone: string | null
          place_id: string | null
          provider_name: string
          rating: number | null
          review_count: number | null
          slug: string
          updated_at: string
          website: string | null
        }
        Insert: {
          business_description?: string | null
          business_status_id?: number | null
          city_id?: string | null
          created_at?: string
          full_address: string
          google_maps_url?: string | null
          id?: string
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          phone?: string | null
          place_id?: string | null
          provider_name: string
          rating?: number | null
          review_count?: number | null
          slug: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          business_description?: string | null
          business_status_id?: number | null
          city_id?: string | null
          created_at?: string
          full_address?: string
          google_maps_url?: string | null
          id?: string
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          phone?: string | null
          place_id?: string | null
          provider_name?: string
          rating?: number | null
          review_count?: number | null
          slug?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rental_shops_business_status_id_fkey"
            columns: ["business_status_id"]
            isOneToOne: false
            referencedRelation: "business_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_shops_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_agent_configs: {
        Row: {
          consecutive_errors: number
          created_at: string
          extraction_hints: string | null
          id: string
          is_active: boolean
          last_error: string | null
          last_run_at: string | null
          shop_id: string
          source_url: string
          tier: number
          updated_at: string
        }
        Insert: {
          consecutive_errors?: number
          created_at?: string
          extraction_hints?: string | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_run_at?: string | null
          shop_id: string
          source_url: string
          tier?: number
          updated_at?: string
        }
        Update: {
          consecutive_errors?: number
          created_at?: string
          extraction_hints?: string | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_run_at?: string | null
          shop_id?: string
          source_url?: string
          tier?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_agent_configs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "rental_shops"
            referencedColumns: ["id"]
          },
        ]
      }
      required_document_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          id: number
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: number
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: number
          permission?: Database["public"]["Enums"]["app_permission"]
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: number
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          role?: Database["public"]["Enums"]["app_role"]
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
      apply_flagged_content_changes: {
        Args: { admin_id: string; flagged_content_id: string }
        Returns: boolean
      }
      authorize: {
        Args: {
          requested_permission: Database["public"]["Enums"]["app_permission"]
        }
        Returns: boolean
      }
      calculate_freshness_status: {
        Args: { days_since_update: number }
        Returns: Database["public"]["Enums"]["freshness_status"]
      }
      capture_daily_analytics_snapshot: { Args: never; Returns: Json }
      clear_all_data: { Args: never; Returns: undefined }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      expire_premium_listings: { Args: never; Returns: number }
      generate_slug: { Args: { "": string }; Returns: string }
      get_brand_distribution: {
        Args: never
        Returns: {
          avg_engine_size: number
          avg_price: number
          brand: string
          count: number
        }[]
      }
      get_category_distribution: {
        Args: never
        Returns: {
          avg_engine_size: number
          avg_price: number
          category: string
          count: number
        }[]
      }
      get_data_freshness_stats: {
        Args: never
        Returns: {
          fresh_entities: number
          fresh_percentage: number
          motorcycle_fresh: number
          motorcycle_stale: number
          motorcycle_very_stale: number
          oldest_motorcycle_days: number
          oldest_shop_days: number
          shop_fresh: number
          shop_stale: number
          shop_very_stale: number
          stale_entities: number
          stale_percentage: number
          total_entities: number
          very_stale_entities: number
          very_stale_percentage: number
        }[]
      }
      get_entities_by_freshness: {
        Args: {
          p_content_type?: Database["public"]["Enums"]["freshness_content_type"]
          p_freshness_status?: Database["public"]["Enums"]["freshness_status"]
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          content_type: Database["public"]["Enums"]["freshness_content_type"]
          days_since_update: number
          entity_id: string
          entity_name: string
          freshness_status: Database["public"]["Enums"]["freshness_status"]
          id: string
          last_updated_at: string
          location_info: string
        }[]
      }
      get_flagged_content_stats: {
        Args: never
        Returns: {
          critical_pending: number
          motorcycle_flags: number
          rental_shop_flags: number
          total_applied: number
          total_approved: number
          total_pending: number
          total_rejected: number
          total_under_review: number
        }[]
      }
      get_geographic_distribution: {
        Args: never
        Returns: {
          city: string
          country: string
          shop_count: number
        }[]
      }
      get_premium_analytics_summary: {
        Args: {
          p_end_date?: string
          p_listing_id: string
          p_start_date?: string
        }
        Returns: {
          avg_daily_value: number
          days_tracked: number
          metric_type: Database["public"]["Enums"]["premium_metric_type"]
          total_value: number
        }[]
      }
      get_premium_dashboard_stats: {
        Args: never
        Returns: {
          expiring_soon: number
          new_listings_this_month: number
          revenue_last_month: number
          revenue_this_month: number
          total_active_listings: number
          total_expired_listings: number
        }[]
      }
      insert_daily_snapshot: { Args: never; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      make_user_admin: { Args: { user_email: string }; Returns: boolean }
      refresh_data_freshness: {
        Args: never
        Returns: {
          fresh_count: number
          stale_count: number
          updated_count: number
          very_stale_count: number
        }[]
      }
      remove_user_admin: { Args: { user_email: string }; Returns: boolean }
    }
    Enums: {
      app_permission:
        | "content.moderate"
        | "premium.manage"
        | "analytics.view"
        | "system.manage"
      app_role: "admin" | "user"
      content_type:
        | "motorcycle"
        | "rental_shop"
        | "motorcycle_feature"
        | "motorcycle_condition"
        | "motorcycle_insurance"
        | "rental_shop_inclusion"
        | "rental_shop_tour"
      flag_category:
        | "incorrect_info"
        | "outdated_info"
        | "missing_info"
        | "inappropriate_content"
        | "pricing_error"
        | "contact_error"
        | "location_error"
        | "specification_error"
        | "availability_error"
        | "other"
      flag_status:
        | "pending"
        | "under_review"
        | "approved"
        | "rejected"
        | "applied"
      freshness_content_type: "motorcycle" | "rental_shop"
      freshness_status: "fresh" | "stale" | "very_stale"
      premium_content_type: "motorcycle" | "rental_shop"
      premium_metric_type:
        | "views"
        | "clicks"
        | "inquiries"
        | "conversions"
        | "favorites"
      premium_status: "active" | "expired" | "paused" | "cancelled"
      premium_tier: "gold" | "platinum" | "featured"
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
      app_permission: [
        "content.moderate",
        "premium.manage",
        "analytics.view",
        "system.manage",
      ],
      app_role: ["admin", "user"],
      content_type: [
        "motorcycle",
        "rental_shop",
        "motorcycle_feature",
        "motorcycle_condition",
        "motorcycle_insurance",
        "rental_shop_inclusion",
        "rental_shop_tour",
      ],
      flag_category: [
        "incorrect_info",
        "outdated_info",
        "missing_info",
        "inappropriate_content",
        "pricing_error",
        "contact_error",
        "location_error",
        "specification_error",
        "availability_error",
        "other",
      ],
      flag_status: [
        "pending",
        "under_review",
        "approved",
        "rejected",
        "applied",
      ],
      freshness_content_type: ["motorcycle", "rental_shop"],
      freshness_status: ["fresh", "stale", "very_stale"],
      premium_content_type: ["motorcycle", "rental_shop"],
      premium_metric_type: [
        "views",
        "clicks",
        "inquiries",
        "conversions",
        "favorites",
      ],
      premium_status: ["active", "expired", "paused", "cancelled"],
      premium_tier: ["gold", "platinum", "featured"],
    },
  },
} as const
