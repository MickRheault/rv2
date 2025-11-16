import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database, Tables, TablesInsert } from '../../lib/supabase/database.types'; // Adjust path as necessary
import { fileURLToPath } from 'url'; // Import fileURLToPath

// Load environment variables from .env
// ES Module equivalent for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../../.env');
console.log(`DEBUG: Loading .env from: ${envPath}`);
console.log(`DEBUG: NEXT_PUBLIC_SUPABASE_URL before dotenv: ${process.env.NEXT_PUBLIC_SUPABASE_URL || '(not set)'}`);

const dotenvResult = dotenv.config({ path: envPath, override: true });
if (dotenvResult.error) {
  console.error(`ERROR: Failed to load .env file: ${dotenvResult.error.message}`);
  throw dotenvResult.error;
}
console.log(`DEBUG: .env loaded successfully`);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log(`DEBUG: NEXT_PUBLIC_SUPABASE_URL after dotenv: ${supabaseUrl}`);
console.log(`DEBUG: Using Supabase URL: ${supabaseUrl}`); // Add logging for URL

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase URL or Service Role Key is missing in environment variables.');
}

// Define the type for the scraped JSON data structure based on the template
// (Ideally, this would be generated or more robustly defined)
type ScrapedJsonData = {
  provider_metadata: {
    scrape_timestamp: string;
    shop_identifier: string;
    name?: string; // Added from CSV
    place_id?: string | null;
    address?: string; // Added from CSV (maps to full_address)
    city?: string; // Added from CSV
    province?: string; // Added from CSV
    country?: string; // Added from CSV
    latitude?: number | null;
    longitude?: number | null;
    phone?: string | null;
    website?: string | null;
    google_maps_url?: string | null;
    business_status?: string | null;
    rating?: number | null;
    number_of_reviews?: number; // Added from CSV (maps to review_count)
    rental_conditions?: Record<string, any> | null; // Changed to be flexible
    rental_inclusions?: string[] | null;
    available_service_locations?: string[] | null;
    offered_tours?: {
      name: string;
      duration_text?: string | null;
      distance_km?: number | null;
      price_text?: string | null;
      currency?: string | null;
    }[] | null;
    // Ensure all fields from best-bangkok.csv are potentially here
  } | null;
  motorcycle_offerings: {
    shop_identifier?: string | null;
    scrape_timestamp?: string | null;
    source_url?: string | null;
    brand?: string | null;
    model: string;
    year?: number | null;
    engine_capacity_cc?: number | null;
    category?: string | null;
    description?: string | null;
    rental_rates?: {
      rate_text?: string | null;
      min_days: number; // Supports decimals: 0.5 = half day, 0.042 (1/24) = 1 hour, etc.
      max_days?: number | null; // Supports decimals: 0.5 = half day, 0.042 (1/24) = 1 hour, etc.
      rate_per_day?: number | null;
      currency?: string | null;
    }[];
    images?: string[];
    features?: string[];
    specifications_raw?: object | string | null;
    conditions_raw?: object | string | null; // Store as JSONB
    required_documents_raw?: string[];
    insurance_details_raw?: {
      type_name: string;
      is_included: boolean;
      cost_per_day?: number | null;
      currency?: string | null;
      deductible?: number | null;
      deductible_currency?: string | null;
      notes?: string | null;
    }[];
    availability_status?: string | null;
  }[];
};


// Initialize Supabase client
// Now we can use type arguments directly with ESM imports
const supabase: SupabaseClient<Database> = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false, // Typically false for server-side scripts
    autoRefreshToken: false,
  }
});

const DATA_DIR = path.resolve(__dirname, './templated-data/5cities');

// --- Load Category Mapping ---
interface CategoryMapping {
  [brand: string]: {
    [model: string]: string;
  };
}

interface MappingData {
  mapping: CategoryMapping;
  category_guidelines: Record<string, string>;
  conflict_resolutions: Record<string, string>;
}

let categoryMapping: MappingData | null = null;

async function loadCategoryMapping(): Promise<MappingData> {
  if (!categoryMapping) {
    try {
      const mappingPath = path.resolve(__dirname, './motorcycle-category-mapping.json');
      const mappingContent = await fs.readFile(mappingPath, 'utf-8');
      categoryMapping = JSON.parse(mappingContent) as MappingData;
      console.log('✅ Category mapping loaded successfully');
    } catch (error) {
      console.warn('⚠️  Could not load category mapping file, will use original categories from data');
      categoryMapping = { mapping: {}, category_guidelines: {}, conflict_resolutions: {} };
    }
  }
  return categoryMapping;
}

function getMappedCategory(brand: string, model: string, originalCategory?: string): string | null {
  if (!categoryMapping) return originalCategory || null;
  
  // Handle null/undefined brand or model
  if (!brand || !model) return originalCategory || null;
  
  // Normalize brand and model for lookup
  const normalizedBrand = brand.trim();
  const normalizedModel = model.trim();
  
  // Check for exact brand and model match
  if (categoryMapping.mapping[normalizedBrand]?.[normalizedModel]) {
    const mappedCategory = categoryMapping.mapping[normalizedBrand][normalizedModel];
    console.log(`   📋 Mapped ${normalizedBrand} ${normalizedModel}: "${originalCategory}" → "${mappedCategory}"`);
    return mappedCategory;
  }
  
  // Check for "Various Models" fallback for the brand
  if (categoryMapping.mapping[normalizedBrand]?.["Various Models"]) {
    const mappedCategory = categoryMapping.mapping[normalizedBrand]["Various Models"];
    console.log(`   📋 Using brand default for ${normalizedBrand} ${normalizedModel}: "${originalCategory}" → "${mappedCategory}"`);
    return mappedCategory;
  }
  
  // Return original category if no mapping found
  if (originalCategory) {
    console.log(`   ⚠️  No mapping found for ${normalizedBrand} ${normalizedModel}, using original: "${originalCategory}"`);
  } else {
    console.log(`   ⚠️  No mapping found for ${normalizedBrand} ${normalizedModel}, no category will be set`);
  }
  return originalCategory || null;
}

