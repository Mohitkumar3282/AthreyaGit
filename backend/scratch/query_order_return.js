import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../app/models/order.js';
import ReturnRequest from '../app/models/returnRequest.js';
import Transaction from '../app/models/transaction.js';
import LedgerEntry from '../app/models/ledgerEntry.js';
import Wallet from '../app/models/wallet.js';

dotenv.config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const stuckRequests = await ReturnRequest.find({ status: 'REFUND_INITIATED' })
            .populate('order_id');

        for (const r of stuckRequests) {
            console.log(`\n=========================================`);
            console.log(`Return Request ID: ${r._id}`);
            console.log(`Status: ${r.status}`);
            console.log(`Refund Amount: ${r.refund_amount}`);
            console.log(`Status History:`, JSON.stringify(r.status_history, null, 2));

            if (r.order_id) {
                console.log(`Order ID: ${r.order_id.orderId}`);
                console.log(`Order Seller ID: ${r.order_id.seller}`);

                const sellerWallet = await Wallet.findOne({ ownerId: r.order_id.seller });
                console.log(`Seller Wallet Balance:`, sellerWallet ? {
                    available: sellerWallet.availableBalance,
                    pending: sellerWallet.pendingBalance
                } : 'Not found');
            }

            const transactions = await Transaction.find({
                reference: new RegExp(r._id.toString(), 'i')
            });
            console.log(`Transactions:`, JSON.stringify(transactions, null, 2));

            const ledgerEntries = await LedgerEntry.find({
                orderId: r.order_id?._id
            });
            console.log(`Ledger Entries for Order:`, JSON.stringify(ledgerEntries, null, 2));
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

run();
