import Seller from "../models/seller.js";
import logger from "../services/logger.js";
import { creditWallet, debitWallet } from "../services/finance/walletService.js";
import { LEDGER_TRANSACTION_TYPE, OWNER_TYPE } from "../constants/finance.js";

const INTERVAL_MS = parseInt(
  process.env.SELLER_MONTHLY_FEE_INTERVAL_MS || `${6 * 60 * 60 * 1000}`,
  10,
);

const currentMonthKey = () => new Date().toISOString().slice(0, 7); // YYYY-MM (UTC)

/**
 * Charges the admin-configured monthly platform fee once per calendar month
 * to every seller whose commission mode is "monthly_fee". The fee is debited
 * from the seller wallet (it may go negative and is recovered from upcoming
 * settlements) and credited to the platform wallet. Idempotent per month.
 */
const chargeMonthlyFees = async () => {
  const month = currentMonthKey();
  try {
    const sellers = await Seller.find({
      "commission.mode": "monthly_fee",
      "commission.monthlyFee": { $gt: 0 },
      "commission.lastMonthlyFeeFor": { $ne: month },
    })
      .select("_id commission")
      .lean();

    for (const row of sellers) {
      const fee = Number(row.commission?.monthlyFee || 0);
      // Claim the month first so concurrent workers never double-charge.
      const claimed = await Seller.findOneAndUpdate(
        { _id: row._id, "commission.lastMonthlyFeeFor": { $ne: month } },
        { $set: { "commission.lastMonthlyFeeFor": month } },
      );
      if (!claimed) continue;

      try {
        const common = {
          amount: fee,
          ledgerType: LEDGER_TRANSACTION_TYPE.ADJUSTMENT,
          ledgerReference: `monthly-fee:${row._id}:${month}`,
          ledgerDescription: `Monthly platform fee ${month}`,
          metadata: { kind: "monthly_platform_fee", month },
        };
        await debitWallet({
          ...common,
          ownerType: OWNER_TYPE.SELLER,
          ownerId: row._id,
          allowNegative: true,
          idempotencyKey: `monthly-fee-debit:${row._id}:${month}`,
        });
        await creditWallet({
          ...common,
          ownerType: OWNER_TYPE.ADMIN,
          ownerId: null,
          idempotencyKey: `monthly-fee-credit:${row._id}:${month}`,
        });
      } catch (err) {
        await Seller.updateOne(
          { _id: row._id },
          { $set: { "commission.lastMonthlyFeeFor": "" } },
        );
        logger.error("Monthly platform fee failed", {
          jobName: "sellerMonthlyFeeJob",
          sellerId: String(row._id),
          error: err.message,
        });
      }
    }
  } catch (err) {
    logger.error("Seller monthly fee job failed", {
      jobName: "sellerMonthlyFeeJob",
      error: err.message,
    });
  }
};

export const getSellerMonthlyFeeJobHandler = () => chargeMonthlyFees;
export const getSellerMonthlyFeeJobInterval = () => INTERVAL_MS;
export default chargeMonthlyFees;
