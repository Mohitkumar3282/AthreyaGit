import mongoose from "mongoose";

const deliveryBoySchema = new mongoose.Schema(
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
      trim: true,
    },
    seller_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
      index: true,
    },
    current_location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
        required: true,
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
        default: [0, 0],
      },
    },
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
    is_available: {
      type: Boolean,
      default: true,
      index: true,
    },
    rating: {
      type: Number,
      default: 5.0,
    },
    total_pickups: {
      type: Number,
      default: 0,
    },
    fcm_token: {
      type: String,
      default: "",
    },
    last_seen_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

deliveryBoySchema.index({ current_location: "2dsphere" });

deliveryBoySchema.virtual("id").get(function () {
  return this._id.toHexString();
});

export default mongoose.model("DeliveryBoy", deliveryBoySchema);
