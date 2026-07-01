import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from './app/models/category.js';

dotenv.config();

async function inspect() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');
        
        const categories = await Category.find({});
        console.log('Categories in DB:');
        categories.forEach(cat => {
            console.log(`- Name: ${cat.name}, Type: ${cat.type}, Image: ${cat.image}, IconUrl: ${cat.iconUrl}`);
        });

        // Let's find Fruits & Vegetables/FRUITS AND VEG categories and fix their image URL if they are broken
        const vegCats = categories.filter(c => 
            c.name.toLowerCase().includes('fruit') || 
            c.name.toLowerCase().includes('veg')
        );

        for (const cat of vegCats) {
            console.log(`Fixing category: ${cat.name}`);
            cat.image = "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&q=80&w=200";
            cat.iconUrl = "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&q=80&w=200";
            await cat.save();
            console.log(`Category ${cat.name} updated successfully!`);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

inspect();
