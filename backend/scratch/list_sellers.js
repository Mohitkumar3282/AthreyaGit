import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Seller from '../app/models/seller.js';
import Product from '../app/models/product.js';

dotenv.config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const sellers = await Seller.find({}).lean();
        console.log(`Found ${sellers.length} sellers in DB:`);
        for (const s of sellers) {
            const productCount = await Product.countDocuments({ sellerId: s._id });
            console.log(JSON.stringify({
                _id: s._id,
                shopName: s.shopName,
                isActive: s.isActive,
                location: s.location,
                serviceRadius: s.serviceRadius,
                productCount
            }, null, 2));
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

run();
