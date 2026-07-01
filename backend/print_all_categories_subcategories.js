import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, './.env') });

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/quickcommerce';

async function run() {
  try {
    await mongoose.connect(mongoUri);
    const Category = mongoose.model('Category', new mongoose.Schema({}, { strict: false }), 'categories');
    const categories = await Category.find({}).lean();
    
    console.log(`Found ${categories.length} total categories in DB.`);
    
    // Group by type
    const headers = categories.filter(c => c.type === 'header');
    const cats = categories.filter(c => c.type === 'category');
    const subcats = categories.filter(c => c.type === 'subcategory');
    
    console.log('\n--- HEADERS ---');
    headers.forEach(h => console.log(`- ${h.name} (${h._id})`));
    
    console.log('\n--- CATEGORIES ---');
    cats.forEach(c => {
      const parent = headers.find(h => String(h._id) === String(c.parentId)) || cats.find(h => String(h._id) === String(c.parentId));
      console.log(`- ${c.name} (${c._id}) -> Parent: ${parent ? parent.name : 'null'}`);
    });
    
    console.log('\n--- SUBCATEGORIES ---');
    subcats.forEach(s => {
      const parent = cats.find(c => String(c._id) === String(s.parentId)) || headers.find(h => String(h._id) === String(s.parentId));
      console.log(`- ${s.name} (${s._id}) -> Parent: ${parent ? parent.name : 'null'}`);
    });

    // Check if any category name matches body, hair, skincare, grocery, etc.
    const searchTerms = ['body', 'hair', 'skin', 'grocery', 'personal', 'care'];
    console.log('\n--- SEARCH RESULTS FOR TERMS ---');
    categories.forEach(c => {
      const nameLower = c.name.toLowerCase();
      if (searchTerms.some(term => nameLower.includes(term))) {
        console.log(`Match found: "${c.name}" | Type: ${c.type} | ID: ${c._id}`);
      }
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}
run();
