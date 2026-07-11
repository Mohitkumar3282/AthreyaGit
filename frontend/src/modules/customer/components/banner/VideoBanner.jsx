import React, { useEffect, useRef, useState, memo } from "react";
import { Loader2 } from "lucide-react";

const VideoBanner = memo(({ videoUrl, posterUrl }) => {
    const videoRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        setIsLoading(true);
        setHasError(false);

        if (videoRef.current) {
            videoRef.current.load();
            // In modern browsers, autoplay requires muted
            videoRef.current.muted = true;
            videoRef.current.play().catch((err) => {
                console.warn("[VideoBanner] Video playback failed or interrupted:", err);
            });
        }
    }, [videoUrl]);

    const handleCanPlay = () => {
        setIsLoading(false);
    };

    const handleVideoError = () => {
        setIsLoading(false);
        setHasError(true);
    };

    return (
        <div 
            className="relative w-full h-full min-h-[160px] bg-[#021f0b] rounded-2xl overflow-hidden shadow-inner flex items-center justify-center bg-cover bg-center"
            style={{ backgroundImage: posterUrl ? `url(${posterUrl})` : undefined }}
        >
            {/* Dark green overlay for readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10 z-10 pointer-events-none" />

            {isLoading && (
                <div className="absolute z-20 flex items-center justify-center">
                    <Loader2 className="animate-spin text-[#A3E635] w-6 h-6" />
                </div>
            )}

            {hasError ? (
                // Safe image background fallback if video fails to load
                <div 
                    className="absolute inset-0 bg-cover bg-center" 
                    style={{ backgroundImage: `url('https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&fit=crop')` }}
                />
            ) : (
                <video
                    ref={videoRef}
                    src={videoUrl}
                    poster={posterUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="none"
                    onCanPlay={handleCanPlay}
                    onError={handleVideoError}
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
                        isLoading ? "opacity-0" : "opacity-100"
                    }`}
                />
            )}
        </div>
    );
});

VideoBanner.displayName = "VideoBanner";

export default VideoBanner;
