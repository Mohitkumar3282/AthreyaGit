import mongoose from "mongoose";
import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

import ReturnRequest from "../app/models/returnRequest.js";
import Seller from "../app/models/seller.js";
import User from "../app/models/customer.js";

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");

  const returns = await ReturnRequest.find().lean();
  console.log(`Total return requests in database: ${returns.length}`);
  
  for (const r of returns) {
    const s = await Seller.findById(r.seller_id).select("name shopName").lean();
    const c = await User.findById(r.customer_id).select("name phone").lean();
    console.log(`- Request ID: ${r._id}`);
    console.log(`  Order: ${r.order_id}`);
    console.log(`  Status: ${r.status}`);
    console.log(`  Customer: ${c?.name} (${c?.phone})`);
    console.log(`  Seller: ${s?.shopName} (${s?.name}) [ID: ${r.seller_id}]`);
    console.log(`  Reason: ${r.reason}`);
    console.log(`  Created At: ${r.createdAt}`);
    console.log("------------------------");
  }

  const sellers = await Seller.find().select("name shopName").lean();
  console.log("\nSellers in system:");
  for (const s of sellers) {
    console.log(`- Shop: ${s.shopName} | Name: ${s.name} | ID: ${s._id}`);
  }

  await mongoose.disconnect();
}

main().catch(console.error);
