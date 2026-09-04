import mongoose from "mongoose";
import {
    ALL_DELIVERY_PRICING_MODES,
    ALL_HANDLING_FEE_STRATEGIES,
} from "../constants/finance.js";
import { ALL_COIN_CREDIT_TRIGGERS } from "../constants/coins.js";

const settingSchema = new mongoose.Schema(
    {
        // General
        appName: {
            type: String,
            default: "Athreya Delivery Athreya Delivery",
        },
        supportEmail: {
            type: String,
            default: "support@Athreya Delivery.com",
        },
        supportPhone: {
            type: String,
            default: "",
        },
        whatsappNumber: {
            type: String,
            default: "",
        },
        currencySymbol: {
            type: String,
            default: "₹",
        },
        currencyCode: {
            type: String,
            default: "INR",
        },
        timezone: {
            type: String,
            default: "Asia/Kolkata",
        },

        // Branding
        logoUrl: String,
        faviconUrl: String,
        primaryColor: {
            type: String,
            default: "#0ea5e9",
        },
        secondaryColor: {
            type: String,
            default: "#64748b",
        },

        // Legal
        companyName: String,
        taxId: String,
        address: String,

        // Social
        facebook: String,
        twitter: String,
        instagram: String,
        linkedin: String,
        youtube: String,

        // Apps
        playStoreLink: String,
        appStoreLink: String,

        // SEO
        metaTitle: String,
        metaDescription: String,
        metaKeywords: String,
        keywords: [{ type: String }], // Array for structured SEO keywords

        // Optional: multi-tenant (null = default tenant)
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
            index: true,
        },

        // Returns / logistics configuration
        returnDeliveryCommission: {
            // Flat amount per return pickup, paid by seller
            type: Number,
            default: 0,
        },

        /**
         * Finance / delivery pricing rules (single source of truth).
         * Existing keys are kept for backward compatibility.
         */
        deliveryPricingMode: {
            type: String,
            enum: ALL_DELIVERY_PRICING_MODES,
            default: "distance_based",
        },
        pricingMode: {
            type: String,
            enum: ALL_DELIVERY_PRICING_MODES,
            default: "distance_based",
        },
        customerBaseDeliveryFee: {
            type: Number,
            default: 30,
            min: 0,
        },
        riderBasePayout: {
            type: Number,
            default: 30,
            min: 0,
        },
        baseDeliveryCharge: {
            type: Number,
            default: 30,
            min: 0,
        },
        baseDistanceCapacityKm: {
            type: Number,
            default: 0.5,
            min: 0,
        },
        incrementalKmSurcharge: {
            type: Number,
            default: 10,
            min: 0,
        },
        // Charged once per ADDITIONAL shop in a multi-shop checkout. The first
        // shop pays the full delivery fee; extra pickup stops cost only this.
        multiShopPickupFee: {
            type: Number,
            default: 5,
            min: 0,
        },
        deliveryPartnerRatePerKm: {
            type: Number,
            default: 5,
            min: 0,
        },
        fleetCommissionRatePerKm: {
            type: Number,
            default: 5,
            min: 0,
        },
        fixedDeliveryFee: {
            type: Number,
            default: 30,
            min: 0,
        },
        handlingFeeStrategy: {
            type: String,
            enum: ALL_HANDLING_FEE_STRATEGIES,
            default: "highest_category_fee",
        },
        platformFee: {
            type: Number,
            default: 0,
            min: 0,
        },
        freeDeliveryThreshold: {
            type: Number,
            default: 0,
            min: 0,
        },
        codEnabled: {
            type: Boolean,
            default: true,
        },
        onlineEnabled: {
            type: Boolean,
            default: true,
        },
        lowStockAlertsEnabled: {
            type: Boolean,
            default: true,
        },

        /**
         * Dynamic delivery-time estimation coefficients.
         * Consumed by `services/deliveryEtaService.js`; every checkout
         * preview re-derives the customer-facing ETA from the same
         * seller-to-address distance the delivery fee is priced on.
         */
        deliveryEta: {
            enabled: { type: Boolean, default: true },
            // Picking, packing and handover buffer applied to every order.
            basePrepMinutes: { type: Number, default: 8, min: 0 },
            // Travel time added per kilometre of seller -> address distance.
            minutesPerKm: { type: Number, default: 3, min: 0 },
            // Extra picking time per cart line (0 disables the term).
            minutesPerItem: { type: Number, default: 0, min: 0 },
            // Floor / ceiling on the quoted lower bound.
            minMinutes: { type: Number, default: 8, min: 1 },
            maxMinutes: { type: Number, default: 180, min: 1 },
            // Width of the quoted window: max = min + spread.
            rangeSpreadMinutes: { type: Number, default: 5, min: 0 },
        },

        /**
         * Wallet Cashback — the retention loop.
         * Consumed by `services/walletCashbackService.js`. A percentage of
         * each delivered order's customer savings is credited to the
         * customer's rupee Wallet, which is spendable at checkout.
         */
        walletCashback: {
            // OFF by default: Athreya Coins (below) is the live retention loop,
            // and at 1 coin per ₹1 saved with a coin worth a paisa it already
            // returns 1% of savings. Running both would reward the same
            // savings twice.
            enabled: { type: Boolean, default: false },
            // Percentage of realised savings credited back (1% => ₹100 saved
            // returns ₹1).
            ratePercent: { type: Number, default: 1, min: 0, max: 100 },
            // Skip credits smaller than this instead of writing dust rows.
            minCashbackAmount: { type: Number, default: 0.01, min: 0 },
            // 0 = uncapped.
            maxCashbackPerOrder: { type: Number, default: 0, min: 0 },
        },

        /**
         * Athreya Coins — the customer-facing loyalty wallet.
         *
         *   "Every ₹1 you save = 1 Paisa Coin"
         *   ₹100 saved -> 100 coins -> ₹1 at checkout
         *
         * Coins are earned on delivery and spent at checkout. See
         * `services/coinsService.js`.
         */
        athreyaCoins: {
            enabled: { type: Boolean, default: true },
            // Coins minted per rupee of realised savings (MRP discount + coupon).
            coinsPerRupeeSaved: { type: Number, default: 1, min: 0 },
            // Rupee value of one coin. 1 coin = 1 paisa.
            rupeeValuePerCoin: { type: Number, default: 0.01, min: 0.01 },
            // Smallest redemption allowed in a single checkout.
            minRedeemCoins: { type: Number, default: 1, min: 0 },
            // Ceiling on how much of an order payable coins may settle.
            maxRedeemPercentOfOrder: { type: Number, default: 100, min: 0, max: 100 },
            // 0 = uncapped.
            maxEarnPerOrder: { type: Number, default: 0, min: 0 },
            // DELIVERY (default) or PLACEMENT.
            creditOn: {
                type: String,
                enum: ALL_COIN_CREDIT_TRIGGERS,
                default: "DELIVERY",
            },
        },
        productApproval: {
            sellerCreateRequiresApproval: {
                type: Boolean,
                default: false,
            },
            sellerEditRequiresApproval: {
                type: Boolean,
                default: false,
            },
        },
        dailyNeeds: {
            fruits: String,
            vegetables: String,
            chicken: String,
            mutton: String,
            eggs: String,
        },
        dailyNeedsCategoryIds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category"
        }],
    },
    {
        timestamps: true,
    }
);