// --- Helper Functions for Find/Create ---

// Country name to ISO code mapping
const COUNTRY_CODE_MAP: Record<string, string> = {
  'Thailand': 'TH',
  'Cambodia': 'KH',
  'Vietnam': 'VN',
  'Spain': 'ES',
  'Portugal': 'PT',
  'France': 'FR',
  'Italy': 'IT',
  'Germany': 'DE',
  'United Kingdom': 'GB',
  'United States': 'US',
  'Canada': 'CA',
  'Australia': 'AU',
  'New Zealand': 'NZ',
  'Japan': 'JP',
  'Indonesia': 'ID',
  'Malaysia': 'MY',
  'Singapore': 'SG',
  'Philippines': 'PH',
  'India': 'IN',
  'Nepal': 'NP',
  'Sri Lanka': 'LK',
  'Greece': 'GR',
  'Croatia': 'HR',
  'Turkey': 'TR',
  'Morocco': 'MA',
  'South Africa': 'ZA',
  'Mexico': 'MX',
  'Brazil': 'BR',
  'Argentina': 'AR',
  'Chile': 'CL',
  'Peru': 'PE',
  'Colombia': 'CO',
};

async function findOrCreateCountry(code: string, name: string): Promise<string> {
    // Simplified: Assumes code is unique primary key from template/CSV if available
    // More robust: Query by name if code is missing, handle conflicts
    if (!code && !name) throw new Error("Country code or name required.");

    const query = code ? supabase.from('countries').select('code').eq('code', code).maybeSingle()
                       : supabase.from('countries').select('code').eq('name', name).maybeSingle();

    const { data, error } = await query;
    if (error) {
        console.error('Supabase error finding country:', error);
        throw new Error(`Error finding country ${code || name}: ${error.message}`);
    }
    if (data && data.code) return data.code;
    if (data && !data.code) {
        console.error('Country found but no code property:', data);
        throw new Error(`Country ${code || name} found but no code property.`);
    }

    // Create if not found
    // Use mapping table or default to 'XX' for unknown countries
    const insertCode = code || COUNTRY_CODE_MAP[name] || 'XX';
    console.log(`Creating country: ${name} (${insertCode})`);
    const { data: newData, error: insertError } = await supabase
        .from('countries')
        .insert({ code: insertCode, name: name || 'Unknown' }) // Use name if provided, else 'Unknown'
        .select('code')
        .single();
    if (insertError) {
        // If it's a duplicate key error, try to find the existing country
        if (insertError.code === '23505' && insertError.details?.includes('already exists')) {
            console.log(`Country ${name} already exists, fetching existing record...`);
            const { data: existingData, error: findError } = await supabase
                .from('countries')
                .select('code')
                .eq('name', name || 'Unknown')
                .single();
            if (findError) {
                console.error('Error finding existing country after duplicate error:', findError);
                throw new Error(`Error finding existing country ${name}: ${findError.message}`);
            }
            return existingData.code;
        }
        console.error('Supabase error creating country:', insertError);
        throw new Error(`Error creating country ${name}: ${insertError.message}`);
    }
    if (!newData || !newData.code) {
        console.error('Country created but no data/code returned:', newData);
        throw new Error(`Failed to create or retrieve code for country ${name}.`);
    }
    return newData.code;
}

async function findOrCreateProvince(name: string, country_code: string): Promise<string> {
    if (!name || !country_code) throw new Error("Province name and country code required.");

    const { data, error } = await supabase
        .from('provinces')
        .select('id')
        .eq('name', name)
        .eq('country_code', country_code)
        .maybeSingle();

    if (error) {
        console.error('Supabase error finding province:', error);
        throw new Error(`Error finding province ${name} in ${country_code}: ${error.message}`);
    }
    if (data && data.id) return data.id;
    if (data && !data.id) {
        console.error('Province found but no id property:', data);
        throw new Error(`Province ${name} in ${country_code} found but no id property.`);
    }

    // Create if not found
    console.log(`Creating province: ${name} in ${country_code}`);
    const { data: newData, error: insertError } = await supabase
        .from('provinces')
        .insert({ name, country_code })
        .select('id')
        .single();
    if (insertError) {
        console.error('Supabase error creating province:', insertError);
        throw new Error(`Error creating province ${name}: ${insertError.message}`);
    }
    if (!newData || !newData.id) {
        console.error('Province created but no data/id returned:', newData);
        throw new Error(`Failed to create or retrieve id for province ${name}.`);
    }
    return newData.id;
}

async function findOrCreateCity(name: string, province_id: string): Promise<string> {
     if (!name || !province_id) throw new Error("City name and province ID required.");

    const { data, error } = await supabase
        .from('cities')
        .select('id')
        .eq('name', name)
        .eq('province_id', province_id)
        .maybeSingle();

    if (error) {
        console.error('Supabase error finding city:', error);
        throw new Error(`Error finding city ${name} in province ${province_id}: ${error.message}`);
    }
    if (data && data.id) return data.id;
    if (data && !data.id) {
        console.error('City found but no id property:', data);
        throw new Error(`City ${name} in province ${province_id} found but no id property.`);
    }

    // Create if not found
     console.log(`Creating city: ${name} in province ${province_id}`);
    const { data: newData, error: insertError } = await supabase
        .from('cities')
        .insert({ name, province_id })
        .select('id')
        .single();
    if (insertError) {
        console.error('Supabase error creating city:', insertError);
        throw new Error(`Error creating city ${name}: ${insertError.message}`);
    }
    if (!newData || !newData.id) {
        console.error('City created but no data/id returned:', newData);
        throw new Error(`Failed to create or retrieve id for city ${name}.`);
    }
    return newData.id;
}

