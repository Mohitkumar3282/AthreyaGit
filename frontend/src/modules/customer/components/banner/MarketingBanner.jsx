import React, { useState, useEffect, memo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Tag, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import VideoBanner from "./VideoBanner";

const MarketingBanner = memo(({ videoData, offers = [] }) => {
    const navigate = useNavigate();
    const [currentVideoIdx, setCurrentVideoIdx] = useState(0);
    const [currentOfferIdx, setCurrentOfferIdx] = useState(0);

    const videos = videoData?.videos || [];
    const activeVideo = videos[currentVideoIdx] || null;

    // Cycle through videos if there are multiple for that time period
    useEffect(() => {
        if (videos.length <= 1) return;
        const interval = setInterval(() => {
            setCurrentVideoIdx((prev) => (prev + 1) % videos.length);
        }, 8000); // Shift promo videos every 8 seconds
        return () => clearInterval(interval);
    }, [videos]);

    // Cycle through offers inside the banner overlay
    useEffect(() => {
        if (offers.length <= 1) return;
        const interval = setInterval(() => {
            setCurrentOfferIdx((prev) => (prev + 1) % offers.length);
        }, 5000); // Cycle offers every 5 seconds
        return () => clearInterval(interval);
    }, [offers]);

    const activeOffer = offers[currentOfferIdx] || null;

    return (
        <div className="relative w-full rounded-2xl overflow-hidden border border-[#0d4f1c] bg-[#021f0b] shadow-lg aspect-[21/9] md:aspect-[3/1] min-h-[175px]">
            {/* Background Video */}
            {activeVideo && <VideoBanner videoUrl={activeVideo.url} />}

            {/* Content Overlay */}
            <div className="absolute inset-0 z-20 p-4 md:p-6 flex flex-col justify-between text-white">
                
                {/* Top Section: Time of day badge and dynamic scrolling offer */}
                <div className="flex justify-between items-start w-full">
                    {/* Time period indicator */}
                    <span className="px-2.5 py-0.5 bg-[#A3E635] text-[#042A0F] text-[9px] font-black rounded-full uppercase tracking-wider shadow-sm">
                        {videoData?.timeOfDay || "Today's Specials"}
                    </span>

                    {/* Dynamic configured offer badge */}
                    {activeOffer && (
                        <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 text-[#A3E635] max-w-[60%] animate-in fade-in slide-in-from-top-1 duration-300">
                            <Tag size={10} className="shrink-0" />
                            <span className="text-[8.5px] font-black tracking-tight truncate">
                                {activeOffer.type}: {activeOffer.value}
                            </span>
                        </div>
                    )}
                </div>

                {/* Bottom Section: Promo text details & CTA button */}
                <div className="flex justify-between items-end gap-4 mt-2">
                    <div className="flex-1 min-w-0">
                        {/* Offer message */}
                        {activeOffer && (
                            <p className="text-[#A3E635] text-[10px] font-bold uppercase tracking-wider mb-1 line-clamp-1">
                                {activeOffer.title}
                            </p>
                        )}
                        
                        {/* Main title */}
                        <h2 className="text-[16px] md:text-2xl font-black leading-tight truncate">
                            {videoData?.text || "Fresh & Hot Specials"}
                        </h2>
                        
                        {/* Subtitle */}
                        <p className="text-[10px] md:text-sm text-slate-200 mt-0.5 leading-tight truncate">
                            {videoData?.subtitle || "Delivered fast & fresh to your home"}
                        </p>
                    </div>

                    {/* CTA button */}
                    <Button 
                        size="sm"
                        className="shrink-0 bg-[#A3E635] hover:bg-[#b0f53c] active:scale-95 text-[#042A0F] font-black text-[10px] md:text-xs rounded-xl px-4 py-2 flex items-center gap-1 border-0 shadow-md transition-transform"
                        onClick={() => {
                            if (videoData?.redirectUrl) {
                                if (videoData.redirectUrl.startsWith("http://") || videoData.redirectUrl.startsWith("https://")) {
                                    window.location.href = videoData.redirectUrl;
                                } else {
                                    navigate(videoData.redirectUrl);
                                }
                            } else {
                                const scrollTarget = document.getElementById("todays-needs");
                                if (scrollTarget) {
                                    scrollTarget.scrollIntoView({ behavior: "smooth" });
                                }
                            }
                        }}
                    >
                        {videoData?.cta || "Shop Now"}
                        <ArrowRight size={12} className="stroke-[3]" />
                    </Button>
                </div>
            </div>
        </div>
    );
});

MarketingBanner.displayName = "MarketingBanner";

export default MarketingBanner;
