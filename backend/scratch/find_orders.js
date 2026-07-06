import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../app/models/order.js';

dotenv.config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');
        
        const orders = await Order.find({}, { orderId: 1, status: 1, workflowStatus: 1, address: 1, createdAt: 1 }).sort({ createdAt: -1 }).limit(10);
        console.log(JSON.stringify(orders, null, 2));
        
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
