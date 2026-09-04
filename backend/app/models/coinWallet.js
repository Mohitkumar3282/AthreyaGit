import mongoose from "mongoose";
import { ALL_COIN_WALLET_STATUSES, COIN_WALLET_STATUS } from "../constants/coins.js";

/**
 * Athreya Coins balance for one customer.
 *
 * Deliberately separate from `Wallet` (rupee balance): coins are a loyalty
 * unit, are not withdrawable, and must never be summed into the money ledger
 * reconciliation queries in `walletService.getAdminFinanceSummary`.
 */
const coinWalletSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    lifetimeEarned: {
      type: Number,
      default: 0,
      min: 0,
    },
    lifetimeRedeemed: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ALL_COIN_WALLET_STATUSES,
      default: COIN_WALLET_STATUS.ACTIVE,
    },
    lastEarnedAt: {
      type: Date,
      default: null,
    },
    lastRedeemedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

export default mongoose.model("CoinWallet", coinWalletSchema);
