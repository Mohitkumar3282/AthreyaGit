import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Setting from '../app/models/setting.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const s = await Setting.findOne().lean();
  console.log('SETTINGS IN DB:', JSON.stringify(s, null, 2));
  process.exit(0);
}
run().catch(console.error);
