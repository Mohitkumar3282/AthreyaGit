import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../app/models/order.js';

dotenv.config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');
        
        const customerId = '6a0d8357680843ff39ba5abd';
        const activeOrders = await Order.find({
            customer: customerId,
            $or: [
                {
                    workflowStatus: {
                        $in: [
                            'CREATED',
                            'SELLER_PENDING',
                            'SELLER_ACCEPTED',
                            'DELIVERY_SEARCH',
                            'DELIVERY_ASSIGNED',
                            'PICKUP_READY',
                            'OUT_FOR_DELIVERY'
                        ]
                    }
                },
                {
                    status: { $in: ["pending", "confirmed", "packed", "out_for_delivery"] }
                }
            ]
        });
        
        console.log('Found active orders count for customer:', activeOrders.length);
        console.log(JSON.stringify(activeOrders.map(o => ({
            _id: o._id,
            orderId: o.orderId,
            status: o.status,
            workflowStatus: o.workflowStatus,
            createdAt: o.createdAt
        })), null, 2));
        
        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

check();
