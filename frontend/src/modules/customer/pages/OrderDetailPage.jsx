import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import InvoiceModal from "../components/order/InvoiceModal";
import HelpModal from "../components/order/HelpModal";
import LiveTrackingMap from "../components/order/LiveTrackingMap";
import DeliveryOtpDisplay from "../components/DeliveryOtpDisplay";
import OrderProgressTracker from "../components/order/OrderProgressTracker";
import ReturnProgressTracker from "../components/order/ReturnProgressTracker";
import CancellationProgressTracker from "../components/order/CancellationProgressTracker";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";
import {
  ChevronLeft,
  Package,
  Truck,
  CheckCircle,
  Clock,
  MapPin,
  CreditCard,
  Download,
  HelpCircle,
  Phone,
  MessageSquare,
  ArrowRight,
  User,
  Loader2,
  Store,
  Navigation2,
  Camera,
  X,
} from "lucide-react";
import { customerApi } from "../services/customerApi";
import { toast } from "sonner";
import { subscribeToOrderLocation, subscribeToOrderTrail, subscribeToOrderRoute } from "@/core/services/trackingClient";
import {
  useOrderIdentifiers,
  resolveOrderIdentifiers,
} from "../hooks/useOrderIdentifiers";
import {
  getOrderSocket,
  joinOrderRoom,
  leaveOrderRoom,
  onOrderStatusUpdate,
  onCustomerOtp,
  onReturnPickupOtp,
  onReturnDropOtp,
  onCancellationPickupOtp,
  onCancellationStatusUpdate,
} from "@/core/services/orderSocket";
import { getLegacyStatusFromOrder } from "@/shared/utils/orderStatus";
import { createSocketTokenReader } from "@core/utils/authStorage";
import { STORAGE_KEYS } from "@core/utils/storage";

const coordsToLatLng = (coords) => {
  if (!Array.isArray(coords) || coords.length < 2) return null;

  const [lng, lat] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng };
};

const hasValidLatLng = (location) =>
  location &&
  typeof location.lat === "number" &&
  typeof location.lng === "number" &&
  Number.isFinite(location.lat) &&
  Number.isFinite(location.lng);

const DEFAULT_CITY_SPEED_KMPH = 24;
const ROUTE_REFRESH_THRESHOLD_M = 150;
const ROUTE_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

const toRadians = (value) => (value * Math.PI) / 180;

