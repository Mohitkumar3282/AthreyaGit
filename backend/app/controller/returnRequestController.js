import ReturnRequest from "../models/returnRequest.js";
import Order from "../models/order.js";
import DeliveryBoy from "../models/deliveryBoy.js";
import Delivery from "../models/delivery.js";
import Seller from "../models/seller.js";
import User from "../models/customer.js";
import Transaction from "../models/transaction.js";
import { uploadToCloudinary } from "../services/mediaService.js";
import handleResponse from "../utils/helper.js";
import getPagination from "../utils/pagination.js";
import { emitNotificationEvent } from "../modules/notifications/notification.emitter.js";
import { NOTIFICATION_EVENTS } from "../modules/notifications/notification.constants.js";
import { emitToSeller, emitToCustomer, emitToDelivery } from "../services/orderSocketEmitter.js";
import * as walletService from "../services/finance/walletService.js";
import { LEDGER_TRANSACTION_TYPE, OWNER_TYPE } from "../constants/finance.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

// Helper for status transition verification
const VALID_TRANSITIONS = {
  REQUESTED: ["SELLER_APPROVED", "SELLER_REJECTED", "CANCELLED"],
  SELLER_APPROVED: ["PICKUP_SCHEDULED", "CANCELLED"],
  PICKUP_SCHEDULED: ["PICKED_UP", "SELLER_APPROVED"],
  PICKED_UP: ["DELIVERED_TO_SELLER", "REFUND_INITIATED"],
  DELIVERED_TO_SELLER: ["REFUND_INITIATED", "UNDER_DISPUTE"],
  REFUND_INITIATED: ["REFUND_INITIATED", "REFUND_COMPLETED"],
  REFUND_COMPLETED: ["CLOSED"],
  UNDER_DISPUTE: ["REFUND_INITIATED", "SELLER_REJECTED"]
};

function isValidTransition(oldStatus, newStatus) {
  const allowed = VALID_TRANSITIONS[oldStatus];
  return allowed && allowed.includes(newStatus);
}

// ── CUSTOMER CONTROLLERS ─────────────────────────────────────────────────────

