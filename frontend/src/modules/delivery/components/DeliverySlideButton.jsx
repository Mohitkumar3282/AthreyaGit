import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { deliveryApi } from "../services/deliveryApi";
import {
  getCachedDeliveryPartnerLocation,
  saveDeliveryPartnerLocation,
} from "../utils/deliveryLastLocation";

/**
 * Get the rider's position RIGHT NOW for the proximity check.
 *
 * The background tracker posts a coarse (cell-tower) fix at most every 30s
 * and pauses while the app is in the background, so the server's stored
 * position can be minutes old and kilometres off — which blocked riders
 * standing at the customer's door. Order of preference:
 *   1. a precise fix from the live map's GPS watch, if only seconds old;
 *   2. a high-accuracy GPS reading from the phone;
 *   3. a quicker lower-accuracy reading;
 *   4. a cached fix up to 2 minutes old.
 */
function getFreshRiderFix() {
  const recent = getCachedDeliveryPartnerLocation(15 * 1000);
  if (recent && Number.isFinite(recent.accuracy) && recent.accuracy <= 100) {
    return Promise.resolve({ lat: recent.lat, lng: recent.lng, accuracy: recent.accuracy });
  }
  const fromPos = (pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    saveDeliveryPartnerLocation(lat, lng, pos.coords.accuracy);
    return { lat, lng, accuracy: pos.coords.accuracy };
  };
  const ask = (opts) =>
    new Promise((resolve) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(fromPos(pos)),
        () => resolve(null),
        opts,
      );
    });
  return ask({ enableHighAccuracy: true, maximumAge: 10000, timeout: 6000 })
    .then((fix) => fix || ask({ enableHighAccuracy: false, maximumAge: 30000, timeout: 4000 }))
    .then((fix) => {
      if (fix) return fix;
      const cached = getCachedDeliveryPartnerLocation(2 * 60 * 1000);
      return cached
        ? { lat: cached.lat, lng: cached.lng, accuracy: cached.accuracy ?? undefined }
        : null;
    });
}

/**
 * DeliverySlideButton - A slide-to-confirm button for delivery actions
 * 
 * This component handles the slide gesture to trigger OTP generation.
 * It takes a fresh GPS fix and sends it with the generate-otp request, so the
 * proximity check uses where the rider is now (not an old stored position).
 * 
 * @param {Object} props
 * @param {string} props.orderId - The order ID for OTP generation
 * @param {Function} props.onSuccess - Callback when OTP is successfully generated
 * @param {Function} props.onError - Callback when an error occurs
 * @param {string} props.label - Label text for the slide button (default: "SLIDE TO GENERATE OTP")
 * @param {string} props.bgColor - Background color class (default: "bg-black ")
 * @param {string} props.bgColorLight - Light background color class (default: "bg-brand-50")
 */
