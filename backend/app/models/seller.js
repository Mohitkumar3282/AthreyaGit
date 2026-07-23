import mongoose from "mongoose";
import bcrypt from "bcrypt";

const sellerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    shopName: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    shopBanner: {
      type: String,
      trim: true,
    },

    shopLogo: {
      type: String,
      trim: true,
    },

    shopGallery: {
      type: [String],
      default: [],
    },

    storeFrontImage: {
      type: String,
      trim: true,
    },

    storeInteriorImages: {
      type: [String],
      default: [],
    },

    businessDescription: {
      type: String,
      trim: true,
    },

    storeTimings: {
      type: String,
      trim: true,
      default: "9:00 AM - 10:00 PM",
    },

    contactNumber: {
      type: String,
      trim: true,
    },

    minimumOrderAmount: {
      type: Number,
      default: 0,
    },

    deliveryFee: {
      type: Number,
      default: 30,
    },

    freeDeliveryAbove: {
      type: Number,
      default: 499,
    },

    hygieneAssured: {
      type: Boolean,
      default: false,
    },

    rating: {
      type: Number,
      default: 4.5,
    },

    reviewCount: {
      type: Number,
      default: 0,
    },

    isOpen: {
      type: Boolean,
      default: true,
    },

    address: {
      type: String,
      trim: true,
    },
    locality: {
      type: String,
      trim: true,
    },
    pincode: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },

    documents: {
      tradeLicense: { type: String, trim: true },
      gstCertificate: { type: String, trim: true },
      idProof: { type: String, trim: true },
      businessRegistration: { type: String, trim: true },
      fssaiLicense: { type: String, trim: true },
      other: { type: String, trim: true },
    },

    role: {
      type: String,
      default: "seller",
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    phoneVerified: {
      type: Boolean,
      default: false,
    },

    applicationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    reviewedAt: {
      type: Date,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },

    rejectionReason: {
      type: String,
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: false,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        default: [75.9001552518043, 22.711140989838025], // Default to Indore coordinates to ensure visibility in default area
      },
    },
    serviceRadius: {
      type: Number,
      default: 5, // Default 5km
    },
    lastLogin: Date,
  },
  { timestamps: true },
);

sellerSchema.index({ location: "2dsphere" });
sellerSchema.index({ isActive: 1, isVerified: 1 });

// Hash password before saving
sellerSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
sellerSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("Seller", sellerSchema);
