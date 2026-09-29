import express from "express";
import { translateBatchController } from "../controller/translateController.js";
import { translateRateLimit } from "../middleware/translateRateLimit.js";

const router = express.Router();

// Public on purpose: the customer app needs UI/product translation before
// login too. Rate-limited instead of gated behind auth.
router.post("/batch", translateRateLimit, translateBatchController);

export default router;