async function findOrCreateBusinessStatus(statusCode: string): Promise<number> {
    if (!statusCode) throw new Error("Business status code required.");

    const { data, error } = await supabase
        .from('business_statuses')
        .select('id')
        .eq('status_code', statusCode)
        .maybeSingle();

    if (error) {
        console.error('Supabase error finding business status:', error);
        throw new Error(`Error finding business status ${statusCode}: ${error.message}`);
    }
    // Note: business_statuses.id is a number, not a string UUID like others
    if (data && typeof data.id === 'number') return data.id;
    if (data && typeof data.id !== 'number') {
        console.error('Business status found but id is not a number:', data);
        throw new Error(`Business status ${statusCode} found but id is not a number.`);
    }

    // Create if not found
    console.log(`Creating business status: ${statusCode}`);
    const { data: newData, error: insertError } = await supabase
        .from('business_statuses')
        .insert({ status_code: statusCode, description: `Status: ${statusCode}` }) // Add basic description
        .select('id')
        .single();
    if (insertError) {
        console.error('Supabase error creating business status:', insertError);
        throw new Error(`Error creating business status ${statusCode}: ${insertError.message}`);
    }
    if (!newData || typeof newData.id !== 'number') {
        console.error('Business status created but no data/id returned or id is not a number:', newData);
        throw new Error(`Failed to create or retrieve id for business status ${statusCode}.`);
    }
    return newData.id;
}

async function findOrCreateConditionType(name: string): Promise<string> {
    if (!name) throw new Error("Condition type name required.");
    const { data, error } = await supabase.from('condition_types').select('id').eq('name', name).maybeSingle();
    if (error) {
        console.error('Supabase error finding condition type:', error);
        throw new Error(`Error finding condition type ${name}: ${error.message}`);
    }
    if (data && data.id) return data.id;
    if (data && !data.id) {
        console.error('Condition type found but no id property:', data);
        throw new Error(`Condition type ${name} found but no id property.`);
    }

    console.log(`Creating condition type: ${name}`);
    const { data: newData, error: insertError } = await supabase.from('condition_types').insert({ name }).select('id').single();
    if (insertError) {
        console.error('Supabase error creating condition type:', insertError);
        throw new Error(`Error creating condition type ${name}: ${insertError.message}`);
    }
    if (!newData || !newData.id) {
        console.error('Condition type created but no data/id returned:', newData);
        throw new Error(`Failed to create or retrieve id for condition type ${name}.`);
    }
    return newData.id;
}

