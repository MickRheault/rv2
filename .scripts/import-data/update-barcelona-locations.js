import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BARCELONA_DIR = path.join(__dirname, 'templated-data', 'barcelona');

// Get all JSON files
const files = fs.readdirSync(BARCELONA_DIR).filter(file => file.endsWith('.json'));

console.log(`Found ${files.length} JSON files to update in Barcelona folder\n`);

let successCount = 0;
let errorCount = 0;

files.forEach(file => {
  const filePath = path.join(BARCELONA_DIR, file);
  
  try {
    // Read the file
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    // Check if provider_metadata exists
    if (!data.provider_metadata) {
      console.log(`⚠️  Skipping ${file}: No provider_metadata found`);
      errorCount++;
      return;
    }
    
    // Get current values
    const currentCity = data.provider_metadata.city;
    const currentProvince = data.provider_metadata.province;
    const currentCountry = data.provider_metadata.country;
    
    // Update the location fields
    data.provider_metadata.city = 'Barcelona';
    data.provider_metadata.province = 'Barcelona';
    data.provider_metadata.country = 'Spain';
    
    // Write back to file with pretty formatting
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    
    // Log the update
    const wasNull = currentCity === null && currentProvince === null && currentCountry === null;
    if (wasNull) {
      console.log(`✅ ${file}: Updated from null values to Barcelona, Barcelona, Spain`);
    } else {
      console.log(`✅ ${file}: Updated from "${currentCity || 'null'}", "${currentProvince || 'null'}", "${currentCountry || 'null'}" to Barcelona, Barcelona, Spain`);
    }
    
    successCount++;
  } catch (error) {
    console.error(`❌ Error processing ${file}:`, error.message);
    errorCount++;
  }
});

console.log(`\n📊 Summary:`);
console.log(`   ✅ Successfully updated: ${successCount} files`);
console.log(`   ❌ Errors: ${errorCount} files`);
console.log(`   📁 Total processed: ${files.length} files`);

