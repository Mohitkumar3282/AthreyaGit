import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from '../app/models/category.js';

dotenv.config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const categories = await Category.find({}).lean();
        console.log(`Found ${categories.length} categories:`);
        
        const waterAndMilkCats = categories.filter(c => 
            c.name.toLowerCase().includes('water') || 
            c.name.toLowerCase().includes('milk') ||
            c.slug.toLowerCase().includes('water') || 
            c.slug.toLowerCase().includes('milk')
        );

        for (const c of waterAndMilkCats) {
            console.log(JSON.stringify({
                _id: c._id,
                name: c.name,
                slug: c.slug,
                type: c.type,
                parentId: c.parentId,
                image: c.image,
                iconUrl: c.iconUrl,
                status: c.status
            }, null, 2));
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

run();
