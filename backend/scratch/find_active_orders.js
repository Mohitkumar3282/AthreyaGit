import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../app/models/order.js';

dotenv.config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');
        
        const activeOrders = await Order.find({
            $or: [
                {
                    workflowStatus: {
                        $in: [
                            "CREATED",
                            "SELLER_PENDING",
                            "SELLER_ACCEPTED",
                            "DELIVERY_SEARCH",
                            "DELIVERY_ASSIGNED",
                            "PICKUP_READY",
                            "OUT_FOR_DELIVERY"
                        ]
                    }
                },
                {
                    status: { $in: ["pending", "confirmed", "packed", "out_for_delivery"] }
                }
            ]
        }, { orderId: 1, status: 1, workflowStatus: 1, createdAt: 1, customer: 1 });
        
        console.log('Active Orders found:', activeOrders.length);
        console.log(JSON.stringify(activeOrders, null, 2));
        
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
