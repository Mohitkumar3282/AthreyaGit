import dotenv from 'dotenv';
import { delPattern } from '../app/services/cacheService.js';
import { getRedisClient } from '../app/config/redis.js';

dotenv.config();

async function run() {
    try {
        console.log('Clearing nearby sellers cache...');
        
        // Clear redis keys matching "cache:*sellers*" or memory cache keys matching "*sellers*"
        const count = await delPattern("*sellers*");
        console.log(`Deleted ${count} cache keys matching *sellers*`);

        // If Redis is active, flush it as well just in case
        const redis = getRedisClient();
        if (redis) {
            const keys = await redis.keys('*sellers*');
            if (keys.length > 0) {
                await redis.del(...keys);
                console.log(`Explicitly deleted Redis keys: ${keys.join(', ')}`);
            }
        }
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
