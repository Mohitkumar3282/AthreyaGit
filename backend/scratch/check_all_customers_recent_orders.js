import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../app/models/order.js';

dotenv.config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');
        
        // Find the absolute latest order in the entire database
        const latestOrder = await Order.findOne({}).sort({ createdAt: -1 });
        if (latestOrder) {
            console.log('Latest Order in entire DB:');
            console.log(JSON.stringify({
                orderId: latestOrder.orderId,
                status: latestOrder.status,
                workflowStatus: latestOrder.workflowStatus,
                customer: latestOrder.customer,
                createdAt: latestOrder.createdAt
            }, null, 2));
        } else {
            console.log('No orders in database!');
        }
        
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
