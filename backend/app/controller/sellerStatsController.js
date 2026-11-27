import Order from "../models/order.js";
import Transaction from "../models/transaction.js";
import handleResponse from "../utils/helper.js";
import mongoose from "mongoose";
import Wallet from "../models/wallet.js";
import { getSellerStats as getSellerStatsFromService } from "../services/seller/sellerStatsService.js";
import { SELLER_VISIBLE_ORDER_SCOPE } from "../services/orderQueryService.js";
import {
    SELLER_SHARE_EXPR,
    computeSellerTxnBalances,
    loadSellerTransactions,
} from "../services/seller/sellerEarningsAmount.js";

/* ===============================
   GET SELLER DASHBOARD STATS
   Delegates to SellerStatsService (P6.2 — cache-fronted) so the heavy
   $facet aggregation + category pipeline are absorbed for ~60s.
================================ */
export const getSellerStats = async (req, res) => {
    try {
        const result = await getSellerStatsFromService(req.user.id, {
            range: req.query?.range,
        });
        return handleResponse(res, 200, "Stats fetched successfully", result);
    } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
    }
};

/* ===============================
   GET SELLER EARNINGS / TRANSACTIONS
================================ */
export const getSellerEarnings = async (req, res) => {
    try {
        const sellerId = req.user.id;
        const sellerOid = new mongoose.Types.ObjectId(sellerId);

        // Order rows carry the seller's share (products only), not the
        // customer's full bill — see loadSellerTransactions.
        const transactions = await loadSellerTransactions(sellerId);
        const { settledBalance, pendingPayouts, totalWithdrawn } =
            computeSellerTxnBalances(transactions);

        // Fetch wallet for live pending balance (money on hold due to return window)
        const wallet = await Wallet.findOne({ ownerType: 'SELLER', ownerId: sellerId });
        const onHoldBalance = wallet ? wallet.pendingBalance : 0;
        const liveAvailableBalance = wallet ? wallet.availableBalance : settledBalance;

        // "Total Revenue" = the seller's product earnings on orders delivered
        // to the customer. Delivery fee, platform fee and tip are excluded.
        const [orderRevenueAgg] = await Order.aggregate([
            {
                $match: {
                    seller: sellerOid,
                    status: 'delivered',
                    workflowStatus: { $ne: 'CANCELLED' },
                    // Only this shop's own orders (see SELLER_VISIBLE_ORDER_SCOPE).
                    ...SELLER_VISIBLE_ORDER_SCOPE,
                },
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: SELLER_SHARE_EXPR },
                },
            },
        ]);
        const totalRevenue = Number(orderRevenueAgg?.totalRevenue || 0);

        // Monthly Revenue Aggregation (Last 6 Months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        // Same definition as Total Revenue: delivered orders only (cancelled
        // and failed orders never count), seller's product share, grouped by
        // the month the order was delivered.
        const monthlyAggregation = await Order.aggregate([
            {
                $match: {
                    seller: sellerOid,
                    status: 'delivered',
                    workflowStatus: { $ne: 'CANCELLED' },
                    ...SELLER_VISIBLE_ORDER_SCOPE,
                }
            },
            { $addFields: { _revDate: { $ifNull: ["$deliveredAt", "$updatedAt"] } } },
            { $match: { _revDate: { $gte: sixMonthsAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m", date: "$_revDate", timezone: "Asia/Kolkata" } },
                    revenue: { $sum: SELLER_SHARE_EXPR }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const chartData = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const dateStr = d.toISOString().slice(0, 7);
            const data = monthlyAggregation.find(m => m._id === dateStr);
            chartData.push({
                name: monthNames[d.getMonth()],
                revenue: data ? data.revenue : 0
            });
        }

        return handleResponse(res, 200, "Earnings fetched successfully", {
            balances: {
                settledBalance: settledBalance,
                pendingPayouts: pendingPayouts,
                onHoldBalance: onHoldBalance, // New field
                availableBalance: liveAvailableBalance, // New field for clarity
                totalRevenue: totalRevenue,
                totalWithdrawn: totalWithdrawn
            },
            monthlyChart: chartData,
            ledger: transactions.map(t => ({
                id: (t.reference || t._id).toString(),
                type: t.type,
                amount: t.amount,
                status: t.status,
                date: new Date(t.createdAt).toISOString().split('T')[0],
                time: new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                customer: t.type === 'Withdrawal' ? 'Bank Transfer' : 'Customer',
                ref: t.order ? `#${t.order.orderId}` : t.reference || t._id
            }))
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
