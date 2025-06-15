import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database, Tables, TablesInsert } from '../app/_lib/database.types'; // Adjust path as necessary
import { fileURLToPath } from 'url'; // Import fileURLToPath

// Load environment variables from .env.local
// ES Module equivalent for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
      min_days: number;
      max_days?: number | null;
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

const DATA_DIR = path.resolve(__dirname, '../design-data/templated-data');

// --- Helper Functions for Find/Create ---

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
    // Need a valid code (like 'TH'). If only name provided, need mapping or default.
    const insertCode = code || (name === 'Thailand' ? 'TH' : 'XX'); // Example fallback
    console.log(`Creating country: ${name} (${insertCode})`);
    const { data: newData, error: insertError } = await supabase
        .from('countries')
        .insert({ code: insertCode, name: name || 'Unknown' }) // Use name if provided, else 'Unknown'
        .select('code')
        .single();
    if (insertError) {
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
    const countryCode = metadata.country ? await findOrCreateCountry(metadata.country === 'Thailand' ? 'TH' : 'XX', metadata.country) : null;
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

// --- Main Import Logic ---

async function importData() {
  console.log('Starting data import...');

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
    // Proceed only if connection test passes
    // *** End Test Query ***

    const files = await fs.readdir(DATA_DIR);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
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
            continue;
        }

        // --- Process Provider / Shop ---
        const shopId = await findOrCreateRentalShop(jsonData.provider_metadata);
        if (!shopId) {
             console.error(`Failed to find or create shop for ${file}. Skipping offerings.`);
             continue;
        }
         console.log(` > Shop ID: ${shopId}`);


        // --- Process Motorcycle Offerings ---
        for (const offering of jsonData.motorcycle_offerings) {
          console.log(`   - Processing offering: ${offering.brand} ${offering.model}`);

          if (!offering.brand) {
             console.warn(`     Skipping offering: Missing brand name.`);
             continue;
          }

          try {
            // 1. Resolve Lookup IDs
            const brandId = await findOrCreateBrand(offering.brand);
            const categoryId = offering.category ? await findOrCreateCategory(offering.category) : null;

            // 2. Prepare Core Rental Data
            // Extract a single daily rate if possible, otherwise null/handle later
            const dailyRateInfo = offering.rental_rates?.find(r => r.min_days === 1 && (!r.max_days || r.max_days === 1));

            const rentalInsertData: TablesInsert<'motorcycle_rentals'> = {
                shop_id: shopId,
                brand_id: brandId,
                category_id: categoryId,
                model: offering.model,
                year: offering.year || null,
                engine_capacity_cc: offering.engine_capacity_cc || null,
                rental_rate_per_day: dailyRateInfo?.rate_per_day || null, // Store basic daily rate here if available
                rental_rate_currency: dailyRateInfo?.currency || null,
                specifications_details: offering.specifications_raw as any, // Store raw spec blob
                conditions_details: offering.conditions_raw as any, // Store raw condition blob
                availability_status: offering.availability_status || null,
                source_url: offering.source_url || null,
            };

             // 3. Insert Core Rental Record
            const { data: newRental, error: rentalInsertError } = await supabase
                .from('motorcycle_rentals')
                .insert(rentalInsertData)
                .select('id')
                .single();

            if (rentalInsertError) throw new Error(`Error inserting rental for ${offering.brand} ${offering.model}: ${rentalInsertError.message}`);
            const motorcycleId = newRental.id;
             console.log(`     > Created motorcycle_rental record: ${motorcycleId}`);

            // 4. Process Rental Rate Tiers
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
                    } else {
                        console.log(`Inserted ${rateTiersData.length} rate tiers for ${motorcycleId}`);
                    }
                }
            }

             // 5. Process Images
            if (offering.images && offering.images.length > 0) {
                let imageLinks: TablesInsert<'motorcycle_images'>[] = [];
                for (const [index, imageUrl] of Array.from(offering.images.entries())) {
                    try {
                        const imageId = await findOrCreateImage(imageUrl);
                        imageLinks.push({ motorcycle_id: motorcycleId, image_id: imageId, sort_order: index });
                    } catch (imgError: any) {
                        console.error(`     ! Error processing image ${imageUrl}: ${imgError.message ? imgError.message : imgError}`);
                    }
                }
                 if (imageLinks.length > 0) {
                    const { error: imageLinkError } = await supabase.from('motorcycle_images').insert(imageLinks);
                    if (imageLinkError) console.error(`     ! Error inserting image links for ${motorcycleId}: ${imageLinkError.message}`);
                     else console.log(`     > Inserted ${imageLinks.length} image links.`);
                 }
            }

             // 6. Process Features
             if (offering.features && offering.features.length > 0) {
                let featureLinks = [];
                 for (const featureName of offering.features) {
                     try {
                         const featureId = await findOrCreateFeature(featureName);
                         featureLinks.push({ motorcycle_id: motorcycleId, feature_id: featureId });
                     } catch (featError: any) {
                         console.error(`     ! Error processing feature ${featureName}: ${featError.message}`);
                     }
                 }
                 if (featureLinks.length > 0) {
                     const { error: featureLinkError } = await supabase.from('motorcycle_features').insert(featureLinks);
                     if (featureLinkError) console.error(`     ! Error inserting feature links for ${motorcycleId}: ${featureLinkError.message}`);
                      else console.log(`     > Inserted ${featureLinks.length} feature links.`);
                 }
             }

             // 7. Process Required Documents
            if (offering.required_documents_raw && offering.required_documents_raw.length > 0) {
                let docLinks = [];
                for (const docName of offering.required_documents_raw) {
                    try {
                        const docTypeId = await findOrCreateRequiredDocumentType(docName);
                        docLinks.push({ motorcycle_id: motorcycleId, document_type_id: docTypeId });
                    } catch (docError: any) {
                        console.error(`     ! Error processing required document ${docName}: ${docError.message}`);
                    }
                }
                if (docLinks.length > 0) {
                    // Use upsert to avoid errors if the link already exists (e.g., running script twice)
                    const { error: docLinkError } = await supabase.from('motorcycle_required_documents').upsert(docLinks);
                    if (docLinkError) console.error(`     ! Error inserting required document links for ${motorcycleId}: ${docLinkError.message}`);
                     else console.log(`     > Inserted/Upserted ${docLinks.length} required document links.`);
                }
            }

             // 8. Process Insurance Details
             if (offering.insurance_details_raw && offering.insurance_details_raw.length > 0) {
                 let insuranceData = [];
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
                          console.error(`     ! Error processing insurance detail ${detail.type_name}: ${insError.message}`);
                     }
                 }
                  if (insuranceData.length > 0) {
                      // Use upsert with conflict resolution on (motorcycle_id, insurance_type_id)
                      const { error: insuranceError } = await supabase
                            .from('motorcycle_insurance_details')
                            .upsert(insuranceData, { onConflict: 'motorcycle_id, insurance_type_id' });
                      if (insuranceError) console.error(`     ! Error inserting insurance details for ${motorcycleId}: ${insuranceError.message}`);
                       else console.log(`     > Inserted/Upserted ${insuranceData.length} insurance details.`);
                  }
             }

             // 9. Process Conditions (Currently just stored in JSONB)
             // Future enhancement: Could parse conditions_raw if it becomes structured
             // and map to motorcycle_conditions junction table using findOrCreateConditionType


          } catch (offerError: any) {
             console.error(`   ! Failed to process offering ${offering.brand} ${offering.model}: ${offerError.message}`);
          }
        } // End of offerings loop

      } catch (fileError: any) {
        console.error(`Failed to process file ${file}: ${fileError.message}`);
      }
    } // End of file loop

    console.log('\nImport process finished.');

  } catch (error: any) {
    console.error('An error occurred during the import process:', error.message);
    process.exit(1); // Exit with error code
  }
}

// Run the import function
importData(); 