import mongoose from "mongoose";
import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

// Import Models
import Order from "../app/models/order.js";
import Customer from "../app/models/customer.js";
import Seller from "../app/models/seller.js";
import DeliveryBoy from "../app/models/deliveryBoy.js";
import OrderOtp from "../app/models/orderOtp.js";
import CancellationRequest from "../app/models/cancellationRequest.js";
import Transaction from "../app/models/transaction.js";
import Product from "../app/models/product.js";
import Wallet from "../app/models/wallet.js";

// Import Controllers
import {
  submitCancellationRequest,
  approveCancellationRequest,
  assignDeliveryBoy,
} from "../app/controller/cancellationRequestController.js";

import {
  requestCancellationPickupOtp,
  verifyCancellationPickupOtp,
  requestCancellationDropOtp,
  verifyCancellationDropOtp,
} from "../app/controller/orderWorkflowController.js";

// Helper for mock Express res object
function createMockResponse() {
  const res = {
    statusCode: 200,
    body: null,
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (data) {
      this.body = data;
      return this;
    },
  };
  return res;
}

async function main() {
  console.log("Connecting to MongoDB at " + process.env.MONGO_URI);
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");

  // Clean up any old test artifacts
  await Order.deleteMany({ orderId: { $regex: /^TEST-ORD-/ } });
  await CancellationRequest.deleteMany({ reason: "TEST_CANCELLATION" });

  console.log("Setting up mock database documents...");

  // 1. Get or Create Customer
  let customer = await Customer.findOne({ email: "test-customer@example.com" });
  if (!customer) {
    customer = await Customer.create({
      name: "Test Customer",
      email: "test-customer@example.com",
      phone: "9876543210",
      password: "password123",
      isEmailVerified: true,
      isPhoneVerified: true,
    });
  }

  // 2. Get or Create Product & Seller
  let product = await Product.findOne();
  let seller;
  if (product && product.sellerId) {
    seller = await Seller.findById(product.sellerId);
  }

  if (!seller) {
    const sellerId = product?.sellerId || new mongoose.Types.ObjectId();
    seller = await Seller.create({
      _id: sellerId,
      name: "Test Seller Owner",
      shopName: "Test Shop",
      email: "test-seller-" + Date.now() + "@example.com",
      phone: "9876543211",
      password: "password123",
      location: {
        type: "Point",
        coordinates: [77.5946, 12.9716], // Bangalore
      },
      address: "Bangalore, India",
      isEmailVerified: true,
      isPhoneVerified: true,
      status: "approved",
    });
  }

  if (!product) {
    product = await Product.create({
      name: "Test Widget",
      price: 100,
      salePrice: 100,
      sellerId: seller._id,
      stock: 50,
      description: "Test description",
      mainImage: "image_url",
      slug: "test-widget-" + Date.now(),
      categoryId: new mongoose.Types.ObjectId(),
      subcategoryId: new mongoose.Types.ObjectId(),
      headerId: new mongoose.Types.ObjectId(),
    });
  }

  // 3. Get or Create Delivery Boy
  let deliveryBoy = await DeliveryBoy.findOne({ phone: "9876543212" });
  if (!deliveryBoy) {
    deliveryBoy = await DeliveryBoy.create({
      name: "Test Delivery Rider",
      phone: "9876543212",
      password: "password123",
      seller_id: seller._id,
      is_active: true,
      is_available: true,
      current_location: {
        type: "Point",
        coordinates: [77.5946, 12.9716],
      },
    });
  } else {
    // Make sure rider is active and available and belongs to the correct seller
    deliveryBoy.is_active = true;
    deliveryBoy.is_available = true;
    deliveryBoy.seller_id = seller._id;
    await deliveryBoy.save();
  }

  // Ensure Customer has a wallet with balance
  let customerWallet = await Wallet.findOne({ ownerId: customer._id });
  if (!customerWallet) {
    customerWallet = await Wallet.create({
      ownerId: customer._id,
      ownerType: "CUSTOMER",
      availableBalance: 500,
      pendingBalance: 0,
    });
  } else {
    customerWallet.availableBalance = 500;
    await customerWallet.save();
  }

  // Ensure Delivery Boy has a wallet
  let riderWallet = await Wallet.findOne({ ownerId: deliveryBoy._id });
  if (!riderWallet) {
    riderWallet = await Wallet.create({
      ownerId: deliveryBoy._id,
      ownerType: "DELIVERY_PARTNER",
      availableBalance: 0,
      pendingBalance: 0,
    });
  } else {
    riderWallet.availableBalance = 0;
    await riderWallet.save();
  }

  // Create a mock Order with status = confirmed, and with walletAmount = 110 (paid via customer's wallet)
  const orderId = "TEST-ORD-" + Date.now();
  console.log(`Creating test order ${orderId}...`);
  const order = await Order.create({
    orderId,
    customer: customer._id,
    seller: seller._id,
    items: [
      {
        product: product._id,
        name: product.name,
        quantity: 1,
        price: 100,
        itemIndex: 0,
      },
    ],
    pricing: {
      subtotal: 100,
      deliveryFee: 10,
      total: 110,
      platformFee: 0,
      gst: 0,
      discount: 0,
      walletAmount: 110,
    },
    paymentBreakdown: {
      grandTotal: 110,
      walletAmount: 110,
      productSubtotal: 100,
      deliveryFeeCharged: 10,
      snapshots: {
        deliverySettings: {},
        categoryCommissionSettings: [],
        handlingFeeStrategy: null,
        handlingCategoryUsed: {},
      },
    },
    address: {
      name: customer.name,
      address: "123 Test St",
      city: "Test City",
      type: "Home",
      phone: customer.phone,
      location: {
        lat: 12.9716,
        lng: 77.5946,
      },
    },
    payment: {
      method: "wallet",
      status: "completed",
    },
    paymentMode: "ONLINE",
    paymentStatus: "PAID",
    status: "confirmed",
    workflowStatus: "DELIVERY_SEARCH",
    workflowVersion: 2,
    returnDeliveryCommission: 15,
  });

  console.log("Mock documents ready.");

  // Check initial wallets
  customerWallet = await Wallet.findOne({ ownerId: customer._id });
  riderWallet = await Wallet.findOne({ ownerId: deliveryBoy._id });
  console.log(`Initial Customer Wallet: ₹${customerWallet.availableBalance}`);
  console.log(`Initial Rider Wallet: ₹${riderWallet.availableBalance}`);

  // ──── Step 1: Customer submits cancellation request ────
  console.log("\n[Step 1] Customer submitting cancellation request...");
  const res1 = createMockResponse();
  const req1 = {
    params: { orderId: order.orderId },
    body: { reason: "TEST_CANCELLATION" },
    user: { id: customer._id.toString(), role: "customer" },
  };
  await submitCancellationRequest(req1, res1);

  if (res1.statusCode !== 201) {
    throw new Error(`Failed to submit request: ${res1.body?.message || JSON.stringify(res1.body)}`);
  }
  const cancelReq = await CancellationRequest.findOne({ order_id: order._id }).sort({ createdAt: -1 });
  if (!cancelReq) throw new Error("CancellationRequest document not created");
  console.log(`- Request Created successfully. Status: ${cancelReq.status}`);

  // ──── Step 2: Seller approves cancellation request ────
  console.log("\n[Step 2] Seller approving cancellation request...");
  const res2 = createMockResponse();
  const req2 = {
    params: { cancellationRequestId: cancelReq._id.toString() },
    body: { note: "Seller approval note" },
    user: { id: seller._id.toString(), role: "seller" },
  };
  await approveCancellationRequest(req2, res2);

  if (res2.statusCode !== 200) {
    throw new Error(`Failed to approve request: ${res2.body?.message || JSON.stringify(res2.body)}`);
  }
  const approvedReq = await CancellationRequest.findById(cancelReq._id);
  console.log(`- Seller Approved successfully. Status: ${approvedReq.status}`);
  
  // Verify order status is NOT cancelled yet
  const orderAfterApprove = await Order.findById(order._id);
  console.log(`- Verification: Order status is still: ${orderAfterApprove.status}`);
  if (orderAfterApprove.status === "cancelled") {
    throw new Error("Order was cancelled immediately on seller approval! It should wait for pickup.");
  }

  // ──── Step 3: Seller assigns delivery boy ────
  console.log("\n[Step 3] Seller assigning delivery rider...");
  const res3 = createMockResponse();
  const req3 = {
    params: { cancellationRequestId: cancelReq._id.toString() },
    body: { delivery_boy_id: deliveryBoy._id.toString() },
    user: { id: seller._id.toString(), role: "seller" },
  };
  await assignDeliveryBoy(req3, res3);

  if (res3.statusCode !== 200) {
    throw new Error(`Failed to assign rider: ${res3.body?.message || JSON.stringify(res3.body)}`);
  }
  const assignedReq = await CancellationRequest.findById(cancelReq._id);
  console.log(`- Delivery Boy assigned successfully. Status: ${assignedReq.status}`);

  // ──── Step 4: OTP Verification for Pickup (Rider picks up items from Customer) ────
  console.log("\n[Step 4] OTP Verification for Customer Pickup...");
  
  // Request pickup OTP first
  const res3b = createMockResponse();
  const req3b = {
    params: { orderId: order.orderId },
    user: { id: deliveryBoy._id.toString(), role: "delivery_boy" },
  };
  await requestCancellationPickupOtp(req3b, res3b);

  if (res3b.statusCode !== 200) {
    throw new Error(`Failed to request pickup OTP: ${res3b.body?.message || JSON.stringify(res3b.body)}`);
  }

  // Look up the generated OTP code from DB
  const pickupOtpRecord = await OrderOtp.findOne({
    orderId: order.orderId,
    type: "cancellation_pickup",
    consumedAt: null,
  }).sort({ createdAt: -1 });

  if (!pickupOtpRecord) {
    throw new Error("cancellation_pickup OTP record not found in database.");
  }
  console.log(`- Retrieved Pickup OTP: ${pickupOtpRecord.code}`);

  const res4 = createMockResponse();
  const req4 = {
    params: { orderId: order.orderId },
    body: { code: pickupOtpRecord.code },
    user: { id: deliveryBoy._id.toString(), role: "delivery_boy" },
  };
  await verifyCancellationPickupOtp(req4, res4);

  if (res4.statusCode !== 200) {
    throw new Error(`Failed pickup OTP verification: ${res4.body?.message || JSON.stringify(res4.body)}`);
  }
  const pickedUpReq = await CancellationRequest.findById(cancelReq._id);
  console.log(`- Pickup OTP verified. Status: ${pickedUpReq.status}`);

  // ──── Step 5: OTP Request & Verification for Drop-off (Rider delivers items to Seller) ────
  console.log("\n[Step 5] OTP Verification for Seller Drop-off...");
  // Rider requests drop OTP
  const res5a = createMockResponse();
  const req5a = {
    params: { orderId: order.orderId },
    user: { id: deliveryBoy._id.toString(), role: "delivery_boy" },
  };
  await requestCancellationDropOtp(req5a, res5a);

  if (res5a.statusCode !== 200) {
    throw new Error(`Failed to request drop OTP: ${res5a.body?.message || JSON.stringify(res5a.body)}`);
  }

  // Look up generated drop OTP
  const dropOtpRecord = await OrderOtp.findOne({
    orderId: order.orderId,
    type: "cancellation_drop",
    consumedAt: null,
  }).sort({ createdAt: -1 });

  if (!dropOtpRecord) {
    throw new Error("cancellation_drop OTP record not found in database.");
  }
  console.log(`- Retrieved Drop OTP: ${dropOtpRecord.code}`);

  // Verify drop OTP
  const res5b = createMockResponse();
  const req5b = {
    params: { orderId: order.orderId },
    body: { code: dropOtpRecord.code },
    user: { id: deliveryBoy._id.toString(), role: "delivery_boy" },
  };
  await verifyCancellationDropOtp(req5b, res5b);

  if (res5b.statusCode !== 200) {
    throw new Error(`Failed drop OTP verification: ${res5b.body?.message || JSON.stringify(res5b.body)}`);
  }
  const finalizedReq = await CancellationRequest.findById(cancelReq._id);
  console.log(`- Drop OTP verified. Status of request: ${finalizedReq.status}`);

  // ──── Step 6: Post-Verification Assertions ────
  console.log("\n[Step 6] Running post-verification assertions...");

  // 1. Order Status is cancelled
  const finalizedOrder = await Order.findById(order._id);
  console.log(`- Order Status: ${finalizedOrder.status}`);
  if (finalizedOrder.status !== "cancelled") {
    throw new Error(`Order status is ${finalizedOrder.status}, expected: cancelled`);
  }

  // 2. Customer Wallet Balance (should be refunded 110 coins)
  customerWallet = await Wallet.findOne({ ownerId: customer._id });
  console.log(`- Final Customer Wallet Balance: ₹${customerWallet.availableBalance} (Expected: ₹610)`);
  if (customerWallet.availableBalance !== 610) {
    throw new Error(`Customer wallet balance is ₹${customerWallet.availableBalance}, expected: ₹610`);
  }

  // 3. Delivery Boy Wallet Balance (should be credited ₹15 commission)
  riderWallet = await Wallet.findOne({ ownerId: deliveryBoy._id });
  console.log(`- Final Rider Wallet Balance: ₹${riderWallet.availableBalance} (Expected: ₹15)`);
  if (riderWallet.availableBalance !== 15) {
    throw new Error(`Rider wallet balance is ₹${riderWallet.availableBalance}, expected: ₹15`);
  }

  // 4. Ledger entry exists
  const refundLedger = await Transaction.findOne({ reference: `CAN-PICK-${order.orderId}` });
  console.log(`- Rider Commission Ledger Transaction: ${refundLedger ? "Found" : "Not Found"}`);
  if (!refundLedger) {
    throw new Error("Rider commission transaction ledger entry not found.");
  }

  console.log("\n=======================================================");
  console.log(" SUCCESS: All cancellation workflow integration tests passed!");
  console.log("=======================================================");

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("\n❌ TEST FAILED:", err);
  await mongoose.disconnect();
  process.exit(1);
});