async function findOrCreateRentalShop(metadata: ScrapedJsonData['provider_metadata']): Promise<string> {
    if (!metadata) throw new Error("Provider metadata is required to find or create a rental shop.");
    if (!metadata.place_id && (!metadata.name || !metadata.address)) {
         throw new Error("Cannot uniquely identify shop: Missing place_id or name/address combination.");
    }

    let query = supabase.from('rental_shops').select('id');
    if (metadata.place_id) {
        query = query.eq('place_id', metadata.place_id);
    } else {
        // Fallback to name and address - less reliable
        if (!metadata.name || !metadata.address) { // Extra check for fallback
            throw new Error("Cannot uniquely identify shop by name/address: Missing name or address.");
        }
        query = query.eq('provider_name', metadata.name).eq('full_address', metadata.address);
    }

    const { data: existingShop, error: findError } = await query.maybeSingle();

    if (findError) {
        console.error('Supabase error finding rental shop:', findError);
        throw new Error(`Error finding rental shop ${metadata.name || metadata.place_id}: ${findError.message}`);
    }
    if (existingShop && existingShop.id) return existingShop.id;
    if (existingShop && !existingShop.id) {
        console.error('Rental shop found but no id property:', existingShop);
        throw new Error(`Rental shop ${metadata.name || metadata.place_id} found but no id property.`);
    }

    // --- Create Shop if Not Found ---
    console.log(`Creating rental shop: ${metadata.name || 'Unnamed Shop'} (${metadata.place_id || 'No Place ID'})`);

    // 1. Resolve Foreign Keys
    // Added null checks before calling findOrCreate functions if dependent values are null
    const countryCode = metadata.country ? await findOrCreateCountry('', metadata.country) : null;
    const provinceId = (metadata.province && countryCode) ? await findOrCreateProvince(metadata.province, countryCode) : null;
    const cityId = (metadata.city && provinceId) ? await findOrCreateCity(metadata.city, provinceId) : null;
    const statusId = metadata.business_status ? await findOrCreateBusinessStatus(metadata.business_status) : null;

    // 2. Prepare Insert Data
    const shopInsertData: TablesInsert<'rental_shops'> = {
        provider_name: metadata.name || metadata.shop_identifier || 'Unknown Provider',
        location_name: metadata.shop_identifier !== metadata.name ? metadata.shop_identifier : null,
        place_id: metadata.place_id || null,
        full_address: metadata.address || 'Unknown Address',
        city_id: cityId,
        latitude: metadata.latitude || null,
        longitude: metadata.longitude || null,
        phone: metadata.phone || null,
        website: metadata.website || null,
        google_maps_url: metadata.google_maps_url || null,
        business_status_id: statusId,
        rating: metadata.rating || null,
        review_count: metadata.number_of_reviews || null,
    } as TablesInsert<'rental_shops'>;

    // 3. Insert Shop
    const { data: newShop, error: insertError } = await supabase
        .from('rental_shops')
        .insert(shopInsertData)
        .select('id')
        .single();

    if (insertError) {
        console.error('Supabase error creating rental shop:', insertError);
        throw new Error(`Error creating rental shop ${metadata.name || 'Unnamed Shop'}: ${insertError.message}`);
    }
    if (!newShop || !newShop.id) {
        console.error('Rental shop created but no data/id returned:', newShop);
        throw new Error(`Failed to create or retrieve id for rental shop ${metadata.name || 'Unnamed Shop'}.`);
    }
    const shopId = newShop.id;

    // 4. Insert Shop Rental Conditions
    if (metadata.rental_conditions) {
        const conditionEntries = Object.entries(metadata.rental_conditions);
        if (conditionEntries.length > 0) {
            console.log(`Processing ${conditionEntries.length} rental conditions for shop ${shopId}`);
            for (const [conditionName, conditionValue] of conditionEntries) {
                if (conditionValue === null || conditionValue === undefined || String(conditionValue).trim() === '') {
                    console.log(`  Skipping condition "${conditionName}" as its value is null, undefined or empty.`);
                    continue;
                }
                try {
                    const formattedConditionName = conditionName
                        .replace(/_/g, ' ')
                        .replace(/([A-Z])/g, ' $1')
                        .trim()
                        .toLowerCase()
                        .replace(/\b\w/g, char => char.toUpperCase());

                    if (!formattedConditionName) {
                        console.warn(`  Skipping condition with original name "${conditionName}" as formatted name is empty.`);
                        continue;
                    }

                    const conditionTypeId = await findOrCreateConditionType(formattedConditionName);
                    
                    const valueToInsert = String(conditionValue).trim();

                    if (valueToInsert === '') {
                        console.log(`  Skipping formatted condition "${formattedConditionName}" (Original: "${conditionName}") as its value became empty after processing.`);
                        continue;
                    }
                    
                    console.log(`  Attempting to insert condition: TypeID="${conditionTypeId}", Value="${valueToInsert}" for ShopID="${shopId}" (Formatted Name: "${formattedConditionName}")`);

                    const { error: conditionInsertError } = await supabase
                        .from('rental_shop_conditions')
                        .insert({
                            shop_id: shopId,
                            condition_type_id: conditionTypeId,
                            condition_value: valueToInsert
                        } as TablesInsert<'rental_shop_conditions'>);

                    if (conditionInsertError) {
                        console.error(`  Supabase error inserting condition "${formattedConditionName}" (Value: "${valueToInsert}") for shop ${shopId}:`, conditionInsertError);
                        // Decide if this should throw or just log. For now, logging.
                        // throw new Error(`Error inserting condition "${formattedConditionName}": ${conditionInsertError.message}`);
                    } else {
                        console.log(`  Successfully inserted condition: "${formattedConditionName}" = "${valueToInsert}" for shop ${shopId}`);
                    }
                } catch (condError: any) {
                    // Catch errors from findOrCreateConditionType or other synchronous issues within the loop
                    console.error(`  Error processing shop condition "${conditionName}" (Value: "${conditionValue}"):`, condError.message ? condError.message : condError);
                }
            }
        }
    }

    // 5. Insert Shop Inclusions
    if (metadata.rental_inclusions && metadata.rental_inclusions.length > 0) {
        const inclusionsData = metadata.rental_inclusions.map(inclusion => ({
            shop_id: shopId,
            inclusion_text: inclusion
        }));

        const { error: inclusionsError } = await supabase
            .from('rental_shop_inclusions')
            .insert(inclusionsData);

        if (inclusionsError) {
            console.error(`Error inserting inclusions for shop ${shopId}: ${inclusionsError.message}`);
        } else {
            console.log(`Inserted ${inclusionsData.length} inclusions for shop ${shopId}`);
        }
    }

    // 6. Insert Service Locations
    if (metadata.available_service_locations && metadata.available_service_locations.length > 0) {
        const locationsData = metadata.available_service_locations.map(location => ({
            shop_id: shopId,
            location_name: location
        }));

        const { error: locationsError } = await supabase
            .from('rental_shop_service_locations')
            .insert(locationsData);

        if (locationsError) {
            console.error(`Error inserting service locations for shop ${shopId}: ${locationsError.message}`);
        } else {
            console.log(`Inserted ${locationsData.length} service locations for shop ${shopId}`);
        }
    }

    // 7. Insert Tours
    if (metadata.offered_tours && metadata.offered_tours.length > 0) {
        const toursData = metadata.offered_tours.map(tour => ({
            shop_id: shopId,
            name: tour.name,
            duration_text: tour.duration_text || null,
            distance_km: tour.distance_km || null,
            price_text: tour.price_text || null,
            currency: tour.currency || null
        }));

        const { error: toursError } = await supabase
            .from('rental_shop_tours')
            .insert(toursData);

        if (toursError) {
            console.error(`Error inserting tours for shop ${shopId}: ${toursError.message}`);
        } else {
            console.log(`Inserted ${toursData.length} tours for shop ${shopId}`);
        }
    }

    return shopId;
}


async function findOrCreateBrand(name: string): Promise<string> {
    if (!name) throw new Error("Brand name required.");
    const { data, error } = await supabase.from('brands').select('id').eq('name', name).maybeSingle();
    if (error) {
        console.error('Supabase error finding brand:', error);
        throw new Error(`Error finding brand ${name}: ${error.message}`);
    }
    if (data && data.id) return data.id;
    if (data && !data.id) {
        console.error('Brand found but no id property:', data);
        throw new Error(`Brand ${name} found but no id property.`);
    }

    console.log(`Creating brand: ${name}`);
    const { data: newData, error: insertError } = await supabase.from('brands').insert({ name }).select('id').single();
    if (insertError) {
        console.error('Supabase error creating brand:', insertError);
        throw new Error(`Error creating brand ${name}: ${insertError.message}`);
    }
    if (!newData || !newData.id) {
        console.error('Brand created but no data/id returned:', newData);
        throw new Error(`Failed to create or retrieve id for brand ${name}.`);
    }
    return newData.id;
}

async function findOrCreateCategory(name: string): Promise<string | null> {
    if (!name) return null; // Category is optional
    const { data, error } = await supabase.from('categories').select('id').eq('name', name).maybeSingle();
    if (error) {
        console.error('Supabase error finding category:', error);
        throw new Error(`Error finding category ${name}: ${error.message}`);
    }
    // Category is optional, so if not found (and no error), it's fine to not create and return null implicitly by not finding
    if (data && data.id) return data.id;
    if (data && !data.id) { // Found but no ID - problematic
        console.error('Category found but no id property:', data);
        throw new Error(`Category ${name} found but no id property.`);
    }
    // If data is null (not found) and no error, proceed to create if name was provided.
    if (!data && name) { // Only create if name is non-empty and it wasn't found
    console.log(`Creating category: ${name}`);
    const { data: newData, error: insertError } = await supabase.from('categories').insert({ name }).select('id').single();
        if (insertError) {
            console.error('Supabase error creating category:', insertError);
            throw new Error(`Error creating category ${name}: ${insertError.message}`);
        }
        if (!newData || !newData.id) {
            console.error('Category created but no data/id returned:', newData);
            throw new Error(`Failed to create or retrieve id for category ${name}.`);
        }
    return newData.id;
    }
    return null; // Return null if name was empty or if it wasn't found and shouldn't be created
}

