import ReturnRequest from "../models/returnRequest.js";
import Order from "../models/order.js";
import DeliveryBoy from "../models/deliveryBoy.js";
import Notification from "../models/notification.js";
import logger from "../services/logger.js";
import { emitToSeller } from "../services/orderSocketEmitter.js";

// Job 1: delivery_boy_acceptance_timeout
// Runs every minute (60,000ms)
export const runDeliveryBoyAcceptanceTimeout = async () => {
  const startTime = Date.now();
  try {
    const timeoutTime = new Date(Date.now() - 5 * 60 * 1000);
    const requests = await ReturnRequest.find({
      status: "PICKUP_SCHEDULED",
      pickup_scheduled_at: { $lt: timeoutTime }
    });

    for (const req of requests) {
      // Check if delivery boy has accepted in status_history
      const accepted = req.status_history.some(
        (h) => h.changed_by === "delivery_boy" && h.note.toLowerCase().includes("accepted")
      );

      if (!accepted) {
        logger.info(`Auto-declining return task assignment for request ${req._id} due to 5m timeout`);
        
        const boyId = req.delivery_boy_id;
        if (boyId) {
          await DeliveryBoy.findByIdAndUpdate(boyId, { is_available: true });
        }

        req.delivery_boy_id = null;
        req.status = "SELLER_APPROVED";
        req.status_history.push({
          status: "SELLER_APPROVED",
          changed_by: "system",
          note: "Auto-declined assignment due to 5-minute acceptance timeout"
        });
        await req.save();

        // Notify seller
        emitToSeller(req.seller_id.toString(), {
          event: "return:task:timeout",
          payload: { returnRequestId: req.id }
        });
      }
    }

    const duration = Date.now() - startTime;
    if (requests.length > 0) {
      logger.info("Delivery boy acceptance timeout job finished", {
        processedCount: requests.length,
        duration
      });
    }
  } catch (error) {
    logger.error("Delivery boy acceptance timeout job failed", { error: error.message });
  }
};

// Job 2: return_window_expiry_reminder
// Runs every 5 minutes (300,000ms)
export const runReturnWindowExpiryReminder = async () => {
  const startTime = Date.now();
  try {
    const now = new Date();
    const maxTime = new Date(now.getTime() + 30 * 60 * 1000); // 30 mins window closing

    const orders = await Order.find({
      status: "delivered",
      return_eligible_until: { $gt: now, $lte: maxTime },
      return_request_id: null
    });

    for (const order of orders) {
      const alreadySent = await Notification.findOne({
        recipient: order.customer,
        "data.orderId": order.orderId,
        title: "Return Window Closing"
      });

      if (!alreadySent) {
        await Notification.create({
          recipient: order.customer,
          recipientModel: "Customer",
          title: "Return Window Closing",
          message: "Return window closing in 30 minutes",
          type: "order",
          data: { orderId: order.orderId }
        });
      }
    }

    const duration = Date.now() - startTime;
    if (orders.length > 0) {
      logger.info("Return window expiry reminder job finished", {
        notifiedCount: orders.length,
        duration
      });
    }
  } catch (error) {
    logger.error("Return window expiry reminder job failed", { error: error.message });
  }
};

// Job 3: stale_request_cleanup
// Runs daily (86,400,000ms)
export const runStaleRequestCleanup = async () => {
  const startTime = Date.now();
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h
    const requests = await ReturnRequest.find({
      status: "REQUESTED",
      requested_at: { $lt: cutoff }
    });

    for (const req of requests) {
      req.admin_note = "FLAGGED_STALE: No seller action for 24h";
      req.status_history.push({
        status: "REQUESTED",
        changed_by: "system",
        note: "Flagged as stale: pending seller action for over 24h"
      });
      await req.save();

      // Log notification entry for admins
      await Notification.create({
        recipientModel: "Admin",
        title: "Stale Return Request Alert",
        message: `Return request for Order #${req.order_id} has been pending for over 24h without seller action.`,
        type: "order",
        data: { returnRequestId: req._id }
      });
    }

    const duration = Date.now() - startTime;
    if (requests.length > 0) {
      logger.info("Stale return requests cleanup job completed", {
        flaggedCount: requests.length,
        duration
      });
    }
  } catch (error) {
    logger.error("Stale return requests cleanup job failed", { error: error.message });
  }
};

export const getDeliveryBoyAcceptanceTimeoutJobHandler = () => runDeliveryBoyAcceptanceTimeout;
export const getDeliveryBoyAcceptanceTimeoutJobInterval = () => 60000; // 1 min

export const getReturnWindowExpiryReminderJobHandler = () => runReturnWindowExpiryReminder;
export const getReturnWindowExpiryReminderJobInterval = () => 300000; // 5 mins

export const getStaleRequestCleanupJobHandler = () => runStaleRequestCleanup;
export const getStaleRequestCleanupJobInterval = () => 86400000; // 1 day
