import mongoose from "mongoose";

const bannerVideoItemSchema = new mongoose.Schema(
    {
        name: { type: String, trim: true },
        url: { type: String, required: true, trim: true }
    },
    { _id: false }
);

const bannerVideoSchema = new mongoose.Schema(
    {
        timeOfDay: {
            type: String,
            enum: ["morning", "afternoon", "evening", "night"],
            required: true,
            unique: true
        },
        text: { type: String, required: true, trim: true },
        subtitle: { type: String, trim: true },
        cta: { type: String, default: "Shop Now", trim: true },
        redirectUrl: { type: String, default: "", trim: true },
        videos: {
            type: [bannerVideoItemSchema],
            default: []
        }
    },
    { timestamps: true }
);

export default mongoose.model("BannerVideo", bannerVideoSchema);
