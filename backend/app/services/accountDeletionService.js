import Seller from "../models/seller.js";
import Delivery from "../models/delivery.js";
import Product from "../models/product.js";
import Order from "../models/order.js";
import Wallet from "../models/wallet.js";
import Transaction from "../models/transaction.js";
import PushToken from "../modules/notifications/token.model.js";
import { buildKey, delPattern } from "./cacheService.js";
import { clearRiderPresence } from "./firebaseService.js";

/**
 * Self-service account deletion for sellers and delivery partners.
 *
 * Accounts are anonymised and switched off, never erased: orders, payouts and
 * ledger rows must stay for accounting. Money that is still owed either way
 * (wallet balance, cash a rider holds, pending withdrawals) blocks deletion
 * so nobody loses earnings or walks away with the platform's cash.
 */

const OPEN_ORDER_STATUSES = ["pending", "confirmed", "packed", "out_for_delivery"];
const MONEY_EPSILON = 0.5;

const fail = (status, message) => ({ ok: false, status, message });

async function walletBlockers(ownerType, ownerId, userModel) {
  const wallet = await Wallet.findOne({ ownerType, ownerId })
    .select("availableBalance pendingBalance cashInHand")
    .lean();
  const owed = Number(wallet?.availableBalance || 0) + Number(wallet?.pendingBalance || 0);
  if (owed > MONEY_EPSILON) {
    return `You still have ₹${owed.toFixed(2)} in your wallet. Please withdraw it before deleting your account.`;
  }
  if (ownerType === "DELIVERY_PARTNER" && Number(wallet?.cashInHand || 0) > MONEY_EPSILON) {
    return `You are holding ₹${Number(wallet.cashInHand).toFixed(2)} of customer cash. Please deposit it with admin before deleting your account.`;
  }
  const pendingWithdrawals = await Transaction.countDocuments({
    user: ownerId,
    userModel,
    type: "Withdrawal",
    status: { $in: ["Pending", "Processing"] },
  });
  if (pendingWithdrawals > 0) {
    return "You have a withdrawal request in progress. Please wait until it is completed.";
  }
  return null;
}

export async function deleteSellerAccount(sellerId, confirm) {
  if (String(confirm || "").trim().toUpperCase() !== "DELETE") {
    return fail(400, "Type DELETE to confirm account deletion");
  }
  const seller = await Seller.findById(sellerId).select("_id deletedAt").lean();
  if (!seller || seller.deletedAt) return fail(404, "Account not found");

  const open = await Order.countDocuments({ seller: seller._id, status: { $in: OPEN_ORDER_STATUSES } });
  if (open > 0) {
    return fail(
      409,
      `You have ${open} order${open === 1 ? "" : "s"} in progress. Complete or cancel ${open === 1 ? "it" : "them"} before deleting your account.`,
    );
  }
  const money = await walletBlockers("SELLER", seller._id, "Seller");
  if (money) return fail(409, money);

  const id = String(seller._id);
  await Seller.updateOne(
    { _id: seller._id },
    {
      $set: {
        name: "Deleted Seller",
        shopName: "Deleted Shop",
        phone: `deleted_${id}`,
        email: `deleted_${id}@deleted.invalid`,
        contactNumber: "",
        address: "",
        locality: "",
        isActive: false,
        isOpen: false,
        isVerified: false,
        manuallyClosed: true,
        deletedAt: new Date(),
      },
      $unset: {
        password: "",
        shopBanner: "",
        shopLogo: "",
        shopGallery: "",
        storeFrontImage: "",
        storeInteriorImages: "",
        documents: "",
      },
    },
  );
  await Promise.allSettled([
    Product.updateMany({ sellerId: seller._id }, { $set: { status: "inactive" } }),
    PushToken.deleteMany({ userId: seller._id }),
    delPattern(buildKey("sellers", "nearby_all", "*")),
    delPattern(buildKey("sellers", "all_active_all")),
  ]);
  return { ok: true };
}

export async function deleteRiderAccount(riderId, confirm) {
  if (String(confirm || "").trim().toUpperCase() !== "DELETE") {
    return fail(400, "Type DELETE to confirm account deletion");
  }
  const rider = await Delivery.findById(riderId).select("_id deletedAt").lean();
  if (!rider || rider.deletedAt) return fail(404, "Account not found");

  const open = await Order.countDocuments({ deliveryBoy: rider._id, status: { $in: OPEN_ORDER_STATUSES } });
  if (open > 0) {
    return fail(
      409,
      `You have ${open} delivery${open === 1 ? "" : "ies"} in progress. Finish ${open === 1 ? "it" : "them"} before deleting your account.`,
    );
  }
  const money = await walletBlockers("DELIVERY_PARTNER", rider._id, "Delivery");
  if (money) return fail(409, money);

  const id = String(rider._id);
  await Delivery.updateOne(
    { _id: rider._id },
    {
      $set: {
        name: "Deleted Rider",
        phone: `deleted_${id}`,
        isOnline: false,
        isVerified: false,
        breakUntil: null,
        deletedAt: new Date(),
      },
      $unset: {
        email: "",
        address: "",
        documents: "",
        accountHolder: "",
        accountNumber: "",
        ifsc: "",
        profileImage: "",
        vehicleNumber: "",
        drivingLicenseNumber: "",
        currentArea: "",
      },
    },
  );
  await Promise.allSettled([PushToken.deleteMany({ userId: rider._id })]);
  // Realtime presence cleanup is best-effort and must never delay the response.
  Promise.resolve(clearRiderPresence(id)).catch(() => {});
  return { ok: true };
}