async function findOrCreateFeature(name: string): Promise<string> {
    if (!name) throw new Error("Feature name required.");
    const { data, error } = await supabase.from('features').select('id').eq('name', name).maybeSingle();
    if (error) {
        console.error('Supabase error finding feature:', error);
        throw new Error(`Error finding feature ${name}: ${error.message}`);
    }
    if (data && data.id) return data.id;
    if (data && !data.id) {
        console.error('Feature found but no id property:', data);
        throw new Error(`Feature ${name} found but no id property.`);
    }

    console.log(`Creating feature: ${name}`);
    const { data: newData, error: insertError } = await supabase.from('features').insert({ name }).select('id').single();
    if (insertError) {
        console.error('Supabase error creating feature:', insertError);
        throw new Error(`Error creating feature ${name}: ${insertError.message}`);
    }
    if (!newData || !newData.id) {
        console.error('Feature created but no data/id returned:', newData);
        throw new Error(`Failed to create or retrieve id for feature ${name}.`);
    }
    return newData.id;
}

async function findOrCreateImage(url: string): Promise<string> {
    if (!url) throw new Error("Image URL required.");
    const { data, error } = await supabase.from('images').select('id').eq('url', url).maybeSingle();
    if (error) {
        console.error('Supabase error finding image:', error);
        throw new Error(`Error finding image ${url}: ${error.message}`);
    }
    if (data && data.id) return data.id;
    if (data && !data.id) {
        console.error('Image found but no id property:', data);
        throw new Error(`Image ${url} found but no id property.`);
    }

    console.log(`Creating image record: ${url}`);
    const { data: newData, error: insertError } = await supabase.from('images').insert({ url }).select('id').single();
    if (insertError) {
        console.error('Supabase error creating image:', insertError);
        throw new Error(`Error creating image ${url}: ${insertError.message}`);
    }
    if (!newData || !newData.id) {
        console.error('Image created but no data/id returned:', newData);
        throw new Error(`Failed to create or retrieve id for image ${url}.`);
    }
    return newData.id;
}

async function findOrCreateRequiredDocumentType(name: string): Promise<string> {
    if (!name) throw new Error("Required document type name required.");
    const { data, error } = await supabase.from('required_document_types').select('id').eq('name', name).maybeSingle();
    if (error) {
        console.error('Supabase error finding required document type:', error);
        throw new Error(`Error finding required document type ${name}: ${error.message}`);
    }
    if (data && data.id) return data.id;
    if (data && !data.id) {
        console.error('Required document type found but no id property:', data);
        throw new Error(`Required document type ${name} found but no id property.`);
    }

    console.log(`Creating required document type: ${name}`);
    const { data: newData, error: insertError } = await supabase.from('required_document_types').insert({ name }).select('id').single();
    if (insertError) {
        console.error('Supabase error creating required document type:', insertError);
        throw new Error(`Error creating required document type ${name}: ${insertError.message}`);
    }
    if (!newData || !newData.id) {
        console.error('Required document type created but no data/id returned:', newData);
        throw new Error(`Failed to create or retrieve id for required document type ${name}.`);
    }
    return newData.id;
}


async function findOrCreateInsuranceType(name: string): Promise<string> {
    if (!name) throw new Error("Insurance type name required.");
    const { data, error } = await supabase.from('insurance_types').select('id').eq('name', name).maybeSingle();
    if (error) {
        console.error('Supabase error finding insurance type:', error);
        throw new Error(`Error finding insurance type ${name}: ${error.message}`);
    }
    if (data && data.id) return data.id;
    if (data && !data.id) {
        console.error('Insurance type found but no id property:', data);
        throw new Error(`Insurance type ${name} found but no id property.`);
    }

    console.log(`Creating insurance type: ${name}`);
    const { data: newData, error: insertError } = await supabase.from('insurance_types').insert({ name }).select('id').single();
    if (insertError) {
        console.error('Supabase error creating insurance type:', insertError);
        throw new Error(`Error creating insurance type ${name}: ${insertError.message}`);
    }
    if (!newData || !newData.id) {
        console.error('Insurance type created but no data/id returned:', newData);
        throw new Error(`Failed to create or retrieve id for insurance type ${name}.`);
    }
    return newData.id;
}

// --- Error Tracking Types ---
interface ErrorSummary {
  fileErrors: { file: string; error: string }[];
  shopErrors: { file: string; shop: string; error: string }[];
  offeringErrors: { file: string; offering: string; error: string }[];
  imageErrors: { file: string; offering: string; imageUrl: string; error: string }[];
  featureErrors: { file: string; offering: string; feature: string; error: string }[];
  documentErrors: { file: string; offering: string; document: string; error: string }[];
  insuranceErrors: { file: string; offering: string; insurance: string; error: string }[];
  rateTierErrors: { file: string; offering: string; error: string }[];
  conditionErrors: { file: string; shop: string; condition: string; error: string }[];
}

interface ImportStats {
  totalFiles: number;
  successfulFiles: number;
  failedFiles: number;
  totalShops: number;
  totalOfferings: number;
  successfulOfferings: number;
  failedOfferings: number;
}

// --- Main Import Logic ---

