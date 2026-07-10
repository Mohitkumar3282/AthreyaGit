import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../app/models/order.js';
import { WORKFLOW_STATUS } from '../app/constants/orderWorkflow.js';

dotenv.config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');
        
        const customerId = "6a0d8357680843ff39ba5abd";
        const timeLimit = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        console.log('Checking activeOrder for customer:', customerId);
        
        const activeOrder = await Order.findOne({
            customer: customerId,
            createdAt: { $gte: timeLimit },
            workflowStatus: {
                $in: [
                    WORKFLOW_STATUS.CREATED,
                    WORKFLOW_STATUS.SELLER_PENDING,
                    WORKFLOW_STATUS.SELLER_ACCEPTED,
                    WORKFLOW_STATUS.DELIVERY_SEARCH,
                    WORKFLOW_STATUS.DELIVERY_ASSIGNED,
                    WORKFLOW_STATUS.PICKUP_READY,
                    WORKFLOW_STATUS.OUT_FOR_DELIVERY
                ]
            }
        })
        .populate("seller")
        .populate("deliveryBoy");
        
        console.log('activeOrder result:', activeOrder ? activeOrder.orderId : 'null');
        
        if (!activeOrder) {
            const fallbackOrder = await Order.findOne({
                customer: customerId,
                createdAt: { $gte: timeLimit },
                status: { $in: ["pending", "confirmed", "packed", "out_for_delivery"] }
            })
            .populate("seller")
            .populate("deliveryBoy");
            
            console.log('fallbackOrder result:', fallbackOrder ? fallbackOrder.orderId : 'null');
        }
        
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
