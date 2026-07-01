import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "./.env") });

const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/quickcommerce";

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    type: { type: String, enum: ["header", "category", "subcategory"], required: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

const Category = mongoose.models.Category || mongoose.model("Category", categorySchema, "categories");

async function seed() {
  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB for seeding categories...");

    // Find the Grocery Header
    const groceryHeader = await Category.findOne({ name: /Grocery/i, type: "header" });
    if (!groceryHeader) {
      console.error("Grocery header not found in database! Please seed it first.");
      process.exit(1);
    }
    console.log(`Found Grocery Header: ${groceryHeader._id}`);

    const dailyNeeds = [
      { name: "Fruits", slug: "fruits-daily", subName: "Fresh Fruits" },
      { name: "Vegetables", slug: "vegetables-daily", subName: "Fresh Vegetables" },
      { name: "Chicken", slug: "chicken-daily", subName: "Fresh Chicken" },
      { name: "Mutton", slug: "mutton-daily", subName: "Fresh Mutton" },
      { name: "Eggs", slug: "eggs-daily", subName: "Fresh Eggs" },
    ];

    for (const item of dailyNeeds) {
      // 1. Create or Find Category
      let cat = await Category.findOne({ slug: item.slug });
      if (!cat) {
        // Double check if there's any other matching category name to reuse
        cat = await Category.findOne({ name: item.name, type: "category" });
      }

      if (!cat) {
        cat = await Category.create({
          name: item.name,
          slug: item.slug,
          type: "category",
          parentId: groceryHeader._id,
          status: "active",
        });
        console.log(`Created Category: ${item.name} (${cat._id})`);
      } else {
        // Ensure type and parent are set correctly
        cat.type = "category";
        cat.parentId = groceryHeader._id;
        await cat.save();
        console.log(`Updated/Verified Category: ${item.name} (${cat._id})`);
      }

      // 2. Create or Find Subcategory
      const subSlug = `${item.subName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-daily`;
      let subcat = await Category.findOne({ slug: subSlug });
      if (!subcat) {
        subcat = await Category.create({
          name: item.subName,
          slug: subSlug,
          type: "subcategory",
          parentId: cat._id,
          status: "active",
        });
        console.log(`  Created Subcategory: ${item.subName} (${subcat._id})`);
      } else {
        subcat.type = "subcategory";
        subcat.parentId = cat._id;
        await subcat.save();
        console.log(`  Updated/Verified Subcategory: ${item.subName} (${subcat._id})`);
      }
    }

    console.log("Seeding completed successfully!");
    await mongoose.disconnect();
  } catch (err) {
    console.error("Seeding failed:", err);
  }
}

seed();
