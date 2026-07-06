import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Delivery from '../app/models/delivery.js';
import DeliveryBoy from '../app/models/deliveryBoy.js';

dotenv.config();

async function sync() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');
        
        const sellerId = "6999782fd49e8099e8a7b11c"; // Harsh's Hub
        
        const riders = await Delivery.find({});
        for (const rider of riders) {
            console.log(`Syncing rider ${rider.name}...`);
            await DeliveryBoy.updateOne(
                { _id: rider._id },
                {
                    $set: {
                        name: rider.name,
                        phone: rider.phone,
                        seller_id: sellerId,
                        is_active: true,
                        is_available: true,
                        current_location: rider.location || { type: "Point", coordinates: [0, 0] },
                        rating: 5.0
                    }
                },
                { upsert: true }
            );
        }
        console.log('Sync complete!');
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

sync();
