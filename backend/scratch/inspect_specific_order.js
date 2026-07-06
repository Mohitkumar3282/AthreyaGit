import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../app/models/order.js';
import Customer from '../app/models/customer.js';

dotenv.config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');
        
        const orderId = 'ORD-01KWGQKA8M092SDS256XFT3YRW';
        const order = await Order.findOne({ orderId });
        if (!order) {
            console.log('Order not found:', orderId);
        } else {
            console.log('Order Found:');
            console.log(JSON.stringify({
                orderId: order.orderId,
                status: order.status,
                workflowStatus: order.workflowStatus,
                address: order.address,
                customer: order.customer
            }, null, 2));
            
            if (order.customer) {
                const customer = await Customer.findById(order.customer);
                if (customer) {
                    console.log('Customer Found:');
                    console.log(JSON.stringify({
                        id: customer._id,
                        name: customer.name,
                        phone: customer.phone,
                        addresses: customer.addresses
                    }, null, 2));
                } else {
                    console.log('Customer not found for ID:', order.customer);
                }
            }
        }
        
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
