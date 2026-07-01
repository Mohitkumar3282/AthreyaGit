import mongoose from "mongoose";

const cancellationRequestSchema = new mongoose.Schema(
  {
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    seller_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
      index: true,
    },
    delivery_boy_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryBoy",
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: [
        "REQUESTED",
        "SELLER_APPROVED",
        "SELLER_REJECTED",
        "PICKUP_SCHEDULED",
        "PICKED_UP",
        "DELIVERED_TO_SELLER",
        "CANCELLED",
      ],
      required: true,
      default: "REQUESTED",
      index: true,
    },
    reason: {
      type: String,
      required: true,
    },
    seller_note: {
      type: String,
      default: "",
    },
    requested_at: {
      type: Date,
      default: Date.now,
    },
    seller_action_at: {
      type: Date,
      default: null,
    },
    pickup_scheduled_at: {
      type: Date,
      default: null,
    },
    picked_up_at: {
      type: Date,
      default: null,
    },
    delivered_to_seller_at: {
      type: Date,
      default: null,
    },
    pickup_otp: {
      type: String,
      default: null,
    },
    otp_generated_at: {
      type: Date,
      default: null,
    },
    status_history: [
      {
        status: {
          type: String,
          required: true,
        },
        changed_by: {
          type: String,
          required: true,
        },
        changed_at: {
          type: Date,
          default: Date.now,
        },
        note: {
          type: String,
          default: "",
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

cancellationRequestSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

export default mongoose.model("CancellationRequest", cancellationRequestSchema);
