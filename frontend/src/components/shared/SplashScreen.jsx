import React, { useEffect, useState, useRef } from "react";
import gsap from "gsap";
import LogoImage from "../../assets/Logo.png";
import { useSettings } from '@core/context/SettingsContext';

const SplashScreen = ({ onFinished }) => {
  const { settings } = useSettings();
  const [percentage, setPercentage] = useState(0);
  const containerRef = useRef(null);
  const logoRef = useRef(null);
  const textRef = useRef(null);
  const progressSectionRef = useRef(null);
  const progressBarRef = useRef(null);

  useEffect(() => {
    // progress object for value tweening
    const progressObj = { value: 0 };
    
    // Create main GSAP timeline
    const tl = gsap.timeline({
      onComplete: () => {
        // Exit fade out & slide up animation
        const finish = () => {
          gsap.to(containerRef.current, {
            opacity: 0,
            y: -20,
            scale: 0.98,
            duration: 0.15,
            ease: "power3.inOut",
            onComplete: () => {
              if (onFinished) onFinished();
            }
          });
        };

        const isHome = typeof window !== "undefined" && (window.location.pathname === "/" || window.location.pathname === "/home");

        if (typeof window !== "undefined" && (window.__homeDataLoaded__ || !isHome)) {
          finish();
        } else if (typeof window !== "undefined") {
          // Safety fallback: auto-clear splash after 1.5 seconds if resolve is not called
          const safetyTimeout = setTimeout(() => {
            finish();
            window.__resolveHomeData__ = null;
          }, 1500);

          window.__resolveHomeData__ = () => {
            clearTimeout(safetyTimeout);
            finish();
            window.__resolveHomeData__ = null;
          };
        } else {
          finish();
        }
      }
    });

    // 1. Logo entry (scale 0.8 -> 1.0, fade in)
    tl.fromTo(logoRef.current,
      { opacity: 0, scale: 0.8 },
      { opacity: 1, scale: 1, duration: 0.2, ease: "back.out(1.2)" }
    );

    // 2. Text elements entry
    tl.fromTo(textRef.current,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.15, ease: "power2.out" },
      "-=0.15" // overlaps with logo entry completion
    );

    // 3. Loader display
    tl.fromTo(progressSectionRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.08 },
      "-=0.08"
    );

    // 4. Progress bar fill & counter animation (takes 0.25s)
    tl.to(progressBarRef.current, {
      scaleX: 1,
      duration: 0.25,
      ease: "power2.inOut"
    }, "-=0.04");

    tl.to(progressObj, {
      value: 100,
      duration: 0.25,
      ease: "power2.inOut",
      onUpdate: () => {
        setPercentage(Math.floor(progressObj.value));
      }
    }, "<"); // run concurrently with progress bar scale

    // 5. Pulsing logo glow / shimmer effect
    gsap.to(logoRef.current, {
      boxShadow: "0 20px 60px rgba(58, 42, 131, 0.45), 0 0 30px rgba(241, 90, 36, 0.25)",
      borderColor: "rgba(255, 255, 255, 0.25)",
      repeat: -1,
      yoyo: true,
      duration: 1.2,
      ease: "sine.inOut"
    });

    return () => {
      tl.kill();
      gsap.killTweensOf(logoRef.current);
    };
  }, [onFinished]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-gradient-to-br from-[#f0ebff] via-[#f7f5ff] to-[#fff2eb] select-none overflow-hidden font-sans"
    >
      {/* Decorative premium radial gradients matching logo colors */}
      <div className="absolute w-[350px] h-[350px] sm:w-[500px] sm:h-[500px] rounded-full bg-[#3a2a83]/8 blur-[100px] -top-20 -left-20 pointer-events-none animate-pulse duration-[6s]" />
      <div className="absolute w-[350px] h-[350px] sm:w-[500px] sm:h-[500px] rounded-full bg-[#f15a24]/8 blur-[100px] -bottom-20 -right-20 pointer-events-none animate-pulse duration-[8s]" />
      
      {/* Gridded backdrop matrix for light mode */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(58,42,131,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(58,42,131,0.015)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)] pointer-events-none" />

      {/* Shimmer background overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[bgShimmer_3s_infinite] pointer-events-none" />

      {/* Center Layout Container */}
      <div className="flex flex-col items-center gap-6 z-10 text-center px-4 max-w-sm sm:max-w-md w-full">
        {/* Animated logo box */}
        <div 
          ref={logoRef}
          className="relative w-40 h-40 sm:w-52 sm:h-52 rounded-[2.5rem] bg-[#0e0c24] border border-[#3a2a83]/20 shadow-[0_25px_60px_rgba(58,42,131,0.25)] flex items-center justify-center p-5 group overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-[#3a2a83]/30 to-transparent opacity-100" />
          <img
            src={settings?.logoUrl || LogoImage}
            alt="Athreya Delivery Logo"
            className="w-full h-full object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.35)]"
          />
          {/* Shimmering beam effect */}
          <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-100 shadow-2xl animate-[shimmer_2.2s_infinite]" />
        </div>

        {/* Brand Text Header */}
        <div ref={textRef} className="flex flex-col gap-1.5 mt-2">
          <h1 className="text-2xl sm:text-3xl font-[1000] tracking-[0.12em] uppercase flex items-center justify-center gap-2">
            <span className="text-[#3a2a83]">ATHREYA</span>
            <span className="text-[#f15a24] bg-gradient-to-r from-[#f15a24] to-[#f97316] bg-clip-text text-transparent">DELIVERY</span>
          </h1>
          <p className="text-[10px] sm:text-xs font-black tracking-[0.35em] text-[#3a2a83]/80 uppercase">
            Freshness Guaranteed
          </p>
        </div>

        {/* Loading Progress Section */}
        <div ref={progressSectionRef} className="w-48 sm:w-56 flex flex-col items-center gap-3 mt-8">
          {/* Progress Track */}
          <div className="relative w-full h-[3px] bg-[#3a2a83]/10 rounded-full overflow-hidden">
            <div
              ref={progressBarRef}
              className="absolute left-0 top-0 h-full w-full bg-gradient-to-r from-[#3a2a83] via-[#8253d6] to-[#f15a24] origin-left rounded-full"
              style={{ transform: "scaleX(0)" }}
            />
          </div>
          {/* Percentage text */}
          <span className="text-[10px] sm:text-xs font-black tracking-widest text-[#3a2a83]/60 uppercase leading-none">
            Loading {percentage}%
          </span>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { left: -150%; }
          100% { left: 150%; }
        }
        @keyframes bgShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
