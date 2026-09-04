import express from "express";
import {
    signupCustomer,
    loginCustomer,
    verifyCustomerOTP,
    getCustomerProfile,
    updateCustomerProfile,
    getCustomerTransactions,
    getCustomerCoins,
    getCustomerCoinTransactions,
    getCustomerWallet,
    getCustomerWalletTransactions,
} from "../controller/customerAuthController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
    authRouteRateLimiter,
    createContentLengthGuard,
    otpRouteRateLimiter,
} from "../middleware/securityMiddlewares.js";

const router = express.Router();
const smallAuthPayload = createContentLengthGuard(
    parseInt(process.env.AUTH_MAX_PAYLOAD_BYTES || "16384", 10),
    "Auth payload too large",
);
router.post("/send-signup-otp", authRouteRateLimiter, otpRouteRateLimiter, smallAuthPayload, signupCustomer);
router.post("/send-login-otp", authRouteRateLimiter, otpRouteRateLimiter, smallAuthPayload, loginCustomer);
router.post("/verify-otp", authRouteRateLimiter, otpRouteRateLimiter, smallAuthPayload, verifyCustomerOTP);

// Profile routes
router.get("/profile", verifyToken, getCustomerProfile);
router.put("/profile", verifyToken, updateCustomerProfile);

// Wallet
// `/transactions` is the legacy Transaction-collection view, kept for older
// clients. `/wallet` + `/wallet/transactions` read the canonical Wallet and
// LedgerEntry records, so cashback credits and checkout redemptions show up.
router.get("/transactions", verifyToken, getCustomerTransactions);
router.get("/wallet", verifyToken, getCustomerWallet);
router.get("/wallet/transactions", verifyToken, getCustomerWalletTransactions);

// Athreya Coins
router.get("/coins", verifyToken, getCustomerCoins);
router.get("/coins/transactions", verifyToken, getCustomerCoinTransactions);

export default router;
