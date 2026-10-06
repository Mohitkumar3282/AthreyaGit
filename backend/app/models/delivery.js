import mongoose from "mongoose";

const deliverySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        phone: {
            type: String,
            required: true,
            unique: true,
        },

        vehicleType: {
            type: String,
            enum: ["bike", "cycle", "scooter"],
            default: "bike",
        },

        email: {
            type: String,
            trim: true,
        },

        address: {
            type: String,
            trim: true,
        },

        accountHolder: {
            type: String,
            trim: true,
        },

        accountNumber: {
            type: String,
            trim: true,
        },

        ifsc: {
            type: String,
            trim: true,
        },

        documents: {
            aadhar: { type: String },
            pan: { type: String },
            drivingLicense: { type: String },
        },

        vehicleNumber: {
            type: String,
            trim: true,
        },

        drivingLicenseNumber: {
            type: String,
            trim: true,
        },

        currentArea: {
            type: String,
            trim: true,
        },
        profileImage: {
            type: String,
            trim: true,
        },

        // Max cash this rider may hold (COD). null/0 = no limit. Admin-controlled.
        cashLimit: {
            type: Number,
            default: null,
            min: 0,
        },

        isVerified: {
            type: Boolean,
            default: false,
        },



        isOnline: {
            type: Boolean,
            default: true,
        },
        location: {
            type: {
                type: String,
                enum: ["Point"],
                default: "Point",
            },
            coordinates: {
                type: [Number],
                default: [0, 0],
            },
        },
        role: {
            type: String,
            default: "delivery",
        },

        otp: {
            type: String,
            select: false,
        },

        otpExpiry: {
            type: Date,
            select: false,
        },

        lastLogin: Date,

        /** Last GPS fix from POST /delivery/location (for radius matching). */
        lastLocationAt: {
            type: Date,
        },

        /** Aggregate customer rating — `rating` is the derived average, kept
         *  in sync with `ratingSum`/`ratingCount` by an atomic pipeline update
         *  whenever a new order rating comes in (see orderController.rateRider). */
        rating: {
            type: Number,
            default: 5.0,
        },
        ratingSum: {
            type: Number,
            default: 0,
        },
        ratingCount: {
            type: Number,
            default: 0,
        },

        /**
         * Cancellation policy (post-acceptance bail-outs only — see
         * Order.riderCancellations). No penalty is ever applied automatically;
         * crossing the threshold only sets `flaggedForReview` so an admin can
         * look at the log and decide. `penaltyLog` records what an admin
         * actually applied, if anything.
         */
        cancellationCount: {
            type: Number,
            default: 0,
        },
        lastCancellationAt: {
            type: Date,
        },
        flaggedForReview: {
            type: Boolean,
            default: false,
        },
        cancellationLog: [
            {
                orderId: String,
                reason: String,
                at: { type: Date, default: Date.now },
            },
        ],
        penaltyLog: [
            {
                amount: Number,
                reason: String,
                appliedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
                at: { type: Date, default: Date.now },
            },
        ],
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

deliverySchema.index({ location: "2dsphere" });
deliverySchema.index({ isOnline: 1, isVerified: 1 });

deliverySchema.virtual('id').get(function () {
    return this._id.toHexString();
});

export default mongoose.model("Delivery", deliverySchema);
