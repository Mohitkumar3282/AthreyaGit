/**
 * Pre-launch cleanup: wipes transactional/test data so the admin dashboard
 * starts from zero.
 *
 * DELETES: orders, order OTPs, checkout groups, carts, payments, payouts,
 *   ledger entries, transactions, wallets, coin wallets/transactions,
 *   return/cancellation requests, delivery assignments, notifications,
 *   reviews, tickets, stock history, finance audit logs, and the
 *   precomputed dashboard / finance / seller stats.
 *
 * KEEPS: admins, customers, sellers, delivery partners, products, categories,
 *   offers, banners, settings, FAQs.
 *
 * USAGE (run from backend/):
 *   node scripts/reset-test-data.js            # dry run: prints counts only
 *   node scripts/reset-test-data.js --confirm  # actually deletes
 *
 * IRREVERSIBLE - take a database backup first (mongodump).
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import connectDB from "../app/dbConfig/dbConfig.js";

import Order from "../app/models/order.js";
import OrderOtp from "../app/models/orderOtp.js";
import CheckoutGroup from "../app/models/checkoutGroup.js";
import Cart from "../app/models/cart.js";
import Payment from "../app/models/payment.js";
import PaymentWebhookEvent from "../app/models/paymentWebhookEvent.js";
import Payout from "../app/models/payout.js";
import LedgerEntry from "../app/models/ledgerEntry.js";
import Transaction from "../app/models/transaction.js";
import Wallet from "../app/models/wallet.js";
import CoinWallet from "../app/models/coinWallet.js";
import CoinTransaction from "../app/models/coinTransaction.js";
import ReturnRequest from "../app/models/returnRequest.js";
import CancellationRequest from "../app/models/cancellationRequest.js";
import DeliveryAssignment from "../app/models/deliveryAssignment.js";
import Notification from "../app/models/notification.js";
import Review from "../app/models/review.js";
import Ticket from "../app/models/ticket.js";
import StockHistory from "../app/models/stockHistory.js";
import FinanceAuditLog from "../app/models/financeAuditLog.js";
import DashboardStats from "../app/models/dashboardStats.js";
import FinanceReports from "../app/models/financeReports.js";
import SellerMetrics from "../app/models/sellerMetrics.js";

dotenv.config();

const CONFIRM = process.argv.includes("--confirm");

const targets = [
  ["Orders", Order],
  ["OrderOtps", OrderOtp],
  ["CheckoutGroups", CheckoutGroup],
  ["Carts", Cart],
  ["Payments", Payment],
  ["PaymentWebhookEvents", PaymentWebhookEvent],
  ["Payouts", Payout],
  ["LedgerEntries", LedgerEntry],
  ["Transactions", Transaction],
  ["Wallets", Wallet],
  ["CoinWallets", CoinWallet],
  ["CoinTransactions", CoinTransaction],
  ["ReturnRequests", ReturnRequest],
  ["CancellationRequests", CancellationRequest],
  ["DeliveryAssignments", DeliveryAssignment],
  ["Notifications", Notification],
  ["Reviews", Review],
  ["Tickets", Ticket],
  ["StockHistory", StockHistory],
  ["FinanceAuditLogs", FinanceAuditLog],
  ["DashboardStats", DashboardStats],
  ["FinanceReports", FinanceReports],
  ["SellerMetrics", SellerMetrics],
];

async function main() {
  await connectDB();
  console.log(`Database: ${mongoose.connection.name}`);
  console.log(CONFIRM ? "MODE: DELETE" : "MODE: DRY RUN (add --confirm to delete)");

  let backupDir = null;
  if (CONFIRM) {
    backupDir = path.resolve("backups", `reset-${new Date().toISOString().replace(/[:.]/g, "-")}`);
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`Backup (JSON) -> ${backupDir}`);
  }

  for (const [label, Model] of targets) {
    const count = await Model.countDocuments({});
    if (CONFIRM && count > 0) {
      const docs = await Model.find({}).lean();
      fs.writeFileSync(path.join(backupDir, `${label}.json`), JSON.stringify(docs));
      const res = await Model.deleteMany({});
      console.log(`${label}: deleted ${res.deletedCount}`);
    } else {
      console.log(`${label}: ${count}`);
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