async function importData() {
  console.log('Starting data import...');

  // Initialize error tracking
  const errors: ErrorSummary = {
    fileErrors: [],
    shopErrors: [],
    offeringErrors: [],
    imageErrors: [],
    featureErrors: [],
    documentErrors: [],
    insuranceErrors: [],
    rateTierErrors: [],
    conditionErrors: [],
  };

  const stats: ImportStats = {
    totalFiles: 0,
    successfulFiles: 0,
    failedFiles: 0,
    totalShops: 0,
    totalOfferings: 0,
    successfulOfferings: 0,
    failedOfferings: 0,
  };

  // *** Add Test Query Here ***
  try {
    console.log('Testing Supabase connection...');
    const { data: testData, error: testError } = await supabase
        .from('countries') // Use a simple table
        .select('code')
        .limit(1);

    if (testError) {
        throw new Error(`Connection test failed: ${testError.message}`);
    }
    console.log('Supabase connection successful.');
    
    // Load category mapping
    console.log('Loading category mapping...');
    await loadCategoryMapping();
    
    // Proceed only if connection test passes
    // *** End Test Query ***

    const files = await fs.readdir(DATA_DIR);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    stats.totalFiles = jsonFiles.length;
    console.log(`Found ${jsonFiles.length} JSON files in ${DATA_DIR}`);

    for (const file of jsonFiles) {
      const filePath = path.join(DATA_DIR, file);
      console.log(`
Processing file: ${file}`);
      try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const jsonData = JSON.parse(fileContent) as ScrapedJsonData;

        if (!jsonData.provider_metadata) {
            console.warn(`Skipping ${file}: Missing provider_metadata.`);
            errors.fileErrors.push({ file, error: 'Missing provider_metadata' });
            stats.failedFiles++;
            continue;
        }

        // --- Process Provider / Shop ---
        let shopId: string;
        try {
          shopId = await findOrCreateRentalShop(jsonData.provider_metadata);
          stats.totalShops++;
          console.log(` > Shop ID: ${shopId}`);
        } catch (shopError: any) {
          console.error(`Failed to find or create shop for ${file}. Skipping offerings.`);
          const shopName = jsonData.provider_metadata.name || jsonData.provider_metadata.shop_identifier || 'Unknown';
          errors.shopErrors.push({ file, shop: shopName, error: shopError.message || String(shopError) });
          stats.failedFiles++;
          continue;
        }


        // --- Process Motorcycle Offerings ---
        for (const offering of jsonData.motorcycle_offerings) {
          stats.totalOfferings++;
          // Use default values for missing data
          const brandName = offering.brand || 'N/A';
          const modelName = offering.model || 'N/A';
          const offeringName = `${brandName} ${modelName}`;
          
          console.log(`   - Processing offering: ${offeringName}`);
          
          if (!offering.brand) {
             console.warn(`     Using default brand name "N/A" for missing brand`);
          }
          
          if (!offering.model) {
             console.warn(`     Using default model name "N/A" for missing model`);
          }

          try {
            // 1. Resolve Lookup IDs
            const brandId = await findOrCreateBrand(brandName);
            
            // 2. Get mapped category using the mapping table
            const mappedCategory = getMappedCategory(brandName, modelName, offering.category || undefined);
            const categoryId = mappedCategory ? await findOrCreateCategory(mappedCategory) : null;

            // 3. Prepare Core Rental Data
            // Extract a single daily rate if possible, otherwise null/handle later
            const dailyRateInfo = offering.rental_rates?.find(r => r.min_days === 1 && (!r.max_days || r.max_days === 1));

            const rentalInsertData: TablesInsert<'motorcycle_rentals'> = {
                shop_id: shopId,
                brand_id: brandId,
                category_id: categoryId,
                model: modelName,
                year: offering.year || null,
                engine_capacity_cc: offering.engine_capacity_cc || null,
                rental_rate_per_day: dailyRateInfo?.rate_per_day || null, // Store basic daily rate here if available
                rental_rate_currency: dailyRateInfo?.currency || null,
                specifications_details: offering.specifications_raw as any, // Store raw spec blob
                conditions_details: offering.conditions_raw as any, // Store raw condition blob
                availability_status: offering.availability_status || null,
                source_url: offering.source_url || null,
            };

             // 4. Insert Core Rental Record
            const { data: newRental, error: rentalInsertError } = await supabase
                .from('motorcycle_rentals')
                .insert(rentalInsertData)
                .select('id')
                .single();

            if (rentalInsertError) throw new Error(`Error inserting rental for ${brandName} ${offering.model}: ${rentalInsertError.message}`);
            const motorcycleId = newRental.id;
            stats.successfulOfferings++;
            console.log(`     > Created motorcycle_rental record: ${motorcycleId}`);

            // 5. Process Rental Rate Tiers
            if (offering.rental_rates && offering.rental_rates.length > 0) {
                const rateTiersData = offering.rental_rates
                    .filter(rate => rate.rate_per_day && rate.currency && rate.min_days)
                    .map(rate => ({
                        motorcycle_id: motorcycleId,
                        min_days: rate.min_days,
                        max_days: rate.max_days || null,
                        rate_per_day: rate.rate_per_day!,
                        currency: rate.currency!
                    }));

                if (rateTiersData.length > 0) {
                    const { error: rateTierError } = await supabase
                        .from('rental_rate_tiers')
                        .insert(rateTiersData);

                    if (rateTierError) {
                        console.error(`Error inserting rate tiers for ${motorcycleId}: ${rateTierError.message}`);
                        errors.rateTierErrors.push({ file, offering: offeringName, error: rateTierError.message });
                    } else {
                        console.log(`Inserted ${rateTiersData.length} rate tiers for ${motorcycleId}`);
                    }
                }
            }

             // 6. Process Images
            if (offering.images && offering.images.length > 0) {
                let imageLinks: TablesInsert<'motorcycle_images'>[] = [];
                for (const [index, imageUrl] of Array.from(offering.images.entries())) {
                    try {
                        const imageId = await findOrCreateImage(imageUrl);
                        imageLinks.push({ motorcycle_id: motorcycleId, image_id: imageId, sort_order: index });
                    } catch (imgError: any) {
                        const errorMsg = imgError.message ? imgError.message : String(imgError);
                        console.error(`     ! Error processing image ${imageUrl}: ${errorMsg}`);
                        errors.imageErrors.push({ file, offering: offeringName, imageUrl, error: errorMsg });
                    }
                }
                 if (imageLinks.length > 0) {
                    const { error: imageLinkError } = await supabase.from('motorcycle_images').insert(imageLinks);
                    if (imageLinkError) {
                        console.error(`     ! Error inserting image links for ${motorcycleId}: ${imageLinkError.message}`);
                        errors.imageErrors.push({ file, offering: offeringName, imageUrl: 'bulk insert', error: imageLinkError.message });
                    } else {
                        console.log(`     > Inserted ${imageLinks.length} image links.`);
                    }
                 }
            }

             // 7. Process Features
             if (offering.features && offering.features.length > 0) {
                let featureLinks: TablesInsert<'motorcycle_features'>[] = [];
                 for (const featureName of offering.features) {
                     try {
                         const featureId = await findOrCreateFeature(featureName);
                         featureLinks.push({ motorcycle_id: motorcycleId, feature_id: featureId });
                     } catch (featError: any) {
                         const errorMsg = featError.message || String(featError);
                         console.error(`     ! Error processing feature ${featureName}: ${errorMsg}`);
                         errors.featureErrors.push({ file, offering: offeringName, feature: featureName, error: errorMsg });
                     }
                 }
                 if (featureLinks.length > 0) {
                     const { error: featureLinkError } = await supabase.from('motorcycle_features').insert(featureLinks);
                     if (featureLinkError) {
                        console.error(`     ! Error inserting feature links for ${motorcycleId}: ${featureLinkError.message}`);
                        errors.featureErrors.push({ file, offering: offeringName, feature: 'bulk insert', error: featureLinkError.message });
                     } else {
                        console.log(`     > Inserted ${featureLinks.length} feature links.`);
                     }
                 }
             }

             // 8. Process Required Documents
            if (offering.required_documents_raw && offering.required_documents_raw.length > 0) {
                let docLinks: TablesInsert<'motorcycle_required_documents'>[] = [];
                for (const docName of offering.required_documents_raw) {
                    try {
                        const docTypeId = await findOrCreateRequiredDocumentType(docName);
                        docLinks.push({ motorcycle_id: motorcycleId, document_type_id: docTypeId });
                    } catch (docError: any) {
                        const errorMsg = docError.message || String(docError);
                        console.error(`     ! Error processing required document ${docName}: ${errorMsg}`);
                        errors.documentErrors.push({ file, offering: offeringName, document: docName, error: errorMsg });
                    }
                }
                if (docLinks.length > 0) {
                    // Use upsert to avoid errors if the link already exists (e.g., running script twice)
                    const { error: docLinkError } = await supabase.from('motorcycle_required_documents').upsert(docLinks);
                    if (docLinkError) {
                        console.error(`     ! Error inserting required document links for ${motorcycleId}: ${docLinkError.message}`);
                        errors.documentErrors.push({ file, offering: offeringName, document: 'bulk insert', error: docLinkError.message });
                    } else {
                        console.log(`     > Inserted/Upserted ${docLinks.length} required document links.`);
                    }
                }
            }

             // 9. Process Insurance Details
             if (offering.insurance_details_raw && offering.insurance_details_raw.length > 0) {
                 let insuranceData: TablesInsert<'motorcycle_insurance_details'>[] = [];
                 for (const detail of offering.insurance_details_raw) {
                     try {
                         const insuranceTypeId = await findOrCreateInsuranceType(detail.type_name);
                         insuranceData.push({
                             motorcycle_id: motorcycleId,
                             insurance_type_id: insuranceTypeId,
                             is_included: detail.is_included,
                             cost_per_day: detail.cost_per_day || null,
                             cost_currency: detail.currency || null,
                             deductible: detail.deductible || null,
                             deductible_currency: detail.deductible_currency || null,
                             notes: detail.notes || null,
                         });
                     } catch (insError: any) {
                          const errorMsg = insError.message || String(insError);
                          console.error(`     ! Error processing insurance detail ${detail.type_name}: ${errorMsg}`);
                          errors.insuranceErrors.push({ file, offering: offeringName, insurance: detail.type_name, error: errorMsg });
                     }
                 }
                  if (insuranceData.length > 0) {
                      // Use upsert with conflict resolution on (motorcycle_id, insurance_type_id)
                      const { error: insuranceError } = await supabase
                            .from('motorcycle_insurance_details')
                            .upsert(insuranceData, { onConflict: 'motorcycle_id, insurance_type_id' });
                      if (insuranceError) {
                        console.error(`     ! Error inserting insurance details for ${motorcycleId}: ${insuranceError.message}`);
                        errors.insuranceErrors.push({ file, offering: offeringName, insurance: 'bulk insert', error: insuranceError.message });
                      } else {
                        console.log(`     > Inserted/Upserted ${insuranceData.length} insurance details.`);
                      }
                  }
             }

             // 10. Process Conditions (Currently just stored in JSONB)
             // Future enhancement: Could parse conditions_raw if it becomes structured
             // and map to motorcycle_conditions junction table using findOrCreateConditionType


          } catch (offerError: any) {
             const errorMsg = offerError.message || String(offerError);
             console.error(`   ! Failed to process offering ${offeringName}: ${errorMsg}`);
             errors.offeringErrors.push({ file, offering: offeringName, error: errorMsg });
             stats.failedOfferings++;
          }
        } // End of offerings loop
        
        // Mark file as successful if we got here (shop was created successfully)
        stats.successfulFiles++;

      } catch (fileError: any) {
        const errorMsg = fileError.message || String(fileError);
        console.error(`Failed to process file ${file}: ${errorMsg}`);
        errors.fileErrors.push({ file, error: errorMsg });
        stats.failedFiles++;
      }
    } // End of file loop

    console.log('\n' + '='.repeat(80));
    console.log('IMPORT SUMMARY');
    console.log('='.repeat(80));
    
    // Print Statistics
    console.log('\n📊 STATISTICS:');
    console.log(`  Files Processed: ${stats.totalFiles}`);
    console.log(`  ✅ Successful: ${stats.successfulFiles}`);
    console.log(`  ❌ Failed: ${stats.failedFiles}`);
    console.log(`  \n  Shops Created: ${stats.totalShops}`);
    console.log(`  \n  Offerings Processed: ${stats.totalOfferings}`);
    console.log(`  ✅ Successful: ${stats.successfulOfferings}`);
    console.log(`  ❌ Failed: ${stats.failedOfferings}`);
    
    // Calculate total errors
    const totalErrors = 
      errors.fileErrors.length +
      errors.shopErrors.length +
      errors.offeringErrors.length +
      errors.imageErrors.length +
      errors.featureErrors.length +
      errors.documentErrors.length +
      errors.insuranceErrors.length +
      errors.rateTierErrors.length +
      errors.conditionErrors.length;
    
    console.log(`\n🚨 TOTAL ERRORS: ${totalErrors}`);
    
    // Print detailed errors if any
    if (totalErrors > 0) {
      console.log('\n' + '-'.repeat(80));
      console.log('DETAILED ERRORS:');
      console.log('-'.repeat(80));
      
      if (errors.fileErrors.length > 0) {
        console.log(`\n❌ File Errors (${errors.fileErrors.length}):`);
        errors.fileErrors.forEach((err, idx) => {
          console.log(`  ${idx + 1}. File: ${err.file}`);
          console.log(`     Error: ${err.error}`);
        });
      }
      
      if (errors.shopErrors.length > 0) {
        console.log(`\n❌ Shop Errors (${errors.shopErrors.length}):`);
        errors.shopErrors.forEach((err, idx) => {
          console.log(`  ${idx + 1}. File: ${err.file}`);
          console.log(`     Shop: ${err.shop}`);
          console.log(`     Error: ${err.error}`);
        });
      }
      
      if (errors.offeringErrors.length > 0) {
        console.log(`\n❌ Offering Errors (${errors.offeringErrors.length}):`);
        errors.offeringErrors.forEach((err, idx) => {
          console.log(`  ${idx + 1}. File: ${err.file}`);
          console.log(`     Offering: ${err.offering}`);
          console.log(`     Error: ${err.error}`);
        });
      }
      
      if (errors.rateTierErrors.length > 0) {
        console.log(`\n❌ Rate Tier Errors (${errors.rateTierErrors.length}):`);
        errors.rateTierErrors.forEach((err, idx) => {
          console.log(`  ${idx + 1}. File: ${err.file}`);
          console.log(`     Offering: ${err.offering}`);
          console.log(`     Error: ${err.error}`);
        });
      }
      
      if (errors.imageErrors.length > 0) {
        console.log(`\n❌ Image Errors (${errors.imageErrors.length}):`);
        errors.imageErrors.slice(0, 10).forEach((err, idx) => {
          console.log(`  ${idx + 1}. File: ${err.file}`);
          console.log(`     Offering: ${err.offering}`);
          console.log(`     Image URL: ${err.imageUrl}`);
          console.log(`     Error: ${err.error}`);
        });
        if (errors.imageErrors.length > 10) {
          console.log(`  ... and ${errors.imageErrors.length - 10} more image errors`);
        }
      }
      
      if (errors.featureErrors.length > 0) {
        console.log(`\n❌ Feature Errors (${errors.featureErrors.length}):`);
        errors.featureErrors.slice(0, 10).forEach((err, idx) => {
          console.log(`  ${idx + 1}. File: ${err.file}`);
          console.log(`     Offering: ${err.offering}`);
          console.log(`     Feature: ${err.feature}`);
          console.log(`     Error: ${err.error}`);
        });
        if (errors.featureErrors.length > 10) {
          console.log(`  ... and ${errors.featureErrors.length - 10} more feature errors`);
        }
      }
      
      if (errors.documentErrors.length > 0) {
        console.log(`\n❌ Document Errors (${errors.documentErrors.length}):`);
        errors.documentErrors.slice(0, 10).forEach((err, idx) => {
          console.log(`  ${idx + 1}. File: ${err.file}`);
          console.log(`     Offering: ${err.offering}`);
          console.log(`     Document: ${err.document}`);
          console.log(`     Error: ${err.error}`);
        });
        if (errors.documentErrors.length > 10) {
          console.log(`  ... and ${errors.documentErrors.length - 10} more document errors`);
        }
      }
      
      if (errors.insuranceErrors.length > 0) {
        console.log(`\n❌ Insurance Errors (${errors.insuranceErrors.length}):`);
        errors.insuranceErrors.slice(0, 10).forEach((err, idx) => {
          console.log(`  ${idx + 1}. File: ${err.file}`);
          console.log(`     Offering: ${err.offering}`);
          console.log(`     Insurance: ${err.insurance}`);
          console.log(`     Error: ${err.error}`);
        });
        if (errors.insuranceErrors.length > 10) {
          console.log(`  ... and ${errors.insuranceErrors.length - 10} more insurance errors`);
        }
      }
      
      if (errors.conditionErrors.length > 0) {
        console.log(`\n❌ Condition Errors (${errors.conditionErrors.length}):`);
        errors.conditionErrors.slice(0, 10).forEach((err, idx) => {
          console.log(`  ${idx + 1}. File: ${err.file}`);
          console.log(`     Shop: ${err.shop}`);
          console.log(`     Condition: ${err.condition}`);
          console.log(`     Error: ${err.error}`);
        });
        if (errors.conditionErrors.length > 10) {
          console.log(`  ... and ${errors.conditionErrors.length - 10} more condition errors`);
        }
      }
    } else {
      console.log('\n✅ No errors encountered!');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('Import process finished.');
    console.log('='.repeat(80));

  } catch (error: any) {
    console.error('An error occurred during the import process:', error.message);
    process.exit(1); // Exit with error code
  }
}

// Run the import function
importData(); 