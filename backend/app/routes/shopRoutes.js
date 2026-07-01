import express from "express";
import {
  getShopById,
  getShopProducts,
  getShopReviews,
  getShopGallery,
  getSimilarShops
} from "../controller/shopController.js";

const router = express.Router();

router.get("/similar/:id", getSimilarShops);
router.get("/:id", getShopById);
router.get("/:id/products", getShopProducts);
router.get("/:id/reviews", getShopReviews);
router.get("/:id/gallery", getShopGallery);

export default router;
