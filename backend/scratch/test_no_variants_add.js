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

        // Find a product with NO variants or empty variants
        const productNoVariants = await Product.findOne({
            status: 'active',
            $or: [
                { variants: { $exists: false } },
                { variants: { $size: 0 } }
            ]
        });

        if (!productNoVariants) {
            console.log('No active product without variants found in DB');
            await mongoose.disconnect();
            return;
        }
        console.log('Found product without variants:', { id: productNoVariants._id, name: productNoVariants.name });

        // Find a customer
        const customer = await User.findOne({ role: 'user' });
        const token = jwt.sign(
            { id: String(customer._id), role: 'user' },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        console.log('Testing adding product without variants with variantSku: ""');
        try {
            const response = await axios.post('http://127.0.0.1:7000/api/cart/add', {
                productId: String(productNoVariants._id),
                variantSku: '',
                quantity: 1
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('Success! Status:', response.status);
        } catch (error) {
            console.log('Failed!');
            if (error.response) {
                console.log('Status code:', error.response.status);
                console.log('Response body:', JSON.stringify(error.response.data, null, 2));
            } else {
                console.log('Error message:', error.message);
            }
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

run();
