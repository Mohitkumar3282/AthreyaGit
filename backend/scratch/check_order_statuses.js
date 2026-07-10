import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../app/models/order.js';

dotenv.config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const orders = await Order.find({}).sort({ createdAt: -1 }).limit(10).lean();
        console.log("Latest orders status inspection:");
        console.log(JSON.stringify(orders.map(o => ({
            orderId: o.orderId,
            status: o.status,
            orderStatus: o.orderStatus,
            workflowStatus: o.workflowStatus,
            workflowVersion: o.workflowVersion
        })), null, 2));

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}
check();
