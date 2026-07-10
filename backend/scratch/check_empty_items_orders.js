import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../app/models/order.js';

dotenv.config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        const orders = await Order.find({ items: { $size: 0 } }).lean();
        console.log(`Found ${orders.length} orders with empty items:`);
        for (const o of orders) {
            console.log(`OrderId: ${o.orderId}, orderType: ${o.orderType}, status: ${o.status}, workflowStatus: ${o.workflowStatus}, deliveryBoy: ${o.deliveryBoy}`);
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}
check();
