import CancellationRequest from "../models/cancellationRequest.js";
import Order from "../models/order.js";
import DeliveryBoy from "../models/deliveryBoy.js";
import Delivery from "../models/delivery.js";
import handleResponse from "../utils/helper.js";
import { emitNotificationEvent } from "../modules/notifications/notification.emitter.js";
import { NOTIFICATION_EVENTS } from "../modules/notifications/notification.constants.js";
import { emitToSeller, emitToCustomer, emitToDelivery } from "../services/orderSocketEmitter.js";

const VALID_TRANSITIONS = {
  REQUESTED: ["SELLER_APPROVED", "SELLER_REJECTED", "CANCELLED"],
  SELLER_APPROVED: ["PICKUP_SCHEDULED", "CANCELLED"],
  PICKUP_SCHEDULED: ["PICKED_UP", "SELLER_APPROVED"],
  PICKED_UP: ["DELIVERED_TO_SELLER"],
  DELIVERED_TO_SELLER: ["CANCELLED"]
};

function isValidTransition(oldStatus, newStatus) {
  const allowed = VALID_TRANSITIONS[oldStatus];
  return allowed && allowed.includes(newStatus);
}

// ── CUSTOMER CONTROLLERS ─────────────────────────────────────────────────────

// POST /api/orders/:orderId/cancellation
export const submitCancellationRequest = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return handleResponse(res, 400, "Reason is required");
    }

    const order = await Order.findOne({ orderId });
    if (!order) {
      return handleResponse(res, 404, "Order not found");
    }

    if (order.customer.toString() !== req.user.id) {
      return handleResponse(res, 403, "Access denied. Order does not belong to you.");
    }

    if (order.status === "pending") {
      return handleResponse(res, 400, "Pending orders can be cancelled directly without a request.");
    }

    if (order.status === "cancelled") {
      return handleResponse(res, 400, "Order is already cancelled.");
    }

    if (order.status === "delivered") {
      return handleResponse(res, 400, "Delivered orders cannot be cancelled. Please request a return instead.");
    }

    const existingRequest = await CancellationRequest.findOne({ order_id: order._id, status: { $ne: "CANCELLED" } });
    if (existingRequest) {
      return handleResponse(res, 409, "A cancellation request already exists for this order.");
    }

    const cancellationRequest = await CancellationRequest.create({
      order_id: order._id,
      customer_id: req.user.id,
      seller_id: order.seller,
      status: "REQUESTED",
      reason,
      status_history: [
        {
          status: "REQUESTED",
          changed_by: "customer",
          note: "Cancellation request submitted"
        }
      ]
    });

    // Notify seller
    emitToSeller(order.seller.toString(), {
      event: "cancellation:new",
      payload: { cancellationRequestId: cancellationRequest.id, orderId }
    });

    emitNotificationEvent(NOTIFICATION_EVENTS.ORDER_CANCELLED, {
      orderId: order.orderId,
      sellerId: order.seller,
      customerId: req.user.id,
      customerMessage: "Your cancellation request has been submitted.",
      sellerMessage: `Cancellation request received for order #${order.orderId}.`
    });

    return handleResponse(res, 201, "Cancellation request submitted successfully", cancellationRequest);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// GET /api/cancellation-requests/:cancellationRequestId
