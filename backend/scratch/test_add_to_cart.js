import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import Product from '../app/models/product.js';
import User from '../app/models/customer.js';

dotenv.config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        // Find an active product
        const product = await Product.findOne({ status: 'active' });
        if (!product) {
            console.error('No active product found in DB');
            await mongoose.disconnect();
            return;
        }
        console.log('Found product:', { id: product._id, name: product.name });

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

        // Perform POST request to /api/cart/add
        console.log('Sending POST to http://localhost:7000/api/cart/add');
        try {
            const response = await axios.post('http://localhost:7000/api/cart/add', {
                productId: String(product._id),
                quantity: 1
            }, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            console.log('Response status:', response.status);
            console.log('Response data:', JSON.stringify(response.data, null, 2));
        } catch (error) {
            console.log('Request failed!');
            if (error.response) {
                console.log('Status code:', error.response.status);
                console.log('Response body:', JSON.stringify(error.response.data, null, 2));
            } else {
                console.error(error.message);
            }
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

run();
