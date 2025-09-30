import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'templated-data', 'siem-reap');

async function updateLocationData() {
    console.log('Updating location data for Siem Reap JSON files...');
    
    // Read all JSON files in the directory
    const files = fs.readdirSync(DATA_DIR).filter(file => file.endsWith('.json'));
    console.log(`Found ${files.length} JSON files to process`);
    
    let updatedCount = 0;
    let alreadyCorrectCount = 0;
    
    for (const file of files) {
        const filePath = path.join(DATA_DIR, file);
        
        try {
            // Read and parse the JSON file
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(fileContent);
            
            // Check if location data needs updating
            const currentCity = data.provider_metadata?.city;
            const currentProvince = data.provider_metadata?.province;
            const currentCountry = data.provider_metadata?.country;
            
            const needsUpdate = currentCity !== 'Siem Reap' || 
                              currentProvince !== 'Siem Reap Province' || 
                              currentCountry !== 'Cambodia';
            
            if (needsUpdate) {
                // Update the location data
                if (data.provider_metadata) {
                    data.provider_metadata.city = 'Siem Reap';
                    data.provider_metadata.province = 'Siem Reap Province';
                    data.provider_metadata.country = 'Cambodia';
                }
                
                // Write back to file with proper formatting
                fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
                console.log(`✅ Updated: ${file}`);
                updatedCount++;
            } else {
                console.log(`✓ Already correct: ${file}`);
                alreadyCorrectCount++;
            }
            
        } catch (error) {
            console.error(`❌ Error processing ${file}:`, error);
        }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Updated: ${updatedCount} files`);
    console.log(`   Already correct: ${alreadyCorrectCount} files`);
    console.log(`   Total processed: ${files.length} files`);
}

updateLocationData().catch(console.error);