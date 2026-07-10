import Order from "../models/order.js";
import Delivery from "../models/delivery.js";
import BannerVideo from "../models/bannerVideo.js";
import handleResponse from "../utils/helper.js";
import { WORKFLOW_STATUS } from "../constants/orderWorkflow.js";
import { getFirebaseRealtimeDb } from "../config/firebaseAdmin.js";

const getTimeOfDay = () => {
    // Force Indian Standard Time (IST, UTC+5:30) for calculations
    const utcDate = new Date();
    const istDate = new Date(utcDate.getTime() + (5.5 * 60 * 60 * 1000));
    const hours = istDate.getUTCHours();
    if (hours >= 7 && hours < 11) return "morning";
    if (hours >= 11 && hours < 15) return "afternoon";
    if (hours >= 15 && hours < 19) return "evening";
    return "night";
};

// Default hardcoded content to fall back on if nothing is set in the DB
const DEFAULT_PROMO_CONTENT = {
    morning: {
        timeOfDay: "morning",
        text: "Today's Breakfast Specials",
        subtitle: "Fresh & Hot – Order Now",
        cta: "Shop Now",
        redirectUrl: "",
        videos: [
            { name: "Fresh Tiffins", url: "https://player.vimeo.com/external/371433846.sd.mp4?s=236da2f3ccee00f3d7df482f3c7e0c7b7440409a&profile_id=139&oauth2_token_id=57447761" },
            { name: "Milk Delivery", url: "https://player.vimeo.com/external/434045526.sd.mp4?s=c1b35cd3b4b60e6e96c4062142e47e3240212f7a&profile_id=165&oauth2_token_id=57447761" },
            { name: "Fresh Vegetables", url: "https://player.vimeo.com/external/371433846.sd.mp4?s=236da2f3ccee00f3d7df482f3c7e0c7b7440409a&profile_id=139&oauth2_token_id=57447761" }
        ]
    },
    afternoon: {
        timeOfDay: "afternoon",
        text: "Popular Lunch Specials",
        subtitle: "Freshly Prepared • Fast Delivery",
        cta: "Shop Now",
        redirectUrl: "",
        videos: [
            { name: "Chicken Biryani", url: "https://player.vimeo.com/external/435674703.sd.mp4?s=7fcc186175ec206b744040a4cf0ca4180d5d71c8&profile_id=165&oauth2_token_id=57447761" },
            { name: "Restaurant Kitchen", url: "https://player.vimeo.com/external/435674703.sd.mp4?s=7fcc186175ec206b744040a4cf0ca4180d5d71c8&profile_id=165&oauth2_token_id=57447761" },
            { name: "Rider Pickup", url: "https://player.vimeo.com/external/459389137.sd.mp4?s=87ae077e69d4519d5113ab1e5da486719ee27ad5&profile_id=165&oauth2_token_id=57447761" }
        ]
    },
    evening: {
        timeOfDay: "evening",
        text: "Evening Snacks Available Near You",
        subtitle: "Order Fresh • Delivered Fast",
        cta: "Shop Now",
        redirectUrl: "",
        videos: [
            { name: "Coffee & Tea", url: "https://player.vimeo.com/external/355159345.sd.mp4?s=d94eb38e0b12bc1a80c98e16cc1aa6e2d1d57545&profile_id=139&oauth2_token_id=57447761" },
            { name: "Bakery & Snacks", url: "https://player.vimeo.com/external/430852026.sd.mp4?s=7e937d57833a6f4e6676cf00344445582f3c7d6a&profile_id=165&oauth2_token_id=57447761" }
        ]
    },
    night: {
        timeOfDay: "night",
        text: "Dinner Ready For Delivery",
        subtitle: "Freshly Made Dinner Specials",
        cta: "Shop Now",
        redirectUrl: "",
        videos: [
            { name: "Dinner Specials", url: "https://player.vimeo.com/external/403847952.sd.mp4?s=6c2ef6cfbf48c2656910a30b201a07ee4b7cb6f4&profile_id=165&oauth2_token_id=57447761" },
            { name: "Ice Cream & Desserts", url: "https://player.vimeo.com/external/385568551.sd.mp4?s=c855a90d8a5a5491176b68a8dc4e9a071bd1f148&profile_id=139&oauth2_token_id=57447761" }
        ]
    }
};

