import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../app/models/order.js';
import Seller from '../app/models/seller.js';

dotenv.config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        // Find the active order for Chirag that is in CONFIRMED or packed or out_for_delivery state
        const order = await Order.findOne({
            deliveryBoy: "6999788ed49e8099e8a7b11f",
            status: { $in: ["confirmed", "packed", "out_for_delivery"] }
        }).populate("seller").lean();

        if (order) {
            console.log("Active Order:", order.orderId);
            console.log("Seller in DB:", JSON.stringify(order.seller, null, 2));
        } else {
            console.log("No active order found for Chirag.");
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}
check();