export const getCancellationRequestDetail = async (req, res) => {
  try {
    const { cancellationRequestId } = req.params;
    const cancellationRequest = await CancellationRequest.findById(cancellationRequestId)
      .populate("order_id")
      .populate("customer_id", "name phone")
      .populate("seller_id", "shopName address name location phone")
      .populate("delivery_boy_id", "name phone rating");

    if (!cancellationRequest) {
      return handleResponse(res, 404, "Cancellation request not found");
    }

    const { id: userId, role } = req.user;
    if (role === "customer" && cancellationRequest.customer_id._id.toString() !== userId) {
      return handleResponse(res, 403, "Access denied");
    }
    if (role === "seller" && cancellationRequest.seller_id._id.toString() !== userId) {
      return handleResponse(res, 403, "Access denied");
    }
    if (role === "delivery_boy" && cancellationRequest.delivery_boy_id?._id?.toString() !== userId) {
      return handleResponse(res, 403, "Access denied");
    }

    return handleResponse(res, 200, "Cancellation request detail fetched", cancellationRequest);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// DELETE /api/cancellation-requests/:cancellationRequestId
export const cancelCancellationRequest = async (req, res) => {
  try {
    const { cancellationRequestId } = req.params;
    const cancellationRequest = await CancellationRequest.findById(cancellationRequestId);
    if (!cancellationRequest) {
      return handleResponse(res, 404, "Cancellation request not found");
    }

    if (cancellationRequest.customer_id.toString() !== req.user.id) {
      return handleResponse(res, 403, "Access denied");
    }

    if (cancellationRequest.status !== "REQUESTED") {
      return handleResponse(res, 400, "Cancel only allowed when status is REQUESTED");
    }

    cancellationRequest.status = "CANCELLED";
    cancellationRequest.status_history.push({
      status: "CANCELLED",
      changed_by: "customer",
      note: "Cancelled by customer"
    });
    await cancellationRequest.save();

    return handleResponse(res, 200, "Cancellation request cancelled successfully", cancellationRequest);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// ── SELLER CONTROLLERS ───────────────────────────────────────────────────────

// GET /api/seller/cancellation-requests
export const getSellerCancellationRequests = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { status, page = 1, limit = 20 } = req.query;

    const query = { seller_id: sellerId };
    if (status) {
      query.status = status;
    }

    const skipIndex = (page - 1) * limit;
    const total = await CancellationRequest.countDocuments(query);
    const cancellationRequests = await CancellationRequest.find(query)
      .populate("customer_id", "name phone")
      .populate("order_id")
      .sort({ createdAt: -1 })
      .skip(skipIndex)
      .limit(Number(limit));

    return handleResponse(res, 200, "Seller cancellation requests fetched", {
      cancellation_requests: cancellationRequests,
      total,
      page: Number(page),
      limit: Number(limit)
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// POST /api/seller/cancellation-requests/:cancellationRequestId/approve
export const approveCancellationRequest = async (req, res) => {
  try {
    const { cancellationRequestId } = req.params;
    const { note } = req.body;
    const cancellationRequest = await CancellationRequest.findById(cancellationRequestId);

    if (!cancellationRequest || cancellationRequest.seller_id.toString() !== req.user.id) {
      return handleResponse(res, 404, "Cancellation request not found");
    }

    if (!isValidTransition(cancellationRequest.status, "SELLER_APPROVED")) {
      return handleResponse(res, 400, "Invalid status transition");
    }

    cancellationRequest.status = "SELLER_APPROVED";
    cancellationRequest.seller_note = note || "";
    cancellationRequest.seller_action_at = new Date();
    cancellationRequest.status_history.push({
      status: "SELLER_APPROVED",
      changed_by: "seller",
      note: note || "Cancellation approved by seller"
    });
    await cancellationRequest.save();

    // Trigger push notification to customer
    emitToCustomer(cancellationRequest.customer_id.toString(), {
      event: "cancellation:approved",
      payload: { cancellationRequestId: cancellationRequest.id, status: cancellationRequest.status }
    });

    return handleResponse(res, 200, "Cancellation request approved by seller", cancellationRequest);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// POST /api/seller/cancellation-requests/:cancellationRequestId/reject
export const rejectCancellationRequest = async (req, res) => {
  try {
    const { cancellationRequestId } = req.params;
    const { note } = req.body;

    if (!note || typeof note !== "string" || note.trim().length === 0) {
      return handleResponse(res, 400, "Rejection note is required");
    }

    const cancellationRequest = await CancellationRequest.findById(cancellationRequestId);
    if (!cancellationRequest || cancellationRequest.seller_id.toString() !== req.user.id) {
      return handleResponse(res, 404, "Cancellation request not found");
    }

    if (!isValidTransition(cancellationRequest.status, "SELLER_REJECTED")) {
      return handleResponse(res, 400, "Invalid status transition");
    }

    cancellationRequest.status = "SELLER_REJECTED";
    cancellationRequest.seller_note = note;
    cancellationRequest.seller_action_at = new Date();
    cancellationRequest.status_history.push({
      status: "SELLER_REJECTED",
      changed_by: "seller",
      note: note
    });
    await cancellationRequest.save();

    // Trigger push to customer
    emitToCustomer(cancellationRequest.customer_id.toString(), {
      event: "cancellation:rejected",
      payload: { cancellationRequestId: cancellationRequest.id, status: cancellationRequest.status, note }
    });

    return handleResponse(res, 200, "Cancellation request rejected by seller", cancellationRequest);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// GET /api/seller/cancellation-requests/delivery-boys/available?cancellation_request_id=xxx
export const getAvailableDeliveryBoys = async (req, res) => {
  try {
    const { cancellation_request_id } = req.query;
    const cancellationRequest = await CancellationRequest.findById(cancellation_request_id).populate("order_id");

    if (!cancellationRequest) {
      return handleResponse(res, 404, "Cancellation request not found");
    }

    const order = await Order.findById(cancellationRequest.order_id);
    if (!order || !order.address?.location) {
      return handleResponse(res, 400, "Customer location details missing from order");
    }

    const customerLat = order.address.location.lat;
    const customerLng = order.address.location.lng;
    const sellerRadiusMeters = 10000; // 10km config

    // DEBUG LOGS (Fix 6)
    const sellerId = req.user.id;
    const allBoys = await DeliveryBoy.find({ seller_id: sellerId });
    console.log("Total boys for seller (Cancellations):", allBoys.length);
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
    console.log("Available boys after filter (Cancellations):", availableBoys.length);

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

    const delivery_boys = await Promise.all(
      availableBoys.map(async (boy) => {
        let distance_km = 999.9;
        if (boy.current_location && boy.current_location.coordinates) {
          const boyLng = boy.current_location.coordinates[0];
          const boyLat = boy.current_location.coordinates[1];
          
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

// POST /api/seller/cancellation-requests/:cancellationRequestId/assign-delivery-boy
export const assignDeliveryBoy = async (req, res) => {
  try {
    const { cancellationRequestId } = req.params;
    const { delivery_boy_id } = req.body;

    const cancellationRequest = await CancellationRequest.findById(cancellationRequestId);
    if (!cancellationRequest || cancellationRequest.seller_id.toString() !== req.user.id) {
      return handleResponse(res, 404, "Cancellation request not found");
    }

    if (!isValidTransition(cancellationRequest.status, "PICKUP_SCHEDULED")) {
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

    deliveryBoy.is_available = false;
    await deliveryBoy.save();

    cancellationRequest.delivery_boy_id = deliveryBoy._id;
    cancellationRequest.status = "PICKUP_SCHEDULED";
    cancellationRequest.pickup_scheduled_at = new Date();
    cancellationRequest.status_history.push({
      status: "PICKUP_SCHEDULED",
      changed_by: "seller",
      note: `Assigned to delivery partner ${deliveryBoy.name}`
    });
    await cancellationRequest.save();

    emitToDelivery(deliveryBoy._id.toString(), {
      event: "cancellation:task:assigned",
      payload: { cancellationRequestId: cancellationRequest.id, status: cancellationRequest.status }
    });

    emitToCustomer(cancellationRequest.customer_id.toString(), {
      event: "cancellation:pickup:scheduled",
      payload: { cancellationRequestId: cancellationRequest.id, deliveryBoyName: deliveryBoy.name }
    });

    return handleResponse(res, 200, "Delivery boy assigned successfully", cancellationRequest);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// PUT /api/seller/cancellation-requests/:cancellationRequestId/reassign-delivery-boy
export const reassignDeliveryBoy = async (req, res) => {
  try {
    const { cancellationRequestId } = req.params;
    const { delivery_boy_id } = req.body;

    const cancellationRequest = await CancellationRequest.findById(cancellationRequestId);
    if (!cancellationRequest || cancellationRequest.seller_id.toString() !== req.user.id) {
      return handleResponse(res, 404, "Cancellation request not found");
    }

    if (cancellationRequest.status !== "PICKUP_SCHEDULED" && cancellationRequest.status !== "SELLER_APPROVED") {
      return handleResponse(res, 400, "Reassignment only allowed for scheduled or approved cancellation requests");
    }

    const previousBoyId = cancellationRequest.delivery_boy_id;
    if (previousBoyId) {
      const prevBoy = await DeliveryBoy.findById(previousBoyId);
      if (prevBoy) {
        prevBoy.is_available = true;
        await prevBoy.save();

        emitToDelivery(previousBoyId.toString(), {
          event: "cancellation:task:cancelled",
          payload: { cancellationRequestId: cancellationRequest.id }
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

    newBoy.is_available = false;
    await newBoy.save();

    cancellationRequest.delivery_boy_id = newBoy._id;
    cancellationRequest.status = "PICKUP_SCHEDULED";
    cancellationRequest.pickup_scheduled_at = new Date();
    cancellationRequest.status_history.push({
      status: "PICKUP_SCHEDULED",
      changed_by: "seller",
      note: `Reassigned from ${previousBoyId ? "previous" : "none"} to ${newBoy.name}`
    });
    await cancellationRequest.save();

    emitToDelivery(newBoy._id.toString(), {
      event: "cancellation:task:assigned",
      payload: { cancellationRequestId: cancellationRequest.id }
    });

    emitToCustomer(cancellationRequest.customer_id.toString(), {
      event: "cancellation:pickup:scheduled",
      payload: { cancellationRequestId: cancellationRequest.id, deliveryBoyName: newBoy.name }
    });

    return handleResponse(res, 200, "Delivery boy reassigned successfully", cancellationRequest);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// ── DELIVERY BOY CONTROLLERS ─────────────────────────────────────────────────

// GET /api/delivery-boy/cancellation-tasks
export const getMyCancellationTasks = async (req, res) => {
  try {
    const cancellationTasks = await CancellationRequest.find({
      delivery_boy_id: req.user.id,
      status: { $in: ["PICKUP_SCHEDULED", "PICKED_UP", "DELIVERED_TO_SELLER"] }
    })
      .populate("order_id")
      .populate("customer_id", "name phone")
      .sort({ updatedAt: -1 });

    return handleResponse(res, 200, "My cancellation tasks fetched", cancellationTasks);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// POST /api/delivery-boy/cancellation-tasks/:cancellationRequestId/accept
export const acceptCancellationTask = async (req, res) => {
  try {
    const { cancellationRequestId } = req.params;
    const cancellationRequest = await CancellationRequest.findOne({
      _id: cancellationRequestId,
      delivery_boy_id: req.user.id
    }).populate("order_id");

    if (!cancellationRequest) {
      return handleResponse(res, 404, "Cancellation task not found or not assigned to you");
    }

    cancellationRequest.status_history.push({
      status: cancellationRequest.status,
      changed_by: "delivery_boy",
      note: "Delivery partner accepted cancellation pickup task"
    });
    await cancellationRequest.save();

    emitToCustomer(cancellationRequest.customer_id.toString(), {
      event: "cancellation:task:accepted",
      payload: { cancellationRequestId: cancellationRequest.id }
    });
    emitToSeller(cancellationRequest.seller_id.toString(), {
      event: "cancellation:task:accepted",
      payload: { cancellationRequestId: cancellationRequest.id }
    });

    return handleResponse(res, 200, "Task accepted successfully", cancellationRequest);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// POST /api/delivery-boy/cancellation-tasks/:cancellationRequestId/decline
export const declineCancellationTask = async (req, res) => {
  try {
    const { cancellationRequestId } = req.params;
    const { reason } = req.body;

    const cancellationRequest = await CancellationRequest.findOne({
      _id: cancellationRequestId,
      delivery_boy_id: req.user.id
    });

    if (!cancellationRequest) {
      return handleResponse(res, 404, "Cancellation task not found or not assigned to you");
    }

    const deliveryBoy = await DeliveryBoy.findById(req.user.id);
    if (deliveryBoy) {
      deliveryBoy.is_available = true;
      await deliveryBoy.save();
    }

    cancellationRequest.delivery_boy_id = null;
    cancellationRequest.status = "SELLER_APPROVED";
    cancellationRequest.status_history.push({
      status: "SELLER_APPROVED",
      changed_by: "delivery_boy",
      note: `Declined: ${reason || "No reason given"}`
    });
    await cancellationRequest.save();

    emitToSeller(cancellationRequest.seller_id.toString(), {
      event: "cancellation:task:declined",
      payload: { cancellationRequestId: cancellationRequest.id, reason }
    });

    return handleResponse(res, 200, "Task declined successfully", cancellationRequest);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// GET /api/orders/:orderId/cancellation
export const getCancellationRequestByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findOne({ orderId });
    if (!order) {
      return handleResponse(res, 404, "Order not found");
    }

    const { id: userId, role } = req.user;
    if (role === "customer" && order.customer.toString() !== userId) {
      return handleResponse(res, 403, "Access denied. Order does not belong to you.");
    }
    if (role === "seller" && order.seller.toString() !== userId) {
      return handleResponse(res, 403, "Access denied");
    }

    const cancellationRequest = await CancellationRequest.findOne({ order_id: order._id })
      .populate("order_id")
      .populate("customer_id", "name phone")
      .populate("seller_id", "shopName address name")
      .populate("delivery_boy_id", "name phone rating")
      .sort({ createdAt: -1 });

    if (!cancellationRequest) {
      return handleResponse(res, 404, "Cancellation request not found for this order");
    }

    return handleResponse(res, 200, "Cancellation request fetched successfully", cancellationRequest);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

