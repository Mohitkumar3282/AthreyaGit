import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../app/models/product.js';

dotenv.config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const product = await Product.findOne({ status: "active" })
            .populate("sellerId")
            .lean();

        console.log('Sample product with populated seller:');
        console.log(JSON.stringify(product, null, 2));

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

run();
