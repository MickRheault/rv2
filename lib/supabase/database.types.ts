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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      clear_all_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      generate_slug: {
        Args: { "": string }
        Returns: string
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
      [_ in never]: never
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
    Enums: {},
  },
} as const 