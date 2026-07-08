import mongoose from 'mongoose';
import dotenv from 'dotenv';
import HeroConfig from '../app/models/heroConfig.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const configs = await HeroConfig.find().lean();
  console.log('HERO CONFIGS IN DB:', JSON.stringify(configs, null, 2));
  process.exit(0);
}
run().catch(console.error);
