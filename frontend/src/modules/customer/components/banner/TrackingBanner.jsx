import React, { memo } from "react";
import TrackingTimeline from "./TrackingTimeline";
import LiveMap from "./LiveMap";
import OrderStatusCard from "./OrderStatusCard";

const TrackingBanner = memo(({ order, stage, riderLocation, routePolyline, dynamicEta, dynamicDistance }) => {
    if (!order) return null;

    const showMap = stage === 5; // Integrate Google Maps only after pickup
    const eta = dynamicEta || "15-20 mins";

    return (
        <div className="w-full bg-[#021f0b] border border-[#0d4f1c] rounded-2xl overflow-hidden shadow-lg flex flex-col gap-3 p-3">
            
            {/* Stage Timeline */}
            <TrackingTimeline currentStage={stage} />

            {/* Google Map (Stage 5) */}
            {showMap && (
                <div className="w-full">
                    <LiveMap
                        status={order.workflowStatus || order.status}
                        eta={eta}
                        riderName={order.deliveryBoy?.fullName}
                        riderLocation={riderLocation}
                        sellerLocation={
                            order.seller?.location
                                ? { lat: order.seller.location.coordinates[1], lng: order.seller.location.coordinates[0] }
                                : null
                        }
                        destinationLocation={order.address?.location}
                        workflowStatus={order.workflowStatus}
                        routePolyline={routePolyline}
                    />
                </div>
            )}

            {/* Order status details / rider info */}
            <OrderStatusCard stage={stage} order={order} eta={eta} dynamicDistance={dynamicDistance} />
        </div>
    );
});

TrackingBanner.displayName = "TrackingBanner";

export default TrackingBanner;
