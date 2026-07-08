import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Seller from '../app/models/seller.js';

dotenv.config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const activeSellers = await Seller.find({
            isActive: true,
            isOpen: true,
            isVerified: true
        }).lean();

        console.log(`Found ${activeSellers.length} active, open, verified sellers:`);
        for (const s of activeSellers) {
            console.log(`- Shop: ${s.shopName} | ID: ${s._id}`);
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

run();
