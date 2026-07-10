import { useState, useEffect, useRef } from "react";
import { bannerService } from "../bannerService";
import { getLegacyStatusFromOrder, WORKFLOW_STATUS } from "@/shared/utils/orderStatus";
import {
    getOrderSocket,
    joinOrderRoom,
    leaveOrderRoom,
    onOrderStatusUpdate,
    onDeliveryOtpValidated
} from "@/core/services/orderSocket";
import { subscribeToOrderLocation, subscribeToOrderRoute } from "@/core/services/trackingClient";
import { createSocketTokenReader } from "@core/utils/authStorage";
import { STORAGE_KEYS } from "@core/utils/storage";

const TIME_OF_DAY_POLL_INTERVAL_MS = 60 * 1000; // Poll time-of-day changes every minute
const ACTIVE_ORDER_POLL_INTERVAL_MS = 15 * 1000; // Check active orders every 15s

export function useBanner() {
    const [mode, setMode] = useState("marketing"); // "marketing" | "tracking"
    const [promoVideos, setPromoVideos] = useState(null);
    const [promoOffers, setPromoOffers] = useState([]);
    
    // Tracking States
    const [activeOrder, setActiveOrder] = useState(null);
    const [currentStage, setCurrentStage] = useState(1); // 1 to 7
    const [riderLocation, setRiderLocation] = useState(null);
    const [routePolyline, setRoutePolyline] = useState(null);
    const [dynamicEta, setDynamicEta] = useState(null);
    const [dynamicDistance, setDynamicDistance] = useState(null);
    const [showThankYou, setShowThankYou] = useState(false);

    const activeOrderRef = useRef(null);
    const orderSubscriptionCleanupRef = useRef(null);

    // Get Socket Token Reader
    const getToken = () => {
        try {
            const reader = createSocketTokenReader(STORAGE_KEYS.AUTH_CUSTOMER);
            return typeof reader === "function" ? reader() : reader;
        } catch (e) {
            return null;
        }
    };

    // 1. Time-of-day and offers polling (Marketing Mode)
    useEffect(() => {
        const fetchMarketingContent = async () => {
            const videoData = await bannerService.getVideos();
            setPromoVideos(videoData);

            const offerData = await bannerService.getOffers();
            setPromoOffers(offerData || []);
        };

        fetchMarketingContent();
        const interval = setInterval(fetchMarketingContent, TIME_OF_DAY_POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, []);

    // 2. Map workflow status to the 7 banner stages
    const getStageFromOrder = (order) => {
        if (!order) return 1;
        const workflowStatus = order.workflowStatus ? String(order.workflowStatus).toUpperCase() : "";
        const legacyStatus = getLegacyStatusFromOrder(order);

        // Stage 6: Delivered
        if (workflowStatus === WORKFLOW_STATUS.DELIVERED || legacyStatus === "delivered" || order.deliveredAt) {
            return 6;
        }

        // Stage 4 / 5: Picked Up & Live Tracking
        if (workflowStatus === WORKFLOW_STATUS.OUT_FOR_DELIVERY || legacyStatus === "out_for_delivery") {
            return 5; // Show Live Tracking Map & Rider status card
        }

        // Stage 3: Ready For Pickup
        if (workflowStatus === WORKFLOW_STATUS.PICKUP_READY) {
            return 3;
        }

        // Stage 2: Preparing Order
        if (
            workflowStatus === WORKFLOW_STATUS.SELLER_ACCEPTED ||
            workflowStatus === WORKFLOW_STATUS.DELIVERY_SEARCH ||
            workflowStatus === WORKFLOW_STATUS.DELIVERY_ASSIGNED
        ) {
            return 2;
        }

        // Stage 1: Order Confirmed
        return 1;
    };

    // 3. Setup location & polyline subscriptions for tracking
    const setupRealtimeTracking = (orderId, riderId) => {
        // Clean up previous subscriptions if any
        if (orderSubscriptionCleanupRef.current) {
            orderSubscriptionCleanupRef.current();
        }

        const unsubLocation = subscribeToOrderLocation(orderId, (location) => {
            if (location && typeof location.lat === "number" && typeof location.lng === "number") {
                setRiderLocation({ lat: location.lat, lng: location.lng });
            }
        });

        const unsubRoute = subscribeToOrderRoute(orderId, (route) => {
            if (route) {
                if (route.polyline) {
                    setRoutePolyline(route);
                }
                if (route.duration) {
                    setDynamicEta(route.duration);
                }
                if (route.distance) {
                    setDynamicDistance(route.distance);
                }
            }
        });

        orderSubscriptionCleanupRef.current = () => {
            unsubLocation();
            unsubRoute();
        };
    };

    // 4. Handle transition back to marketing after delivery thank you
    const handleOrderDelivered = () => {
        setCurrentStage(6); // Show Success Check
        
        // After 4 seconds, show Thank You screen (Stage 7)
        setTimeout(() => {
            setCurrentStage(7);
            setShowThankYou(true);
            
            // After 4 more seconds, transition back to Marketing mode
            setTimeout(() => {
                setMode("marketing");
                setActiveOrder(null);
                activeOrderRef.current = null;
                setRiderLocation(null);
                setRoutePolyline(null);
                setShowThankYou(false);
            }, 4000);
        }, 4000);
    };

    // 5. Update status handler
    const handleStatusUpdate = (orderData) => {
        if (!orderData) return;
        
        const stage = getStageFromOrder(orderData);
        
        // If transitioning to Stage 6 (Delivered)
        if (stage === 6 && currentStage < 6) {
            handleOrderDelivered();
            return;
        }

        setCurrentStage(stage);
        setActiveOrder((prev) => ({
            ...prev,
            ...orderData
        }));

        // Trigger realtime location tracking if Out for Delivery and delivery boy is assigned
        if (stage >= 4 && orderData.orderId) {
            setupRealtimeTracking(orderData.orderId, orderData.deliveryBoy?._id || orderData.deliveryBoy);
        }
    };

    // 6. Socket connection & Active Order lifecycle manager
    useEffect(() => {
        const token = getToken();

        const checkActiveOrder = async () => {
            // If Thank You screen is active, do not interrupt it
            if (showThankYou || currentStage === 6 || currentStage === 7) return;

            const order = await bannerService.getActiveOrder();
            if (order) {
                const prevOrder = activeOrderRef.current;
                activeOrderRef.current = order;
                setActiveOrder(order);
                setMode("tracking");

                const stage = getStageFromOrder(order);
                setCurrentStage(stage);

                // Join order socket room
                if (token && order.orderId) {
                    joinOrderRoom(order.orderId, token);
                }

                // If Out for Delivery, subscribe to location
                if (stage >= 4 && order.orderId) {
                    setupRealtimeTracking(order.orderId, order.deliveryBoy?._id || order.deliveryBoy);
                }

                // Fetch initial rider location details and ETA from API
                if (order.orderId) {
                    bannerService.getRiderLocation(order.orderId).then((riderLocData) => {
                        if (riderLocData) {
                            if (riderLocData.eta) {
                                setDynamicEta(riderLocData.eta);
                            }
                            if (riderLocData.remainingDistanceKm) {
                                setDynamicDistance(`${riderLocData.remainingDistanceKm} km`);
                            }
                            if (riderLocData.riderLocation) {
                                setRiderLocation(riderLocData.riderLocation);
                            }
                        }
                    }).catch((err) => {
                        console.warn("Failed to fetch initial rider location / ETA:", err);
                    });
                }

                // If status was active but is now delivered
                if (stage === 6 && (!prevOrder || getStageFromOrder(prevOrder) < 6)) {
                    handleOrderDelivered();
                }
            } else {
                // No active order found
                if (mode === "tracking" && !showThankYou && currentStage < 6) {
                    setMode("marketing");
                    setActiveOrder(null);
                    activeOrderRef.current = null;
                    setRiderLocation(null);
                    setRoutePolyline(null);
                }
            }
        };

        checkActiveOrder();
        const pollInterval = setInterval(checkActiveOrder, ACTIVE_ORDER_POLL_INTERVAL_MS);

        // Listen for Socket events
        let unsubSocketStatus = null;
        let unsubSocketOtp = null;

        if (token) {
            getOrderSocket(token);

            unsubSocketStatus = onOrderStatusUpdate(token, (payload) => {
                console.log("[useBanner] Socket order status update:", payload);
                if (payload && activeOrderRef.current && (payload.orderId === activeOrderRef.current.orderId || payload._id === activeOrderRef.current._id)) {
                    handleStatusUpdate(payload);
                }
            });

            unsubSocketOtp = onDeliveryOtpValidated(token, (payload) => {
                console.log("[useBanner] Socket OTP validated:", payload);
                if (payload && activeOrderRef.current && payload.orderId === activeOrderRef.current.orderId) {
                    handleOrderDelivered();
                }
            });
        }

        return () => {
            clearInterval(pollInterval);
            if (unsubSocketStatus) unsubSocketStatus();
            if (unsubSocketOtp) unsubSocketOtp();
            if (orderSubscriptionCleanupRef.current) {
                orderSubscriptionCleanupRef.current();
            }
            if (token && activeOrderRef.current?.orderId) {
                leaveOrderRoom(activeOrderRef.current.orderId, token);
            }
        };
    }, [mode, currentStage, showThankYou]);

    return {
        mode,
        promoVideos,
        promoOffers,
        activeOrder,
        currentStage,
        riderLocation,
        routePolyline,
        dynamicEta,
        dynamicDistance,
        showThankYou
    };
}
