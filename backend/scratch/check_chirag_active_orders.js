import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../app/models/order.js';

dotenv.config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        // Find active orders where deliveryBoy is Chirag
        const orders = await Order.find({
            deliveryBoy: "6999788ed49e8099e8a7b11f",
            status: { $nin: ["delivered", "cancelled"] }
        }).lean();

        console.log("Chirag's active (undelivered/uncancelled) orders:");
        console.log(JSON.stringify(orders.map(o => ({
            orderId: o.orderId,
            status: o.status,
            orderStatus: o.orderStatus,
            workflowStatus: o.workflowStatus,
            orderType: o.orderType,
            paymentMode: o.paymentMode,
            paymentStatus: o.paymentStatus,
            payment: o.payment,
            pricing: o.pricing,
            paymentBreakdown: o.paymentBreakdown,
            items: o.items
        })), null, 2));

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}
check();
