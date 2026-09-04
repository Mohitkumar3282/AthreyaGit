import React, { useEffect, useRef, useState } from "react";
import LogoTransparent from "../../assets/LogoTransparent.png";
import { useSettings } from '@core/context/SettingsContext';

/**
 * SplashScreen
 *
 * Runs on every cold load, so it deliberately carries no animation library.
 * This used to drive its timeline with GSAP, which cost ~230 KB of JavaScript
 * in the entry chunk purely to fade a logo in — the splash screen was the only
 * GSAP consumer in the app. Everything here is now CSS keyframes and
 * transitions, which the compositor runs off the main thread.
 *
 * Timing contract (unchanged from the GSAP version):
 *   - the intro plays for INTRO_MS
 *   - on Home we then wait for the page to signal `window.__resolveHomeData__`,
 *     with a SAFETY_MS fallback so a slow/failed fetch can never trap the user
 *   - off Home we exit as soon as the intro finishes
 */

const INTRO_MS = 450;   // logo + text + progress bar fill
const SAFETY_MS = 1500; // hard cap on waiting for Home's data signal
const EXIT_MS = 150;    // fade/slide out

const SplashScreen = ({ onFinished }) => {
  const { settings } = useSettings();
  const [percentage, setPercentage] = useState(0);
  const [exiting, setExiting] = useState(false);
  const onFinishedRef = useRef(onFinished);

  // Keep the latest callback without making it an effect dependency — a new
  // function identity from the parent must not restart the splash timeline.
  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    const timers = [];
    let done = false;

    // Drive the counter off rAF rather than a GSAP tween. Skipped entirely for
    // users who asked for reduced motion — they just see 100%.
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    if (prefersReducedMotion) {
      setPercentage(100);
    } else {
      const started = performance.now();
      const tick = (now) => {
        const progress = Math.min(1, (now - started) / INTRO_MS);
        setPercentage(Math.floor(progress * 100));
        if (progress < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    const finish = () => {
      if (done) return;
      done = true;
      setExiting(true);
      timers.push(setTimeout(() => onFinishedRef.current?.(), EXIT_MS));
    };

    timers.push(
      setTimeout(() => {
        const isHome =
          window.location.pathname === "/" || window.location.pathname === "/home";

        // Off Home, or Home already resolved: leave immediately.
        if (window.__homeDataLoaded__ || !isHome) {
          finish();
          return;
        }

        const safety = setTimeout(() => {
          finish();
          window.__resolveHomeData__ = null;
        }, SAFETY_MS);
        timers.push(safety);

        window.__resolveHomeData__ = () => {
          clearTimeout(safety);
          finish();
          window.__resolveHomeData__ = null;
        };
      }, INTRO_MS)
    );

    return () => {
      done = true;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      window.__resolveHomeData__ = null;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-gradient-to-br from-[#f0ebff] via-[#f7f5ff] to-[#fff2eb] select-none overflow-hidden font-sans transition-all duration-150 ease-in-out"
      style={{
        opacity: exiting ? 0 : 1,
        transform: exiting ? "translateY(-20px) scale(0.98)" : "none",
      }}
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
        <div className="relative w-40 h-40 sm:w-52 sm:h-52 rounded-[2.5rem] bg-[#0e0c24] border border-[#3a2a83]/20 shadow-[0_25px_60px_rgba(58,42,131,0.25)] flex items-center justify-center p-5 group overflow-hidden animate-[splashLogoIn_0.2s_ease-out_both,splashGlow_2.4s_ease-in-out_0.2s_infinite]">
          <div className="absolute inset-0 bg-gradient-to-tr from-[#3a2a83]/30 to-transparent opacity-100" />
          <img
            src={settings?.logoUrl || LogoTransparent}
            alt="Athreya Delivery Logo"
            width="208"
            height="208"
            fetchPriority="high"
            decoding="async"
            className="w-full h-full object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.35)]"
          />
          {/* Shimmering beam effect */}
          <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-100 shadow-2xl animate-[shimmer_2.2s_infinite]" />
        </div>

        {/* Brand Text Header */}
        <div className="flex flex-col gap-1.5 mt-2 animate-[splashFadeUp_0.15s_ease-out_0.1s_both]">
          <h1 className="text-2xl sm:text-3xl font-[1000] tracking-[0.12em] uppercase flex items-center justify-center gap-2">
            <span className="text-[#3a2a83]">ATHREYA</span>
            <span className="text-[#f15a24] bg-gradient-to-r from-[#f15a24] to-[#f97316] bg-clip-text text-transparent">DELIVERY</span>
          </h1>
          <p className="text-[10px] sm:text-xs font-black tracking-[0.35em] text-[#3a2a83]/80 uppercase">
            Freshness Guaranteed
          </p>
        </div>

        {/* Loading Progress Section */}
        <div className="w-48 sm:w-56 flex flex-col items-center gap-3 mt-8 animate-[splashFadeIn_0.08s_ease-out_0.2s_both]">
          {/* Progress Track */}
          <div className="relative w-full h-[3px] bg-[#3a2a83]/10 rounded-full overflow-hidden">
            <div className="absolute left-0 top-0 h-full w-full bg-gradient-to-r from-[#3a2a83] via-[#8253d6] to-[#f15a24] origin-left rounded-full animate-[splashProgress_0.45s_ease-in-out_both]" />
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
        @keyframes splashLogoIn {
          from { opacity: 0; transform: scale(0.8); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes splashFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes splashFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes splashProgress {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes splashGlow {
          0%, 100% {
            box-shadow: 0 25px 60px rgba(58, 42, 131, 0.25);
            border-color: rgba(58, 42, 131, 0.2);
          }
          50% {
            box-shadow: 0 20px 60px rgba(58, 42, 131, 0.45), 0 0 30px rgba(241, 90, 36, 0.25);
            border-color: rgba(255, 255, 255, 0.25);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .fixed [class*="animate-"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
