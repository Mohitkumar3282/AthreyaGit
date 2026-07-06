import mongoose from "mongoose";
import Category from "../app/models/category.js";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGO_URI || "mongodb://localhost:27017/athreya";
console.log("Connecting to:", uri);

mongoose.connect(uri)
  .then(async () => {
    console.log("Connected successfully!");
    
    const cat1 = await Category.findById("6a3fc1728bb6d217bf338f1d").lean();
    const cat2 = await Category.findById("6a3fc1738bb6d217bf338f24").lean();
    
    console.log("Cat 1:", cat1);
    console.log("Cat 2:", cat2);
    
    mongoose.disconnect();
  })
  .catch(err => {
    console.error("Connection error:", err);
  });