// GET /api/orders/:orderId/return-eligibility
export const getReturnEligibility = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findOne({ orderId });
    if (!order) {
      return handleResponse(res, 404, "Order not found");
    }

    const deliveredAtTime = order.delivered_at || order.deliveredAt;
    if (!deliveredAtTime) {
      return handleResponse(res, 200, "Return eligibility fetched", {
        eligible: false,
        reason: "non_returnable",
        time_remaining_seconds: null,
        return_deadline: null
      });
    }

    const existingRequest = await ReturnRequest.findOne({ order_id: order._id, status: { $ne: "CANCELLED" } });
    if (existingRequest) {
      return handleResponse(res, 200, "Return eligibility fetched", {
        eligible: false,
        reason: "already_requested",
        time_remaining_seconds: null,
        return_deadline: new Date(deliveredAtTime.getTime() + 2 * 60 * 60 * 1000).toISOString()
      });
    }

    const deadline = new Date(deliveredAtTime.getTime() + 2 * 60 * 60 * 1000);
    const now = new Date();
    const remainingMs = deadline.getTime() - now.getTime();

    if (remainingMs <= 0) {
      return handleResponse(res, 200, "Return eligibility fetched", {
        eligible: false,
        reason: "window_expired",
        time_remaining_seconds: null,
        return_deadline: deadline.toISOString()
      });
    }

    return handleResponse(res, 200, "Return eligibility fetched", {
      eligible: true,
      reason: "within_window",
      time_remaining_seconds: Math.floor(remainingMs / 1000),
      return_deadline: deadline.toISOString()
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// POST /api/orders/:orderId/return (multipart/form-data)
export const submitReturnRequest = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason, reason_description } = req.body;
    const files = req.files || [];

    const order = await Order.findOne({ orderId });
    if (!order) {
      return handleResponse(res, 404, "Order not found");
    }

    // Verify order customer mapping
    if (order.customer.toString() !== req.user.id) {
      return handleResponse(res, 403, "Access denied. Order does not belong to you.");
    }

    // Verify order delivery status
    const deliveredAtTime = order.delivered_at || order.deliveredAt;
    if (!deliveredAtTime) {
      return handleResponse(res, 400, "Return can only be requested for delivered orders.");
    }

    // Verify time window
    const deadline = new Date(deliveredAtTime.getTime() + 2 * 60 * 60 * 1000);
    if (new Date() > deadline) {
      return handleResponse(res, 400, "Return window has expired (2-hour limit).");
    }

    // Verify duplicate return requests
    const existingRequest = await ReturnRequest.findOne({ order_id: order._id, status: { $ne: "CANCELLED" } });
    if (existingRequest) {
      return handleResponse(res, 409, "Return request already exists for this order.");
    }

    // Validate images
    if (!files || files.length < 1 || files.length > 5) {
      return handleResponse(res, 400, "Product images are required (min 1, max 5 images).");
    }

    // Upload to Cloudinary
    const product_images = [];
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        return handleResponse(res, 400, "Maximum image size allowed is 5MB.");
      }
      const url = await uploadToCloudinary(file.buffer, "media/returns", {
        mimeType: file.mimetype,
        resourceType: "image"
      });
      product_images.push(url);
    }

    // Calculate refund amount
    const subtotal = order.paymentBreakdown?.productSubtotal || order.pricing?.subtotal || 0;
    const refund_amount = subtotal;

    const returnRequest = await ReturnRequest.create({
      order_id: order._id,
      customer_id: req.user.id,
      seller_id: order.seller,
      status: "REQUESTED",
      reason,
      reason_description: reason_description || "",
      product_images,
      refund_amount,
      delivered_at: deliveredAtTime,
      return_deadline: deadline,
      status_history: [
        {
          status: "REQUESTED",
          changed_by: "customer",
          note: "Return request submitted"
        }
      ]
    });

    order.return_request_id = returnRequest._id;
    order.returnStatus = "return_requested";
    await order.save();

    // Notify seller
    emitToSeller(order.seller.toString(), {
      event: "return:new",
      payload: { returnRequestId: returnRequest.id, orderId }
    });

    emitNotificationEvent(NOTIFICATION_EVENTS.RETURN_REQUESTED, {
      orderId: order.orderId,
      sellerId: order.seller,
      customerId: req.user.id,
      data: { reason }
    });

    return handleResponse(res, 201, "Return request submitted successfully", {
      success: true,
      return_request_id: returnRequest.id,
      status: returnRequest.status,
      message: "Return request submitted successfully"
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// GET /api/return-requests/:returnRequestId
export const getReturnRequestDetail = async (req, res) => {
  try {
    const { returnRequestId } = req.params;
    const returnRequest = await ReturnRequest.findById(returnRequestId)
      .populate("order_id")
      .populate("customer_id", "name phone")
      .populate("seller_id", "shopName address name location phone")
      .populate("delivery_boy_id", "name phone rating");

    if (!returnRequest) {
      return handleResponse(res, 404, "Return request not found");
    }

    // Security check: restrict access
    const { id: userId, role } = req.user;
    if (role === "customer" && returnRequest.customer_id._id.toString() !== userId) {
      return handleResponse(res, 403, "Access denied");
    }
    if (role === "seller" && returnRequest.seller_id._id.toString() !== userId) {
      return handleResponse(res, 403, "Access denied");
    }
    if (role === "delivery_boy" && returnRequest.delivery_boy_id?._id?.toString() !== userId) {
      return handleResponse(res, 403, "Access denied");
    }

    return handleResponse(res, 200, "Return request detail fetched", returnRequest);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// DELETE /api/return-requests/:returnRequestId
export const cancelReturnRequest = async (req, res) => {
  try {
    const { returnRequestId } = req.params;
    const returnRequest = await ReturnRequest.findById(returnRequestId);
    if (!returnRequest) {
      return handleResponse(res, 404, "Return request not found");
    }

    if (returnRequest.customer_id.toString() !== req.user.id) {
      return handleResponse(res, 403, "Access denied");
    }

    if (returnRequest.status !== "REQUESTED") {
      return handleResponse(res, 400, "Cancel only allowed when status is REQUESTED");
    }

    returnRequest.status = "CANCELLED";
    returnRequest.status_history.push({
      status: "CANCELLED",
      changed_by: "customer",
      note: "Cancelled by customer"
    });
    await returnRequest.save();

    // Also update parent Order status
    const order = await Order.findById(returnRequest.order_id);
    if (order) {
      order.returnStatus = "none";
      await order.save();
    }

    return handleResponse(res, 200, "Return request cancelled successfully", {
      success: true,
      returnRequestId: returnRequest.id,
      status: returnRequest.status
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// ── SELLER CONTROLLERS ───────────────────────────────────────────────────────

// GET /api/seller/return-requests
export const getSellerReturnRequests = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { status, page = 1, limit = 20 } = req.query;

    const query = { seller_id: sellerId };
    if (status) {
      query.status = status;
    }

    const skipIndex = (page - 1) * limit;
    const total = await ReturnRequest.countDocuments(query);
    const returnRequests = await ReturnRequest.find(query)
      .populate("customer_id", "name phone")
      .populate("order_id")
      .sort({ createdAt: -1 })
      .skip(skipIndex)
      .limit(Number(limit));

    return handleResponse(res, 200, "Seller return requests fetched", {
      return_requests: returnRequests,
      total,
      page: Number(page),
      limit: Number(limit)
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// POST /api/seller/return-requests/:returnRequestId/approve
export const approveReturnRequest = async (req, res) => {
  try {
    const { returnRequestId } = req.params;
    const { note } = req.body;
    const returnRequest = await ReturnRequest.findById(returnRequestId);

    if (!returnRequest || returnRequest.seller_id.toString() !== req.user.id) {
      return handleResponse(res, 404, "Return request not found");
    }

    if (!isValidTransition(returnRequest.status, "SELLER_APPROVED")) {
      return handleResponse(res, 400, "Invalid status transition");
    }

    returnRequest.status = "SELLER_APPROVED";
    returnRequest.seller_note = note || "";
    returnRequest.seller_action_at = new Date();
    returnRequest.status_history.push({
      status: "SELLER_APPROVED",
      changed_by: "seller",
      note: note || "Return approved by seller"
    });
    await returnRequest.save();

    // Also update parent Order
    const order = await Order.findById(returnRequest.order_id);
    if (order) {
      order.returnStatus = "return_approved";
      await order.save();
    }

    // Trigger push notification to customer
    emitToCustomer(returnRequest.customer_id.toString(), {
      event: "return:approved",
      payload: { returnRequestId: returnRequest.id, status: returnRequest.status }
    });

    emitNotificationEvent(NOTIFICATION_EVENTS.RETURN_APPROVED, {
      customerId: returnRequest.customer_id,
      orderId: returnRequest.order_id
    });

    return handleResponse(res, 200, "Return request approved", returnRequest);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// POST /api/seller/return-requests/:returnRequestId/reject
export const rejectReturnRequest = async (req, res) => {
  try {
    const { returnRequestId } = req.params;
    const { note } = req.body;

    if (!note || typeof note !== "string" || note.trim().length === 0) {
      return handleResponse(res, 400, "Rejection note is required");
    }

    const returnRequest = await ReturnRequest.findById(returnRequestId);
    if (!returnRequest || returnRequest.seller_id.toString() !== req.user.id) {
      return handleResponse(res, 404, "Return request not found");
    }

    if (!isValidTransition(returnRequest.status, "SELLER_REJECTED")) {
      return handleResponse(res, 400, "Invalid status transition");
    }

    returnRequest.status = "SELLER_REJECTED";
    returnRequest.seller_note = note;
    returnRequest.seller_action_at = new Date();
    returnRequest.status_history.push({
      status: "SELLER_REJECTED",
      changed_by: "seller",
      note: note
    });
    await returnRequest.save();

    // Also update parent Order
    const order = await Order.findById(returnRequest.order_id);
    if (order) {
      order.returnStatus = "return_rejected";
      await order.save();
    }

    // Trigger push to customer
    emitToCustomer(returnRequest.customer_id.toString(), {
      event: "return:rejected",
      payload: { returnRequestId: returnRequest.id, status: returnRequest.status, note }
    });

    emitNotificationEvent(NOTIFICATION_EVENTS.RETURN_REJECTED, {
      customerId: returnRequest.customer_id,
      orderId: returnRequest.order_id,
      data: { reason: note }
    });

    return handleResponse(res, 200, "Return request rejected", returnRequest);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// GET /api/seller/delivery-boys/available?return_request_id=xxx
export const getAvailableDeliveryBoys = async (req, res) => {
  try {
    const { return_request_id } = req.query;
    const returnRequest = await ReturnRequest.findById(return_request_id).populate("order_id");

    if (!returnRequest) {
      return handleResponse(res, 404, "Return request not found");
    }

    const order = await Order.findById(returnRequest.order_id);
    if (!order || !order.address?.location) {
      return handleResponse(res, 400, "Customer location details missing from order");
    }

    const customerLat = order.address.location.lat;
    const customerLng = order.address.location.lng;
    const sellerRadiusMeters = 10000; // 10km config

    // DEBUG LOGS (Fix 6)
    const sellerId = req.user.id;
    const allBoys = await DeliveryBoy.find({ seller_id: sellerId });
    console.log("Total boys for seller (Returns):", allBoys.length);
    console.log("Boys data:", JSON.stringify(allBoys));

    // Fetch online delivery riders
    const onlineRiders = await Delivery.find({ isOnline: true }).select("_id").lean();
    const onlineRiderIds = onlineRiders.map((r) => r._id);

    // Query active/available boys near customer coordinates
    let availableBoys = await DeliveryBoy.find({
      seller_id: sellerId,
      is_active: true,
      $or: [
        { is_available: true },
        { _id: { $in: onlineRiderIds } }
      ],
      current_location: {
        $nearSphere: {
          $geometry: { type: "Point", coordinates: [customerLng, customerLat] },
          $maxDistance: sellerRadiusMeters
        }
      }
    });
    console.log("Available boys after filter (Returns):", availableBoys.length);

    // Fallback: If no boys found within radius, fallback to all active & available delivery boys for this seller (geography relaxed)
    if (availableBoys.length === 0) {
      console.log("No available boys found within radius. Falling back to all active & available boys of seller...");
      availableBoys = await DeliveryBoy.find({
        seller_id: sellerId,
        is_active: true,
        $or: [
          { is_available: true },
          { _id: { $in: onlineRiderIds } }
        ]
      });
      console.log("Fallback available boys:", availableBoys.length);
    }

    // Format list including distance in km
    const delivery_boys = await Promise.all(
      availableBoys.map(async (boy) => {
        let distance_km = 999.9;
        if (boy.current_location && boy.current_location.coordinates) {
          const boyLng = boy.current_location.coordinates[0];
          const boyLat = boy.current_location.coordinates[1];
          
          // Haversine formula to compute distance
          const R = 6371; // km
          const dLat = ((boyLat - customerLat) * Math.PI) / 180;
          const dLng = ((boyLng - customerLng) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((customerLat * Math.PI) / 180) *
              Math.cos((boyLat * Math.PI) / 180) *
              Math.sin(dLng / 2) *
              Math.sin(dLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          distance_km = Number((R * c).toFixed(1));
        }

        return {
          id: boy.id,
          name: boy.name,
          phone: boy.phone,
          distance_km,
          rating: boy.rating || 5.0,
          is_available: boy.is_available
        };
      })
    );

    // Sort by distance ASC
    delivery_boys.sort((a, b) => a.distance_km - b.distance_km);

    return handleResponse(res, 200, "Available delivery boys fetched", {
      delivery_boys,
      total: delivery_boys.length
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// POST /api/seller/return-requests/:returnRequestId/assign-delivery-boy
export const assignDeliveryBoy = async (req, res) => {
  try {
    const { returnRequestId } = req.params;
    const { delivery_boy_id } = req.body;

    const returnRequest = await ReturnRequest.findById(returnRequestId);
    if (!returnRequest || returnRequest.seller_id.toString() !== req.user.id) {
      return handleResponse(res, 404, "Return request not found");
    }

    if (!isValidTransition(returnRequest.status, "PICKUP_SCHEDULED")) {
      return handleResponse(res, 400, "Assignment is only allowed when status is SELLER_APPROVED");
    }

    const deliveryBoy = await DeliveryBoy.findById(delivery_boy_id);
    if (!deliveryBoy || deliveryBoy.seller_id.toString() !== req.user.id) {
      return handleResponse(res, 404, "Delivery boy not found or doesn't belong to you");
    }

    const delivery = await Delivery.findById(deliveryBoy._id).lean();
    const isOnline = delivery?.isOnline === true;
    if (!deliveryBoy.is_active || (!deliveryBoy.is_available && !isOnline)) {
      return handleResponse(res, 400, "Delivery boy is offline or busy");
    }

    // Set delivery boy busy
    deliveryBoy.is_available = false;
    await deliveryBoy.save();

    returnRequest.delivery_boy_id = deliveryBoy._id;
    returnRequest.status = "PICKUP_SCHEDULED";
    returnRequest.pickup_scheduled_at = new Date();
    returnRequest.status_history.push({
      status: "PICKUP_SCHEDULED",
      changed_by: "seller",
      note: `Assigned to delivery partner ${deliveryBoy.name}`
    });
    await returnRequest.save();

    // Also update parent Order so OTP generation logic functions correctly
    const order = await Order.findById(returnRequest.order_id);
    if (order) {
      order.returnStatus = "return_pickup_assigned";
      order.returnDeliveryBoy = deliveryBoy._id;
      await order.save();
    }

    // Sockets & Notifications
    emitToDelivery(deliveryBoy._id.toString(), {
      event: "return:task:assigned",
      payload: { returnRequestId: returnRequest.id, status: returnRequest.status }
    });

    emitToCustomer(returnRequest.customer_id.toString(), {
      event: "return:pickup:scheduled",
      payload: { returnRequestId: returnRequest.id, deliveryBoyName: deliveryBoy.name }
    });

    emitNotificationEvent(NOTIFICATION_EVENTS.RETURN_PICKUP_ASSIGNED, {
      deliveryId: deliveryBoy._id,
      orderId: returnRequest.order_id,
      customerId: returnRequest.customer_id,
      data: { commission: 15 } // Mock commission
    });

    return handleResponse(res, 200, "Delivery boy assigned successfully", returnRequest);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// PUT /api/seller/return-requests/:returnRequestId/reassign-delivery-boy
export const reassignDeliveryBoy = async (req, res) => {
  try {
    const { returnRequestId } = req.params;
    const { delivery_boy_id } = req.body;

    const returnRequest = await ReturnRequest.findById(returnRequestId);
    if (!returnRequest || returnRequest.seller_id.toString() !== req.user.id) {
      return handleResponse(res, 404, "Return request not found");
    }

    if (returnRequest.status !== "PICKUP_SCHEDULED" && returnRequest.status !== "SELLER_APPROVED") {
      return handleResponse(res, 400, "Reassignment only allowed for scheduled or approved return requests");
    }

    const previousBoyId = returnRequest.delivery_boy_id;
    if (previousBoyId) {
      const prevBoy = await DeliveryBoy.findById(previousBoyId);
      if (prevBoy) {
        prevBoy.is_available = true;
        await prevBoy.save();

        // Notify previous boy
        emitToDelivery(previousBoyId.toString(), {
          event: "return:task:cancelled",
          payload: { returnRequestId: returnRequest.id }
        });
      }
    }

    const newBoy = await DeliveryBoy.findById(delivery_boy_id);
    if (!newBoy || newBoy.seller_id.toString() !== req.user.id) {
      return handleResponse(res, 404, "New delivery boy not found or doesn't belong to you");
    }

    const delivery = await Delivery.findById(newBoy._id).lean();
    const isOnline = delivery?.isOnline === true;
    if (!newBoy.is_active || (!newBoy.is_available && !isOnline)) {
      return handleResponse(res, 400, "New delivery boy is offline or busy");
    }

    // Set new boy busy
    newBoy.is_available = false;
    await newBoy.save();

    returnRequest.delivery_boy_id = newBoy._id;
    returnRequest.status = "PICKUP_SCHEDULED";
    returnRequest.pickup_scheduled_at = new Date();
    returnRequest.status_history.push({
      status: "PICKUP_SCHEDULED",
      changed_by: "seller",
      note: `Reassigned from ${previousBoyId ? "previous" : "none"} to ${newBoy.name}`
    });
    await returnRequest.save();

    // Also update parent Order so OTP generation logic functions correctly
    const order = await Order.findById(returnRequest.order_id);
    if (order) {
      order.returnStatus = "return_pickup_assigned";
      order.returnDeliveryBoy = newBoy._id;
      await order.save();
    }

    // Sockets & Notifications
    emitToDelivery(newBoy._id.toString(), {
      event: "return:task:assigned",
      payload: { returnRequestId: returnRequest.id }
    });

    emitToCustomer(returnRequest.customer_id.toString(), {
      event: "return:pickup:scheduled",
      payload: { returnRequestId: returnRequest.id, deliveryBoyName: newBoy.name }
    });

    return handleResponse(res, 200, "Delivery boy reassigned successfully", returnRequest);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// ── DELIVERY BOY CONTROLLERS ─────────────────────────────────────────────────

// GET /api/delivery-boy/return-tasks
export const getMyReturnTasks = async (req, res) => {
  try {
    const returnTasks = await ReturnRequest.find({
      delivery_boy_id: req.user.id,
      status: { $in: ["PICKUP_SCHEDULED", "PICKED_UP", "DELIVERED_TO_SELLER"] }
    })
      .populate("order_id")
      .populate("customer_id", "name phone")
      .sort({ updatedAt: -1 });

    return handleResponse(res, 200, "My return tasks fetched", returnTasks);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// POST /api/delivery-boy/return-tasks/:returnRequestId/accept
export const acceptReturnTask = async (req, res) => {
  try {
    const { returnRequestId } = req.params;
    const returnRequest = await ReturnRequest.findOne({
      _id: returnRequestId,
      delivery_boy_id: req.user.id
    }).populate("order_id");

    if (!returnRequest) {
      return handleResponse(res, 404, "Return task not found or not assigned to you");
    }

    returnRequest.status_history.push({
      status: returnRequest.status,
      changed_by: "delivery_boy",
      note: "Delivery partner accepted return pickup task"
    });
    await returnRequest.save();

    // Notify customer and seller
    emitToCustomer(returnRequest.customer_id.toString(), {
      event: "return:task:accepted",
      payload: { returnRequestId: returnRequest.id }
    });
    emitToSeller(returnRequest.seller_id.toString(), {
      event: "return:task:accepted",
      payload: { returnRequestId: returnRequest.id }
    });

    return handleResponse(res, 200, "Task accepted successfully", returnRequest);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// POST /api/delivery-boy/return-tasks/:returnRequestId/decline
export const declineReturnTask = async (req, res) => {
  try {
    const { returnRequestId } = req.params;
    const { reason } = req.body;

    const returnRequest = await ReturnRequest.findOne({
      _id: returnRequestId,
      delivery_boy_id: req.user.id
    });

    if (!returnRequest) {
      return handleResponse(res, 404, "Return task not found or not assigned to you");
    }

    const deliveryBoy = await DeliveryBoy.findById(req.user.id);
    if (deliveryBoy) {
      deliveryBoy.is_available = true;
      await deliveryBoy.save();
    }

    // Reset status back to seller approved
    returnRequest.delivery_boy_id = null;
    returnRequest.status = "SELLER_APPROVED";
    returnRequest.status_history.push({
      status: "SELLER_APPROVED",
      changed_by: "delivery_boy",
      note: `Declined: ${reason || "No reason given"}`
    });
    await returnRequest.save();

    // Also update parent Order
    const order = await Order.findById(returnRequest.order_id);
    if (order) {
      order.returnStatus = "return_approved";
      order.returnDeliveryBoy = null;
      await order.save();
    }

    // Notify seller
    emitToSeller(returnRequest.seller_id.toString(), {
      event: "return:task:declined",
      payload: { returnRequestId: returnRequest.id, reason }
    });

    return handleResponse(res, 200, "Task declined successfully", returnRequest);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// POST /api/delivery-boy/return-tasks/:returnRequestId/picked-up
export const markPickedUp = async (req, res) => {
  try {
    const { returnRequestId } = req.params;
    const file = req.file;

    const returnRequest = await ReturnRequest.findOne({
      _id: returnRequestId,
      delivery_boy_id: req.user.id
    });

    if (!returnRequest) {
      return handleResponse(res, 404, "Return task not found");
    }

    if (!isValidTransition(returnRequest.status, "PICKED_UP")) {
      return handleResponse(res, 400, "Invalid status transition");
    }

    let pickupImageUrl = "";
    if (file) {
      pickupImageUrl = await uploadToCloudinary(file.buffer, "media/returns/proofs", {
        mimeType: file.mimetype,
        resourceType: "image"
      });
    }

    returnRequest.status = "PICKED_UP";
    returnRequest.picked_up_at = new Date();
    returnRequest.status_history.push({
      status: "PICKED_UP",
      changed_by: "delivery_boy",
      note: "Item picked up from customer" + (pickupImageUrl ? ` (Proof: ${pickupImageUrl})` : "")
    });
    await returnRequest.save();

    // Also update parent Order
    const order = await Order.findById(returnRequest.order_id);
    if (order) {
      order.returnStatus = "return_in_transit";
      order.returnPickedAt = new Date();
      await order.save();
    }

    // Notify customer and seller
    emitToCustomer(returnRequest.customer_id.toString(), {
      event: "return:picked_up",
      payload: { returnRequestId: returnRequest.id }
    });
    emitToSeller(returnRequest.seller_id.toString(), {
      event: "return:picked_up",
      payload: { returnRequestId: returnRequest.id }
    });

    return handleResponse(res, 200, "Task marked as picked up", returnRequest);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// POST /api/delivery-boy/return-tasks/:returnRequestId/delivered-to-seller
export const markDeliveredToSeller = async (req, res) => {
  try {
    const { returnRequestId } = req.params;

    const returnRequest = await ReturnRequest.findOne({
      _id: returnRequestId,
      delivery_boy_id: req.user.id
    });

    if (!returnRequest) {
      return handleResponse(res, 404, "Return task not found");
    }

    if (!isValidTransition(returnRequest.status, "DELIVERED_TO_SELLER")) {
      return handleResponse(res, 400, "Invalid status transition");
    }

    const deliveryBoy = await DeliveryBoy.findById(req.user.id);
    if (deliveryBoy) {
      deliveryBoy.is_available = true;
      deliveryBoy.total_pickups += 1;
      await deliveryBoy.save();
    }

    returnRequest.status = "DELIVERED_TO_SELLER";
    returnRequest.delivered_to_seller_at = new Date();
    returnRequest.status_history.push({
      status: "DELIVERED_TO_SELLER",
      changed_by: "delivery_boy",
      note: "Returned package delivered to seller store"
    });
    await returnRequest.save();

    // Also update parent Order
    const order = await Order.findById(returnRequest.order_id);
    if (order) {
      order.returnStatus = "returned";
      order.returnDeliveredBackAt = new Date();
      await order.save();
    }

    // Notify seller
    emitToSeller(returnRequest.seller_id.toString(), {
      event: "return:delivered_to_seller",
      payload: { returnRequestId: returnRequest.id }
    });

    return handleResponse(res, 200, "Task marked as delivered to seller", returnRequest);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// PUT /api/delivery-boy/location
export const updateDeliveryBoyLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (typeof lat !== "number" || typeof lng !== "number") {
      return handleResponse(res, 400, "lat and lng are required and must be numbers");
    }

    const deliveryBoy = await DeliveryBoy.findById(req.user.id);
    if (!deliveryBoy) {
      return handleResponse(res, 404, "Delivery boy not found");
    }

    deliveryBoy.current_location = {
      type: "Point",
      coordinates: [lng, lat]
    };
    deliveryBoy.last_seen_at = new Date();
    await deliveryBoy.save();

    return handleResponse(res, 200, "Location updated successfully", {
      lat,
      lng,
      last_seen_at: deliveryBoy.last_seen_at
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// ── ADMIN CONTROLLERS ────────────────────────────────────────────────────────

// GET /api/admin/return-requests
export const getAdminReturnRequests = async (req, res) => {
  try {
    const { status, seller_id, from_date, to_date, page = 1, limit = 50 } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }
    if (seller_id) {
      query.seller_id = seller_id;
    }
    if (from_date || to_date) {
      query.createdAt = {};
      if (from_date) {
        query.createdAt.$gte = new Date(from_date);
      }
      if (to_date) {
        query.createdAt.$lte = new Date(to_date);
      }
    }

    const skipIndex = (page - 1) * limit;
    const total = await ReturnRequest.countDocuments(query);
    const returnRequests = await ReturnRequest.find(query)
      .populate("customer_id", "name phone")
      .populate("seller_id", "shopName name")
      .populate("order_id")
      .sort({ createdAt: -1 })
      .skip(skipIndex)
      .limit(Number(limit));

    // Get count breakdown by status
    const statusCounts = await ReturnRequest.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    const by_status = statusCounts.reduce((acc, current) => {
      acc[current._id] = current.count;
      return acc;
    }, {});

    return handleResponse(res, 200, "Admin return requests fetched", {
      return_requests: returnRequests,
      total,
      by_status,
      page: Number(page),
      limit: Number(limit)
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// POST /api/admin/return-requests/:returnRequestId/override
export const overrideReturnRequest = async (req, res) => {
  try {
    const { returnRequestId } = req.params;
    const { action, note } = req.body;

    const returnRequest = await ReturnRequest.findById(returnRequestId);
    if (!returnRequest) {
      return handleResponse(res, 404, "Return request not found");
    }

    let targetStatus;
    const finalRefundAmount = returnRequest.refund_amount || 0;
    const finalMethod = returnRequest.refund_method || "wallet";

    if (action === "approve") {
      targetStatus = "SELLER_APPROVED";
      returnRequest.seller_action_at = new Date();
    } else if (action === "reject") {
      targetStatus = "SELLER_REJECTED";
      returnRequest.seller_action_at = new Date();
    } else if (action === "initiate_refund") {
      targetStatus = "REFUND_COMPLETED";
      returnRequest.refund_initiated_at = new Date();
      returnRequest.refund_completed_at = new Date();

      // Execute Money Flow
      let txnReference = `REF-WALLET-${Date.now()}`;
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          // If method is wallet, credit customer's wallet
          if (finalMethod === "wallet") {
            await walletService.creditWallet({
              ownerType: OWNER_TYPE.CUSTOMER,
              ownerId: returnRequest.customer_id,
              amount: finalRefundAmount,
              bucket: "available",
              session,
              ledgerType: LEDGER_TRANSACTION_TYPE.WALLET_REFUND,
              ledgerReference: txnReference,
              ledgerDescription: `Return request refund for Order #${returnRequest.order_id}`,
              idempotencyKey: `RETURN-REFUND-${returnRequest._id}`,
              metadata: { source: "admin_override_initiate_refund" }
            });

            await Transaction.create(
              [
                {
                  user: returnRequest.customer_id,
                  userModel: "User",
                  type: "Refund",
                  amount: finalRefundAmount,
                  status: "Settled",
                  reference: `${txnReference}-CUST`,
                  meta: { orderId: returnRequest.order_id, type: "return_wallet" }
                }
              ],
              { session }
            );
          }
          
          // Debit seller wallet to recover refund cost
          const order = await Order.findById(returnRequest.order_id).session(session);
          if (order && order.seller) {
            await walletService.debitWallet({
              ownerType: OWNER_TYPE.SELLER,
              ownerId: order.seller,
              amount: finalRefundAmount,
              bucket: "available",
              session,
              ledgerType: LEDGER_TRANSACTION_TYPE.REFUND,
              ledgerReference: txnReference,
              ledgerDescription: `Refund debited for return request #${returnRequest._id}`,
              idempotencyKey: `RETURN-SELLER-DEBIT-${returnRequest._id}`,
              metadata: { refundAmount: finalRefundAmount },
              allowNegative: true
            });

            await Transaction.create(
              [
                {
                  user: order.seller,
                  userModel: "Seller",
                  type: "Refund",
                  amount: -finalRefundAmount,
                  status: "Settled",
                  reference: `${txnReference}-SELLER`
                }
              ],
              { session }
            );
          }
        });
      } finally {
        session.endSession();
      }

      returnRequest.refund_transaction_id = txnReference;
    } else {
      return handleResponse(res, 400, "Invalid override action");
    }

    returnRequest.status = targetStatus;
    returnRequest.admin_note = note || "Overridden by administrator";
    returnRequest.status_history.push({
      status: targetStatus,
      changed_by: "admin",
      note: note || `Admin force override to ${targetStatus}`
    });
    await returnRequest.save();

    // Also update parent Order
    const order = await Order.findById(returnRequest.order_id);
    if (order) {
      if (targetStatus === "SELLER_APPROVED") {
        order.returnStatus = "return_approved";
      } else if (targetStatus === "SELLER_REJECTED") {
        order.returnStatus = "return_rejected";
      } else if (targetStatus === "REFUND_COMPLETED") {
        order.returnStatus = "refund_completed";
        if (order.payment) {
          order.payment.status = "refunded";
        }
      }
      await order.save();
    }

    // Emit event for refund completed if applicable
    if (targetStatus === "REFUND_COMPLETED") {
      emitNotificationEvent(NOTIFICATION_EVENTS.REFUND_COMPLETED, {
        customerId: returnRequest.customer_id,
        orderId: returnRequest.order_id,
        data: { refundAmount: finalRefundAmount, paymentMethod: finalMethod }
      });

      emitToCustomer(returnRequest.customer_id.toString(), {
        event: "return:refund:completed",
        payload: { returnRequestId: returnRequest.id, status: returnRequest.status, refundAmount: finalRefundAmount }
      });
    } else {
      // Sockets update
      emitToCustomer(returnRequest.customer_id.toString(), {
        event: "return:override",
        payload: { returnRequestId: returnRequest.id, status: returnRequest.status }
      });
    }

    return handleResponse(res, 200, "Return request overridden successfully", returnRequest);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// POST /api/admin/return-requests/:returnRequestId/initiate-refund
export const initiateRefund = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { returnRequestId } = req.params;
    const { refund_amount, refund_method } = req.body;

    const returnRequest = await ReturnRequest.findById(returnRequestId);
    if (!returnRequest) {
      return handleResponse(res, 404, "Return request not found");
    }

    if (!isValidTransition(returnRequest.status, "REFUND_INITIATED")) {
      return handleResponse(res, 400, "Refund can only be initiated when package is picked up or delivered to seller");
    }

    const finalRefundAmount = refund_amount != null ? Number(refund_amount) : returnRequest.refund_amount;
    const finalMethod = refund_method || returnRequest.refund_method || "wallet";

    // Execute Money Flow
    let txnReference = `REF-WALLET-${Date.now()}`;
    await session.withTransaction(async () => {
      // Save REFUND_INITIATED status inside session so it rolls back automatically on failure
      returnRequest.status = "REFUND_INITIATED";
      returnRequest.refund_amount = finalRefundAmount;
      returnRequest.refund_method = finalMethod;
      returnRequest.refund_initiated_at = new Date();
      returnRequest.status_history.push({
        status: "REFUND_INITIATED",
        changed_by: "admin",
        note: `Refund of ₹${finalRefundAmount} initiated via ${finalMethod}`
      });
      await returnRequest.save({ session });

      // If method is wallet, credit customer's wallet
      if (finalMethod === "wallet") {
        await walletService.creditWallet({
          ownerType: OWNER_TYPE.CUSTOMER,
          ownerId: returnRequest.customer_id,
          amount: finalRefundAmount,
          bucket: "available",
          session,
          ledgerType: LEDGER_TRANSACTION_TYPE.WALLET_REFUND,
          ledgerReference: txnReference,
          ledgerDescription: `Return request refund for Order #${returnRequest.order_id}`,
          idempotencyKey: `RETURN-REFUND-${returnRequest._id}`,
          metadata: { source: "admin_initiate_refund" }
        });

        await Transaction.create(
          [
            {
              user: returnRequest.customer_id,
              userModel: "User",
              type: "Refund",
              amount: finalRefundAmount,
              status: "Settled",
              reference: `${txnReference}-CUST`,
              meta: { orderId: returnRequest.order_id, type: "return_wallet" }
            }
          ],
          { session }
        );
      }
      
      // Debit seller wallet to recover refund cost
      const order = await Order.findById(returnRequest.order_id).session(session);
      if (order && order.seller) {
        await walletService.debitWallet({
          ownerType: OWNER_TYPE.SELLER,
          ownerId: order.seller,
          amount: finalRefundAmount,
          bucket: "available",
          session,
          ledgerType: LEDGER_TRANSACTION_TYPE.REFUND,
          ledgerReference: txnReference,
          ledgerDescription: `Refund debited for return request #${returnRequest._id}`,
          idempotencyKey: `RETURN-SELLER-DEBIT-${returnRequest._id}`,
          metadata: { refundAmount: finalRefundAmount },
          allowNegative: true
        });

        await Transaction.create(
          [
            {
              user: order.seller,
              userModel: "Seller",
              type: "Refund",
              amount: -finalRefundAmount,
              status: "Settled",
              reference: `${txnReference}-SELLER`
            }
          ],
          { session }
        );
      }
    });

    // Emit refund initiated notification
    emitNotificationEvent(NOTIFICATION_EVENTS.REFUND_INITIATED, {
      customerId: returnRequest.customer_id,
      orderId: returnRequest.order_id
    });

    // Mark as completed/closed
    returnRequest.status = "REFUND_COMPLETED";
    returnRequest.refund_completed_at = new Date();
    returnRequest.refund_transaction_id = txnReference;
    returnRequest.status_history.push({
      status: "REFUND_COMPLETED",
      changed_by: "system",
      note: "Refund successfully settled and return closed"
    });
    await returnRequest.save();

    // Update order return request status
    const parentOrder = await Order.findById(returnRequest.order_id);
    if (parentOrder) {
      parentOrder.returnStatus = "refund_completed";
      if (parentOrder.payment) {
        parentOrder.payment.status = "refunded";
      }
      await parentOrder.save();
    }

    emitNotificationEvent(NOTIFICATION_EVENTS.REFUND_COMPLETED, {
      customerId: returnRequest.customer_id,
      orderId: returnRequest.order_id,
      data: { refundAmount: finalRefundAmount, paymentMethod: finalMethod }
    });

    // Sockets trigger
    emitToCustomer(returnRequest.customer_id.toString(), {
      event: "return:refund:completed",
      payload: { returnRequestId: returnRequest.id, status: returnRequest.status, refundAmount: finalRefundAmount }
    });

    return handleResponse(res, 200, "Refund completed successfully", returnRequest);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  } finally {
    session.endSession();
  }
};

// GET /api/admin/return-requests/stats
export const getAdminReturnStats = async (req, res) => {
  try {
    const total = await ReturnRequest.countDocuments();
    const statusCounts = await ReturnRequest.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    const by_status = statusCounts.reduce((acc, current) => {
      acc[current._id] = current.count;
      return acc;
    }, {});

    // Average resolution time (requested to refund completed)
    const completedRequests = await ReturnRequest.find({
      status: "REFUND_COMPLETED",
      refund_completed_at: { $ne: null }
    }).select("requested_at refund_completed_at");

    let avg_resolution_hours = 0;
    if (completedRequests.length > 0) {
      const totalHours = completedRequests.reduce((sum, req) => {
        const diffMs = req.refund_completed_at.getTime() - req.requested_at.getTime();
        return sum + diffMs / (1000 * 60 * 60);
      }, 0);
      avg_resolution_hours = Number((totalHours / completedRequests.length).toFixed(1));
    }

    // Refund total this month
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));

    const monthlyRefunds = await ReturnRequest.aggregate([
      {
        $match: {
          status: "REFUND_COMPLETED",
          refund_completed_at: { $gte: startOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          totalRefund: { $sum: "$refund_amount" }
        }
      }
    ]);
    const refund_total_this_month = monthlyRefunds[0]?.totalRefund || 0;

    return handleResponse(res, 200, "Return request statistics fetched", {
      total,
      by_status,
      avg_resolution_hours,
      refund_total_this_month
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// ── DELIVERY BOY AUTH SEED / LOGIN HELPERS ───────────────────────────────────

// POST /api/delivery-boy/login (Developer/Testing Login helper)
export const deliveryBoyLogin = async (req, res) => {
  try {
    const { phone, name } = req.body;
    if (!phone) {
      return handleResponse(res, 400, "phone number is required");
    }

    let deliveryBoy = await DeliveryBoy.findOne({ phone });
    if (!deliveryBoy) {
      // Auto-create/seed for developer convenience if not found!
      // Find any seller in system to link to.
      const seller = await Seller.findOne({});
      if (!seller) {
        return handleResponse(res, 500, "No sellers exist in system. Please create a seller first.");
      }

      deliveryBoy = await DeliveryBoy.create({
        name: name || "Test Rider",
        phone,
        seller_id: seller._id,
        current_location: {
          type: "Point",
          coordinates: [77.5946, 12.9716] // Bangalore coords default
        }
      });
    }

    const token = jwt.sign(
      { id: deliveryBoy.id, role: "delivery_boy" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return handleResponse(res, 200, "Logged in successfully", {
      token,
      delivery_boy: {
        id: deliveryBoy.id,
        name: deliveryBoy.name,
        phone: deliveryBoy.phone,
        seller_id: deliveryBoy.seller_id
      }
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
