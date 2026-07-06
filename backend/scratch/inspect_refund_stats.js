import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ReturnRequest from '../app/models/returnRequest.js';

dotenv.config();

async function inspect() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');
        
        const returnRequests = await ReturnRequest.find({ status: 'REFUND_COMPLETED' });
        console.log('Total REFUND_COMPLETED requests:', returnRequests.length);
        
        for (const req of returnRequests) {
            console.log({
                id: req._id,
                status: req.status,
                refund_amount: req.refund_amount,
                refund_completed_at: req.refund_completed_at,
                refund_completed_at_type: typeof req.refund_completed_at,
                refund_completed_at_instanceof_Date: req.refund_completed_at instanceof Date
            });
        }
        
        // Run aggregation manually
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        console.log('startOfMonth:', startOfMonth);
        
        const monthlyRefunds = await ReturnRequest.aggregate([
          {
            $match: {
              status: "REFUND_COMPLETED",
              refund_completed_at: { $gte: startOfMonth }
            }
          },
          {
            $group: {
              _id: null,
              totalRefund: { $sum: "$refund_amount" }
            }
          }
        ]);
        console.log('Aggregation result:', monthlyRefunds);
        
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

inspect();
