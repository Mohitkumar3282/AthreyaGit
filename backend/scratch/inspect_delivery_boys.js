import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Delivery from '../app/models/delivery.js';
import DeliveryBoy from '../app/models/deliveryBoy.js';

dotenv.config();

async function inspect() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');
        
        const deliveries = await Delivery.find({});
        console.log('--- Delivery Model ("Delivery" collection) ---');
        console.log('Count:', deliveries.length);
        console.log(JSON.stringify(deliveries.map(r => ({
            id: r._id,
            name: r.name,
            phone: r.phone,
            isOnline: r.isOnline,
            isVerified: r.isVerified,
            location: r.location
        })), null, 2));

        const deliveryBoys = await DeliveryBoy.find({});
        console.log('\n--- DeliveryBoy Model ("DeliveryBoy" collection) ---');
        console.log('Count:', deliveryBoys.length);
        console.log(JSON.stringify(deliveryBoys.map(r => ({
            id: r._id,
            name: r.name,
            phone: r.phone,
            is_active: r.is_active,
            is_available: r.is_available,
            seller_id: r.seller_id,
            current_location: r.current_location
        })), null, 2));
        
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

inspect();
