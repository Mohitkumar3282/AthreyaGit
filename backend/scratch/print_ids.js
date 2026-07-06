import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from '../app/models/category.js';

dotenv.config({ path: '../.env' });

async function inspect() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const categories = await Category.find({
            name: { $in: ["Fruits", "Vegetables", "Chicken", "Mutton", "Eggs"] }
        });
        
        const catIds = categories.map(c => c._id);
        const subcategories = await Category.find({
            parentId: { $in: catIds }
        });
        
        console.log('Categories matching Daily Needs:');
        categories.forEach(cat => {
            console.log(`ID: ${cat._id}, Name: ${cat.name}, Slug: ${cat.slug}, Type: ${cat.type}, ParentId: ${cat.parentId}`);
        });

        console.log('Subcategories of Daily Needs:');
        subcategories.forEach(sub => {
            console.log(`ID: ${sub._id}, Name: ${sub.name}, Slug: ${sub.slug}, Type: ${sub.type}, ParentId: ${sub.parentId}`);
        });
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
inspect();
