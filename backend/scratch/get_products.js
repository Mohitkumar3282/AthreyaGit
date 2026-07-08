import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../app/models/product.js';
import Category from '../app/models/category.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const product = await Product.findOne({ name: 'Chinken' }).lean();
  console.log('CHINKEN PRODUCT:', JSON.stringify(product, null, 2));

  if (product) {
    if (product.headerId) {
      const header = await Category.findById(product.headerId).lean();
      console.log('HEADER CATEGORY:', header);
    }
    if (product.categoryId) {
      const cat = await Category.findById(product.categoryId).lean();
      console.log('CATEGORY:', cat);
    }
    if (product.subcategoryId) {
      const sub = await Category.findById(product.subcategoryId).lean();
      console.log('SUBCATEGORY:', sub);
    }
  }
  
  process.exit(0);
}
run().catch(console.error);
