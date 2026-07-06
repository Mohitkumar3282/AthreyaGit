import mongoose from 'mongoose';
import dotenv from 'dotenv';
import OfferSection from '../app/models/offerSection.js';
import Product from '../app/models/product.js';
import User from '../app/models/customer.js';
import Cart from '../app/models/cart.js';
import { getApprovedOrLegacyFilter } from '../app/services/productModerationService.js';

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    // Find active offer sections
    const sections = await OfferSection.find({ status: 'active' })
      .populate({
        path: 'productIds',
        match: {
          status: 'active',
          ...getApprovedOrLegacyFilter()
        }
      });

    console.log(`Found ${sections.length} active offer sections`);
    for (const sec of sections) {
      console.log(`Section: "${sec.title}" has ${sec.productIds ? sec.productIds.length : 0} matching products`);
      if (sec.productIds && sec.productIds.length > 0) {
        for (const prod of sec.productIds) {
          console.log(` - Product ID: ${prod._id}, Name: "${prod.name}", Status: "${prod.status}", ApprovalStatus: "${prod.approvalStatus}"`);
          console.log(`   Price: ${prod.price}, SalePrice: ${prod.salePrice}`);
          console.log(`   Variants Count: ${prod.variants ? prod.variants.length : 0}`);
          if (prod.variants && prod.variants.length > 0) {
            console.log(`   Variants:`, JSON.stringify(prod.variants, null, 2));
          }
        }
      }
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error running script:', err);
  }
}

run();
