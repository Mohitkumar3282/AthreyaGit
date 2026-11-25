/**
 * Clear ORDER + TRANSACTION history so the admin panel starts fresh.
 *
 * DELETES (backed up to backups/clear-history-<timestamp>/ first):
 *   orders, order OTPs, checkout groups, payments, payment webhook events,
 *   payouts, ledger entries, transactions, wallets, coin wallets / coin
 *   transactions, return / cancellation requests, delivery assignments,
 *   notifications, finance audit logs, precomputed dashboard / finance /
 *   seller stats.
 *   Also resets the legacy `walletBalance` on customers to 0.
 *
 * NEVER TOUCHES: products, stock history, categories, customers, sellers,
 *   riders, admins, carts, reviews, support tickets, offers, banners, settings.
 *
 * USAGE (run from backend/):
 *   node scripts/clear-order-history.js            # dry run: counts only
 *   node scripts/clear-order-history.js --confirm  # back up, then delete
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";

const CONFIRM = process.argv.includes("--confirm");

// Raw collection names, so no model hooks run and nothing else is touched.
const COLLECTIONS = [
  "orders",
  "orderotps",
  "checkoutgroups",
  "payments",
  "paymentwebhookevents",
  "payouts",
  "ledgerentries",
  "transactions",
  "wallets",
  "coinwallets",
  "cointransactions",
  "returnrequests",
  "cancellationrequests",
  "deliveryassignments",
  "notifications",
  "financeauditlogs",
  "dashboardstats",
  "financereports",
  "sellermetrics",
];

const PROTECTED = new Set(["products", "stockhistories", "categories", "users", "customers", "sellers", "deliveries", "admins", "carts", "reviews", "tickets"]);

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log(`Database: ${db.databaseName}`);
  console.log(CONFIRM ? "MODE: BACKUP + DELETE" : "MODE: DRY RUN (add --confirm to delete)");

  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));
  const productsBefore = existing.has("products") ? await db.collection("products").countDocuments() : 0;

  let backupDir = null;
  if (CONFIRM) {
    backupDir = path.resolve("backups", `clear-history-${new Date().toISOString().replace(/[:.]/g, "-")}`);
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`Backup -> ${backupDir}`);
  }

  for (const name of COLLECTIONS) {
    if (PROTECTED.has(name)) throw new Error(`Refusing to touch protected collection ${name}`);
    if (!existing.has(name)) continue;
    const col = db.collection(name);
    const count = await col.countDocuments();
    if (!CONFIRM || count === 0) {
      console.log(`${name}: ${count}`);
      continue;
    }
    const docs = await col.find({}).toArray();
    fs.writeFileSync(path.join(backupDir, `${name}.json`), JSON.stringify(docs));
    const res = await col.deleteMany({});
    console.log(`${name}: backed up ${docs.length}, deleted ${res.deletedCount}`);
  }

  // Legacy per-customer wallet balance (real balances lived in `wallets`).
  if (existing.has("users")) {
    const users = db.collection("users");
    const withBalance = await users.find({ walletBalance: { $gt: 0 } }, { projection: { walletBalance: 1 } }).toArray();
    if (CONFIRM && withBalance.length) {
      fs.writeFileSync(path.join(backupDir, "users.walletBalance.json"), JSON.stringify(withBalance));
      const res = await users.updateMany({ walletBalance: { $gt: 0 } }, { $set: { walletBalance: 0 } });
      console.log(`customers walletBalance reset: ${res.modifiedCount}`);
    } else {
      console.log(`customers with walletBalance > 0: ${withBalance.length}`);
    }
  }

  const productsAfter = existing.has("products") ? await db.collection("products").countDocuments() : 0;
  console.log(`products: ${productsBefore} before, ${productsAfter} after (must be equal)`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
