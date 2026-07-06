import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import User from '../app/models/customer.js';

dotenv.config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        // Find a customer
        const customer = await User.findOne({ role: 'user' });
        if (!customer) {
            console.error('No customer found in DB');
            await mongoose.disconnect();
            return;
        }
        console.log('Found customer:', { id: customer._id, name: customer.name });

        // Generate JWT token
        const token = jwt.sign(
            { id: String(customer._id), role: 'user' },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        console.log('Generated token');

        // Trending product ID (Whole Farm Premium Saunf Seeds)
        const productId = '699d6fe8b199bc76efb67ab1';
        const variantSku = 'masala-oil-more-528014-5964';

        // 1. Try adding with variantSku
        console.log('\n--- Test 1: Adding with variantSku ---');
        try {
            const response = await axios.post('http://127.0.0.1:7000/api/cart/add', {
                productId: productId,
                variantSku: variantSku,
                quantity: 1
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('Test 1 Success! Status:', response.status);
            console.log('Test 1 Data Items:', response.data.result.items.map(item => ({
                productId: item.productId._id,
                variantSku: item.variantSku,
                quantity: item.quantity
            })));
        } catch (error) {
            console.log('Test 1 Failed!');
            if (error.response) {
                console.log('Status code:', error.response.status);
                console.log('Response body:', JSON.stringify(error.response.data, null, 2));
            } else {
                console.log('Error message:', error.message);
                console.log('Stack:', error.stack);
            }
        }

        // 2. Try adding without variantSku
        console.log('\n--- Test 2: Adding without variantSku ---');
        try {
            const response = await axios.post('http://127.0.0.1:7000/api/cart/add', {
                productId: productId,
                variantSku: '',
                quantity: 1
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('Test 2 Success! Status:', response.status);
            console.log('Test 2 Data Items:', response.data.result.items.map(item => ({
                productId: item.productId._id,
                variantSku: item.variantSku,
                quantity: item.quantity
            })));
        } catch (error) {
            console.log('Test 2 Failed!');
            if (error.response) {
                console.log('Status code:', error.response.status);
                console.log('Response body:', JSON.stringify(error.response.data, null, 2));
            } else {
                console.log('Error message:', error.message);
                console.log('Stack:', error.stack);
            }
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

run();
