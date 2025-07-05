export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
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
            referencedRelation: "mv_location_motorcycle_counts"
            referencedColumns: ["province_id"]
          },
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
          created_at: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          name?: string
          updated_at?: string
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
          {
            foreignKeyName: "provinces_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "mv_location_motorcycle_counts"
            referencedColumns: ["country_code"]
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
          {
            foreignKeyName: "rental_shops_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "mv_location_motorcycle_counts"
            referencedColumns: ["city_id"]
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
      mv_location_motorcycle_counts: {
        Row: {
          avg_rating: number | null
          city_id: string | null
          city_name: string | null
          country_code: string | null
          country_name: string | null
          max_price: number | null
          min_price: number | null
          motorcycle_count: number | null
          province_id: string | null
          province_name: string | null
          shop_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_flagged_content_changes: {
        Args: { flagged_content_id: string; admin_id: string }
        Returns: boolean
      }
      assign_admin_by_email: {
        Args: { user_email: string }
        Returns: string
      }
      authorize: {
        Args: {
          requested_permission: Database["public"]["Enums"]["app_permission"]
        }
        Returns: boolean
      }
      clear_all_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      custom_access_token_hook: {
        Args: { event: Json }
        Returns: Json
      }
      generate_slug: {
        Args: { "": string }
        Returns: string
      }
      get_flagged_content_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_pending: number
          total_under_review: number
          total_approved: number
          total_applied: number
          total_rejected: number
          critical_pending: number
          motorcycle_flags: number
          rental_shop_flags: number
        }[]
      }
      get_query_performance_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          query_type: string
          avg_duration_ms: number
          total_calls: number
          cache_hit_ratio: number
        }[]
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      refresh_location_counts: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      search_locations_with_counts: {
        Args: { search_query: string; result_limit?: number }
        Returns: {
          type: string
          id: string
          name: string
          parent_name: string
          full_name: string
          motorcycle_count: number
          shop_count: number
        }[]
      }
      unaccent: {
        Args: { "": string }
        Returns: string
      }
      unaccent_init: {
        Args: { "": unknown }
        Returns: unknown
      }
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
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
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
    },
  },
} as const 