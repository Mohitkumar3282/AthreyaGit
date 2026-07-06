import { uploadToCloudinary } from '../app/services/mediaService.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testUpload() {
    console.log("Testing uploadToCloudinary with mock file buffer...");
    const dummyBuffer = Buffer.from("Hello World - this is a test image file content");
    const mimeType = "image/png";

    try {
        const resultUrl = await uploadToCloudinary(dummyBuffer, "products", {
            mimeType,
            resourceType: "image"
        });

        console.log("\nSuccess!");
        console.log("Returned URL start:", resultUrl.substring(0, 50));
        console.log("Is Data URL:", resultUrl.startsWith("data:"));
        
        if (resultUrl.startsWith("data:")) {
            console.log("Correctly fell back to Base64 data URL!");
        } else {
            console.log("WARNING: Did not fall back to Base64 data URL!");
        }
    } catch (error) {
        console.error("Test failed with error:", error);
    }
}

testUpload();
