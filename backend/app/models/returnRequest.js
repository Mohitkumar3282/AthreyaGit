import mongoose from "mongoose";

const returnRequestSchema = new mongoose.Schema(
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
        "REFUND_INITIATED",
        "REFUND_COMPLETED",
        "CLOSED",
        "UNDER_DISPUTE",
        "CANCELLED",
      ],
      required: true,
      default: "REQUESTED",
      index: true,
    },
    reason: {
      type: String,
      enum: [
        "damaged_product",
        "wrong_item",
        "missing_items",
        "quality_issue",
        "changed_mind",
        "other",
      ],
      required: true,
    },
    reason_description: {
      type: String,
      default: "",
    },
    product_images: {
      type: [String],
      required: true,
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length >= 1 && v.length <= 5;
        },
        message: "Product images array must contain between 1 and 5 URLs.",
      },
    },
    seller_note: {
      type: String,
      default: "",
    },
    admin_note: {
      type: String,
      default: "",
    },
    refund_amount: {
      type: Number,
      required: true,
      default: 0,
    },
    refund_method: {
      type: String,
      enum: ["original_payment", "bank_transfer", "wallet"],
      default: "wallet",
    },
    refund_transaction_id: {
      type: String,
      default: null,
    },
    delivered_at: {
      type: Date,
      required: true,
    },
    return_deadline: {
      type: Date,
      required: true,
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
    refund_initiated_at: {
      type: Date,
      default: null,
    },
    refund_completed_at: {
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

returnRequestSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

export default mongoose.model("ReturnRequest", returnRequestSchema);
