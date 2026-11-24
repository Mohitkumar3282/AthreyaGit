/**
 * One-time fix: make every product's top-level price / salePrice match its
 * first variant (variant prices are what checkout charges; the storefront
 * cards show the top-level fields, so mismatches showed customers an old price).
 *
 * Dry run (default, read-only):   node scripts/sync-product-prices-from-variants.js
 * Apply the changes:              node scripts/sync-product-prices-from-variants.js --apply
 */
import "dotenv/config";
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

function targetPrices(product) {
  const first = Array.isArray(product.variants) ? product.variants[0] : null;
  if (!first) return null;
  const price = Number(first.price);
  if (!Number.isFinite(price) || price <= 0) return null;
  const sale = Number(first.salePrice);
  return { price, salePrice: Number.isFinite(sale) && sale > 0 ? sale : 0 };
}

await mongoose.connect(process.env.MONGO_URI);
const products = mongoose.connection.db.collection("products");
const cursor = products.find(
  { "variants.0": { $exists: true } },
  { projection: { name: 1, price: 1, salePrice: 1, variants: 1 } },
);

let mismatched = 0;
let updated = 0;
for await (const p of cursor) {
  const t = targetPrices(p);
  if (!t) continue;
  const curPrice = Number(p.price) || 0;
  const curSale = Number(p.salePrice) || 0;
  if (curPrice === t.price && curSale === t.salePrice) continue;
  mismatched += 1;
  console.log(
    `${APPLY ? "UPDATE" : "would update"}: ${p.name} | price ${curPrice} -> ${t.price} | sale ${curSale} -> ${t.salePrice}`,
  );
  if (APPLY) {
    await products.updateOne({ _id: p._id }, { $set: { price: t.price, salePrice: t.salePrice } });
    updated += 1;
  }
}

console.log(
  APPLY
    ? `\nDone: ${updated} product(s) updated.`
    : `\nDry run: ${mismatched} product(s) would change. Re-run with --apply to save.`,
);
await mongoose.disconnect();
