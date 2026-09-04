import Customer from "../models/customer.js";
import Transaction from "../models/transaction.js";
import jwt from "jsonwebtoken";
import handleResponse from "../utils/helper.js";
import {
    issueCustomerOtp,
    sanitizeCustomer,
    verifyCustomerOtpCode,
} from "../services/otpAuthService.js";
import {
    sendLoginOtpSchema,
    sendSignupOtpSchema,
    validateSchema,
    verifyOtpSchema,
} from "../validation/customerAuthValidation.js";
import {
    getCoinSummary,
    listCoinTransactions,
} from "../services/coinsService.js";
import {
    getWalletSummary,
    listWalletTransactions,
} from "../services/customerWalletService.js";

const generateToken = (customer) =>
    jwt.sign(
        { id: customer._id, role: "customer" },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );

/* ===============================
   SIGNUP – Send OTP
================================ */
export const signupCustomer = async (req, res) => {
    try {
        const payload = validateSchema(sendSignupOtpSchema, req.body || {});

        await issueCustomerOtp({
            name: payload.name,
            rawPhone: payload.phone,
            flow: "signup",
            ipAddress: req.ip,
        });

        return handleResponse(res, 200, "If the number is eligible, OTP has been sent");
    } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
    }
};

/* ===============================
   LOGIN – Send OTP
================================ */
export const loginCustomer = async (req, res) => {
    try {
        const payload = validateSchema(sendLoginOtpSchema, req.body || {});

        await issueCustomerOtp({
            rawPhone: payload.phone,
            flow: "login",
            ipAddress: req.ip,
        });

        return handleResponse(res, 200, "If the number is eligible, OTP has been sent");
    } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
    }
};

/* ===============================
   VERIFY OTP – Login / Signup
================================ */
export const verifyCustomerOTP = async (req, res) => {
    try {
        const payload = validateSchema(verifyOtpSchema, req.body || {});
        const customer = await verifyCustomerOtpCode({
            rawPhone: payload.phone,
            otp: payload.otp,
            ipAddress: req.ip,
        });
        const token = generateToken(customer);

        return handleResponse(
            res,
            200,
            "Login successful",
            {
                token,
                customer: sanitizeCustomer(customer),
            }
        );
    } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
    }
};

/* ===============================
   GET PROFILE
================================ */
export const getCustomerProfile = async (req, res) => {
    try {
        const customer = await Customer.findById(req.user.id);
        if (!customer) {
            return handleResponse(res, 404, "Customer not found");
        }

        // The wallet balance rides along with the profile so the app can
        // render the wallet chip on first paint without a second round trip.
        // We read the CANONICAL Wallet document rather than trusting the
        // legacy `User.walletBalance` mirror, so a customer whose cashback
        // landed on the canonical wallet sees it immediately.
        //
        // Both summaries are best-effort: a wallet or coins read failure must
        // degrade to a zero balance, never to a broken profile.
        const [wallet, coins] = await Promise.all([
            getWalletSummary(req.user.id).catch(() => null),
            getCoinSummary(req.user.id).catch(() => null),
        ]);
        const payload = customer.toObject ? customer.toObject() : customer;

        return handleResponse(res, 200, "Profile fetched successfully", {
            ...payload,
            walletBalance: wallet ? wallet.balance : payload.walletBalance || 0,
            wallet,
            coinBalance: coins ? coins.balance : 0,
            coins,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   GET WALLET SUMMARY
================================ */
export const getCustomerWallet = async (req, res) => {
    try {
        const wallet = await getWalletSummary(req.user.id);
        return handleResponse(res, 200, "Wallet fetched", wallet);
    } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
    }
};

/* ===============================
   GET WALLET HISTORY (LEDGER)
================================ */
export const getCustomerWalletTransactions = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const result = await listWalletTransactions(req.user.id, { page, limit });
        return handleResponse(res, 200, "Wallet history fetched", result);
    } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
    }
};

/* ===============================
   GET ATHREYA COINS SUMMARY
================================ */
export const getCustomerCoins = async (req, res) => {
    try {
        const coins = await getCoinSummary(req.user.id);
        return handleResponse(res, 200, "Athreya Coins fetched", coins);
    } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
    }
};

/* ===============================
   GET ATHREYA COINS HISTORY
================================ */
export const getCustomerCoinTransactions = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const result = await listCoinTransactions(req.user.id, { page, limit });
        return handleResponse(res, 200, "Athreya Coins history fetched", result);
    } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
    }
};

/* ===============================
   UPDATE PROFILE
================================ */
export const updateCustomerProfile = async (req, res) => {
    try {
        const { name, email, addresses } = req.body;

        const customer = await Customer.findById(req.user.id);
        if (!customer) {
            return handleResponse(res, 404, "Customer not found");
        }

        if (name) customer.name = name;
        if (email) customer.email = email;
        if (addresses) customer.addresses = addresses;

        await customer.save();

        return handleResponse(res, 200, "Profile updated successfully", customer);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   GET WALLET TRANSACTIONS
================================ */
export const getCustomerTransactions = async (req, res) => {
    try {
        const customerId = req.user.id;
        const { page = 1, limit = 20 } = req.query;
        const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(50, Math.max(1, parseInt(limit, 10)));
        const perPage = Math.min(50, Math.max(1, parseInt(limit, 10)));

        const [transactions, total] = await Promise.all([
            Transaction.find({ user: customerId, userModel: "User" })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(perPage)
                .populate("order", "orderId")
                .lean(),
            Transaction.countDocuments({ user: customerId, userModel: "User" }),
        ]);

        const items = transactions.map((t) => ({
            _id: t._id,
            type: t.type === "Refund" ? "credit" : "debit",
            title: t.type === "Refund" ? "Refund" : t.type,
            amount: Math.abs(t.amount),
            date: t.createdAt,
            reference: t.reference,
            orderId: t.order?.orderId,
        }));

        return handleResponse(res, 200, "Transactions fetched", {
            items,
            total,
            page: parseInt(page, 10),
            totalPages: Math.ceil(total / perPage) || 1,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