// 1. GET /api/banner/videos (Public)
export const getPromoVideos = async (req, res) => {
    try {
        const timeOfDay = getTimeOfDay();
        
        // Find config in DB first
        const config = await BannerVideo.findOne({ timeOfDay }).lean();
        if (config) {
            return handleResponse(res, 200, "Promo videos fetched successfully", config);
        }

        // Fallback to defaults
        const activePromo = DEFAULT_PROMO_CONTENT[timeOfDay] || DEFAULT_PROMO_CONTENT.night;
        return handleResponse(res, 200, "Promo videos fetched successfully (fallback)", activePromo);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// 2. GET /api/banner/offers (Public)
export const getPromoOffers = async (req, res) => {
    try {
        const offers = [
            { id: "festive", type: "Festival Offers", title: "Festival Feast Specials", value: "Flat 20% OFF", subtitle: "Celebrate with top delicacies from nearby shops" },
            { id: "bestsellers", type: "Today's Best Sellers", title: "Today's Hot Picks", value: "Buy 1 Get 1 Free", subtitle: "Most ordered dishes right now in Aswapuram" },
            { id: "trending", type: "Trending Shops", title: "Trending Stores Near You", value: "Free Delivery", subtitle: "Highly rated local favorites" },
            { id: "combos", type: "Combo Offers", title: "Mega Combo Savings", value: "Save up to ₹150", subtitle: "Perfect family meal boxes" },
            { id: "flash", type: "Flash Deals", title: "Lightning Flash Deals", value: "Up to 50% OFF", subtitle: "Ends in 20 minutes! Grab it fast" },
            { id: "weekend", type: "Weekend Specials", title: "Weekend Chill Treats", value: "Extra Cashback", subtitle: "Make your weekends special" },
            { id: "limited", type: "Limited-Time Offers", title: "Exclusive Chef Creations", value: "Premium Rewards", subtitle: "Specials crafted only for today" },
            { id: "new_launches", type: "New Shop Launches", title: "Welcome New Stores", value: "Flat ₹50 Coupon", subtitle: "Try out newly opened kitchens in your area" }
        ];

        return handleResponse(res, 200, "Promo offers fetched successfully", offers);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// 3. GET /api/orders/active (Public/Customer)
export const getActiveOrder = async (req, res) => {
    try {
        const customerId = req.user.id;

        const timeLimit = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours only

        const activeOrder = await Order.findOne({
            customer: customerId,
            createdAt: { $gte: timeLimit },
            workflowStatus: {
                $in: [
                    WORKFLOW_STATUS.CREATED,
                    WORKFLOW_STATUS.SELLER_PENDING,
                    WORKFLOW_STATUS.SELLER_ACCEPTED,
                    WORKFLOW_STATUS.DELIVERY_SEARCH,
                    WORKFLOW_STATUS.DELIVERY_ASSIGNED,
                    WORKFLOW_STATUS.PICKUP_READY,
                    WORKFLOW_STATUS.OUT_FOR_DELIVERY
                ]
            }
        })
        .populate("seller")
        .populate("deliveryBoy")
        .sort({ createdAt: -1 });

        if (!activeOrder) {
            const fallbackOrder = await Order.findOne({
                customer: customerId,
                createdAt: { $gte: timeLimit },
                status: { $in: ["pending", "confirmed", "packed", "out_for_delivery"] }
            })
            .populate("seller")
            .populate("deliveryBoy")
            .sort({ createdAt: -1 });

            if (fallbackOrder) {
                return handleResponse(res, 200, "Active order found (fallback)", fallbackOrder);
            }

            return handleResponse(res, 200, "No active order found", null);
        }

        return handleResponse(res, 200, "Active order found", activeOrder);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// 4. GET /api/orders/:id/status (Public/Customer)
export const getOrderStatusDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findById(id)
            .populate("seller")
            .populate("deliveryBoy");

        if (!order) {
            return handleResponse(res, 404, "Order not found");
        }

        return handleResponse(res, 200, "Order status fetched successfully", order);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// 5. GET /api/rider/location/:orderId (Public/Customer)
export const getRiderLocation = async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await Order.findOne({ orderId })
            .populate("seller")
            .populate("deliveryBoy");

        if (!order) {
            return handleResponse(res, 404, "Order not found");
        }

        let liveRiderLoc = null;
        try {
            const db = getFirebaseRealtimeDb();
            if (db) {
                const snapshot = await db.ref(`/orders/${order.orderId}/rider`).once("value");
                liveRiderLoc = snapshot.val();
            }
        } catch (firebaseErr) {
            console.error("Firebase read rider location error:", firebaseErr.message);
        }

        let riderCoords = null;
        let lastUpdatedAt = null;

        if (liveRiderLoc && typeof liveRiderLoc.lat === "number" && typeof liveRiderLoc.lng === "number") {
            riderCoords = { lat: liveRiderLoc.lat, lng: liveRiderLoc.lng };
            lastUpdatedAt = liveRiderLoc.lastUpdatedAt;
        } else if (order.deliveryBoy) {
            const deliveryBoy = await Delivery.findById(order.deliveryBoy);
            if (deliveryBoy && deliveryBoy.location && Array.isArray(deliveryBoy.location.coordinates)) {
                const [lng, lat] = deliveryBoy.location.coordinates;
                riderCoords = { lat, lng };
                lastUpdatedAt = deliveryBoy.lastLocationAt || deliveryBoy.updatedAt;
            }
        }

        if (!riderCoords) {
            const destLat = order.address?.location?.lat || 17.6145;
            const destLng = order.address?.location?.lng || 80.8925;
            const sellerLat = order.seller?.location?.coordinates?.[1] || 17.6105;
            const sellerLng = order.seller?.location?.coordinates?.[0] || 80.8875;

            riderCoords = {
                lat: (sellerLat + destLat) / 2,
                lng: (sellerLng + destLng) / 2
            };
            lastUpdatedAt = new Date().toISOString();
        }

        const payload = {
            orderId: order.orderId,
            riderId: order.deliveryBoy?._id || null,
            riderName: order.deliveryBoy?.fullName || "Delivery Partner",
            riderPhoto: order.deliveryBoy?.profileImage || "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100&auto=format&fit=crop&q=60",
            vehicleNumber: order.deliveryBoy?.vehicleNumber || "AP-28-XX-1234",
            riderLocation: riderCoords,
            customerLocation: order.address?.location || { lat: 17.6145, lng: 80.8925 },
            sellerLocation: order.seller?.location
                ? { lat: order.seller.location.coordinates[1], lng: order.seller.location.coordinates[0] }
                : { lat: 17.6105, lng: 80.8875 },
            lastLocationAt: lastUpdatedAt,
            eta: "8-12 mins",
            remainingDistanceKm: 1.8
        };

        return handleResponse(res, 200, "Rider location fetched successfully", payload);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// 6. GET /api/admin/banner/videos (Admin only)
export const getAdminBannerVideos = async (req, res) => {
    try {
        const dbConfigs = await BannerVideo.find({}).lean();
        
        // Map db configs and inject default fallback content for any missing slots
        const slots = ["morning", "afternoon", "evening", "night"];
        const results = slots.map(slot => {
            const match = dbConfigs.find(c => c.timeOfDay === slot);
            return match || DEFAULT_PROMO_CONTENT[slot];
        });

        return handleResponse(res, 200, "Admin banner timing configurations fetched", results);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// 7. PUT /api/admin/banner/videos (Admin only)
export const upsertAdminBannerVideo = async (req, res) => {
    try {
        const { timeOfDay, text, subtitle, cta, redirectUrl, videos } = req.body;

        if (!timeOfDay || !["morning", "afternoon", "evening", "night"].includes(timeOfDay)) {
            return handleResponse(res, 400, "Valid timeOfDay is required");
        }

        if (!text) {
            return handleResponse(res, 400, "Text is required");
        }

        const updated = await BannerVideo.findOneAndUpdate(
            { timeOfDay },
            {
                $set: {
                    text,
                    subtitle: subtitle || "",
                    cta: cta || "Shop Now",
                    redirectUrl: redirectUrl || "",
                    videos: Array.isArray(videos) ? videos : []
                }
            },
            { new: true, upsert: true }
        );

        return handleResponse(res, 200, "Banner timing configuration saved", updated);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
