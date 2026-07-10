import express from "express";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import {
    getPromoVideos,
    getPromoOffers,
    getActiveOrder,
    getOrderStatusDetail,
    getRiderLocation,
    getAdminBannerVideos,
    upsertAdminBannerVideo
} from "../controller/bannerController.js";

const router = express.Router();

// Banner routes (Public/Customer)
router.get("/banner/videos", getPromoVideos);
router.get("/banner/offers", getPromoOffers);

// Active/tracking order routes (Public/Customer)
router.get("/orders/active", verifyToken, getActiveOrder);
router.get("/orders/:id/status", verifyToken, getOrderStatusDetail);
router.get("/rider/location/:orderId", verifyToken, getRiderLocation);

// Admin timing banner management routes
router.get("/admin/banner/videos", verifyToken, allowRoles("admin"), getAdminBannerVideos);
router.put("/admin/banner/videos", verifyToken, allowRoles("admin"), upsertAdminBannerVideo);

export default router;
