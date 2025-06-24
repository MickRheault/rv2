create extension if not exists "unaccent" with schema "public" version '1.1';

create sequence "public"."business_statuses_id_seq";

create table "public"."brands" (
    "id" uuid not null default uuid_generate_v4(),
    "name" text not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


create table "public"."business_statuses" (
    "id" integer not null default nextval('business_statuses_id_seq'::regclass),
    "status_code" text not null,
    "description" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


create table "public"."categories" (
    "id" uuid not null default uuid_generate_v4(),
    "name" text not null,
    "description" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


create table "public"."cities" (
    "id" uuid not null default uuid_generate_v4(),
    "name" text not null,
    "province_id" uuid not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


create table "public"."condition_types" (
    "id" uuid not null default uuid_generate_v4(),
    "name" text not null,
    "description" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


create table "public"."countries" (
    "code" character(2) not null,
    "name" text not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


create table "public"."features" (
    "id" uuid not null default uuid_generate_v4(),
    "name" text not null,
    "description" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


create table "public"."images" (
    "id" uuid not null default uuid_generate_v4(),
    "url" text not null,
    "alt_text" text,
    "created_at" timestamp with time zone not null default now()
);


create table "public"."insurance_types" (
    "id" uuid not null default uuid_generate_v4(),
    "name" text not null,
    "description" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


create table "public"."motorcycle_conditions" (
    "motorcycle_id" uuid not null,
    "condition_type_id" uuid not null,
    "notes" text
);


create table "public"."motorcycle_features" (
    "motorcycle_id" uuid not null,
    "feature_id" uuid not null
);


create table "public"."motorcycle_images" (
    "motorcycle_id" uuid not null,
    "image_id" uuid not null,
    "sort_order" integer default 0
);


create table "public"."motorcycle_insurance_details" (
    "id" uuid not null default uuid_generate_v4(),
    "motorcycle_id" uuid not null,
    "insurance_type_id" uuid not null,
    "is_included" boolean not null default false,
    "cost_per_day" numeric(10,2),
    "cost_currency" character(3),
    "deductible" numeric(12,2),
    "deductible_currency" character(3),
    "notes" text
);


create table "public"."motorcycle_rentals" (
    "id" uuid not null default uuid_generate_v4(),
    "shop_id" uuid not null,
    "brand_id" uuid not null,
    "category_id" uuid,
    "model" text not null,
    "year" integer,
    "engine_capacity_cc" integer,
    "rental_rate_per_day" numeric(10,2),
    "rental_rate_currency" character(3),
    "specifications_details" jsonb,
    "conditions_details" jsonb,
    "availability_status" text,
    "source_url" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


create table "public"."motorcycle_required_documents" (
    "motorcycle_id" uuid not null,
    "document_type_id" uuid not null
);


create table "public"."provinces" (
    "id" uuid not null default uuid_generate_v4(),
    "name" text not null,
    "country_code" character(2) not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


create table "public"."rental_rate_tiers" (
    "id" uuid not null default uuid_generate_v4(),
    "motorcycle_id" uuid not null,
    "min_days" integer not null,
    "max_days" integer,
    "rate_per_day" numeric(10,2) not null,
    "currency" character(3) not null
);


create table "public"."rental_shop_conditions" (
    "id" uuid not null default gen_random_uuid(),
    "shop_id" uuid not null,
    "condition_type_id" uuid not null,
    "condition_value" text not null,
    "notes" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


create table "public"."rental_shop_inclusions" (
    "id" uuid not null default uuid_generate_v4(),
    "shop_id" uuid not null,
    "inclusion_text" text not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


create table "public"."rental_shop_service_locations" (
    "id" uuid not null default uuid_generate_v4(),
    "shop_id" uuid not null,
    "location_name" text not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


create table "public"."rental_shop_tours" (
    "id" uuid not null default uuid_generate_v4(),
    "shop_id" uuid not null,
    "name" text not null,
    "duration_text" text,
    "distance_km" numeric(10,2),
    "price_text" text,
    "currency" character(3),
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


create table "public"."rental_shops" (
    "id" uuid not null default uuid_generate_v4(),
    "provider_name" text not null,
    "location_name" text,
    "place_id" text,
    "full_address" text not null,
    "city_id" uuid,
    "latitude" numeric(10,7),
    "longitude" numeric(10,7),
    "phone" text,
    "website" text,
    "google_maps_url" text,
    "business_status_id" integer,
    "rating" numeric(2,1),
    "review_count" integer,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "slug" text not null,
    "business_description" text
);


create table "public"."required_document_types" (
    "id" uuid not null default uuid_generate_v4(),
    "name" text not null,
    "description" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter sequence "public"."business_statuses_id_seq" owned by "public"."business_statuses"."id";

CREATE UNIQUE INDEX brands_name_key ON public.brands USING btree (name);

CREATE UNIQUE INDEX brands_pkey ON public.brands USING btree (id);

CREATE UNIQUE INDEX business_statuses_pkey ON public.business_statuses USING btree (id);

CREATE UNIQUE INDEX business_statuses_status_code_key ON public.business_statuses USING btree (status_code);

CREATE UNIQUE INDEX categories_name_key ON public.categories USING btree (name);

CREATE UNIQUE INDEX categories_pkey ON public.categories USING btree (id);

CREATE UNIQUE INDEX cities_name_province_id_key ON public.cities USING btree (name, province_id);

CREATE UNIQUE INDEX cities_pkey ON public.cities USING btree (id);

CREATE UNIQUE INDEX condition_types_name_key ON public.condition_types USING btree (name);

CREATE UNIQUE INDEX condition_types_pkey ON public.condition_types USING btree (id);

CREATE UNIQUE INDEX countries_name_key ON public.countries USING btree (name);

CREATE UNIQUE INDEX countries_pkey ON public.countries USING btree (code);

CREATE UNIQUE INDEX features_name_key ON public.features USING btree (name);

CREATE UNIQUE INDEX features_pkey ON public.features USING btree (id);

CREATE INDEX idx_mc_motorcycle_id ON public.motorcycle_conditions USING btree (motorcycle_id);

CREATE INDEX idx_mf_motorcycle_id ON public.motorcycle_features USING btree (motorcycle_id);

CREATE INDEX idx_mi_motorcycle_id ON public.motorcycle_images USING btree (motorcycle_id);

CREATE INDEX idx_mid_motorcycle_id ON public.motorcycle_insurance_details USING btree (motorcycle_id);

CREATE INDEX idx_mr_brand_id ON public.motorcycle_rentals USING btree (brand_id);

CREATE INDEX idx_mr_category_id ON public.motorcycle_rentals USING btree (category_id);

CREATE INDEX idx_mr_cond_details_gin ON public.motorcycle_rentals USING gin (conditions_details);

CREATE INDEX idx_mr_engine_cc ON public.motorcycle_rentals USING btree (engine_capacity_cc);

CREATE INDEX idx_mr_model ON public.motorcycle_rentals USING btree (model);

CREATE INDEX idx_mr_rate_day ON public.motorcycle_rentals USING btree (rental_rate_per_day);

CREATE INDEX idx_mr_shop_id ON public.motorcycle_rentals USING btree (shop_id);

CREATE INDEX idx_mr_spec_details_gin ON public.motorcycle_rentals USING gin (specifications_details);

CREATE INDEX idx_mrd_motorcycle_id ON public.motorcycle_required_documents USING btree (motorcycle_id);

CREATE INDEX idx_rrt_motorcycle_id ON public.rental_rate_tiers USING btree (motorcycle_id);

CREATE INDEX idx_rs_city_id ON public.rental_shops USING btree (city_id);

CREATE INDEX idx_rs_place_id ON public.rental_shops USING btree (place_id);

CREATE INDEX idx_rs_provider_name ON public.rental_shops USING btree (provider_name);

CREATE INDEX idx_rsi_shop_id ON public.rental_shop_inclusions USING btree (shop_id);

CREATE INDEX idx_rssl_shop_id ON public.rental_shop_service_locations USING btree (shop_id);

CREATE INDEX idx_rst_shop_id ON public.rental_shop_tours USING btree (shop_id);

CREATE UNIQUE INDEX images_pkey ON public.images USING btree (id);

CREATE UNIQUE INDEX images_url_key ON public.images USING btree (url);

CREATE UNIQUE INDEX insurance_types_name_key ON public.insurance_types USING btree (name);

CREATE UNIQUE INDEX insurance_types_pkey ON public.insurance_types USING btree (id);

CREATE UNIQUE INDEX motorcycle_conditions_pkey ON public.motorcycle_conditions USING btree (motorcycle_id, condition_type_id);

CREATE UNIQUE INDEX motorcycle_features_pkey ON public.motorcycle_features USING btree (motorcycle_id, feature_id);

CREATE UNIQUE INDEX motorcycle_images_pkey ON public.motorcycle_images USING btree (motorcycle_id, image_id);

CREATE UNIQUE INDEX motorcycle_insurance_details_motorcycle_id_insurance_type_i_key ON public.motorcycle_insurance_details USING btree (motorcycle_id, insurance_type_id);

CREATE UNIQUE INDEX motorcycle_insurance_details_pkey ON public.motorcycle_insurance_details USING btree (id);

CREATE UNIQUE INDEX motorcycle_rentals_pkey ON public.motorcycle_rentals USING btree (id);

CREATE UNIQUE INDEX motorcycle_required_documents_pkey ON public.motorcycle_required_documents USING btree (motorcycle_id, document_type_id);

CREATE UNIQUE INDEX provinces_name_country_code_key ON public.provinces USING btree (name, country_code);

CREATE UNIQUE INDEX provinces_pkey ON public.provinces USING btree (id);

CREATE UNIQUE INDEX rental_rate_tiers_pkey ON public.rental_rate_tiers USING btree (id);

CREATE UNIQUE INDEX rental_shop_conditions_pkey ON public.rental_shop_conditions USING btree (id);

CREATE UNIQUE INDEX rental_shop_conditions_shop_id_condition_type_id_key ON public.rental_shop_conditions USING btree (shop_id, condition_type_id);

CREATE UNIQUE INDEX rental_shop_inclusions_pkey ON public.rental_shop_inclusions USING btree (id);

CREATE UNIQUE INDEX rental_shop_service_locations_pkey ON public.rental_shop_service_locations USING btree (id);

CREATE UNIQUE INDEX rental_shop_tours_pkey ON public.rental_shop_tours USING btree (id);

CREATE UNIQUE INDEX rental_shops_pkey ON public.rental_shops USING btree (id);

CREATE UNIQUE INDEX rental_shops_place_id_key ON public.rental_shops USING btree (place_id);

CREATE UNIQUE INDEX rental_shops_slug_idx ON public.rental_shops USING btree (slug);

CREATE UNIQUE INDEX required_document_types_name_key ON public.required_document_types USING btree (name);

CREATE UNIQUE INDEX required_document_types_pkey ON public.required_document_types USING btree (id);

alter table "public"."brands" add constraint "brands_pkey" PRIMARY KEY using index "brands_pkey";

alter table "public"."business_statuses" add constraint "business_statuses_pkey" PRIMARY KEY using index "business_statuses_pkey";

alter table "public"."categories" add constraint "categories_pkey" PRIMARY KEY using index "categories_pkey";

alter table "public"."cities" add constraint "cities_pkey" PRIMARY KEY using index "cities_pkey";

alter table "public"."condition_types" add constraint "condition_types_pkey" PRIMARY KEY using index "condition_types_pkey";

alter table "public"."countries" add constraint "countries_pkey" PRIMARY KEY using index "countries_pkey";

alter table "public"."features" add constraint "features_pkey" PRIMARY KEY using index "features_pkey";

alter table "public"."images" add constraint "images_pkey" PRIMARY KEY using index "images_pkey";

alter table "public"."insurance_types" add constraint "insurance_types_pkey" PRIMARY KEY using index "insurance_types_pkey";

alter table "public"."motorcycle_conditions" add constraint "motorcycle_conditions_pkey" PRIMARY KEY using index "motorcycle_conditions_pkey";

alter table "public"."motorcycle_features" add constraint "motorcycle_features_pkey" PRIMARY KEY using index "motorcycle_features_pkey";

alter table "public"."motorcycle_images" add constraint "motorcycle_images_pkey" PRIMARY KEY using index "motorcycle_images_pkey";

alter table "public"."motorcycle_insurance_details" add constraint "motorcycle_insurance_details_pkey" PRIMARY KEY using index "motorcycle_insurance_details_pkey";

alter table "public"."motorcycle_rentals" add constraint "motorcycle_rentals_pkey" PRIMARY KEY using index "motorcycle_rentals_pkey";

alter table "public"."motorcycle_required_documents" add constraint "motorcycle_required_documents_pkey" PRIMARY KEY using index "motorcycle_required_documents_pkey";

alter table "public"."provinces" add constraint "provinces_pkey" PRIMARY KEY using index "provinces_pkey";

alter table "public"."rental_rate_tiers" add constraint "rental_rate_tiers_pkey" PRIMARY KEY using index "rental_rate_tiers_pkey";

alter table "public"."rental_shop_conditions" add constraint "rental_shop_conditions_pkey" PRIMARY KEY using index "rental_shop_conditions_pkey";

alter table "public"."rental_shop_inclusions" add constraint "rental_shop_inclusions_pkey" PRIMARY KEY using index "rental_shop_inclusions_pkey";

alter table "public"."rental_shop_service_locations" add constraint "rental_shop_service_locations_pkey" PRIMARY KEY using index "rental_shop_service_locations_pkey";

alter table "public"."rental_shop_tours" add constraint "rental_shop_tours_pkey" PRIMARY KEY using index "rental_shop_tours_pkey";

alter table "public"."rental_shops" add constraint "rental_shops_pkey" PRIMARY KEY using index "rental_shops_pkey";

alter table "public"."required_document_types" add constraint "required_document_types_pkey" PRIMARY KEY using index "required_document_types_pkey";

alter table "public"."brands" add constraint "brands_name_key" UNIQUE using index "brands_name_key";

alter table "public"."business_statuses" add constraint "business_statuses_status_code_key" UNIQUE using index "business_statuses_status_code_key";

alter table "public"."categories" add constraint "categories_name_key" UNIQUE using index "categories_name_key";

alter table "public"."cities" add constraint "cities_name_province_id_key" UNIQUE using index "cities_name_province_id_key";

alter table "public"."cities" add constraint "cities_province_id_fkey" FOREIGN KEY (province_id) REFERENCES provinces(id) ON DELETE RESTRICT not valid;

alter table "public"."cities" validate constraint "cities_province_id_fkey";

alter table "public"."condition_types" add constraint "condition_types_name_key" UNIQUE using index "condition_types_name_key";

alter table "public"."countries" add constraint "countries_name_key" UNIQUE using index "countries_name_key";

alter table "public"."features" add constraint "features_name_key" UNIQUE using index "features_name_key";

alter table "public"."images" add constraint "images_url_key" UNIQUE using index "images_url_key";

alter table "public"."insurance_types" add constraint "insurance_types_name_key" UNIQUE using index "insurance_types_name_key";

alter table "public"."motorcycle_conditions" add constraint "motorcycle_conditions_condition_type_id_fkey" FOREIGN KEY (condition_type_id) REFERENCES condition_types(id) ON DELETE CASCADE not valid;

alter table "public"."motorcycle_conditions" validate constraint "motorcycle_conditions_condition_type_id_fkey";

alter table "public"."motorcycle_conditions" add constraint "motorcycle_conditions_motorcycle_id_fkey" FOREIGN KEY (motorcycle_id) REFERENCES motorcycle_rentals(id) ON DELETE CASCADE not valid;

alter table "public"."motorcycle_conditions" validate constraint "motorcycle_conditions_motorcycle_id_fkey";

alter table "public"."motorcycle_features" add constraint "motorcycle_features_feature_id_fkey" FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE not valid;

alter table "public"."motorcycle_features" validate constraint "motorcycle_features_feature_id_fkey";

alter table "public"."motorcycle_features" add constraint "motorcycle_features_motorcycle_id_fkey" FOREIGN KEY (motorcycle_id) REFERENCES motorcycle_rentals(id) ON DELETE CASCADE not valid;

alter table "public"."motorcycle_features" validate constraint "motorcycle_features_motorcycle_id_fkey";

alter table "public"."motorcycle_images" add constraint "motorcycle_images_image_id_fkey" FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE not valid;

alter table "public"."motorcycle_images" validate constraint "motorcycle_images_image_id_fkey";

alter table "public"."motorcycle_images" add constraint "motorcycle_images_motorcycle_id_fkey" FOREIGN KEY (motorcycle_id) REFERENCES motorcycle_rentals(id) ON DELETE CASCADE not valid;

alter table "public"."motorcycle_images" validate constraint "motorcycle_images_motorcycle_id_fkey";

alter table "public"."motorcycle_insurance_details" add constraint "motorcycle_insurance_details_insurance_type_id_fkey" FOREIGN KEY (insurance_type_id) REFERENCES insurance_types(id) ON DELETE RESTRICT not valid;

alter table "public"."motorcycle_insurance_details" validate constraint "motorcycle_insurance_details_insurance_type_id_fkey";

alter table "public"."motorcycle_insurance_details" add constraint "motorcycle_insurance_details_motorcycle_id_fkey" FOREIGN KEY (motorcycle_id) REFERENCES motorcycle_rentals(id) ON DELETE CASCADE not valid;

alter table "public"."motorcycle_insurance_details" validate constraint "motorcycle_insurance_details_motorcycle_id_fkey";

alter table "public"."motorcycle_insurance_details" add constraint "motorcycle_insurance_details_motorcycle_id_insurance_type_i_key" UNIQUE using index "motorcycle_insurance_details_motorcycle_id_insurance_type_i_key";

alter table "public"."motorcycle_rentals" add constraint "motorcycle_rentals_brand_id_fkey" FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE RESTRICT not valid;

alter table "public"."motorcycle_rentals" validate constraint "motorcycle_rentals_brand_id_fkey";

alter table "public"."motorcycle_rentals" add constraint "motorcycle_rentals_category_id_fkey" FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL not valid;

alter table "public"."motorcycle_rentals" validate constraint "motorcycle_rentals_category_id_fkey";

alter table "public"."motorcycle_rentals" add constraint "motorcycle_rentals_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES rental_shops(id) ON DELETE CASCADE not valid;

alter table "public"."motorcycle_rentals" validate constraint "motorcycle_rentals_shop_id_fkey";

alter table "public"."motorcycle_required_documents" add constraint "motorcycle_required_documents_document_type_id_fkey" FOREIGN KEY (document_type_id) REFERENCES required_document_types(id) ON DELETE CASCADE not valid;

alter table "public"."motorcycle_required_documents" validate constraint "motorcycle_required_documents_document_type_id_fkey";

alter table "public"."motorcycle_required_documents" add constraint "motorcycle_required_documents_motorcycle_id_fkey" FOREIGN KEY (motorcycle_id) REFERENCES motorcycle_rentals(id) ON DELETE CASCADE not valid;

alter table "public"."motorcycle_required_documents" validate constraint "motorcycle_required_documents_motorcycle_id_fkey";

alter table "public"."provinces" add constraint "provinces_country_code_fkey" FOREIGN KEY (country_code) REFERENCES countries(code) ON DELETE RESTRICT not valid;

alter table "public"."provinces" validate constraint "provinces_country_code_fkey";

alter table "public"."provinces" add constraint "provinces_name_country_code_key" UNIQUE using index "provinces_name_country_code_key";

alter table "public"."rental_rate_tiers" add constraint "rental_rate_tiers_check" CHECK (((max_days IS NULL) OR (max_days >= min_days))) not valid;

alter table "public"."rental_rate_tiers" validate constraint "rental_rate_tiers_check";

alter table "public"."rental_rate_tiers" add constraint "rental_rate_tiers_min_days_check" CHECK ((min_days > 0)) not valid;

alter table "public"."rental_rate_tiers" validate constraint "rental_rate_tiers_min_days_check";

alter table "public"."rental_rate_tiers" add constraint "rental_rate_tiers_motorcycle_id_fkey" FOREIGN KEY (motorcycle_id) REFERENCES motorcycle_rentals(id) ON DELETE CASCADE not valid;

alter table "public"."rental_rate_tiers" validate constraint "rental_rate_tiers_motorcycle_id_fkey";

alter table "public"."rental_shop_conditions" add constraint "rental_shop_conditions_condition_type_id_fkey" FOREIGN KEY (condition_type_id) REFERENCES condition_types(id) ON DELETE CASCADE not valid;

alter table "public"."rental_shop_conditions" validate constraint "rental_shop_conditions_condition_type_id_fkey";

alter table "public"."rental_shop_conditions" add constraint "rental_shop_conditions_shop_id_condition_type_id_key" UNIQUE using index "rental_shop_conditions_shop_id_condition_type_id_key";

alter table "public"."rental_shop_conditions" add constraint "rental_shop_conditions_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES rental_shops(id) ON DELETE CASCADE not valid;

alter table "public"."rental_shop_conditions" validate constraint "rental_shop_conditions_shop_id_fkey";

alter table "public"."rental_shop_inclusions" add constraint "rental_shop_inclusions_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES rental_shops(id) ON DELETE CASCADE not valid;

alter table "public"."rental_shop_inclusions" validate constraint "rental_shop_inclusions_shop_id_fkey";

alter table "public"."rental_shop_service_locations" add constraint "rental_shop_service_locations_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES rental_shops(id) ON DELETE CASCADE not valid;

alter table "public"."rental_shop_service_locations" validate constraint "rental_shop_service_locations_shop_id_fkey";

alter table "public"."rental_shop_tours" add constraint "rental_shop_tours_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES rental_shops(id) ON DELETE CASCADE not valid;

alter table "public"."rental_shop_tours" validate constraint "rental_shop_tours_shop_id_fkey";

alter table "public"."rental_shops" add constraint "rental_shops_business_status_id_fkey" FOREIGN KEY (business_status_id) REFERENCES business_statuses(id) ON DELETE SET NULL not valid;

alter table "public"."rental_shops" validate constraint "rental_shops_business_status_id_fkey";

alter table "public"."rental_shops" add constraint "rental_shops_city_id_fkey" FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL not valid;

alter table "public"."rental_shops" validate constraint "rental_shops_city_id_fkey";

alter table "public"."rental_shops" add constraint "rental_shops_place_id_key" UNIQUE using index "rental_shops_place_id_key";

alter table "public"."required_document_types" add constraint "required_document_types_name_key" UNIQUE using index "required_document_types_name_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.clear_all_data()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Truncate tables. Using CASCADE handles Foreign Key dependencies automatically.
    -- RESTART IDENTITY resets any sequences (like SERIAL columns).
    -- Ensure the database role running this has TRUNCATE privileges.

    RAISE NOTICE 'Attempting to truncate all seed-related tables...';

    TRUNCATE TABLE
        public.rental_rate_tiers,       -- Assuming 'public' schema
        public.motorcycle_insurance_details,
        public.motorcycle_images,
        public.motorcycle_conditions,
        public.motorcycle_required_documents,
        public.motorcycle_features,
        public.motorcycle_rentals,
        public.images,
        public.rental_shops,
        public.cities,
        public.provinces,
        public.countries,
        public.business_statuses,
        public.brands,
        public.categories,
        public.features,
        public.required_document_types,
        public.insurance_types,
        public.condition_types
    RESTART IDENTITY CASCADE;

    RAISE NOTICE 'Finished truncating tables.';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_slug(text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT 
    lower(
      regexp_replace(
        regexp_replace(
          unaccent($1), 
          '[^\w\s-]', 
          '', 
          'g'
        ),
        '\s+', 
        '-', 
        'g'
      )
    );
$function$
;

CREATE OR REPLACE FUNCTION public.rental_shops_slug_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := generate_slug(NEW.provider_name);
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

grant delete on table "public"."brands" to "anon";

grant insert on table "public"."brands" to "anon";

grant references on table "public"."brands" to "anon";

grant select on table "public"."brands" to "anon";

grant trigger on table "public"."brands" to "anon";

grant truncate on table "public"."brands" to "anon";

grant update on table "public"."brands" to "anon";

grant delete on table "public"."brands" to "authenticated";

grant insert on table "public"."brands" to "authenticated";

grant references on table "public"."brands" to "authenticated";

grant select on table "public"."brands" to "authenticated";

grant trigger on table "public"."brands" to "authenticated";

grant truncate on table "public"."brands" to "authenticated";

grant update on table "public"."brands" to "authenticated";

grant delete on table "public"."brands" to "service_role";

grant insert on table "public"."brands" to "service_role";

grant references on table "public"."brands" to "service_role";

grant select on table "public"."brands" to "service_role";

grant trigger on table "public"."brands" to "service_role";

grant truncate on table "public"."brands" to "service_role";

grant update on table "public"."brands" to "service_role";

grant delete on table "public"."business_statuses" to "anon";

grant insert on table "public"."business_statuses" to "anon";

grant references on table "public"."business_statuses" to "anon";

grant select on table "public"."business_statuses" to "anon";

grant trigger on table "public"."business_statuses" to "anon";

grant truncate on table "public"."business_statuses" to "anon";

grant update on table "public"."business_statuses" to "anon";

grant delete on table "public"."business_statuses" to "authenticated";

grant insert on table "public"."business_statuses" to "authenticated";

grant references on table "public"."business_statuses" to "authenticated";

grant select on table "public"."business_statuses" to "authenticated";

grant trigger on table "public"."business_statuses" to "authenticated";

grant truncate on table "public"."business_statuses" to "authenticated";

grant update on table "public"."business_statuses" to "authenticated";

grant delete on table "public"."business_statuses" to "service_role";

grant insert on table "public"."business_statuses" to "service_role";

grant references on table "public"."business_statuses" to "service_role";

grant select on table "public"."business_statuses" to "service_role";

grant trigger on table "public"."business_statuses" to "service_role";

grant truncate on table "public"."business_statuses" to "service_role";

grant update on table "public"."business_statuses" to "service_role";

grant delete on table "public"."categories" to "anon";

grant insert on table "public"."categories" to "anon";

grant references on table "public"."categories" to "anon";

grant select on table "public"."categories" to "anon";

grant trigger on table "public"."categories" to "anon";

grant truncate on table "public"."categories" to "anon";

grant update on table "public"."categories" to "anon";

grant delete on table "public"."categories" to "authenticated";

grant insert on table "public"."categories" to "authenticated";

grant references on table "public"."categories" to "authenticated";

grant select on table "public"."categories" to "authenticated";

grant trigger on table "public"."categories" to "authenticated";

grant truncate on table "public"."categories" to "authenticated";

grant update on table "public"."categories" to "authenticated";

grant delete on table "public"."categories" to "service_role";

grant insert on table "public"."categories" to "service_role";

grant references on table "public"."categories" to "service_role";

grant select on table "public"."categories" to "service_role";

grant trigger on table "public"."categories" to "service_role";

grant truncate on table "public"."categories" to "service_role";

grant update on table "public"."categories" to "service_role";

grant delete on table "public"."cities" to "anon";

grant insert on table "public"."cities" to "anon";

grant references on table "public"."cities" to "anon";

grant select on table "public"."cities" to "anon";

grant trigger on table "public"."cities" to "anon";

grant truncate on table "public"."cities" to "anon";

grant update on table "public"."cities" to "anon";

grant delete on table "public"."cities" to "authenticated";

grant insert on table "public"."cities" to "authenticated";

grant references on table "public"."cities" to "authenticated";

grant select on table "public"."cities" to "authenticated";

grant trigger on table "public"."cities" to "authenticated";

grant truncate on table "public"."cities" to "authenticated";

grant update on table "public"."cities" to "authenticated";

grant delete on table "public"."cities" to "service_role";

grant insert on table "public"."cities" to "service_role";

grant references on table "public"."cities" to "service_role";

grant select on table "public"."cities" to "service_role";

grant trigger on table "public"."cities" to "service_role";

grant truncate on table "public"."cities" to "service_role";

grant update on table "public"."cities" to "service_role";

grant delete on table "public"."condition_types" to "anon";

grant insert on table "public"."condition_types" to "anon";

grant references on table "public"."condition_types" to "anon";

grant select on table "public"."condition_types" to "anon";

grant trigger on table "public"."condition_types" to "anon";

grant truncate on table "public"."condition_types" to "anon";

grant update on table "public"."condition_types" to "anon";

grant delete on table "public"."condition_types" to "authenticated";

grant insert on table "public"."condition_types" to "authenticated";

grant references on table "public"."condition_types" to "authenticated";

grant select on table "public"."condition_types" to "authenticated";

grant trigger on table "public"."condition_types" to "authenticated";

grant truncate on table "public"."condition_types" to "authenticated";

grant update on table "public"."condition_types" to "authenticated";

grant delete on table "public"."condition_types" to "service_role";

grant insert on table "public"."condition_types" to "service_role";

grant references on table "public"."condition_types" to "service_role";

grant select on table "public"."condition_types" to "service_role";

grant trigger on table "public"."condition_types" to "service_role";

grant truncate on table "public"."condition_types" to "service_role";

grant update on table "public"."condition_types" to "service_role";

grant delete on table "public"."countries" to "anon";

grant insert on table "public"."countries" to "anon";

grant references on table "public"."countries" to "anon";

grant select on table "public"."countries" to "anon";

grant trigger on table "public"."countries" to "anon";

grant truncate on table "public"."countries" to "anon";

grant update on table "public"."countries" to "anon";

grant delete on table "public"."countries" to "authenticated";

grant insert on table "public"."countries" to "authenticated";

grant references on table "public"."countries" to "authenticated";

grant select on table "public"."countries" to "authenticated";

grant trigger on table "public"."countries" to "authenticated";

grant truncate on table "public"."countries" to "authenticated";

grant update on table "public"."countries" to "authenticated";

grant delete on table "public"."countries" to "service_role";

grant insert on table "public"."countries" to "service_role";

grant references on table "public"."countries" to "service_role";

grant select on table "public"."countries" to "service_role";

grant trigger on table "public"."countries" to "service_role";

grant truncate on table "public"."countries" to "service_role";

grant update on table "public"."countries" to "service_role";

grant delete on table "public"."features" to "anon";

grant insert on table "public"."features" to "anon";

grant references on table "public"."features" to "anon";

grant select on table "public"."features" to "anon";

grant trigger on table "public"."features" to "anon";

grant truncate on table "public"."features" to "anon";

grant update on table "public"."features" to "anon";

grant delete on table "public"."features" to "authenticated";

grant insert on table "public"."features" to "authenticated";

grant references on table "public"."features" to "authenticated";

grant select on table "public"."features" to "authenticated";

grant trigger on table "public"."features" to "authenticated";

grant truncate on table "public"."features" to "authenticated";

grant update on table "public"."features" to "authenticated";

grant delete on table "public"."features" to "service_role";

grant insert on table "public"."features" to "service_role";

grant references on table "public"."features" to "service_role";

grant select on table "public"."features" to "service_role";

grant trigger on table "public"."features" to "service_role";

grant truncate on table "public"."features" to "service_role";

grant update on table "public"."features" to "service_role";

grant delete on table "public"."images" to "anon";

grant insert on table "public"."images" to "anon";

grant references on table "public"."images" to "anon";

grant select on table "public"."images" to "anon";

grant trigger on table "public"."images" to "anon";

grant truncate on table "public"."images" to "anon";

grant update on table "public"."images" to "anon";

grant delete on table "public"."images" to "authenticated";

grant insert on table "public"."images" to "authenticated";

grant references on table "public"."images" to "authenticated";

grant select on table "public"."images" to "authenticated";

grant trigger on table "public"."images" to "authenticated";

grant truncate on table "public"."images" to "authenticated";

grant update on table "public"."images" to "authenticated";

grant delete on table "public"."images" to "service_role";

grant insert on table "public"."images" to "service_role";

grant references on table "public"."images" to "service_role";

grant select on table "public"."images" to "service_role";

grant trigger on table "public"."images" to "service_role";

grant truncate on table "public"."images" to "service_role";

grant update on table "public"."images" to "service_role";

grant delete on table "public"."insurance_types" to "anon";

grant insert on table "public"."insurance_types" to "anon";

grant references on table "public"."insurance_types" to "anon";

grant select on table "public"."insurance_types" to "anon";

grant trigger on table "public"."insurance_types" to "anon";

grant truncate on table "public"."insurance_types" to "anon";

grant update on table "public"."insurance_types" to "anon";

grant delete on table "public"."insurance_types" to "authenticated";

grant insert on table "public"."insurance_types" to "authenticated";

grant references on table "public"."insurance_types" to "authenticated";

grant select on table "public"."insurance_types" to "authenticated";

grant trigger on table "public"."insurance_types" to "authenticated";

grant truncate on table "public"."insurance_types" to "authenticated";

grant update on table "public"."insurance_types" to "authenticated";

grant delete on table "public"."insurance_types" to "service_role";

grant insert on table "public"."insurance_types" to "service_role";

grant references on table "public"."insurance_types" to "service_role";

grant select on table "public"."insurance_types" to "service_role";

grant trigger on table "public"."insurance_types" to "service_role";

grant truncate on table "public"."insurance_types" to "service_role";

grant update on table "public"."insurance_types" to "service_role";

grant delete on table "public"."motorcycle_conditions" to "anon";

grant insert on table "public"."motorcycle_conditions" to "anon";

grant references on table "public"."motorcycle_conditions" to "anon";

grant select on table "public"."motorcycle_conditions" to "anon";

grant trigger on table "public"."motorcycle_conditions" to "anon";

grant truncate on table "public"."motorcycle_conditions" to "anon";

grant update on table "public"."motorcycle_conditions" to "anon";

grant delete on table "public"."motorcycle_conditions" to "authenticated";

grant insert on table "public"."motorcycle_conditions" to "authenticated";

grant references on table "public"."motorcycle_conditions" to "authenticated";

grant select on table "public"."motorcycle_conditions" to "authenticated";

grant trigger on table "public"."motorcycle_conditions" to "authenticated";

grant truncate on table "public"."motorcycle_conditions" to "authenticated";

grant update on table "public"."motorcycle_conditions" to "authenticated";

grant delete on table "public"."motorcycle_conditions" to "service_role";

grant insert on table "public"."motorcycle_conditions" to "service_role";

grant references on table "public"."motorcycle_conditions" to "service_role";

grant select on table "public"."motorcycle_conditions" to "service_role";

grant trigger on table "public"."motorcycle_conditions" to "service_role";

grant truncate on table "public"."motorcycle_conditions" to "service_role";

grant update on table "public"."motorcycle_conditions" to "service_role";

grant delete on table "public"."motorcycle_features" to "anon";

grant insert on table "public"."motorcycle_features" to "anon";

grant references on table "public"."motorcycle_features" to "anon";

grant select on table "public"."motorcycle_features" to "anon";

grant trigger on table "public"."motorcycle_features" to "anon";

grant truncate on table "public"."motorcycle_features" to "anon";

grant update on table "public"."motorcycle_features" to "anon";

grant delete on table "public"."motorcycle_features" to "authenticated";

grant insert on table "public"."motorcycle_features" to "authenticated";

grant references on table "public"."motorcycle_features" to "authenticated";

grant select on table "public"."motorcycle_features" to "authenticated";

grant trigger on table "public"."motorcycle_features" to "authenticated";

grant truncate on table "public"."motorcycle_features" to "authenticated";

grant update on table "public"."motorcycle_features" to "authenticated";

grant delete on table "public"."motorcycle_features" to "service_role";

grant insert on table "public"."motorcycle_features" to "service_role";

grant references on table "public"."motorcycle_features" to "service_role";

grant select on table "public"."motorcycle_features" to "service_role";

grant trigger on table "public"."motorcycle_features" to "service_role";

grant truncate on table "public"."motorcycle_features" to "service_role";

grant update on table "public"."motorcycle_features" to "service_role";

grant delete on table "public"."motorcycle_images" to "anon";

grant insert on table "public"."motorcycle_images" to "anon";

grant references on table "public"."motorcycle_images" to "anon";

grant select on table "public"."motorcycle_images" to "anon";

grant trigger on table "public"."motorcycle_images" to "anon";

grant truncate on table "public"."motorcycle_images" to "anon";

grant update on table "public"."motorcycle_images" to "anon";

grant delete on table "public"."motorcycle_images" to "authenticated";

grant insert on table "public"."motorcycle_images" to "authenticated";

grant references on table "public"."motorcycle_images" to "authenticated";

grant select on table "public"."motorcycle_images" to "authenticated";

grant trigger on table "public"."motorcycle_images" to "authenticated";

grant truncate on table "public"."motorcycle_images" to "authenticated";

grant update on table "public"."motorcycle_images" to "authenticated";

grant delete on table "public"."motorcycle_images" to "service_role";

grant insert on table "public"."motorcycle_images" to "service_role";

grant references on table "public"."motorcycle_images" to "service_role";

grant select on table "public"."motorcycle_images" to "service_role";

grant trigger on table "public"."motorcycle_images" to "service_role";

grant truncate on table "public"."motorcycle_images" to "service_role";

grant update on table "public"."motorcycle_images" to "service_role";

grant delete on table "public"."motorcycle_insurance_details" to "anon";

grant insert on table "public"."motorcycle_insurance_details" to "anon";

grant references on table "public"."motorcycle_insurance_details" to "anon";

grant select on table "public"."motorcycle_insurance_details" to "anon";

grant trigger on table "public"."motorcycle_insurance_details" to "anon";

grant truncate on table "public"."motorcycle_insurance_details" to "anon";

grant update on table "public"."motorcycle_insurance_details" to "anon";

grant delete on table "public"."motorcycle_insurance_details" to "authenticated";

grant insert on table "public"."motorcycle_insurance_details" to "authenticated";

grant references on table "public"."motorcycle_insurance_details" to "authenticated";

grant select on table "public"."motorcycle_insurance_details" to "authenticated";

grant trigger on table "public"."motorcycle_insurance_details" to "authenticated";

grant truncate on table "public"."motorcycle_insurance_details" to "authenticated";

grant update on table "public"."motorcycle_insurance_details" to "authenticated";

grant delete on table "public"."motorcycle_insurance_details" to "service_role";

grant insert on table "public"."motorcycle_insurance_details" to "service_role";

grant references on table "public"."motorcycle_insurance_details" to "service_role";

grant select on table "public"."motorcycle_insurance_details" to "service_role";

grant trigger on table "public"."motorcycle_insurance_details" to "service_role";

grant truncate on table "public"."motorcycle_insurance_details" to "service_role";

grant update on table "public"."motorcycle_insurance_details" to "service_role";

grant delete on table "public"."motorcycle_rentals" to "anon";

grant insert on table "public"."motorcycle_rentals" to "anon";

grant references on table "public"."motorcycle_rentals" to "anon";

grant select on table "public"."motorcycle_rentals" to "anon";

grant trigger on table "public"."motorcycle_rentals" to "anon";

grant truncate on table "public"."motorcycle_rentals" to "anon";

grant update on table "public"."motorcycle_rentals" to "anon";

grant delete on table "public"."motorcycle_rentals" to "authenticated";

grant insert on table "public"."motorcycle_rentals" to "authenticated";

grant references on table "public"."motorcycle_rentals" to "authenticated";

grant select on table "public"."motorcycle_rentals" to "authenticated";

grant trigger on table "public"."motorcycle_rentals" to "authenticated";

grant truncate on table "public"."motorcycle_rentals" to "authenticated";

grant update on table "public"."motorcycle_rentals" to "authenticated";

grant delete on table "public"."motorcycle_rentals" to "service_role";

grant insert on table "public"."motorcycle_rentals" to "service_role";

grant references on table "public"."motorcycle_rentals" to "service_role";

grant select on table "public"."motorcycle_rentals" to "service_role";

grant trigger on table "public"."motorcycle_rentals" to "service_role";

grant truncate on table "public"."motorcycle_rentals" to "service_role";

grant update on table "public"."motorcycle_rentals" to "service_role";

grant delete on table "public"."motorcycle_required_documents" to "anon";

grant insert on table "public"."motorcycle_required_documents" to "anon";

grant references on table "public"."motorcycle_required_documents" to "anon";

grant select on table "public"."motorcycle_required_documents" to "anon";

grant trigger on table "public"."motorcycle_required_documents" to "anon";

grant truncate on table "public"."motorcycle_required_documents" to "anon";

grant update on table "public"."motorcycle_required_documents" to "anon";

grant delete on table "public"."motorcycle_required_documents" to "authenticated";

grant insert on table "public"."motorcycle_required_documents" to "authenticated";

grant references on table "public"."motorcycle_required_documents" to "authenticated";

grant select on table "public"."motorcycle_required_documents" to "authenticated";

grant trigger on table "public"."motorcycle_required_documents" to "authenticated";

grant truncate on table "public"."motorcycle_required_documents" to "authenticated";

grant update on table "public"."motorcycle_required_documents" to "authenticated";

grant delete on table "public"."motorcycle_required_documents" to "service_role";

grant insert on table "public"."motorcycle_required_documents" to "service_role";

grant references on table "public"."motorcycle_required_documents" to "service_role";

grant select on table "public"."motorcycle_required_documents" to "service_role";

grant trigger on table "public"."motorcycle_required_documents" to "service_role";

grant truncate on table "public"."motorcycle_required_documents" to "service_role";

grant update on table "public"."motorcycle_required_documents" to "service_role";

grant delete on table "public"."provinces" to "anon";

grant insert on table "public"."provinces" to "anon";

grant references on table "public"."provinces" to "anon";

grant select on table "public"."provinces" to "anon";

grant trigger on table "public"."provinces" to "anon";

grant truncate on table "public"."provinces" to "anon";

grant update on table "public"."provinces" to "anon";

grant delete on table "public"."provinces" to "authenticated";

grant insert on table "public"."provinces" to "authenticated";

grant references on table "public"."provinces" to "authenticated";

grant select on table "public"."provinces" to "authenticated";

grant trigger on table "public"."provinces" to "authenticated";

grant truncate on table "public"."provinces" to "authenticated";

grant update on table "public"."provinces" to "authenticated";

grant delete on table "public"."provinces" to "service_role";

grant insert on table "public"."provinces" to "service_role";

grant references on table "public"."provinces" to "service_role";

grant select on table "public"."provinces" to "service_role";

grant trigger on table "public"."provinces" to "service_role";

grant truncate on table "public"."provinces" to "service_role";

grant update on table "public"."provinces" to "service_role";

grant delete on table "public"."rental_rate_tiers" to "anon";

grant insert on table "public"."rental_rate_tiers" to "anon";

grant references on table "public"."rental_rate_tiers" to "anon";

grant select on table "public"."rental_rate_tiers" to "anon";

grant trigger on table "public"."rental_rate_tiers" to "anon";

grant truncate on table "public"."rental_rate_tiers" to "anon";

grant update on table "public"."rental_rate_tiers" to "anon";

grant delete on table "public"."rental_rate_tiers" to "authenticated";

grant insert on table "public"."rental_rate_tiers" to "authenticated";

grant references on table "public"."rental_rate_tiers" to "authenticated";

grant select on table "public"."rental_rate_tiers" to "authenticated";

grant trigger on table "public"."rental_rate_tiers" to "authenticated";

grant truncate on table "public"."rental_rate_tiers" to "authenticated";

grant update on table "public"."rental_rate_tiers" to "authenticated";

grant delete on table "public"."rental_rate_tiers" to "service_role";

grant insert on table "public"."rental_rate_tiers" to "service_role";

grant references on table "public"."rental_rate_tiers" to "service_role";

grant select on table "public"."rental_rate_tiers" to "service_role";

grant trigger on table "public"."rental_rate_tiers" to "service_role";

grant truncate on table "public"."rental_rate_tiers" to "service_role";

grant update on table "public"."rental_rate_tiers" to "service_role";

grant delete on table "public"."rental_shop_conditions" to "anon";

grant insert on table "public"."rental_shop_conditions" to "anon";

grant references on table "public"."rental_shop_conditions" to "anon";

grant select on table "public"."rental_shop_conditions" to "anon";

grant trigger on table "public"."rental_shop_conditions" to "anon";

grant truncate on table "public"."rental_shop_conditions" to "anon";

grant update on table "public"."rental_shop_conditions" to "anon";

grant delete on table "public"."rental_shop_conditions" to "authenticated";

grant insert on table "public"."rental_shop_conditions" to "authenticated";

grant references on table "public"."rental_shop_conditions" to "authenticated";

grant select on table "public"."rental_shop_conditions" to "authenticated";

grant trigger on table "public"."rental_shop_conditions" to "authenticated";

grant truncate on table "public"."rental_shop_conditions" to "authenticated";

grant update on table "public"."rental_shop_conditions" to "authenticated";

grant delete on table "public"."rental_shop_conditions" to "service_role";

grant insert on table "public"."rental_shop_conditions" to "service_role";

grant references on table "public"."rental_shop_conditions" to "service_role";

grant select on table "public"."rental_shop_conditions" to "service_role";

grant trigger on table "public"."rental_shop_conditions" to "service_role";

grant truncate on table "public"."rental_shop_conditions" to "service_role";

grant update on table "public"."rental_shop_conditions" to "service_role";

grant delete on table "public"."rental_shop_inclusions" to "anon";

grant insert on table "public"."rental_shop_inclusions" to "anon";

grant references on table "public"."rental_shop_inclusions" to "anon";

grant select on table "public"."rental_shop_inclusions" to "anon";

grant trigger on table "public"."rental_shop_inclusions" to "anon";

grant truncate on table "public"."rental_shop_inclusions" to "anon";

grant update on table "public"."rental_shop_inclusions" to "anon";

grant delete on table "public"."rental_shop_inclusions" to "authenticated";

grant insert on table "public"."rental_shop_inclusions" to "authenticated";

grant references on table "public"."rental_shop_inclusions" to "authenticated";

grant select on table "public"."rental_shop_inclusions" to "authenticated";

grant trigger on table "public"."rental_shop_inclusions" to "authenticated";

grant truncate on table "public"."rental_shop_inclusions" to "authenticated";

grant update on table "public"."rental_shop_inclusions" to "authenticated";

grant delete on table "public"."rental_shop_inclusions" to "service_role";

grant insert on table "public"."rental_shop_inclusions" to "service_role";

grant references on table "public"."rental_shop_inclusions" to "service_role";

grant select on table "public"."rental_shop_inclusions" to "service_role";

grant trigger on table "public"."rental_shop_inclusions" to "service_role";

grant truncate on table "public"."rental_shop_inclusions" to "service_role";

grant update on table "public"."rental_shop_inclusions" to "service_role";

grant delete on table "public"."rental_shop_service_locations" to "anon";

grant insert on table "public"."rental_shop_service_locations" to "anon";

grant references on table "public"."rental_shop_service_locations" to "anon";

grant select on table "public"."rental_shop_service_locations" to "anon";

grant trigger on table "public"."rental_shop_service_locations" to "anon";

grant truncate on table "public"."rental_shop_service_locations" to "anon";

grant update on table "public"."rental_shop_service_locations" to "anon";

grant delete on table "public"."rental_shop_service_locations" to "authenticated";

grant insert on table "public"."rental_shop_service_locations" to "authenticated";

grant references on table "public"."rental_shop_service_locations" to "authenticated";

grant select on table "public"."rental_shop_service_locations" to "authenticated";

grant trigger on table "public"."rental_shop_service_locations" to "authenticated";

grant truncate on table "public"."rental_shop_service_locations" to "authenticated";

grant update on table "public"."rental_shop_service_locations" to "authenticated";

grant delete on table "public"."rental_shop_service_locations" to "service_role";

grant insert on table "public"."rental_shop_service_locations" to "service_role";

grant references on table "public"."rental_shop_service_locations" to "service_role";

grant select on table "public"."rental_shop_service_locations" to "service_role";

grant trigger on table "public"."rental_shop_service_locations" to "service_role";

grant truncate on table "public"."rental_shop_service_locations" to "service_role";

grant update on table "public"."rental_shop_service_locations" to "service_role";

grant delete on table "public"."rental_shop_tours" to "anon";

grant insert on table "public"."rental_shop_tours" to "anon";

grant references on table "public"."rental_shop_tours" to "anon";

grant select on table "public"."rental_shop_tours" to "anon";

grant trigger on table "public"."rental_shop_tours" to "anon";

grant truncate on table "public"."rental_shop_tours" to "anon";

grant update on table "public"."rental_shop_tours" to "anon";

grant delete on table "public"."rental_shop_tours" to "authenticated";

grant insert on table "public"."rental_shop_tours" to "authenticated";

grant references on table "public"."rental_shop_tours" to "authenticated";

grant select on table "public"."rental_shop_tours" to "authenticated";

grant trigger on table "public"."rental_shop_tours" to "authenticated";

grant truncate on table "public"."rental_shop_tours" to "authenticated";

grant update on table "public"."rental_shop_tours" to "authenticated";

grant delete on table "public"."rental_shop_tours" to "service_role";

grant insert on table "public"."rental_shop_tours" to "service_role";

grant references on table "public"."rental_shop_tours" to "service_role";

grant select on table "public"."rental_shop_tours" to "service_role";

grant trigger on table "public"."rental_shop_tours" to "service_role";

grant truncate on table "public"."rental_shop_tours" to "service_role";

grant update on table "public"."rental_shop_tours" to "service_role";

grant delete on table "public"."rental_shops" to "anon";

grant insert on table "public"."rental_shops" to "anon";

grant references on table "public"."rental_shops" to "anon";

grant select on table "public"."rental_shops" to "anon";

grant trigger on table "public"."rental_shops" to "anon";

grant truncate on table "public"."rental_shops" to "anon";

grant update on table "public"."rental_shops" to "anon";

grant delete on table "public"."rental_shops" to "authenticated";

grant insert on table "public"."rental_shops" to "authenticated";

grant references on table "public"."rental_shops" to "authenticated";

grant select on table "public"."rental_shops" to "authenticated";

grant trigger on table "public"."rental_shops" to "authenticated";

grant truncate on table "public"."rental_shops" to "authenticated";

grant update on table "public"."rental_shops" to "authenticated";

grant delete on table "public"."rental_shops" to "service_role";

grant insert on table "public"."rental_shops" to "service_role";

grant references on table "public"."rental_shops" to "service_role";

grant select on table "public"."rental_shops" to "service_role";

grant trigger on table "public"."rental_shops" to "service_role";

grant truncate on table "public"."rental_shops" to "service_role";

grant update on table "public"."rental_shops" to "service_role";

grant delete on table "public"."required_document_types" to "anon";

grant insert on table "public"."required_document_types" to "anon";

grant references on table "public"."required_document_types" to "anon";

grant select on table "public"."required_document_types" to "anon";

grant trigger on table "public"."required_document_types" to "anon";

grant truncate on table "public"."required_document_types" to "anon";

grant update on table "public"."required_document_types" to "anon";

grant delete on table "public"."required_document_types" to "authenticated";

grant insert on table "public"."required_document_types" to "authenticated";

grant references on table "public"."required_document_types" to "authenticated";

grant select on table "public"."required_document_types" to "authenticated";

grant trigger on table "public"."required_document_types" to "authenticated";

grant truncate on table "public"."required_document_types" to "authenticated";

grant update on table "public"."required_document_types" to "authenticated";

grant delete on table "public"."required_document_types" to "service_role";

grant insert on table "public"."required_document_types" to "service_role";

grant references on table "public"."required_document_types" to "service_role";

grant select on table "public"."required_document_types" to "service_role";

grant trigger on table "public"."required_document_types" to "service_role";

grant truncate on table "public"."required_document_types" to "service_role";

grant update on table "public"."required_document_types" to "service_role";

CREATE TRIGGER set_timestamp_brands BEFORE UPDATE ON public.brands FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_business_statuses BEFORE UPDATE ON public.business_statuses FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_categories BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_cities BEFORE UPDATE ON public.cities FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_condition_types BEFORE UPDATE ON public.condition_types FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_countries BEFORE UPDATE ON public.countries FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_features BEFORE UPDATE ON public.features FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_insurance_types BEFORE UPDATE ON public.insurance_types FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_motorcycle_rentals BEFORE UPDATE ON public.motorcycle_rentals FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_provinces BEFORE UPDATE ON public.provinces FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER handle_rental_shop_conditions_updated_at BEFORE UPDATE ON public.rental_shop_conditions FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_rental_shop_inclusions BEFORE UPDATE ON public.rental_shop_inclusions FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_rental_shop_service_locations BEFORE UPDATE ON public.rental_shop_service_locations FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_rental_shop_tours BEFORE UPDATE ON public.rental_shop_tours FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_rental_shops_slug BEFORE INSERT ON public.rental_shops FOR EACH ROW EXECUTE FUNCTION rental_shops_slug_trigger();

CREATE TRIGGER set_timestamp_rental_shops BEFORE UPDATE ON public.rental_shops FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_required_document_types BEFORE UPDATE ON public.required_document_types FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();



