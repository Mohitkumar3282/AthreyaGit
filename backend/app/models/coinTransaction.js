import mongoose from "mongoose";
import {
  ALL_COIN_DIRECTIONS,
  ALL_COIN_TRANSACTION_TYPES,
} from "../constants/coins.js";

/**
 * Append-only history of every Athreya Coins movement.
 *
 * `idempotencyKey` is unique-sparse so a retried credit (e.g. a delivery
 * settlement replayed by a queue worker) cannot double-grant coins: the second
 * insert hits the unique index and `coinsService` treats it as a no-op.
 */
const coinTransactionSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ALL_COIN_TRANSACTION_TYPES,
      required: true,
    },
    direction: {
      type: String,
      enum: ALL_COIN_DIRECTIONS,
      required: true,
    },
    coins: {
      type: Number,
      required: true,
      min: 0,
    },
    // Rupee value the coins represented at the time of the movement, using
    // the `rupeeValuePerCoin` in effect then. Frozen so a later config change
    // cannot rewrite history.
    rupeeValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    balanceBefore: {
      type: Number,
      default: 0,
    },
    balanceAfter: {
      type: Number,
      default: 0,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    orderId: {
      type: String,
      default: null,
      index: true,
    },
    checkoutGroupId: {
      type: String,
      default: null,
    },
    description: {
      type: String,
      default: "",
    },
    idempotencyKey: {
      type: String,
      default: null,
    },
    meta: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true },
);

coinTransactionSchema.index({ customer: 1, createdAt: -1 });
coinTransactionSchema.index(
  { idempotencyKey: 1 },
  { unique: true, sparse: true },
);

export default mongoose.model("CoinTransaction", coinTransactionSchema);
