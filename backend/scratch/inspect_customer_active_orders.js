import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../app/models/order.js';

dotenv.config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');
        
        // Find ALL orders in the last 24 hours
        const timeLimit = new Date(Date.now() - 24 * 60 * 60 * 1000);
        console.log('Checking orders since:', timeLimit.toISOString());
        
        const orders = await Order.find({
            createdAt: { $gte: timeLimit }
        }).sort({ createdAt: -1 });
        
        console.log('Orders in last 24h:', orders.length);
        orders.forEach(o => {
            console.log(`Order: ${o.orderId}, Status: ${o.status}, workflowStatus: ${o.workflowStatus}, Customer: ${o.customer}, Created: ${o.createdAt.toISOString()}`);
        });
        
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