const DeliverySlideButton = ({
  orderId,
  onSuccess,
  onError,
  isReturn = false,
  isReturnDrop = false,
  isPickup = false,
  label = "SLIDE TO GENERATE OTP",
  bgColor = "bg-black ",
  bgColorLight = "bg-brand-50",
}) => {
  const [isSlideComplete, setIsSlideComplete] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Reset slide state when orderId changes
  useEffect(() => {
    setIsSlideComplete(false);
    setDragX(0);
    setIsLoading(false);
  }, [orderId]);

  const resetSlide = () => {
    setIsSlideComplete(false);
    setDragX(0);
    setIsLoading(false);
  };

  /**
   * Handle slide completion - generate OTP using stored location
   */
  const handleSlideComplete = async () => {
    setIsLoading(true);

    try {
      // Delivery / pickup OTPs are checked against the rider's distance from
      // the address, so send a fresh GPS fix with the request.
      let locationBody = {};
      if (!isReturn && !isReturnDrop) {
        const fix = await getFreshRiderFix();
        if (fix) {
          locationBody = {
            lat: fix.lat,
            lng: fix.lng,
            ...(Number.isFinite(fix.accuracy) ? { accuracy: Math.round(fix.accuracy) } : {}),
          };
        }
      }

      // Call appropriate endpoint based on flow type
      const response = isReturnDrop
        ? await deliveryApi.requestReturnDropOtp(orderId, {})
        : isReturn
          ? await deliveryApi.requestReturnOtp(orderId, {})
          : isPickup
            ? await deliveryApi.requestPickupOtp(orderId, locationBody)
            : await deliveryApi.requestDeliveryOtp(orderId, locationBody);

      // Handle success
      toast.success(response.data?.message || (isPickup ? "OTP generated and sent to sender" : "OTP generated and sent to customer"));

      if (onSuccess) {
        onSuccess(response.data);
      }
    } catch (error) {
      // Handle different error types. Same dual-shape access pattern as
      // OtpInput.jsx — the canonical workflow controller wraps the
      // structured payload inside `result.error`.
      const respData = error.response?.data || {};
      const structured =
        (respData.result && respData.result.error) ||
        (typeof respData.error === "object" ? respData.error : null) ||
        {};
      const errorMessage =
        structured.message ||
        respData.message ||
        error.message ||
        "Failed to generate OTP";
      const errorCode = structured.code;

      // Display user-friendly error messages
      if (errorCode === "PROXIMITY_OUT_OF_RANGE") {
        const details = error.response?.data?.error?.details || error.response?.data?.result?.error?.details;
        const distance = details?.currentDistance;
        const range = details?.requiredRange;

        if (distance !== undefined && range !== undefined) {
          toast.error(
            `You are too ${distance > range ? "far" : "close"}. You must be within ${range}m of the delivery location.`,
            { duration: 5000 }
          );
        } else {
          toast.error(errorMessage || "You are too far from the delivery location.", { duration: 5000 });
        }
      } else if (errorCode === "LOCATION_REQUIRED" || errorCode === "LOCATION_STALE") {
        toast.error(errorMessage || "Location data is not available. Please ensure location tracking is enabled.");
      } else if (errorCode === "ORDER_NOT_FOUND") {
        toast.error("Order not found. Please refresh and try again.");
      } else if (errorCode === "UNAUTHORIZED_DELIVERY") {
        toast.error("This order is not assigned to you.");
      } else {
        toast.error(errorMessage);
      }

      if (onError) {
        onError(error);
      }

      resetSlide();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative h-16 bg-gray-100 rounded-full overflow-hidden select-none">
      {/* Label text */}
      <motion.div
        className={`absolute inset-0 flex items-center justify-center text-gray-400 font-bold text-[16px] pointer-events-none transition-opacity duration-300 ${dragX > 50 || isLoading ? "opacity-0" : "opacity-100"
          }`}
        animate={{ x: [0, 5, 0] }}
        transition={{ repeat: Infinity, duration: 1.5 }}>
        {label} <ChevronRight className="ml-1 inline" />
      </motion.div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="animate-spin text-primary" size={24} />
          <span className="ml-2 text-[16px] font-medium text-gray-600">
            {isReturn || isPickup ? "Requesting OTP..." : "Generating OTP..."}
          </span>
        </div>
      )}

      {/* Progress background */}
      <motion.div
        className={`absolute inset-y-0 left-0 ${bgColorLight} opacity-50`}
        style={{ width: Math.min(dragX + 60, 340) }}
      />

      {/* Draggable button */}
      <motion.div
        className={`absolute top-1 bottom-1 left-1 w-14 rounded-full flex items-center justify-center shadow-md cursor-grab active:cursor-grabbing z-20 ${bgColor}`}
        drag="x"
        dragConstraints={{ left: 0, right: 280 }}
        dragElastic={0.05}
        dragMomentum={false}
        onDrag={(_, info) => {
          if (!isLoading) {
            setDragX(Math.max(0, info.offset.x));
          }
        }}
        onDragEnd={(_, info) => {
          if (isLoading) return;

          if (info.offset.x > 150) {
            setIsSlideComplete(true);
            handleSlideComplete();
          } else {
            setDragX(0);
          }
        }}
        animate={{ x: isSlideComplete ? 280 : 0 }}
        whileHover={{ scale: isLoading ? 1 : 1.05 }}
        whileTap={{ scale: isLoading ? 1 : 0.95 }}
        style={{ pointerEvents: isLoading ? "none" : "auto" }}>
        <ChevronRight className="text-white" size={24} />
      </motion.div>
    </div>
  );
};

export default DeliverySlideButton;