settingSchema.pre("save", function syncFinanceAliases(next) {
    if (!this.pricingMode && this.deliveryPricingMode) {
        this.pricingMode = this.deliveryPricingMode;
    }
    if (!this.deliveryPricingMode && this.pricingMode) {
        this.deliveryPricingMode = this.pricingMode;
    }

    if (this.baseDeliveryCharge == null) {
        this.baseDeliveryCharge = this.customerBaseDeliveryFee ?? 30;
    }
    if (this.customerBaseDeliveryFee == null) {
        this.customerBaseDeliveryFee = this.baseDeliveryCharge ?? 30;
    }

    if (this.riderBasePayout == null) {
        this.riderBasePayout = this.baseDeliveryCharge ?? this.customerBaseDeliveryFee ?? 30;
    }

    if (this.fleetCommissionRatePerKm == null && this.deliveryPartnerRatePerKm != null) {
        this.fleetCommissionRatePerKm = this.deliveryPartnerRatePerKm;
    }
    if (this.deliveryPartnerRatePerKm == null && this.fleetCommissionRatePerKm != null) {
        this.deliveryPartnerRatePerKm = this.fleetCommissionRatePerKm;
    }

    if (this.fixedDeliveryFee == null) {
        this.fixedDeliveryFee = this.baseDeliveryCharge ?? this.customerBaseDeliveryFee ?? 30;
    }

    next();
});

export default mongoose.model("Setting", settingSchema);
