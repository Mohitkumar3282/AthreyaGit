import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { getActiveOrder } from '../app/controller/bannerController.js';

dotenv.config();

// Mock req and res
const req = {
    user: {
        id: '6a0d8357680843ff39ba5abd'
    }
};

const res = {
    statusCode: 200,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(payload) {
        console.log('Response Status:', this.statusCode);
        console.log('Response Success:', payload.success);
        console.log('Response Message:', payload.message);
        console.log('Response Result:', payload.result ? payload.result.orderId : null);
    }
};

async function runTest() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');
        
        await getActiveOrder(req, res);
        
        await mongoose.disconnect();
    } catch (err) {
        console.error('Test error:', err);
    }
}

runTest();
