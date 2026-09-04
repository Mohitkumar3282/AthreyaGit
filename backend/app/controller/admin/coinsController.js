import mongoose from "mongoose";
import CoinWallet from "../../models/coinWallet.js";
import CoinTransaction from "../../models/coinTransaction.js";
import handleResponse from "../../utils/helper.js";
import { ALL_COIN_TRANSACTION_TYPES } from "../../constants/coins.js";
import { coinsToRupees, getCoinSettings } from "../../services/coinsService.js";

/**
 * Admin read-side for the Athreya Coins programme.
 *
 * Two views:
 *   - `GET /admin/coins/wallets`      — every customer's coin balance
 *   - `GET /admin/coins/transactions` — the movement log, filterable
 *
 * Both are read-only. Coins are minted by delivery settlement and spent at
 * checkout; there is deliberately no admin "grant coins" endpoint here,
 * because an unaudited mint would break the invariant that every coin traces
 * back to a real order's savings.
 */

function parsePaging(query = {}) {
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 25));
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  return { limit, page, skip: (page - 1) * limit };
}

/** GET /admin/coins/wallets */
export const getCoinWallets = async (req, res) => {
  try {
    const { limit, page, skip } = parsePaging(req.query);
    const search = String(req.query.search || "").trim();

    // Join to the customer so admins can search by name/phone/email rather
    // than having to know an ObjectId.
    const pipeline = [
      {
        $lookup: {
          from: "users",
          localField: "customer",
          foreignField: "_id",
          as: "customerDoc",
        },
      },
      { $unwind: { path: "$customerDoc", preserveNullAndEmptyArrays: true } },
    ];

    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      pipeline.push({
        $match: {
          $or: [
            { "customerDoc.name": rx },
            { "customerDoc.phone": rx },
            { "customerDoc.email": rx },
          ],
        },
      });
    }

    pipeline.push(
      { $sort: { balance: -1, updatedAt: -1 } },
      {
        $facet: {
          rows: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                customer: 1,
                balance: 1,
                lifetimeEarned: 1,
                lifetimeRedeemed: 1,
                status: 1,
                updatedAt: 1,
                customerName: "$customerDoc.name",
                customerPhone: "$customerDoc.phone",
                customerEmail: "$customerDoc.email",
              },
            },
          ],
          total: [{ $count: "count" }],
          totals: [
            {
              $group: {
                _id: null,
                outstanding: { $sum: "$balance" },
                earned: { $sum: "$lifetimeEarned" },
                redeemed: { $sum: "$lifetimeRedeemed" },
              },
            },
          ],
        },
      },
    );

    const [result] = await CoinWallet.aggregate(pipeline);
    const settings = await getCoinSettings();
    const total = result?.total?.[0]?.count || 0;
    const totals = result?.totals?.[0] || {};

    const items = (result?.rows || []).map((row) => ({
      ...row,
      rupeeValue: coinsToRupees(row.balance, settings),
    }));

    return handleResponse(res, 200, "Coin wallets fetched", {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      summary: {
        // Coins the platform still owes as future discounts — the liability
        // this programme carries on the balance sheet.
        outstandingCoins: totals.outstanding || 0,
        outstandingValue: coinsToRupees(totals.outstanding || 0, settings),
        lifetimeEarned: totals.earned || 0,
        lifetimeRedeemed: totals.redeemed || 0,
        walletCount: total,
      },
      settings,
    });
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

/** GET /admin/coins/transactions */
export const getCoinTransactions = async (req, res) => {
  try {
    const { limit, page, skip } = parsePaging(req.query);
    const { customerId, type, orderId, fromDate, toDate } = req.query;

    const filter = {};
    if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
      filter.customer = new mongoose.Types.ObjectId(customerId);
    }
    if (type && ALL_COIN_TRANSACTION_TYPES.includes(type)) {
      filter.type = type;
    }
    if (orderId) filter.orderId = String(orderId).trim();
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const [rows, total] = await Promise.all([
      CoinTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("customer", "name phone email")
        .lean(),
      CoinTransaction.countDocuments(filter),
    ]);

    const items = rows.map((row) => ({
      _id: row._id,
      type: row.type,
      direction: row.direction,
      coins: row.coins,
      rupeeValue: row.rupeeValue,
      balanceAfter: row.balanceAfter,
      orderId: row.orderId,
      description: row.description,
      savingsBase: Number(row.meta?.savingsBase || 0),
      date: row.createdAt,
      customerId: row.customer?._id || row.customer || null,
      customerName: row.customer?.name || null,
      customerPhone: row.customer?.phone || null,
    }));

    return handleResponse(res, 200, "Coin transactions fetched", {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

export default { getCoinWallets, getCoinTransactions };
