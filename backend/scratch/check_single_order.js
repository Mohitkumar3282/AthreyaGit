import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../app/models/order.js';

dotenv.config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        const o = await Order.findOne({ orderId: "ORD-01KWC2HXBG8S9KS22YMT8F7FD6" }).lean();
        console.log("Order ORD-01KWC2HXBG8S9KS22YMT8F7FD6 Details:");
        console.log(JSON.stringify(o, null, 2));

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}
check();
