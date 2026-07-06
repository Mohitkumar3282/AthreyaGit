import dotenv from 'dotenv';
import { geocodeAddress } from '../app/services/mapsGeocodeService.js';

dotenv.config();

async function test() {
    try {
        const addressText = "81 Pipliyahana Road, Near 214, Indore - 452018";
        console.log("Geocoding address:", addressText);
        const result = await geocodeAddress(addressText);
        console.log("Result:", JSON.stringify(result, null, 2));
        process.exit(0);
    } catch (err) {
        console.error("Geocoding failed:", err);
        process.exit(1);
    }
}

test();
