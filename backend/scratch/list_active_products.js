import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../app/models/product.js';

dotenv.config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const products = await Product.find({ status: 'active' });
        console.log('Active products count:', products.length);
        console.log(JSON.stringify(products.map(p => ({
            id: p._id,
            name: p.name,
            status: p.status,
            approvalStatus: p.approvalStatus,
            variants: p.variants
        })), null, 2));

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

run();
