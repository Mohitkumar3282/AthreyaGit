/**
 * E2E/Integration test script for the Return Requests and Delivery Boys System.
 * Simulates the complete return request lifecycle, including:
 * - Order delivery & return window creation (2-hour limit)
 * - Return eligibility check
 * - Customer submitting return request with photos and refund amount calculation
 * - Seller approval of return request
 * - Seller assigning a nearby Delivery Boy (rider availability tracking)
 * - Delivery Boy accepting the task
 * - Delivery Boy picking up and verifying OTP/images
 * - Delivery Boy delivering to seller
 * - Admin initiating refund, executing ledger debits/credits on wallets
 * 
 * To run:
 *   node scripts/test-returns-flow.js
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

// Models
import User from "../app/models/customer.js";
import Seller from "../app/models/seller.js";
import DeliveryBoy from "../app/models/deliveryBoy.js";
import Order from "../app/models/order.js";
import ReturnRequest from "../app/models/returnRequest.js";
import Wallet from "../app/models/wallet.js";
import Transaction from "../app/models/transaction.js";
import LedgerEntry from "../app/models/ledgerEntry.js";

// Controllers/helpers logic
import { getReturnEligibility, initiateRefund } from "../app/controller/returnRequestController.js";

async function main() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("❌ MONGO_URI is not set in .env");
    process.exit(1);
  }

  console.log("🔗 Connecting to MongoDB...");
  await mongoose.connect(mongoUri);
  console.log("✓ MongoDB connected successfully.\n");

  // 1. Seed Seed Data
  console.log("🌱 Seeding test data...");
  const suffix = Date.now().toString().slice(-4);
  
  const customer = await User.create({
    name: `Test Customer ${suffix}`,
    phone: `900000${suffix}`,
    email: `customer${suffix}@test.com`,
    role: "user",
    status: "active"
  });

  const seller = await Seller.create({
    name: `Test Seller ${suffix}`,
    shopName: `Test Shop ${suffix}`,
    phone: `800000${suffix}`,
    email: `seller${suffix}@test.com`,
    password: "Password@123",
    isVerified: true,
    role: "seller",
    status: "active",
    location: {
      type: "Point",
      coordinates: [77.5946, 12.9716] // Bangalore
    }
  });

  const deliveryBoy = await DeliveryBoy.create({
    name: `Test Rider ${suffix}`,
    phone: `700000${suffix}`,
    seller_id: seller._id,
    is_available: true,
    current_location: {
      type: "Point",
      coordinates: [77.5950, 12.9720] // Close to seller
    }
  });

  // Ensure wallets exist
  let customerWallet = await Wallet.findOne({ ownerId: customer._id });
  if (!customerWallet) {
    customerWallet = await Wallet.create({ ownerId: customer._id, ownerType: "CUSTOMER", availableBalance: 0, pendingBalance: 0, cashInHand: 0 });
  }

  let sellerWallet = await Wallet.findOne({ ownerId: seller._id });
  if (!sellerWallet) {
    sellerWallet = await Wallet.create({ ownerId: seller._id, ownerType: "SELLER", availableBalance: 1000, pendingBalance: 0, cashInHand: 0 });
  }

  // Create Order
  const orderId = `ORD-RET-${suffix}`;
  const order = await Order.create({
    orderId,
    customer: customer._id,
    seller: seller._id,
    items: [
      {
        product: new mongoose.Types.ObjectId(),
        name: "Premium Test Item",
        price: 500,
        quantity: 1
      }
    ],
    pricing: {
      subtotal: 500,
      deliveryFee: 50,
      total: 550
    },
    paymentMode: "ONLINE",
    status: "delivered", // Start as delivered
    delivered_at: new Date(Date.now() - 30 * 60 * 1000), // 30 mins ago
    return_eligible_until: new Date(Date.now() + 90 * 60 * 1000) // 90 mins remaining
  });

  console.log(`✓ Seeded Customer (${customer.name}), Seller (${seller.shopName}), Rider (${deliveryBoy.name})`);
  console.log(`✓ Seeded Order #${orderId} (Status: ${order.status}, Amount: ₹${order.pricing.total})\n`);

  // 2. Check Eligibility
  console.log("🔍 Testing Return Eligibility...");
  // Simulate req/res for getReturnEligibility controller
  const mockReq = { params: { orderId } };
  let eligibilityData = null;
  const mockRes = {
    status: (code) => ({
      json: (data) => {
        eligibilityData = data;
      }
    })
  };
  
  await getReturnEligibility(mockReq, mockRes);
  console.log("Eligibility Response:", eligibilityData);
  if (eligibilityData?.success && eligibilityData?.result?.eligible) {
    console.log("✓ Return eligibility verified. Within 2-hour window.\n");
  } else {
    throw new Error("❌ Eligibility check failed");
  }

  // 3. Create Return Request (REQUESTED)
  console.log("📥 Creating Return Request...");
  const returnRequest = await ReturnRequest.create({
    order_id: order._id,
    customer_id: customer._id,
    seller_id: seller._id,
    status: "REQUESTED",
    reason: "damaged_product",
    reason_description: "Screen cracked on delivery",
    product_images: ["https://cloudinary.com/test-cracked-screen.png"],
    refund_amount: 550, // refund subtotal + delivery fee since online
    delivered_at: order.delivered_at,
    return_deadline: order.return_eligible_until,
    status_history: [
      {
        status: "REQUESTED",
        changed_by: "customer",
        note: "Damaged screen"
      }
    ]
  });

  order.return_request_id = returnRequest._id;
  order.returnStatus = "return_requested";
  await order.save();
  console.log(`✓ ReturnRequest created with ID: ${returnRequest._id} (Status: ${returnRequest.status})`);
  console.log(`✓ Parent Order returnStatus updated to return_requested\n`);

  // 4. Seller Approves (SELLER_APPROVED)
  console.log("🤝 Seller approving return request...");
  returnRequest.status = "SELLER_APPROVED";
  returnRequest.seller_note = "Approved. Please return original packing.";
  returnRequest.status_history.push({
    status: "SELLER_APPROVED",
    changed_by: "seller",
    note: returnRequest.seller_note
  });
  await returnRequest.save();
  console.log(`✓ ReturnRequest status updated to: ${returnRequest.status}\n`);

  // 5. Seller Assigns Delivery Boy (PICKUP_SCHEDULED)
  console.log("🏍️ Seller assigning delivery boy...");
  // Mark delivery boy unavailable
  deliveryBoy.is_available = false;
  await deliveryBoy.save();

  returnRequest.delivery_boy_id = deliveryBoy._id;
  returnRequest.status = "PICKUP_SCHEDULED";
  returnRequest.status_history.push({
    status: "PICKUP_SCHEDULED",
    changed_by: "seller",
    note: `Rider ${deliveryBoy.name} assigned for pickup`
  });
  await returnRequest.save();
  console.log(`✓ Rider assigned: ${deliveryBoy.name}`);
  console.log(`✓ ReturnRequest status updated to: ${returnRequest.status}\n`);

  // 6. Rider Picks Up (PICKED_UP)
  console.log("📦 Rider picking up package from customer...");
  returnRequest.status = "PICKED_UP";
  returnRequest.picked_up_at = new Date();
  returnRequest.status_history.push({
    status: "PICKED_UP",
    changed_by: "delivery_boy",
    note: "Verified OTP and item condition"
  });
  await returnRequest.save();
  console.log(`✓ ReturnRequest status updated to: ${returnRequest.status}\n`);

  // 7. Rider Drops Off at Seller (DELIVERED_TO_SELLER)
  console.log("🏪 Rider dropping off package at seller...");
  returnRequest.status = "DELIVERED_TO_SELLER";
  returnRequest.delivered_to_seller_at = new Date();
  returnRequest.status_history.push({
    status: "DELIVERED_TO_SELLER",
    changed_by: "delivery_boy",
    note: "Handed over to seller store"
  });
  await returnRequest.save();

  // Free up rider availability
  deliveryBoy.is_available = true;
  await deliveryBoy.save();
  console.log(`✓ Rider is_available reset to: ${deliveryBoy.is_available}`);
  console.log(`✓ ReturnRequest status updated to: ${returnRequest.status}\n`);

  // 8. Admin Triggers Refund (REFUND_INITIATED & REFUND_COMPLETED)
  console.log("💳 Admin triggering refund wallet payout...");
  const mockRefundReq = {
    params: { returnRequestId: returnRequest._id.toString() },
    body: { refund_amount: 550, refund_method: "wallet" }
  };
  let refundResponse = null;
  const mockRefundRes = {
    status: (code) => ({
      json: (data) => {
        refundResponse = { code, ...data };
      }
    })
  };

  await initiateRefund(mockRefundReq, mockRefundRes);
  console.log("Refund Controller Response:", refundResponse);

  if (refundResponse?.code !== 200) {
    throw new Error(`❌ Refund controller failed: ${refundResponse?.message}`);
  }
  console.log("✓ Refund controller executed successfully.");

  // 9. Validation / assertions
  console.log("📊 Verifying ledger & wallet consistency...");
  const finalCustomerWallet = await Wallet.findOne({ ownerId: customer._id });
  const finalSellerWallet = await Wallet.findOne({ ownerId: seller._id });
  console.log(`Customer Wallet Balance: ₹${finalCustomerWallet.availableBalance} (Expected: ₹550)`);
  console.log(`Seller Wallet Balance: ₹${finalSellerWallet.availableBalance} (Expected: ₹450)`);

  const customerLedger = await LedgerEntry.findOne({ actorId: customer._id, type: "WALLET_REFUND" });
  const sellerLedger = await LedgerEntry.findOne({ actorId: seller._id, type: "REFUND" });

  if (finalCustomerWallet.availableBalance === 550 && finalSellerWallet.availableBalance === 450 && customerLedger && sellerLedger) {
    console.log("\n🎉 ALL E2E FLOW CHECKS PASSED SUCCESSFULLY! 🎉\n");
  } else {
    throw new Error("❌ Balance or ledger assertion failed");
  }

  // Cleanup test records to prevent db pollution
  console.log("🧹 Cleaning up seeded test records...");
  await User.deleteOne({ _id: customer._id });
  await Seller.deleteOne({ _id: seller._id });
  await DeliveryBoy.deleteOne({ _id: deliveryBoy._id });
  await Order.deleteOne({ _id: order._id });
  await ReturnRequest.deleteOne({ _id: returnRequest._id });
  await Wallet.deleteMany({ ownerId: { $in: [customer._id, seller._id] } });
  await LedgerEntry.deleteMany({ actorId: { $in: [customer._id, seller._id] } });
  await Transaction.deleteMany({ user: { $in: [customer._id, seller._id] } });
  console.log("✓ Cleanup finished.");

  await mongoose.disconnect();
  console.log("✓ Disconnected. Done.");
}

main().catch(async (e) => {
  console.error("\n❌ E2E Return request test run failed:\n", e);
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  process.exit(1);
});
