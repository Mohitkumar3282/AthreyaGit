import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Seller from '../app/models/seller.js';

dotenv.config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const allSellers = await Seller.find({}).lean();

        console.log(`Found ${allSellers.length} total sellers:`);
        for (const s of allSellers) {
            console.log(`- Shop: ${s.shopName || s.name || 'Unnamed'}`);
            console.log(`  ID: ${s._id}`);
            console.log(`  isActive: ${s.isActive}`);
            console.log(`  isOpen: ${s.isOpen}`);
            console.log(`  isVerified: ${s.isVerified}`);
            console.log(`  applicationStatus: ${s.applicationStatus}`);
            console.log(`  location: ${JSON.stringify(s.location)}`);
            console.log(`  serviceRadius: ${s.serviceRadius}`);
            console.log(`  locality: ${s.locality}`);
            console.log('------------------------------');
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

run();
