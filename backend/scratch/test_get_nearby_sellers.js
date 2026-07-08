import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Seller from '../app/models/seller.js';

dotenv.config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        // Let's test the database query we do in getNearbySellers when no lat/lng is passed
        const sellers = await Seller.find({
            isActive: true,
            isOpen: true,
            isVerified: true
        }).lean();

        console.log(`Found ${sellers.length} sellers matching {isActive: true, isOpen: true, isVerified: true}:`);
        for (const s of sellers) {
            console.log(`- ${s.shopName} (ID: ${s._id}) | isActive: ${s.isActive} | isOpen: ${s.isOpen} | isVerified: ${s.isVerified}`);
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

run();
