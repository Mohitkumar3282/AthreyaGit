import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const mongoUri = process.env.MONGO_URI;

const ProductSchema = new mongoose.Schema({}, { strict: false });
const SellerSchema = new mongoose.Schema({}, { strict: false });

const Product = mongoose.model("Product", ProductSchema, "products");
const Seller = mongoose.model("Seller", SellerSchema, "sellers");

async function run() {
  console.log("Connecting to:", mongoUri);
  await mongoose.connect(mongoUri);
  console.log("Connected.");

  const productId = "699d6fe8b199bc76efb67ab1";
  console.log("Looking up product:", productId);
  const product = await Product.findById(productId).lean();
  
  if (!product) {
    console.log("Product not found!");
    process.exit(0);
  }

  console.log("Product:", JSON.stringify(product, null, 2));

  if (product.sellerId) {
    const seller = await Seller.findById(product.sellerId).lean();
    console.log("Seller:", JSON.stringify(seller, null, 2));
  }

  await mongoose.disconnect();
}

run().catch(console.error);
