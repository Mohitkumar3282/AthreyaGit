import express from "express";
import { verifyToken, allowRoles } from "../middleware/authMiddleware.js";
import {
  submitCancellationRequest,
  getCancellationRequestDetail,
  cancelCancellationRequest,
  getSellerCancellationRequests,
  approveCancellationRequest,
  rejectCancellationRequest,
  getAvailableDeliveryBoys,
  assignDeliveryBoy,
  reassignDeliveryBoy,
  getMyCancellationTasks,
  acceptCancellationTask,
  declineCancellationTask,
  getCancellationRequestByOrderId,
} from "../controller/cancellationRequestController.js";

const router = express.Router();

// ── CUSTOMER ROUTES ──────────────────────────────────────────────────────────
router.post(
  "/orders/:orderId/cancellation",
  verifyToken,
  allowRoles("customer", "user"),
  submitCancellationRequest
);

router.get(
  "/orders/:orderId/cancellation",
  verifyToken,
  allowRoles("customer", "user", "seller", "delivery_boy", "admin"),
  getCancellationRequestByOrderId
);

router.get(
  "/cancellation-requests/:cancellationRequestId",
  verifyToken,
  allowRoles("customer", "user", "seller", "delivery_boy", "admin"),
  getCancellationRequestDetail
);

router.delete(
  "/cancellation-requests/:cancellationRequestId",
  verifyToken,
  allowRoles("customer", "user"),
  cancelCancellationRequest
);

// ── SELLER ROUTES ────────────────────────────────────────────────────────────
router.get(
  "/seller/cancellation-requests",
  verifyToken,
  allowRoles("seller"),
  getSellerCancellationRequests
);

router.get(
  "/seller/cancellation-requests/:cancellationRequestId",
  verifyToken,
  allowRoles("seller"),
  getCancellationRequestDetail
);

router.post(
  "/seller/cancellation-requests/:cancellationRequestId/approve",
  verifyToken,
  allowRoles("seller"),
  approveCancellationRequest
);

router.post(
  "/seller/cancellation-requests/:cancellationRequestId/reject",
  verifyToken,
  allowRoles("seller"),
  rejectCancellationRequest
);

router.get(
  "/seller/cancellation-requests/delivery-boys/available",
  verifyToken,
  allowRoles("seller"),
  getAvailableDeliveryBoys
);

router.post(
  "/seller/cancellation-requests/:cancellationRequestId/assign-delivery-boy",
  verifyToken,
  allowRoles("seller"),
  assignDeliveryBoy
);

router.put(
  "/seller/cancellation-requests/:cancellationRequestId/reassign-delivery-boy",
  verifyToken,
  allowRoles("seller"),
  reassignDeliveryBoy
);

// ── DELIVERY BOY ROUTES ──────────────────────────────────────────────────────
router.get(
  "/delivery-boy/cancellation-tasks",
  verifyToken,
  allowRoles("delivery_boy", "admin"),
  getMyCancellationTasks
);

router.post(
  "/delivery-boy/cancellation-tasks/:cancellationRequestId/accept",
  verifyToken,
  allowRoles("delivery_boy"),
  acceptCancellationTask
);

router.post(
  "/delivery-boy/cancellation-tasks/:cancellationRequestId/decline",
  verifyToken,
  allowRoles("delivery_boy"),
  declineCancellationTask
);

export default router;