const distanceMeters = (from, to) => {
  if (!hasValidLatLng(from) || !hasValidLatLng(to)) return null;
  const r = 6371000;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatArrivalTime = (arrivalMs) =>
  new Date(arrivalMs).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

const formatArrivingIn = (minutes) => {
  if (!Number.isFinite(minutes) || minutes < 0) return "Soon";
  const rounded = Math.max(1, Math.round(minutes));
  return `${rounded} min${rounded === 1 ? "" : "s"}`;
};

const formatDistance = (meters) => {
  if (!Number.isFinite(meters) || meters <= 0) return "—";
  if (meters < 1000) {
    return `${Math.max(50, Math.round(meters / 10) * 10)} m`;
  }
  return `${(meters / 1000).toFixed(meters >= 10000 ? 1 : 2)} km`;
};

const estimateMinutesFromDistance = (meters) => {
  if (!Number.isFinite(meters) || meters <= 0) return null;
  return (meters * 60) / (DEFAULT_CITY_SPEED_KMPH * 1000);
};

const getTrackingRoutePhase = (order) => {
  if (!order) return "pickup";

  const workflowStatus = String(order.workflowStatus || "").toUpperCase();
  const legacyStatus = String(order.status || "").toLowerCase();
  const riderStep = Number(order.deliveryRiderStep) || 0;

  const isDeliveryPhase =
    workflowStatus === "OUT_FOR_DELIVERY" ||
    workflowStatus === "DELIVERED" ||
    legacyStatus === "out_for_delivery" ||
    legacyStatus === "delivered" ||
    riderStep >= 3 ||
    Boolean(order.pickupConfirmedAt);

  return isDeliveryPhase ? "delivery" : "pickup";
};

const matchesOrderIdentifier = (payloadOrderId, identifiers = []) => {
  const normalizedPayloadId = String(payloadOrderId || "").trim();
  if (!normalizedPayloadId) return false;
  return identifiers
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .includes(normalizedPayloadId);
};

const OrderDetailPage = () => {
  const { orderId } = useParams();
  const [showInvoice, setShowInvoice] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [returnDetails, setReturnDetails] = useState(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [requestingReturn, setRequestingReturn] = useState(false);
  const [selectedReturnItems, setSelectedReturnItems] = useState({});
  const [returnReason, setReturnReason] = useState("");
  const [returnReasonDetail, setReturnReasonDetail] = useState("");
  const [returnConditionAssurance, setReturnConditionAssurance] = useState(false);
  const [returnImageFiles, setReturnImageFiles] = useState([]);
  const [returnImagePreviews, setReturnImagePreviews] = useState([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [returnEligibility, setReturnEligibility] = useState({ eligible: false });
  const fileInputRef = useRef(null);

  const [cancellationDetails, setCancellationDetails] = useState(null);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [requestingCancellation, setRequestingCancellation] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellationReasonDetail, setCancellationReasonDetail] = useState("");

  const fetchCancellationData = async (ord) => {
    if (!ord) return;
    try {
      const res = await customerApi.getCancellationRequestByOrderId(ord.orderId);
      const data = res.data.result || res.data;
      setCancellationDetails(data);
      if (data?.pickup_otp) {
        setHandoffOtp(data.pickup_otp);
      }
    } catch (err) {
      setCancellationDetails(null);
    }
  };

  const fetchReturnData = async (ord) => {
    if (!ord) return;
    try {
      const eligRes = await customerApi.getReturnEligibility(ord.orderId);
      setReturnEligibility(eligRes.data.result || eligRes.data);
    } catch (err) {
      console.error("Failed to fetch return eligibility", err);
    }

    const returnReqId = ord.return_request_id;
    if (returnReqId) {
      try {
        const retRes = await customerApi.getReturnRequestStatus(returnReqId);
        const ret = retRes.data.result || retRes.data;
        setReturnDetails(ret);
        if (ret?.pickup_otp) {
          setHandoffOtp(ret.pickup_otp);
        }
      } catch (err) {
        console.error("Failed to fetch return request status", err);
        setReturnDetails(null);
      }
    } else {
      setReturnDetails(null);
    }
  };
  const [liveLocation, setLiveLocation] = useState(null);
  const [trail, setTrail] = useState([]);
  const [routePolyline, setRoutePolyline] = useState(null);
  const [handoffOtp, setHandoffOtp] = useState(null);
  const [clockTick, setClockTick] = useState(Date.now());
  const parsedReturnWindowMinutes = parseInt(
    import.meta.env.VITE_RETURN_WINDOW_MINUTES || "2",
    10,
  );
  const returnWindowMinutes =
    Number.isFinite(parsedReturnWindowMinutes) && parsedReturnWindowMinutes > 0
      ? parsedReturnWindowMinutes
      : 2;
  const routeOriginRef = useRef(null);
  const routeRequestRef = useRef({ phase: "", startedAt: 0 });
  const [returnCountdown, setReturnCountdown] = useState(null);
  const refreshRef = useRef({ inFlight: false, lastAt: 0 });
  const extraRoomRef = useRef("");

  // Single source of truth for the various ids that may refer to this
  // order (URL param vs canonical order.orderId vs checkoutGroupId). The
  // hook exposes:
  //   - canonicalOrderId : id to use for realtime fan-out (RTDB + sockets)
  //   - identifiersRef   : .current array kept in sync for socket callbacks
  //   - extraRoomId      : canonical id when it differs from the URL param
  // `lookupId` is also available from the hook for callers that need a
  // REST-friendly id; this page derives it ad hoc via `resolveOrderLookupId`
  // because the value is needed against freshly-fetched data before state
  // settles, which the pure helper handles directly.
  const {
    canonicalOrderId,
    identifiersRef,
    extraRoomId,
  } = useOrderIdentifiers(orderId, order);

  const navigate = useNavigate();
  // Pure helper for resolving the lookup id from a freshly-fetched order
  // before React state has settled (e.g. inside the initial fetch effect).
  const resolveOrderLookupId = (ord) =>
    resolveOrderIdentifiers(ord, orderId).lookupId || "";

  const handleBack = () => {
    const idx = window?.history?.state?.idx;
    if (typeof idx === "number" && idx > 0) {
      navigate(-1);
      return;
    }
    navigate("/orders");
  };

  // Scroll to top on load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const isInvalid = !orderId || orderId === "undefined" || orderId === "null";
    if (isInvalid) {
      console.warn(`[OrderDetailPage] Invalid orderId from URL: ${orderId}. Redirecting...`);
      navigate("/orders", { replace: true });
      return;
    }

    const fetchOrderDetails = async () => {
      try {
        refreshRef.current.inFlight = true;
        const response = await customerApi.getOrderDetails(orderId);
        const ord = response.data.result;
        setOrder(ord);
        await fetchReturnData(ord);
        await fetchCancellationData(ord);
      } catch (error) {
        console.error("Failed to fetch order details:", error);
        toast.error("Failed to load order details");
      } finally {
        refreshRef.current.inFlight = false;
        setLoading(false);
      }
    };

    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return undefined;
    const getToken = createSocketTokenReader(STORAGE_KEYS.AUTH_CUSTOMER);
    getOrderSocket(getToken);
    joinOrderRoom(orderId, getToken);

    // Also join using the canonical order.orderId once loaded (may differ from URL param)
    if (order?.orderId && order.orderId !== orderId) {
      joinOrderRoom(order.orderId, getToken);
    }

    const refresh = () => {
      const now = Date.now();
      if (refreshRef.current.inFlight) return;
      if (now - refreshRef.current.lastAt < 2000) return;
      refreshRef.current.lastAt = now;
      refreshRef.current.inFlight = true;
      customerApi
        .getOrderDetails(orderId)
        .then(async (r) => {
          const ord = r.data.result;
          setOrder(ord);
          await fetchReturnData(ord);
          await fetchCancellationData(ord);
        })
        .catch(() => { })
        .finally(() => {
          refreshRef.current.inFlight = false;
        });
    };

    const offStatus = onOrderStatusUpdate(getToken, (payload) => {
      // Immediately update order state from socket payload — no waiting for API re-fetch
      const ws = String(payload?.workflowStatus || "").toUpperCase();
      if (ws) {
        setOrder((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            workflowStatus: ws,
            // Keep legacy status in sync for components that read order.status
            ...(ws === "DELIVERED" && { status: "delivered" }),
            ...(ws === "DELIVERY_SEARCH" && { status: "confirmed" }),
            ...(ws === "OUT_FOR_DELIVERY" && { status: "out_for_delivery" }),
            ...(ws === "CANCELLED" && { status: "cancelled" }),
          };
        });
      }
      refresh();
    });
    const offOtp = onCustomerOtp(getToken, (payload) => {
      if (matchesOrderIdentifier(payload?.orderId, identifiersRef.current) && (payload?.code || payload?.otp)) {
        setHandoffOtp(payload.code || payload.otp);
        toast.info("Delivery OTP received — share with rider if asked.");
      }
    });
    const offReturnOtp = onReturnPickupOtp(getToken, (payload) => {
      if (matchesOrderIdentifier(payload?.orderId, identifiersRef.current) && payload?.otp) {
        setHandoffOtp(payload.otp);
        toast.info("Return pickup OTP received — share with rider.");
      }
    });
    const offCancellationOtp = onCancellationPickupOtp(getToken, (payload) => {
      if (matchesOrderIdentifier(payload?.orderId, identifiersRef.current) && payload?.otp) {
        setHandoffOtp(payload.otp);
        toast.info("Cancellation pickup OTP received — share with rider.");
      }
    });
    const offCancellationStatus = onCancellationStatusUpdate(getToken, (payload) => {
      refresh();
    });

    return () => {
      offStatus();
      offOtp();
      offReturnOtp();
      offCancellationOtp();
      offCancellationStatus();
      leaveOrderRoom(orderId, getToken);
    };
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return undefined;
    const getToken = createSocketTokenReader(STORAGE_KEYS.AUTH_CUSTOMER);

    const nextExtraRoom = extraRoomId;

    if (extraRoomRef.current && extraRoomRef.current !== nextExtraRoom) {
      leaveOrderRoom(extraRoomRef.current, getToken);
      extraRoomRef.current = "";
    }

    if (nextExtraRoom && extraRoomRef.current !== nextExtraRoom) {
      joinOrderRoom(nextExtraRoom, getToken);
      extraRoomRef.current = nextExtraRoom;
    }

    return () => {
      if (extraRoomRef.current) {
        leaveOrderRoom(extraRoomRef.current, getToken);
        extraRoomRef.current = "";
      }
    };
  }, [orderId, extraRoomId]);

  // Subscribe to live tracking from Firebase (if available).
  //
  // Realtime DB writes from the rider/server are keyed on the canonical
  // `order.orderId`. The URL param may be a checkoutGroupId / alias / Mongo
  // _id, so subscribing on the raw URL produces zero updates for those
  // surfaces. We re-pin the subscriptions whenever the resolved canonical
  // id changes (i.e. once the order has loaded).
  useEffect(() => {
    const trackingId = canonicalOrderId;
    if (!trackingId) return;

    console.log(`[OrderDetailPage] Setting up Firebase subscriptions for order ${trackingId}`);
    const offLocation = subscribeToOrderLocation(trackingId, (loc) => {
      console.log(`[OrderDetailPage] Location update:`, loc);
      setLiveLocation(loc);
    });
    const offTrail = subscribeToOrderTrail(trackingId, (t) => {
      console.log(`[OrderDetailPage] Trail update: ${t.length} points`);
      setTrail(t);
    });
    const offRoute = subscribeToOrderRoute(trackingId, (route) => {
      console.log(`[OrderDetailPage] Route update:`, route);
      setRoutePolyline(route);
    });

    return () => {
      console.log(`[OrderDetailPage] Cleaning up Firebase subscriptions for order ${trackingId}`);
      offLocation && offLocation();
      offTrail && offTrail();
      offRoute && offRoute();
    };
  }, [canonicalOrderId]);

  useEffect(() => {
    const iv = setInterval(() => setClockTick(Date.now()), 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const deadlineStr = returnEligibility?.return_deadline || order?.return_eligible_until;
    if (!deadlineStr || order?.status !== "delivered") {
      setReturnCountdown(null);
      return;
    }

    const calculateCountdown = () => {
      const deadline = new Date(deadlineStr).getTime();
      const now = Date.now();
      const remaining = Math.max(0, deadline - now);

      if (remaining <= 0) {
        setReturnCountdown(0);
        return;
      }

      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setReturnCountdown(`${mins}:${secs.toString().padStart(2, "0")}`);
    };

    calculateCountdown();
    const iv = setInterval(calculateCountdown, 1000);
    return () => clearInterval(iv);
  }, [returnEligibility, order]);

  const handleOpenInMaps = () => {
    const loc = order?.address?.location;
    const dest =
      loc &&
        typeof loc.lat === "number" &&
        typeof loc.lng === "number" &&
        Number.isFinite(loc.lat) &&
        Number.isFinite(loc.lng)
        ? loc
        : null;

    const rider =
      liveLocation &&
        typeof liveLocation.lat === "number" &&
        typeof liveLocation.lng === "number"
        ? liveLocation
        : null;

    if (rider && dest) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&origin=${rider.lat},${rider.lng}&destination=${dest.lat},${dest.lng}`,
        "_blank",
      );
      return;
    }

    if (dest) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}`,
        "_blank",
      );
      return;
    }

    window.open("https://maps.google.com", "_blank");
  };

  const status = order ? getLegacyStatusFromOrder(order) : null;
  const isAwaitingOnlinePayment =
    Boolean(order) &&
    order.paymentMode === "ONLINE" &&
    order.paymentStatus !== "PAID" &&
    status !== "cancelled";
  const sellerLocation = coordsToLatLng(order?.seller?.location?.coordinates);
  const routePhase = getTrackingRoutePhase(order);
  const routeMatchesPhase =
    routePhase === "pickup"
      ? routePolyline?.phase
        ? routePolyline.phase === routePhase
        : !!routePolyline?.polyline
      : routePolyline?.phase === routePhase;
  const activeRoutePolyline = routeMatchesPhase ? routePolyline : null;
  const estimatedArrival = useMemo(() => {
    if (!order) {
      return {
        arrivalTimeText: "--",
        arrivingInText: "--",
      };
    }

    if (status === "delivered") {
      return {
        arrivalTimeText: "Arrived",
        arrivingInText: "Delivered",
      };
    }

    const targetLocation =
      routePhase === "delivery" ? order?.address?.location : sellerLocation;

    let minutes = null;
    const routeDurationSeconds = Number(activeRoutePolyline?.duration);
    if (Number.isFinite(routeDurationSeconds) && routeDurationSeconds > 0) {
      minutes = routeDurationSeconds / 60;
    } else {
      const routeDistanceMeters = Number(activeRoutePolyline?.distanceMeters);
      minutes =
        estimateMinutesFromDistance(routeDistanceMeters) ??
        estimateMinutesFromDistance(distanceMeters(liveLocation, targetLocation));
    }

    if (!Number.isFinite(minutes) || minutes <= 0) {
      minutes = status === "confirmed" ? 12 : 8;
    }

    const arrivalMs = clockTick + minutes * 60 * 1000;
    const routeDistanceMeters = Number(
      activeRoutePolyline?.distanceMeters ?? activeRoutePolyline?.distance,
    );
    return {
      arrivalTimeText: formatArrivalTime(arrivalMs),
      arrivingInText: formatArrivingIn(minutes),
      totalDistanceText: formatDistance(
        routeDistanceMeters ||
        distanceMeters(liveLocation, targetLocation),
      ),
    };
  }, [
    activeRoutePolyline?.distanceMeters,
    activeRoutePolyline?.duration,
    liveLocation,
    order,
    routePhase,
    sellerLocation,
    status,
    clockTick,
  ]);

  useEffect(() => {
    if (!orderId || status === "delivered" || status === "cancelled") return;
    if (!hasValidLatLng(liveLocation)) return;

    const currentOrigin = {
      lat: liveLocation.lat,
      lng: liveLocation.lng,
    };
    const originDrift =
      routeOriginRef.current && hasValidLatLng(routeOriginRef.current)
        ? distanceMeters(routeOriginRef.current, currentOrigin)
        : null;
    const routeIsFresh =
      activeRoutePolyline?.polyline &&
      originDrift !== null &&
      originDrift < ROUTE_REFRESH_THRESHOLD_M &&
      routePhase === activeRoutePolyline?.phase;

    if (routeIsFresh) return;

    const now = Date.now();
    if (
      routeRequestRef.current.phase === routePhase &&
      now - routeRequestRef.current.startedAt < ROUTE_REFRESH_INTERVAL_MS &&
      (originDrift === null || originDrift < ROUTE_REFRESH_THRESHOLD_M)
    ) {
      return;
    }

    routeRequestRef.current = { phase: routePhase, startedAt: now };
    let ignore = false;

    customerApi
      .getOrderRoute(orderId, {
        phase: routePhase,
        originLat: liveLocation.lat,
        originLng: liveLocation.lng,
        _t: now,
      })
      .then((response) => {
        if (ignore) return;
        const nextRoute = response.data?.result;
        if (nextRoute?.polyline) {
          setRoutePolyline(nextRoute);
          routeOriginRef.current = currentOrigin;
        }
      })
      .catch(() => { });

    return () => {
      ignore = true;
    };
  }, [
    activeRoutePolyline?.polyline,
    liveLocation,
    orderId,
    routePhase,
    status,
  ]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="animate-spin text-[#1a6e2e]" size={32} />
      </div>
    );
  }

  const canRequestReturn = () => {
    if (!order) return false;
    if (order.status === "cancelled") return false;
    if (order.status !== "delivered") return false;
    if (
      returnDetails &&
      returnDetails.status &&
      returnDetails.status !== "NONE" &&
      returnDetails.status !== "CANCELLED"
    ) {
      return false;
    }
    return !!returnEligibility?.eligible;
  };

  const canCancelDirectly = () => {
    return order && order.status === "pending";
  };

  const canRequestCancellation = () => {
    if (!order) return false;
    if (order.status === "pending" || order.status === "cancelled" || order.status === "delivered") return false;
    if (cancellationDetails && cancellationDetails.status !== "CANCELLED" && cancellationDetails.status !== "SELLER_REJECTED") {
      return false;
    }
    return true;
  };

  const handleCancelDirectly = async (reason) => {
    try {
      setRequestingCancellation(true);
      await customerApi.cancelOrder(order.orderId, { reason });
      toast.success("Order cancelled successfully");
      setShowCancellationModal(false);
      setCancellationReason("");
      setCancellationReasonDetail("");
      
      const orderRes = await customerApi.getOrderDetails(orderId);
      const updatedOrd = orderRes.data.result;
      setOrder(updatedOrd);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to cancel order");
    } finally {
      setRequestingCancellation(false);
    }
  };

  const handleCancellationSubmit = async () => {
    if (!cancellationReason.trim()) {
      toast.error("Please provide a reason for cancellation");
      return;
    }

    const finalReason = cancellationReasonDetail.trim()
      ? `${cancellationReason}: ${cancellationReasonDetail.trim()}`
      : cancellationReason;

    if (canCancelDirectly()) {
      await handleCancelDirectly(finalReason);
      return;
    }

    try {
      setRequestingCancellation(true);
      await customerApi.submitCancellationRequest(order.orderId, { reason: finalReason });
      toast.success("Cancellation request submitted successfully");
      setShowCancellationModal(false);
      setCancellationReason("");
      setCancellationReasonDetail("");

      const orderRes = await customerApi.getOrderDetails(orderId);
      const updatedOrd = orderRes.data.result;
      setOrder(updatedOrd);
      await fetchCancellationData(updatedOrd);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit cancellation request");
    } finally {
      setRequestingCancellation(false);
    }
  };

  const toggleItemSelection = (index) => {
    setSelectedReturnItems((prev) => {
      const next = { ...prev };
      if (next[index]) {
        delete next[index];
      } else {
        next[index] = { quantity: order.items[index].quantity };
      }
      return next;
    });
  };

  const handleReturnSubmit = async () => {
    if (!order) return;
    if (!returnReason.trim()) {
      toast.error("Please provide a reason for return.");
      return;
    }
    if (!returnConditionAssurance) {
      toast.error("Please confirm that the product is in good condition with accessories.");
      return;
    }
    if (returnImageFiles.length === 0) {
      toast.error("Please upload at least 1 image of the product.");
      return;
    }

    const formData = new FormData();
    formData.append("reason", returnReason);
    formData.append("reason_description", returnReasonDetail);
    returnImageFiles.forEach((file) => {
      formData.append("images", file);
    });

    try {
      setRequestingReturn(true);
      await customerApi.submitReturn(order.orderId, formData);
      toast.success("Return request submitted successfully");
      setShowReturnModal(false);
      setSelectedReturnItems({});
      setReturnReason("");
      setReturnReasonDetail("");
      setReturnConditionAssurance(false);
      returnImagePreviews.forEach(url => URL.revokeObjectURL(url));
      setReturnImageFiles([]);
      setReturnImagePreviews([]);

      const orderRes = await customerApi.getOrderDetails(orderId);
      const updatedOrd = orderRes.data.result;
      setOrder(updatedOrd);
      await fetchReturnData(updatedOrd);
    } catch (error) {
      console.error("Failed to submit return request", error);
      toast.error(
        error.response?.data?.message || "Failed to submit return request",
      );
    } finally {
      setRequestingReturn(false);
    }
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remaining = 5 - returnImageFiles.length;
    const toProcess = files.slice(0, remaining);

    const newFiles = [...returnImageFiles, ...toProcess].slice(0, 5);
    setReturnImageFiles(newFiles);

    const previews = newFiles.map(file => URL.createObjectURL(file));
    setReturnImagePreviews(previews);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index) => {
    if (returnImagePreviews[index]) {
      URL.revokeObjectURL(returnImagePreviews[index]);
    }
    const nextFiles = returnImageFiles.filter((_, i) => i !== index);
    const nextPreviews = returnImagePreviews.filter((_, i) => i !== index);
    setReturnImageFiles(nextFiles);
    setReturnImagePreviews(nextPreviews);
  };

  const handleRetryPayment = async () => {
    try {
      if (!order) return;
      const paymentRef =
        Number(order.checkoutGroupSize || 1) > 1
          ? (order.checkoutGroupId || order.orderId)
          : order.orderId;
      const response = await customerApi.createPaymentOrder({
        orderRef: paymentRef,
      });
      if (response.data.success && response.data.result?.redirectUrl) {
        window.location.href = response.data.result.redirectUrl;
      } else {
        toast.error(response.data.message || "Failed to initiate payment");
      }
    } catch (err) {
      console.error("[OrderDetailPage] Retry payment error:", err);
      toast.error(
        err?.response?.data?.message ||
        err?.message ||
        "Unable to start payment. Please try again later.",
      );
    }
  };

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <Package size={64} className="text-slate-300 mb-4" />
        <h3 className="text-lg font-bold text-slate-800">Order not found</h3>
        <Link to="/orders" className="text-[#1a6e2e] font-bold mt-4 hover:opacity-80">
          Back to my orders
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24 font-sans">
      {/* Minimal Header */}
      <div className="bg-white/80  sticky top-0 z-30 px-4 py-3 flex items-center justify-between border-b border-slate-100">
        <button
          type="button"
          onClick={handleBack}
          className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors"
        >
          <ChevronLeft size={24} className="text-slate-800" />
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-base font-bold text-slate-800">Order</h1>
          <p className="text-xs text-slate-500 font-medium">#{order.orderId.slice(-8)}</p>
        </div>
        <div className="w-10" />
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Payment Required Card - Only for Online Pending Orders */}
        {isAwaitingOnlinePayment && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl p-5 border border-[#1a6e2e]/20 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <CreditCard size={64} className="text-[#1a6e2e]" />
            </div>
            <div className="relative z-10 flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-[#1a6e2e] animate-pulse" />
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Payment Required</h3>
                </div>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Complete your payment of <span className="font-bold">₹{order.pricing.total}</span> to proceed with this order.
                </p>
              </div>
              <button
                onClick={handleRetryPayment}
                className="bg-[#1a6e2e] hover:bg-[#1a6e2e]/90 text-white px-5 py-2.5 rounded-xl text-xs font-black border border-transparent transition-all active:scale-95 flex items-center gap-2 uppercase tracking-wide shrink-0"
              >
                Pay Now <ArrowRight size={14} />
              </button>
            </div>
          </motion.div>
        )}

        {/* Enhanced Map with Cleaner Design - Hide when delivered or cancelled */}
        {!isAwaitingOnlinePayment && status !== "delivered" && status !== "cancelled" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl overflow-hidden border border-[#1a6e2e]/20"
          >
            <LiveTrackingMap
              status={order.workflowStatus || order.status}
              eta={estimatedArrival.arrivingInText}
              riderName={order.deliveryBoy?.name || "Delivery Partner"}
              riderLocation={liveLocation}
              sellerLocation={sellerLocation}
              destinationLocation={
                order.address?.location?.lat
                  ? order.address.location
                  : activeRoutePolyline?.destination || null
              }
              routePhase={routePhase}
              routePolyline={activeRoutePolyline}
              onOpenInMaps={handleOpenInMaps}
            />
          </motion.div>
        )}

        {/* Order Progress Tracker - New Component */}
        {!isAwaitingOnlinePayment && (
          <OrderProgressTracker
            order={order}
            estimatedArrivalText={estimatedArrival.arrivalTimeText}
            arrivingInText={estimatedArrival.arrivingInText}
            totalDistanceText={estimatedArrival.totalDistanceText}
          />
        )}

        {/* Proximity-based Delivery OTP Display */}
        <DeliveryOtpDisplay
          orderId={order?.orderId || orderId}
          checkoutGroupId={order?.checkoutGroupId || orderId}
          initialOtp={order?.deliveryOtp}
          initialOtpExpiresAt={order?.deliveryOtpExpiresAt}
        />

        {/* Delivery Partner Card - Redesigned */}
        {order.deliveryBoy && status !== "delivered" && status !== "cancelled" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-3xl p-5 border border-[#1a6e2e]/20 text-slate-800"
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="h-14 w-14 rounded-full bg-[#1a6e2e]/10 overflow-hidden border-2 border-[#1a6e2e]/20">
                  <img
                    src="https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100&auto=format&fit=crop&q=60"
                    alt="Rider"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-white text-[#1a6e2e] text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 border border-[#1a6e2e]/20">
                  4.8 ★
                </div>
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-white/80 uppercase tracking-wider">Your Courier</p>
                <h3 className="font-bold text-white text-lg">{order.deliveryBoy?.name || "Delivery Partner"}</h3>
                <p className="text-xs text-white/90 mt-0.5">On the way to you</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="h-11 w-11 rounded-full bg-white/20  flex items-center justify-center hover:bg-white/30 transition-colors border border-white/30">
                  <MessageSquare size={20} className="text-white" />
                </button>
                <button className="h-11 w-11 rounded-full bg-white/20  flex items-center justify-center hover:bg-white/30 transition-colors border border-white/30">
                  <Phone size={20} className="text-white" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Pickup Location Card - Redesigned */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-3xl p-5 border border-[#1a6e2e]/20"
        >
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-orange-50 flex items-center justify-center flex-shrink-0">
              <Store size={24} className="text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs font-bold text-orange-600 uppercase tracking-wider">Pickup Location</p>
              </div>
              <h4 className="font-bold text-slate-900 text-base mb-1">Store Location</h4>
              <p className="text-sm text-slate-500 leading-relaxed">
                {order.address?.address || "Address not available"}
              </p>
            </div>
            <button
              onClick={handleOpenInMaps}
              className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors flex-shrink-0"
            >
              <Navigation2 size={18} className="text-slate-700" />
            </button>
          </div>
        </motion.div>

        {/* Delivery Address Card - Redesigned */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-3xl p-5 border border-[#1a6e2e]/20"
        >
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-[#1a6e2e]/10 flex items-center justify-center flex-shrink-0">
              <MapPin size={24} className="text-[#1a6e2e]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs font-bold text-[#1a6e2e] uppercase tracking-wider">Delivery Address</p>
                <span className="bg-[#1a6e2e]/10 text-[#1a6e2e] text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {order.address.type}
                </span>
              </div>
              <h4 className="font-bold text-slate-900 text-base mb-1">{order.address.name}</h4>
              <p className="text-sm text-slate-500 leading-relaxed">
                {order.address.address}, {order.address.city}
              </p>
              {order.address?.location &&
                typeof order.address.location.lat === "number" &&
                typeof order.address.location.lng === "number" && (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#1a6e2e] bg-[#1a6e2e]/10 px-2 py-1 rounded-lg">
                    <CheckCircle size={14} className="text-[#1a6e2e]" />
                    Precise location confirmed
                  </p>
                )}
              <p className="text-sm text-slate-800 font-semibold mt-3 flex items-center gap-2">
                <Phone size={16} className="text-slate-400" />
                {order.address.phone}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Order Items - Compact Design */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-3xl p-5 border border-[#1a6e2e]/20"
        >
          {order.orderType === "custom_pickup" ? (
            <>
              <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Package size={18} className="text-slate-400" />
                Parcel Details
              </h3>
              <div className="space-y-4">
                {order.parcelDetails && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Items List / Details</p>
                    <p className="text-sm font-semibold text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {order.parcelDetails}
                    </p>
                  </div>
                )}
                {order.parcelImage && (
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Order Image / Screenshot</p>
                    <div className="max-w-xs rounded-2xl overflow-hidden ring-1 ring-slate-100 shadow-md">
                      <img src={order.parcelImage} alt="Order proof" className="w-full object-cover max-h-64" />
                    </div>
                  </div>
                )}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pickup Type</p>
                    <p className="text-sm font-black text-slate-900 mt-0.5">
                      {order.pickupType === "pay_and_collect" ? "Rider pays shop bill" : "Prepaid parcel"}
                    </p>
                  </div>
                  {order.pickupType === "pay_and_collect" && (
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bill Amount</p>
                      <p className="text-sm font-black text-slate-900 mt-0.5">₹{order.billAmount}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Package size={18} className="text-slate-400" />
                Order Items
              </h3>
              <div className="space-y-3">
                {order.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 transition-colors"
                  >
                    <div className="h-14 w-14 bg-slate-50 rounded-xl overflow-hidden flex-shrink-0 border border-slate-100">
                      <img
                        src={applyCloudinaryTransform(item.image)}
                        alt={item.name}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-slate-800 text-sm mb-0.5 truncate">
                        {item.name}
                      </h4>
                      <p className="text-slate-500 text-xs font-medium">
                        Qty: {item.quantity}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-slate-900">
                        ₹{item.price * item.quantity}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>

        {/* Bill Summary - Cleaner Design */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-3xl p-5 border border-[#1a6e2e]/20"
        >
          <h3 className="text-base font-bold text-slate-800 mb-4">Bill Summary</h3>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Item Total</span>
              <span className="font-semibold">₹{order.pricing.subtotal}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Delivery Fee</span>
              <span
                className={
                  order.pricing.deliveryFee === 0 ? "text-[#1a6e2e] font-bold" : "font-semibold"
                }>
                {order.pricing.deliveryFee === 0
                  ? "FREE"
                  : `₹${order.pricing.deliveryFee}`}
              </span>
            </div>
            {order.pricing.tip > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Tip</span>
                <span className="font-semibold">₹{order.pricing.tip}</span>
              </div>
            )}
            <div className="border-t border-slate-100 mt-3 pt-3 flex justify-between items-center">
              <span className="text-base font-bold text-slate-900">
                Total Amount
              </span>
              <span className="text-xl font-black text-[#1a6e2e]">
                ₹{order.pricing.total}
              </span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="mt-4 bg-slate-50 rounded-2xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 bg-white rounded-xl flex items-center justify-center border border-[#1a6e2e]/20">
                <CreditCard size={18} className="text-slate-700" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Payment
                </p>
                <p className="text-sm font-bold text-slate-900">
                  {order.payment.method === "cash"
                    ? "Cash on Delivery"
                    : order.payment.method}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Action Buttons - Redesigned */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="grid grid-cols-2 gap-3"
        >
          <button
            onClick={() => setShowInvoice(true)}
            className="py-3.5 rounded-2xl bg-white border-2 border-[#1a6e2e]/20 text-[#1a6e2e] font-bold hover:bg-[#1a6e2e]/10 transition-all flex items-center justify-center gap-2 text-sm active:scale-[0.98]">
            <Download size={18} /> Invoice
          </button>
          <button
            onClick={() => setShowHelp(true)}
            className="py-3.5 rounded-2xl bg-white border-2 border-[#1a6e2e]/20 text-[#1a6e2e] font-bold hover:bg-[#1a6e2e]/10 transition-all flex items-center justify-center gap-2 text-sm active:scale-[0.98]">
            <HelpCircle size={18} /> Help
          </button>
        </motion.div>

        {/* Cancellation Section - Only if applicable */}
        {(canCancelDirectly() || canRequestCancellation() || (cancellationDetails && cancellationDetails.status && cancellationDetails.status !== "NONE")) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38 }}
            className="bg-white rounded-3xl p-5 border border-[#1a6e2e]/20"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-800">
                Order Cancellation
              </h3>
            </div>

            {cancellationDetails && cancellationDetails.status && cancellationDetails.status !== "NONE" ? (
              <div className="space-y-4 text-sm">
                <CancellationProgressTracker status={cancellationDetails.status} history={cancellationDetails.status_history} />

                {/* OTP Display for Customer if pickup scheduled */}
                {cancellationDetails.status === "PICKUP_SCHEDULED" && (
                  <div className="bg-[#1a6e2e]/10 rounded-2xl p-4 border border-[#1a6e2e]/20">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-8 w-8 rounded-full bg-[#1a6e2e]/20 flex items-center justify-center">
                        <Truck size={16} className="text-[#1a6e2e]" />
                      </div>
                      <p className="text-sm font-bold text-slate-800">Cancellation Pickup Assigned</p>
                    </div>
                    <p className="text-xs text-[#1a6e2e] mb-3 ml-11">
                      A delivery partner is coming to collect your items for cancellation. Please share this OTP when they arrive:
                    </p>
                    <div className="ml-11 flex items-center gap-2">
                      {handoffOtp ? (
                        <div className="flex gap-2">
                          {handoffOtp.split('').map((digit, i) => (
                            <div key={i} className="h-10 w-8 bg-white border border-[#1a6e2e]/20 rounded-lg flex items-center justify-center text-lg font-black text-[#1a6e2e]">
                              {digit}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs font-bold text-slate-400 italic">Waiting for rider to request OTP...</p>
                      )}
                    </div>
                  </div>
                )}

                {cancellationDetails.status === "SELLER_REJECTED" && (
                  <p className="text-sm text-rose-600 font-medium bg-rose-50 p-3 rounded-xl border border-rose-100">
                    Cancellation request rejected:{" "}
                    {cancellationDetails.seller_note || "No reason provided"}
                  </p>
                )}
                {cancellationDetails.status === "CANCELLED" && (
                  <div className="bg-[#1a6e2e]/10 p-4 rounded-2xl border border-[#1a6e2e]/20">
                    <p className="text-xs font-bold text-[#1a6e2e] uppercase tracking-wider mb-1">Cancellation Completed</p>
                    <p className="text-sm text-slate-700 font-medium">
                      Your order has been successfully cancelled and ₹{order.pricing.total} has been refunded to your {order.paymentMethod === 'cod' ? 'hand (Cash)' : 'wallet'}.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                {canCancelDirectly()
                  ? "You can cancel this order directly before it is processed."
                  : "You can request an order cancellation. This will require seller approval and rider pickup."}
              </p>
            )}

            {(canCancelDirectly() || canRequestCancellation()) && (
              <button
                onClick={() => setShowCancellationModal(true)}
                className="w-full py-4 rounded-2xl bg-rose-600 text-white text-sm font-bold border border-transparent hover:bg-rose-500 transition-all active:scale-[0.98]">
                {canCancelDirectly() ? "Cancel Order" : "Request Cancellation"}
              </button>
            )}
          </motion.div>
        )}

        {/* Return Section - Only if applicable */}
        {(canRequestReturn() || (returnDetails && returnDetails.status && returnDetails.status !== "NONE" && returnDetails.status !== "CANCELLED")) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-3xl p-5 border border-[#1a6e2e]/20"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-800">
                Return & Refund
              </h3>
              {canRequestReturn() && returnCountdown !== 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-bold ring-1 ring-amber-200">
                  <Clock size={12} />
                  Ends in {returnCountdown}
                </div>
              )}
            </div>

            {returnDetails &&
              returnDetails.status &&
              returnDetails.status !== "NONE" &&
              returnDetails.status !== "CANCELLED" ? (
              <div className="space-y-4 text-sm">
                <ReturnProgressTracker returnStatus={returnDetails.status} history={returnDetails.status_history} />

                {/* Return OTP Display for Customer if pickup is assigned */}
                {returnDetails.status === "PICKUP_SCHEDULED" && (
                  <div className="bg-[#1a6e2e]/10 rounded-2xl p-4 border border-[#1a6e2e]/20">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-8 w-8 rounded-full bg-[#1a6e2e]/20 flex items-center justify-center">
                        <Truck size={16} className="text-[#1a6e2e]" />
                      </div>
                      <p className="text-sm font-bold text-slate-800">Return Pickup Assigned</p>
                    </div>
                    <p className="text-xs text-[#1a6e2e] mb-3 ml-11">
                      A delivery partner is coming to collect your return. Please share this OTP when they arrive:
                    </p>
                    <div className="ml-11 flex items-center gap-2">
                      {handoffOtp ? (
                        <div className="flex gap-2">
                          {handoffOtp.split('').map((digit, i) => (
                            <div key={i} className="h-10 w-8 bg-white border border-[#1a6e2e]/20 rounded-lg flex items-center justify-center text-lg font-black text-[#1a6e2e]">
                              {digit}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs font-bold text-slate-400 italic">Waiting for rider to request OTP...</p>
                      )}
                    </div>
                  </div>
                )}

                {returnDetails.status === "SELLER_REJECTED" && (
                  <p className="text-sm text-rose-600 font-medium bg-rose-50 p-3 rounded-xl border border-rose-100">
                    Return request rejected:{" "}
                    {returnDetails.seller_note || "No reason provided"}
                  </p>
                )}
                {returnDetails.refund_amount > 0 &&
                  returnDetails.status === "REFUND_COMPLETED" && (
                    <div className="bg-[#1a6e2e]/10 p-4 rounded-2xl border border-[#1a6e2e]/20">
                      <p className="text-xs font-bold text-[#1a6e2e] uppercase tracking-wider mb-1">Refund Successful</p>
                      <p className="text-sm text-[#1a6e2e] font-medium">
                        ₹{returnDetails.refund_amount} has been credited to your {order.paymentMethod === 'cod' ? 'hand (Cash)' : 'wallet'}.
                      </p>
                    </div>
                  )}
              </div>
            ) : (
              <p className="text-sm text-slate-500 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                You can request a return within the return eligibility window (2 hours) after delivery.
              </p>
            )}

            {canRequestReturn() && (
              <button
                onClick={() => setShowReturnModal(true)}
                className="w-full py-4 rounded-2xl bg-slate-900 text-white text-sm font-bold border border-transparent hover:bg-slate-800 transition-all active:scale-[0.98]">
                Request Return
              </button>
            )}
          </motion.div>
        )}
      </div>

      {/* Modals */}
      <InvoiceModal
        isOpen={showInvoice}
        onClose={() => setShowInvoice(false)}
        order={order}
      />
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />

      {/* Return Request Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/40"
            onClick={() => !requestingReturn && setShowReturnModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 w-full max-w-md bg-white rounded-3xl border border-[#1a6e2e]/20 p-6 space-y-4"
          >
            <h3 className="text-lg font-black text-slate-900">
              Request Return
            </h3>
            <p className="text-xs text-slate-500">
              Select the items you want to return and tell us why.
            </p>
            <div className="max-h-48 overflow-y-auto space-y-3">
              {order.items.map((item, idx) => {
                const checked = !!selectedReturnItems[idx];
                return (
                  <label
                    key={idx}
                    className="flex items-center gap-3 p-3 rounded-2xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleItemSelection(idx)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-800">
                        {item.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        Qty: {item.quantity} • ₹{item.price * item.quantity}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600">
                  Reason for return
                </label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
                >
                  <option value="" disabled>Select a reason...</option>
                  <option value="damaged_product">Damaged Product</option>
                  <option value="wrong_item">Wrong Item Delivered</option>
                  <option value="missing_items">Missing Items</option>
                  <option value="quality_issue">Quality Issue</option>
                  <option value="changed_mind">Changed Mind</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600">
                  Detailed Issue Mention
                </label>
                <textarea
                  rows={2}
                  value={returnReasonDetail}
                  onChange={(e) => setReturnReasonDetail(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
                  placeholder="Describe the issue with the product..."
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-600 uppercase">
                  Photos ({returnImageFiles.length}/5) *
                </p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {returnImagePreviews.map((img, index) => (
                    <div key={index} className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 shrink-0">
                      <img src={img} alt="proof" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center cursor-pointer hover:bg-black/80"
                      >
                        <X size={12} className="text-white" />
                      </button>
                    </div>
                  ))}
                  {returnImageFiles.length < 5 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors shrink-0"
                    >
                      {isUploadingImage ? (
                        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                      ) : (
                        <Camera className="w-5 h-5 text-slate-400" />
                      )}
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </div>

              <label className="flex items-start gap-3 p-3 rounded-2xl bg-amber-50 border border-amber-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={returnConditionAssurance}
                  onChange={(e) => setReturnConditionAssurance(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600"
                />
                <span className="text-xs font-semibold text-amber-900 leading-tight">
                  I confirm the product is returned with proper accessories and is in good condition.
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => !requestingReturn && setShowReturnModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                disabled={requestingReturn}>
                Cancel
              </button>
              <button
                onClick={handleReturnSubmit}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-70 transition-all"
                disabled={requestingReturn}>
                {requestingReturn ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Cancellation Request Modal */}
      {showCancellationModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/40"
            onClick={() => !requestingCancellation && setShowCancellationModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 w-full max-w-md bg-white rounded-3xl border border-[#1a6e2e]/20 p-6 space-y-4 font-sans"
          >
            <h3 className="text-lg font-black text-slate-900">
              {canCancelDirectly() ? "Cancel Order" : "Request Cancellation"}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              {canCancelDirectly()
                ? "Please tell us why you want to cancel this order."
                : "Cancellation requires approval from the seller and items collection. Please specify the reason."}
            </p>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600">
                  Reason for cancellation
                </label>
                <select
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 font-medium"
                >
                  <option value="" disabled>Select a reason...</option>
                  <option value="Changed my mind">Changed my mind</option>
                  <option value="Expected delivery is too late">Expected delivery is too late</option>
                  <option value="Incorrect delivery address">Incorrect delivery address</option>
                  <option value="Ordered incorrect products">Ordered incorrect products</option>
                  <option value="Other">Other reason</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600">
                  Detailed Issue / Comment (Optional)
                </label>
                <textarea
                  rows={3}
                  value={cancellationReasonDetail}
                  onChange={(e) => setCancellationReasonDetail(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 font-medium"
                  placeholder="Tell us more about your cancellation reason..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => !requestingCancellation && setShowCancellationModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                disabled={requestingCancellation}>
                Cancel
              </button>
              <button
                onClick={handleCancellationSubmit}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-70 transition-all border border-transparent"
                disabled={requestingCancellation}>
                {requestingCancellation ? "Submitting..." : "Confirm"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default OrderDetailPage;
