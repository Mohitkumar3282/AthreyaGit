import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Seller from '../app/models/seller.js';

dotenv.config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        // Find all sellers with coordinates [0, 0]
        const sellersToFix = await Seller.find({
            "location.coordinates": { $eq: [0, 0] }
        });

        console.log(`Found ${sellersToFix.length} sellers with [0,0] coordinates to fix:`);

        for (const s of sellersToFix) {
            console.log(`- Updating shop: ${s.shopName || s.name}`);
            s.location = {
                type: "Point",
                coordinates: [75.9001552518043, 22.711140989838025] // Default Indore coordinates
            };
            await s.save();
            console.log(`  Shop ${s.shopName || s.name} updated successfully!`);
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

run();
