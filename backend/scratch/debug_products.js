import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../app/models/product.js';
import Category from '../app/models/category.js';
import Seller from '../app/models/seller.js';

dotenv.config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        console.log('\n--- CAMPA PRODUCTS ---');
        const campaProducts = await Product.find({ name: /Campa/i }).lean();
        console.log(`Found ${campaProducts.length} Campa products:`);
        for (const p of campaProducts) {
            console.log(JSON.stringify({
                _id: p._id,
                name: p.name,
                status: p.status,
                approvalStatus: p.approvalStatus,
                headerId: p.headerId,
                categoryId: p.categoryId,
                subcategoryId: p.subcategoryId,
                sellerId: p.sellerId,
                isFeatured: p.isFeatured,
            }, null, 2));

            // Fetch the references
            const header = await Category.findById(p.headerId).lean();
            const category = await Category.findById(p.categoryId).lean();
            const subcategory = await Category.findById(p.subcategoryId).lean();
            const seller = await Seller.findById(p.sellerId).lean();

            console.log('Category details:');
            console.log(`- Header: ${header ? `${header.name} (${header.type}, status: ${header.status})` : 'null'}`);
            console.log(`- Category: ${category ? `${category.name} (${category.type}, status: ${category.status})` : 'null'}`);
            console.log(`- Subcategory: ${subcategory ? `${subcategory.name} (${subcategory.type}, status: ${subcategory.status})` : 'null'}`);
            
            console.log('Seller details:');
            if (seller) {
                console.log(`- Name: ${seller.shopName}`);
                console.log(`- isActive: ${seller.isActive}`);
                console.log(`- isApproved: ${seller.isApproved}`);
                console.log(`- location:`, JSON.stringify(seller.location));
                console.log(`- serviceRadius: ${seller.serviceRadius} km`);
            } else {
                console.log(`- Seller: null`);
            }
            console.log('----------------------------------------------------');
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

run();
