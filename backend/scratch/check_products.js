import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../app/models/product.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const sampleProduct = await Product.findOne().lean();
  console.log('Sample Product Keys:', Object.keys(sampleProduct));
  console.log('Sample Product details:', JSON.stringify(sampleProduct, null, 2));

  // Count products with potential flags
  const counts = {
    total: await Product.countDocuments(),
    isFeatured: await Product.countDocuments({ isFeatured: true }),
    dailyNeed: await Product.countDocuments({ dailyNeed: true }),
    isDailyNeed: await Product.countDocuments({ isDailyNeed: true }),
    todayNeed: await Product.countDocuments({ todayNeed: true }),
  };
  console.log('Counts:', counts);

  process.exit(0);
}
run().catch(console.error);
