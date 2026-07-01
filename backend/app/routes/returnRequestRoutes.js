import express from "express";
import multer from "multer";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import {
  getReturnEligibility,
  submitReturnRequest,
  getReturnRequestDetail,
  cancelReturnRequest,
  getSellerReturnRequests,
  approveReturnRequest,
  rejectReturnRequest,
  getAvailableDeliveryBoys,
  assignDeliveryBoy,
  reassignDeliveryBoy,
  getMyReturnTasks,
  acceptReturnTask,
  declineReturnTask,
  markPickedUp,
  markDeliveredToSeller,
  updateDeliveryBoyLocation,
  getAdminReturnRequests,
  overrideReturnRequest,
  initiateRefund,
  getAdminReturnStats,
  deliveryBoyLogin,
} from "../controller/returnRequestController.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ── CUSTOMER ROUTES ──────────────────────────────────────────────────────────
// Check return eligibility
router.get(
  "/orders/:orderId/return-eligibility",
  verifyToken,
  allowRoles("customer", "user", "admin"),
  getReturnEligibility
);

// Submit return request
router.post(
  "/orders/:orderId/return",
  verifyToken,
  allowRoles("customer", "user"),
  upload.array("images", 5),
  submitReturnRequest
);

// Get return request status
router.get(
  "/return-requests/:returnRequestId",
  verifyToken,
  allowRoles("customer", "user", "seller", "delivery_boy", "admin"),
  getReturnRequestDetail
);

// Cancel return request
router.delete(
  "/return-requests/:returnRequestId",
  verifyToken,
  allowRoles("customer", "user"),
  cancelReturnRequest
);

// ── SELLER ROUTES ────────────────────────────────────────────────────────────
// Get pending return requests
router.get(
  "/seller/return-requests",
  verifyToken,
  allowRoles("seller"),
  getSellerReturnRequests
);

// View return request detail (Alias matching requested routes structure)
router.get(
  "/seller/return-requests/:returnRequestId",
  verifyToken,
  allowRoles("seller"),
  getReturnRequestDetail
);

// Approve return
router.post(
  "/seller/return-requests/:returnRequestId/approve",
  verifyToken,
  allowRoles("seller"),
  approveReturnRequest
);

// Reject return
router.post(
  "/seller/return-requests/:returnRequestId/reject",
  verifyToken,
  allowRoles("seller"),
  rejectReturnRequest
);

// Get available delivery boys
router.get(
  "/seller/delivery-boys/available",
  verifyToken,
  allowRoles("seller"),
  getAvailableDeliveryBoys
);

// Assign delivery boy
router.post(
  "/seller/return-requests/:returnRequestId/assign-delivery-boy",
  verifyToken,
  allowRoles("seller"),
  assignDeliveryBoy
);

// Re-assign delivery boy
router.put(
  "/seller/return-requests/:returnRequestId/reassign-delivery-boy",
  verifyToken,
  allowRoles("seller"),
  reassignDeliveryBoy
);

// ── DELIVERY BOY ROUTES ──────────────────────────────────────────────────────
// Get my assigned return pickups
router.get(
  "/delivery-boy/return-tasks",
  verifyToken,
  allowRoles("delivery_boy", "admin"),
  getMyReturnTasks
);

// Accept task
router.post(
  "/delivery-boy/return-tasks/:returnRequestId/accept",
  verifyToken,
  allowRoles("delivery_boy"),
  acceptReturnTask
);

// Decline task
router.post(
  "/delivery-boy/return-tasks/:returnRequestId/decline",
  verifyToken,
  allowRoles("delivery_boy"),
  declineReturnTask
);

// Mark as picked up
router.post(
  "/delivery-boy/return-tasks/:returnRequestId/picked-up",
  verifyToken,
  allowRoles("delivery_boy"),
  upload.single("pickup_image"),
  markPickedUp
);

// Mark as delivered to seller
router.post(
  "/delivery-boy/return-tasks/:returnRequestId/delivered-to-seller",
  verifyToken,
  allowRoles("delivery_boy"),
  markDeliveredToSeller
);

// Update location
router.put(
  "/delivery-boy/location",
  verifyToken,
  allowRoles("delivery_boy"),
  updateDeliveryBoyLocation
);

// ── ADMIN ROUTES ─────────────────────────────────────────────────────────────
// Get all return requests (with filters)
router.get(
  "/admin/return-requests",
  verifyToken,
  allowRoles("admin"),
  getAdminReturnRequests
);

// Get return request detail
router.get(
  "/admin/return-requests/:returnRequestId",
  verifyToken,
  allowRoles("admin"),
  getReturnRequestDetail
);

// Force approve / override
router.post(
  "/admin/return-requests/:returnRequestId/override",
  verifyToken,
  allowRoles("admin"),
  overrideReturnRequest
);

// Initiate refund
router.post(
  "/admin/return-requests/:returnRequestId/initiate-refund",
  verifyToken,
  allowRoles("admin"),
  initiateRefund
);

// Dashboard stats
router.get(
  "/admin/return-requests/stats",
  verifyToken,
  allowRoles("admin"),
  getAdminReturnStats
);

// ── AUTHENTICATION / TESTING HELPERS ─────────────────────────────────────────
// Dev-only delivery boy login/seeding helper
router.post("/delivery-boy/login", deliveryBoyLogin);

export default router;
