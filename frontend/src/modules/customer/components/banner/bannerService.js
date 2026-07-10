import axiosInstance from "@/core/api/axios";

// Helper to get local mock data if the API fails or is unavailable
const getMockPromoVideos = () => {
    const hours = new Date().getHours();
    let timeOfDay = "night";
    let text = "Dinner Ready For Delivery";
    let subtitle = "Freshly Made Dinner Specials";
    let cta = "Shop Now";
    let videos = [
        { name: "Dinner Specials", url: "https://player.vimeo.com/external/403847952.sd.mp4?s=6c2ef6cfbf48c2656910a30b201a07ee4b7cb6f4&profile_id=165&oauth2_token_id=57447761" },
        { name: "Ice Cream & Desserts", url: "https://player.vimeo.com/external/385568551.sd.mp4?s=c855a90d8a5a5491176b68a8dc4e9a071bd1f148&profile_id=139&oauth2_token_id=57447761" }
    ];

    if (hours >= 7 && hours < 11) {
        timeOfDay = "morning";
        text = "Today's Breakfast Specials";
        subtitle = "Fresh & Hot – Order Now";
        cta = "Shop Now";
        videos = [
            { name: "Fresh Tiffins", url: "https://player.vimeo.com/external/371433846.sd.mp4?s=236da2f3ccee00f3d7df482f3c7e0c7b7440409a&profile_id=139&oauth2_token_id=57447761" },
            { name: "Milk Delivery", url: "https://player.vimeo.com/external/434045526.sd.mp4?s=c1b35cd3b4b60e6e96c4062142e47e3240212f7a&profile_id=165&oauth2_token_id=57447761" },
            { name: "Fresh Vegetables", url: "https://player.vimeo.com/external/371433846.sd.mp4?s=236da2f3ccee00f3d7df482f3c7e0c7b7440409a&profile_id=139&oauth2_token_id=57447761" }
        ];
    } else if (hours >= 11 && hours < 15) {
        timeOfDay = "afternoon";
        text = "Popular Lunch Specials";
        subtitle = "Freshly Prepared • Fast Delivery";
        cta = "Shop Now";
        videos = [
            { name: "Chicken Biryani", url: "https://player.vimeo.com/external/435674703.sd.mp4?s=7fcc186175ec206b744040a4cf0ca4180d5d71c8&profile_id=165&oauth2_token_id=57447761" },
            { name: "Restaurant Kitchen", url: "https://player.vimeo.com/external/435674703.sd.mp4?s=7fcc186175ec206b744040a4cf0ca4180d5d71c8&profile_id=165&oauth2_token_id=57447761" },
            { name: "Rider Pickup", url: "https://player.vimeo.com/external/459389137.sd.mp4?s=87ae077e69d4519d5113ab1e5da486719ee27ad5&profile_id=165&oauth2_token_id=57447761" }
        ];
    } else if (hours >= 15 && hours < 19) {
        timeOfDay = "evening";
        text = "Evening Snacks Available Near You";
        subtitle = "Order Fresh • Delivered Fast";
        cta = "Shop Now";
        videos = [
            { name: "Coffee & Tea", url: "https://player.vimeo.com/external/355159345.sd.mp4?s=d94eb38e0b12bc1a80c98e16cc1aa6e2d1d57545&profile_id=139&oauth2_token_id=57447761" },
            { name: "Bakery & Snacks", url: "https://player.vimeo.com/external/430852026.sd.mp4?s=7e937d57833a6f4e6676cf00344445582f3c7d6a&profile_id=165&oauth2_token_id=57447761" }
        ];
    }

    return { timeOfDay, text, subtitle, cta, videos };
};

const getMockPromoOffers = () => {
    return [
        { id: "festive", type: "Festival Offers", title: "Festival Feast Specials", value: "Flat 20% OFF", subtitle: "Celebrate with top delicacies from nearby shops" },
        { id: "bestsellers", type: "Today's Best Sellers", title: "Today's Hot Picks", value: "Buy 1 Get 1 Free", subtitle: "Most ordered dishes right now in Aswapuram" },
        { id: "trending", type: "Trending Shops", title: "Trending Stores Near You", value: "Free Delivery", subtitle: "Highly rated local favorites" },
        { id: "combos", type: "Combo Offers", title: "Mega Combo Savings", value: "Save up to ₹150", subtitle: "Perfect family meal boxes" },
        { id: "flash", type: "Flash Deals", title: "Lightning Flash Deals", value: "Up to 50% OFF", subtitle: "Ends in 20 minutes! Grab it fast" },
        { id: "weekend", type: "Weekend Specials", title: "Weekend Chill Treats", value: "Extra Cashback", subtitle: "Make your weekends special" },
        { id: "limited", type: "Limited-Time Offers", title: "Exclusive Chef Creations", value: "Premium Rewards", subtitle: "Specials crafted only for today" },
        { id: "new_launches", type: "New Shop Launches", title: "Welcome New Stores", value: "Flat ₹50 Coupon", subtitle: "Try out newly opened kitchens in your area" }
    ];
};

export const bannerService = {
    getVideos: async () => {
        try {
            const res = await axiosInstance.get("/banner/videos");
            if (res.data?.success && res.data?.result) {
                return res.data.result;
            }
            return getMockPromoVideos();
        } catch (e) {
            console.warn("[bannerService] Failed to load videos, falling back to mock", e);
            return getMockPromoVideos();
        }
    },
    getOffers: async () => {
        try {
            const res = await axiosInstance.get("/banner/offers");
            if (res.data?.success && res.data?.result) {
                return res.data.result;
            }
            return getMockPromoOffers();
        } catch (e) {
            console.warn("[bannerService] Failed to load offers, falling back to mock", e);
            return getMockPromoOffers();
        }
    },
    getActiveOrder: async () => {
        try {
            const res = await axiosInstance.get("/orders/active");
            if (res.data?.success && res.data?.result) {
                return res.data.result;
            }
            return null;
        } catch (e) {
            console.warn("[bannerService] Failed to load active order", e);
            return null;
        }
    },
    getOrderStatus: async (orderId) => {
        try {
            const res = await axiosInstance.get(`/orders/${orderId}/status`);
            if (res.data?.success && res.data?.result) {
                return res.data.result;
            }
            return null;
        } catch (e) {
            console.warn("[bannerService] Failed to get order status", e);
            return null;
        }
    },
    getRiderLocation: async (orderId) => {
        try {
            const res = await axiosInstance.get(`/rider/location/${orderId}`);
            if (res.data?.success && res.data?.result) {
                return res.data.result;
            }
            return null;
        } catch (e) {
            console.warn("[bannerService] Failed to get rider location", e);
            return null;
        }
    }
};
