import { addToCartSchema } from '../app/validation/cartValidation.js';

const payload1 = {
    productId: '69a174f9e57f4fde72e277bd',
    quantity: 1
};

const result1 = addToCartSchema.validate(payload1);
console.log('Result 1 (no variantSku):', result1.error ? result1.error.message : 'OK');

const payload2 = {
    productId: '69a174f9e57f4fde72e277bd',
    quantity: 1,
    variantSku: 'SKU123'
};

const result2 = addToCartSchema.validate(payload2);
console.log('Result 2 (with variantSku):', result2.error ? result2.error.message : 'OK');

const payload3 = {
    productId: 'short',
    quantity: 1
};

const result3 = addToCartSchema.validate(payload3);
console.log('Result 3 (short productId):', result3.error ? result3.error.message : 'OK');
