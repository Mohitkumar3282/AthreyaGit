import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { getAdminReturnStats } from '../app/controller/returnRequestController.js';

dotenv.config();

async function test() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');
        
        const req = {};
        const res = {
            status: function(code) {
                this.statusCode = code;
                return this;
            },
            json: function(data) {
                console.log('API Response:', JSON.stringify(data, null, 2));
            }
        };
        
        await getAdminReturnStats(req, res);
        
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

test();
