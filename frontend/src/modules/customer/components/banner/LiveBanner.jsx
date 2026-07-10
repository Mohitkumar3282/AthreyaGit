import React, { memo } from "react";
import { useBanner } from "./hooks/useBanner";
import MarketingBanner from "./MarketingBanner";
import TrackingBanner from "./TrackingBanner";
import ThankYouAnimation from "./ThankYouAnimation";

const LiveBanner = memo(() => {
    const {
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
    } = useBanner();

    // 1. Loading state (skeleton banner)
    if (mode === "marketing" && !promoVideos) {
        return (
            <div className="w-full bg-[#021f0b] border border-[#0d4f1c] rounded-2xl p-6 min-h-[175px] animate-pulse flex flex-col justify-between">
                <div className="h-4 bg-[#A3E635]/20 rounded w-1/4" />
                <div className="space-y-2">
                    <div className="h-6 bg-[#A3E635]/20 rounded w-3/4" />
                    <div className="h-3 bg-[#A3E635]/20 rounded w-1/2" />
                </div>
                <div className="flex justify-between items-center">
                    <div className="h-3 bg-[#A3E635]/20 rounded w-1/3" />
                    <div className="h-8 bg-[#A3E635]/20 rounded-xl w-24" />
                </div>
            </div>
        );
    }

    // 2. Tracking / Delivered / Thank You animations
    if (mode === "tracking" || showThankYou || currentStage >= 6) {
        if (currentStage >= 6) {
            return <ThankYouAnimation isThankYouStage={currentStage === 7} />;
        }

        return (
            <TrackingBanner
                order={activeOrder}
                stage={currentStage}
                riderLocation={riderLocation}
                routePolyline={routePolyline}
                dynamicEta={dynamicEta}
                dynamicDistance={dynamicDistance}
            />
        );
    }

    // 3. Marketing Mode
    return (
        <MarketingBanner
            videoData={promoVideos}
            offers={promoOffers}
        />
    );
});

LiveBanner.displayName = "LiveBanner";

export default LiveBanner;
