import React from "react";
import { cn } from "@/lib/utils";
import { motion, useMotionValue } from "framer-motion";
import {
  applyCloudinaryTransform,
  buildCloudinarySrcSet,
  isCloudinaryUrl,
} from "@/core/utils/imageUtils";

import { isMobileOrWebView } from "@/core/utils/deviceUtils";
import newBanner from "@/assets/banner_new.png";


const BANNER_CHUNK_SIZE = 20;

const isVideoUrl = (url) => {
  if (!url) return false;
  return (
    url.includes("/video/upload/") ||
    /\.(mp4|webm|ogg|mov|m4v)($|\?)/i.test(url)
  );
};

const ExperienceBannerCarousel = ({ section, items, fullWidth = false, slideGap = 0, edgeToEdge = false }) => {
  if (!items.length) return null;

  const [activeIndex, setActiveIndex] = React.useState(0);
  const [visibleCount, setVisibleCount] = React.useState(() =>
    Math.min(items.length, BANNER_CHUNK_SIZE)
  );
  const visibleItems = items.slice(0, visibleCount);
  const totalItems = visibleItems.length;
  const x = useMotionValue(0);
  const containerRef = React.useRef(null);
  const hasMore = visibleCount < items.length;

  const loadMore = React.useCallback(() => {
    setVisibleCount((prev) => Math.min(items.length, prev + BANNER_CHUNK_SIZE));
  }, [items.length]);

  React.useEffect(() => {
    setVisibleCount(Math.min(items.length, BANNER_CHUNK_SIZE));
    setActiveIndex(0);
  }, [items.length]);

  // Auto-play logic
  React.useEffect(() => {
    if (totalItems <= 1) return;

    const intervalId = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % totalItems);
    }, 4500);

    return () => clearInterval(intervalId);
  }, [totalItems]);

  React.useEffect(() => {
    if (!hasMore) return;
    if (activeIndex >= totalItems - 2) {
      loadMore();
    }
  }, [activeIndex, totalItems, hasMore, loadMore]);

  const handleDragEnd = (_, info) => {
    const threshold = 50;
    if (info.offset.x < -threshold) {
      // Swipe left -> Next
      setActiveIndex((prev) => Math.min(prev + 1, totalItems - 1));
    } else if (info.offset.x > threshold) {
      // Swipe right -> Prev
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    }
  };

  const getBannerOptimizedSrc = React.useCallback((url) => {
    if (!url) return url;
    if (url.includes("d2rmrcv7ku9jedetdano")) return newBanner;
    if (!isCloudinaryUrl(url)) return url;
    return applyCloudinaryTransform(url, "f_auto,q_auto,c_fill,g_auto,w_824,h_440");
  }, []);


  return (
    <div className={cn("overflow-hidden touch-pan-y", fullWidth && "w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] md:w-full md:static md:ml-0 md:mr-0 md:max-w-6xl md:mx-auto md:rounded-[2rem]")}>
      <motion.div
        ref={containerRef}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        animate={{ x: `-${(activeIndex / totalItems) * 100}%` }}
        transition={isMobileOrWebView() ? { type: "tween", ease: "easeInOut", duration: 0.3 } : { type: "spring", stiffness: 300, damping: 30 }}
        className="flex"
        style={{ width: `${totalItems * 100}%` }}
      >
        {visibleItems.map((banner, idx) => (
          <div
            key={idx}
            className={cn(
              "relative shrink-0 overflow-hidden bg-slate-100 flex items-center justify-center box-border",
              fullWidth ? "h-[200px] sm:h-[280px] md:h-[380px] lg:h-[440px] md:rounded-[2rem] px-0" : "h-[200px] sm:h-[280px] md:h-[380px] lg:h-[440px] px-4 md:px-8"
            )}
            style={{ width: `${100 / totalItems}%` }}
          >
            {fullWidth ? (
              isVideoUrl(banner.imageUrl) ? (
                <>
                  <video
                    src={banner.imageUrl}
                    className="w-full h-full object-cover object-center pointer-events-none"
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                  {/* Bottom Scrolling Marquee Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-[#3a2a83]/90 text-white py-1 md:py-1.5 overflow-hidden whitespace-nowrap z-30 font-black border-t border-white/10 uppercase tracking-widest text-[9px] md:text-[11px]">
                      <div className="classic-marquee-track flex w-max items-center gap-8">
                          <span>One App. Every Shop. Every Need. Delivered Fast & Safe</span>
                          <span className="text-yellow-400">&bull;</span>
                          <span>One App. Every Shop. Every Need. Delivered Fast & Safe</span>
                          <span className="text-yellow-400">&bull;</span>
                          <span>One App. Every Shop. Every Need. Delivered Fast & Safe</span>
                          <span className="text-yellow-400">&bull;</span>
                          <span>One App. Every Shop. Every Need. Delivered Fast & Safe</span>
                          <span className="text-yellow-400">&bull;</span>
                      </div>
                  </div>
                </>
              ) : (
                <img
                  src={getBannerOptimizedSrc(banner.imageUrl)}
                  srcSet={
                    isCloudinaryUrl(banner.imageUrl) && !banner.imageUrl.includes("d2rmrcv7ku9jedetdano")
                      ? buildCloudinarySrcSet(banner.imageUrl, [
                          { w: 412, h: 220 },
                          { w: 824, h: 440 },
                          { w: 1248, h: 660 },
                        ])
                      : undefined
                  }
                  sizes="100vw"
                  alt={banner.title || section?.title || "Banner"}
                  className="w-full h-full object-cover object-center pointer-events-none"
                  width={412}
                  height={220}
                  loading={idx === 0 ? "eager" : "lazy"}
                  fetchPriority={idx === 0 ? "high" : "low"}
                  decoding="async"
                />
              )
            ) : (
              <div className="h-full w-full max-w-[560px] overflow-hidden rounded-3xl bg-slate-100  relative">
                {isVideoUrl(banner.imageUrl) ? (
                  <>
                    <video
                      src={banner.imageUrl}
                      className="w-full h-full object-cover object-center pointer-events-none"
                      autoPlay
                      loop
                      muted
                      playsInline
                    />
                    {/* Bottom Scrolling Marquee Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-[#3a2a83]/90 text-white py-1 md:py-1.5 overflow-hidden whitespace-nowrap z-30 font-black border-t border-white/10 uppercase tracking-widest text-[9px] md:text-[11px]">
                        <div className="classic-marquee-track flex w-max items-center gap-8">
                            <span>One App. Every Shop. Every Need. Delivered Fast & Safe</span>
                            <span className="text-yellow-400">&bull;</span>
                            <span>One App. Every Shop. Every Need. Delivered Fast & Safe</span>
                            <span className="text-yellow-400">&bull;</span>
                            <span>One App. Every Shop. Every Need. Delivered Fast & Safe</span>
                            <span className="text-yellow-400">&bull;</span>
                            <span>One App. Every Shop. Every Need. Delivered Fast & Safe</span>
                            <span className="text-yellow-400">&bull;</span>
                        </div>
                    </div>
                  </>
                ) : (
                  <img
                    src={getBannerOptimizedSrc(banner.imageUrl)}
                    srcSet={
                      isCloudinaryUrl(banner.imageUrl) && !banner.imageUrl.includes("d2rmrcv7ku9jedetdano")
                        ? buildCloudinarySrcSet(banner.imageUrl, [
                            { w: 560, h: 220 },
                            { w: 1120, h: 440 },
                          ])
                        : undefined
                    }
                    sizes="(max-width: 768px) 100vw, 560px"
                    alt={banner.title || section?.title || "Banner"}
                    className="w-full h-full object-cover object-center pointer-events-none"
                    width={560}
                    height={220}
                    loading={idx === 0 ? "eager" : "lazy"}
                    fetchPriority={idx === 0 ? "high" : "low"}
                    decoding="async"
                  />
                )}
              </div>
            )}
          </div>
        ))}
      </motion.div>
    </div>
  );
};

export default ExperienceBannerCarousel;
