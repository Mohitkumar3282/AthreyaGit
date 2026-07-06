import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ReturnRequest from '../app/models/returnRequest.js';
import CancellationRequest from '../app/models/cancellationRequest.js';
import Seller from '../app/models/seller.js';

dotenv.config();

async function inspect() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');
        
        const returns = await ReturnRequest.find({});
        console.log('--- Return Requests ---');
        console.log(JSON.stringify(returns.map(r => ({
            id: r._id,
            status: r.status,
            seller_id: r.seller_id,
            delivery_boy_id: r.delivery_boy_id,
            order_id: r.order_id
        })), null, 2));

        const cancellations = await CancellationRequest.find({});
        console.log('\n--- Cancellation Requests ---');
        console.log(JSON.stringify(cancellations.map(c => ({
            id: c._id,
            status: c.status,
            seller_id: c.seller_id,
            delivery_boy_id: c.delivery_boy_id,
            order_id: c.order_id
        })), null, 2));

        const sellers = await Seller.find({});
        console.log('\n--- Sellers ---');
        console.log(JSON.stringify(sellers.map(s => ({
            id: s._id,
            name: s.name,
            phone: s.phone,
            shopName: s.shopName
        })), null, 2));
        
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

inspect();
