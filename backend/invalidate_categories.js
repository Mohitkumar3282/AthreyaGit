import Redis from "ioredis";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "./.env") });

const redisHost = process.env.REDIS_HOST || "127.0.0.1";
const redisPort = parseInt(process.env.REDIS_PORT || "6379", 10);
const redisPassword = process.env.REDIS_PASSWORD || undefined;

async function run() {
  try {
    const redis = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
    });

    console.log("Connected to Redis...");

    // Find and delete catalog categories cache keys
    const keys = await redis.keys("*categories*");
    console.log("Found keys matching *categories*:", keys);
    if (keys.length > 0) {
      await redis.del(keys);
      console.log("Deleted keys successfully!");
    }

    // Publish invalidation channel message
    await redis.publish("cache:invalidate", "cache:catalog:categories:*");
    console.log("Published cache:invalidate channel message!");

    await redis.quit();
    console.log("Redis client closed.");
  } catch (err) {
    console.error("Redis operation failed:", err);
  }
}

run();
