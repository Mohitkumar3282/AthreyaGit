import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from '../app/models/category.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const list = await Category.find({ type: 'header' }).lean();
  console.log('HEADERS IN DB:');
  list.forEach(c => {
    console.log(JSON.stringify({ _id: c._id, name: c.name, image: c.image, type: c.type, childrenCount: c.children?.length }));
  });
  process.exit(0);
}
run().catch(console.error);
