import LedgerEntry from "../models/ledgerEntry.js";
import {
  LEDGER_DIRECTION,
  LEDGER_TRANSACTION_TYPE,
  OWNER_TYPE,
} from "../constants/finance.js";
import { roundCurrency } from "../utils/money.js";
import { getCustomerBalance, getOrCreateWallet } from "./finance/walletService.js";
import { getCashbackSettings } from "./walletCashbackService.js";

/**
 * Read side of the customer Wallet module.
 *
 * History comes from `LedgerEntry` — the canonical record every wallet
 * movement writes to — rather than the legacy `Transaction` collection, which
 * only ever recorded order payments. That is what makes cashback credits,
 * refunds and checkout redemptions all appear in one list.
 */

// Customer-facing labels. Anything not listed falls back to a humanised
// version of the raw enum, so a new ledger type shows up as readable text
// instead of disappearing from the customer's history.
const TRANSACTION_LABELS = {
  [LEDGER_TRANSACTION_TYPE.CASHBACK_CREDITED]: "Cashback earned",
  [LEDGER_TRANSACTION_TYPE.CASHBACK_REVERSED]: "Cashback reversed",
  [LEDGER_TRANSACTION_TYPE.WALLET_PAYMENT]: "Paid from wallet",
  [LEDGER_TRANSACTION_TYPE.WALLET_REFUND]: "Refund credited",
  [LEDGER_TRANSACTION_TYPE.REFUND]: "Refund credited",
  [LEDGER_TRANSACTION_TYPE.ADJUSTMENT]: "Wallet adjustment",
  [LEDGER_TRANSACTION_TYPE.CANCELLATION_REVERSAL]: "Order cancelled",
};

function humanizeType(type) {
  return String(type || "")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}

export async function getWalletSummary(customerId, { session = null } = {}) {
  const [balance, cashbackSettings] = await Promise.all([
    getCustomerBalance(customerId, { session }),
    getCashbackSettings({ session }),
  ]);

  let lifetimeCredited = 0;
  let lifetimeDebited = 0;
  let lifetimeCashback = 0;

  try {
    const wallet = await getOrCreateWallet(OWNER_TYPE.CUSTOMER, customerId, { session });
    lifetimeCredited = roundCurrency(wallet?.totalCredited || 0);
    lifetimeDebited = roundCurrency(wallet?.totalDebited || 0);

    const cashbackAgg = await LedgerEntry.aggregate([
      {
        $match: {
          actorType: OWNER_TYPE.CUSTOMER,
          actorId: wallet.ownerId,
          type: LEDGER_TRANSACTION_TYPE.CASHBACK_CREDITED,
        },
      },
      { $group: { _id: null, amount: { $sum: "$amount" } } },
    ]);
    lifetimeCashback = roundCurrency(cashbackAgg[0]?.amount || 0);
  } catch {
    // Summary extras are best-effort — the balance is what the customer
    // actually needs, and it has already been resolved above.
  }

  return {
    balance: roundCurrency(balance),
    lifetimeCredited,
    lifetimeDebited,
    lifetimeCashback,
    cashback: {
      enabled: cashbackSettings.enabled,
      ratePercent: cashbackSettings.ratePercent,
    },
  };
}

export async function listWalletTransactions(customerId, { page = 1, limit = 20 } = {}) {
  const perPage = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const skip = (currentPage - 1) * perPage;

  const query = { actorType: OWNER_TYPE.CUSTOMER, actorId: customerId };

  const [rows, total] = await Promise.all([
    LedgerEntry.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(perPage)
      .populate("orderId", "orderId")
      .lean(),
    LedgerEntry.countDocuments(query),
  ]);

  return {
    items: rows.map((row) => ({
      _id: row._id,
      type: row.type,
      direction: row.direction,
      isCredit: row.direction === LEDGER_DIRECTION.CREDIT,
      title: TRANSACTION_LABELS[row.type] || humanizeType(row.type),
      amount: roundCurrency(row.amount),
      balanceAfter: row.balanceAfter == null ? null : roundCurrency(row.balanceAfter),
      orderId: row.orderId?.orderId || row.reference || null,
      description: row.description || "",
      date: row.createdAt,
    })),
    total,
    page: currentPage,
    totalPages: Math.ceil(total / perPage) || 1,
  };
}

export default {
  getWalletSummary,
  listWalletTransactions,
};
