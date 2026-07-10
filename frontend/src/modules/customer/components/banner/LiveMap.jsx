import React, { memo } from "react";
import LiveTrackingMap from "../order/LiveTrackingMap";

const LiveMap = memo(({
    status,
    eta,
    riderName,
    riderLocation,
    sellerLocation,
    destinationLocation,
    workflowStatus,
    routePolyline
}) => {
    // Determine route phase
    const routePhase = workflowStatus === "OUT_FOR_DELIVERY" ? "delivery" : "pickup";

    const handleOpenInMaps = ({ riderLocation, destinationLocation }) => {
        if (riderLocation) {
            window.open(`https://www.google.com/maps/search/?api=1&query=${riderLocation.lat},${riderLocation.lng}`, "_blank");
        } else if (destinationLocation) {
            window.open(`https://www.google.com/maps/search/?api=1&query=${destinationLocation.lat},${destinationLocation.lng}`, "_blank");
        }
    };

    return (
        <div className="w-full h-[220px] rounded-xl overflow-hidden shadow-md relative border border-[#0d4f1c] bg-[#021f0b]">
            <LiveTrackingMap
                status={status}
                eta={eta || "10 mins"}
                riderName={riderName || "Delivery Partner"}
                riderLocation={riderLocation}
                sellerLocation={sellerLocation}
                destinationLocation={destinationLocation}
                routePhase={routePhase}
                routePolyline={routePolyline}
                onOpenInMaps={handleOpenInMaps}
            />
        </div>
    );
});

LiveMap.displayName = "LiveMap";

export default LiveMap;
