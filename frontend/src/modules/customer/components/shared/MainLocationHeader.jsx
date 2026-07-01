import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import Lottie from "lottie-react";
import LocationDrawer from "./LocationDrawer";
import { useLocation } from "../../context/LocationContext";
import { useProductDetail } from "../../context/ProductDetailContext";
import { useSettings } from "@core/context/SettingsContext";
import { cn } from "@/lib/utils";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";
import { isMobileOrWebView } from "@/core/utils/deviceUtils";
import {
  buildHeaderGradient,
  buildMiniCartColor,
  buildSearchBarBackgroundColor,
  shiftHex,
} from "../../utils/headerTheme";
import LogoImage from "../../../../assets/Logo.png";

// MUI Icons
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import SearchIcon from "@mui/icons-material/Search";
import MicIcon from "@mui/icons-material/Mic";
import ChevronDownIcon from "@mui/icons-material/KeyboardArrowDown";
import FavoriteBorderOutlinedIcon from "@mui/icons-material/FavoriteBorderOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";

/** Full-width bottom stroke + tab curve; l/r are 0–100% of column where the inner bump sits. */
function buildActiveTabPath(l, r) {
  const y = 20;
  const mapX = (x) => l + ((x - 1.5) / (98.5 - 1.5)) * (r - l);
  // Softer shoulders + flatter crown for a cleaner active tab curve.
  return `M 0 ${y} L ${l} ${y} L ${l} 12 C ${mapX(2.6)} 7 ${mapX(8.2)} 1.55 ${mapX(15)} 1.55 L ${mapX(85)} 1.55 C ${mapX(91.8)} 1.55 ${mapX(97.4)} 7 ${mapX(98.5)} 12 V ${y} L 100 ${y}`;
}

function CategoryNavColumn({
  cat,
  isActive,
  categoryAccent,
  onCategorySelect,
  headerFontColor,
  headerIconColor,
}) {
  const activeColor = categoryAccent || "#3a2a83";
  const inactiveColor = "#111827"; // Darkest slate-950 for clear inactive visibility
  const colRef = useRef(null);
  const labelRef = useRef(null);
  const [lr, setLr] = useState({ l: 22, r: 78 });

  const measure = () => {
    if (!isActive || !colRef.current || !labelRef.current) return;
    const col = colRef.current.getBoundingClientRect();
    const lab = labelRef.current.getBoundingClientRect();
    if (col.width < 4) return;
    const pad = 5;
    const l = Math.max(0, ((lab.left - col.left - pad) / col.width) * 100);
    const r = Math.min(100, ((lab.right - col.left + pad) / col.width) * 100);
    if (r - l > 6) setLr({ l, r });
  };

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (colRef.current) ro.observe(colRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [isActive, cat.name]);

  const pathD = isActive ? buildActiveTabPath(lr.l, lr.r) : "";

  return (
    <motion.div
      ref={colRef}
      layout
      whileTap={{ scale: 0.96 }}
      transition={{
        layout: { type: "spring", stiffness: 520, damping: 38, mass: 0.55 },
      }}
      onClick={() => onCategorySelect && onCategorySelect(cat)}
      style={{
        borderBottomColor: isActive ? "transparent" : activeColor,
      }}
      className="category-column relative z-[2] flex min-w-[64px] shrink-0 cursor-pointer flex-col items-center gap-1 border-b-2 px-0.5 pb-1 pt-1 snap-start md:min-w-[84px]">
      <div
        className="category-icon-circle relative z-10 flex h-12 w-12 items-center justify-center md:h-13 md:w-13 rounded-full bg-white border-2 transition-all overflow-hidden"
      >
        {typeof cat.icon === "function" ||
          (typeof cat.icon === "object" && cat.icon.$$typeof) ? (
          <cat.icon
            sx={{
              fontSize: { xs: 24, md: 32 },
              color: isActive ? activeColor : inactiveColor,
              opacity: 1,
              transition: "color 0.2s, transform 0.2s",
            }}
          />
        ) : (
          <img
            src={cat.icon}
            alt={cat.name}
            loading="lazy"
            className="w-full h-full object-cover rounded-full"
            style={{ opacity: 1 }}
          />
        )}
      </div>
      <div className="relative mt-px w-full">
        <span
          ref={labelRef}
          className={cn(
            "relative z-10 mx-auto block max-w-none px-1 pb-0.5 text-center text-[10px] font-sans tracking-tight md:text-[12px]",
            isActive ? "font-bold" : "font-medium",
          )}
          style={{
            color: isActive ? activeColor : inactiveColor,
            opacity: 1,
          }}>
          {cat.name}
        </span>
      </div>
      {isActive && (
        <motion.svg
          layoutId="active-category-curve"
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 right-0 z-[6] h-[22px] w-full overflow-visible"
          viewBox="0 0 100 20"
          preserveAspectRatio="none"
          shapeRendering="geometricPrecision"
          transition={{
            layout: { type: "spring", stiffness: 560, damping: 40, mass: 0.5 },
          }}>
          <path
            d={pathD}
            fill={activeColor}
            fillOpacity="0.08"
            stroke={activeColor}
            strokeWidth="2"
            strokeLinecap="butt"
            strokeLinejoin="round"
          />
        </motion.svg>
      )}
    </motion.div>
  );
}

const MainLocationHeader = ({
  categories = [],
  activeCategory,
  onCategorySelect,
}) => {
  const { scrollY } = useScroll();
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const [cartAnimData, setCartAnimData] = useState(null);

  // Dynamically load shopping-cart Lottie on mount
  useEffect(() => {
    import("../../../../assets/lottie/shopping-cart.json")
      .then((m) => setCartAnimData(m.default))
      .catch(() => { });
  }, []);
  const { currentLocation, refreshLocation, isFetchingLocation } =
    useLocation();
  const { isOpen: isProductDetailOpen } = useProductDetail();
  const { settings } = useSettings();
  const appName = settings?.appName || "App";
  const logoUrl = settings?.logoUrl || LogoImage;
  const navigate = useNavigate();

  // Search Logic
  const handleSearchClick = () => {
    navigate("/search");
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      navigate("/search", { state: { query: e.target.value } });
    }
  };

  // Search placeholder animation
  const [searchPlaceholder, setSearchPlaceholder] = useState("Search ");
  const [typingState, setTypingState] = useState({
    textIndex: 0,
    charIndex: 0,
    isDeleting: false,
    isPaused: false,
  });

  const staticText = "Search ";
  const typingPhrases = [
    '"bread"',
    '"milk"',
    '"chocolate"',
    '"eggs"',
    '"chips"',
  ];

  useEffect(() => {
    const { textIndex, charIndex, isDeleting, isPaused } = typingState;
    const currentPhrase = typingPhrases[textIndex];

    if (isPaused) {
      const timeout = setTimeout(() => {
        setTypingState((prev) => ({
          ...prev,
          isPaused: false,
          isDeleting: true,
        }));
      }, 2000); // Pause after full phrase
      return () => clearTimeout(timeout);
    }

    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          // Typing
          if (charIndex < currentPhrase.length) {
            setSearchPlaceholder(
              staticText + currentPhrase.substring(0, charIndex + 1),
            );
            setTypingState((prev) => ({
              ...prev,
              charIndex: prev.charIndex + 1,
            }));
          } else {
            // Finished typing
            setTypingState((prev) => ({ ...prev, isPaused: true }));
          }
        } else {
          // Deleting
          if (charIndex > 0) {
            setSearchPlaceholder(
              staticText + currentPhrase.substring(0, charIndex - 1),
            );
            setTypingState((prev) => ({
              ...prev,
              charIndex: prev.charIndex - 1,
            }));
          } else {
            // Finished deleting
            setTypingState((prev) => ({
              ...prev,
              isDeleting: false,
              textIndex: (prev.textIndex + 1) % typingPhrases.length,
            }));
          }
        }
      },
      isDeleting ? 50 : 100,
    ); // 50ms deleting speed, 100ms typing speed

    return () => clearTimeout(timeout);
  }, [typingState]);

  // Smooth scroll interpolations
  const headerTopPadding = useTransform(scrollY, [0, 160], [16, 12]);
  const headerBottomPadding = useTransform(scrollY, [0, 160], [4, 3]);
  const headerRoundness = useTransform(scrollY, [0, 160], [0, 24]);
  const bgOpacity = useTransform(scrollY, [0, 160], [1, 0.98]);

  // Content animations
  const contentHeight = useTransform(scrollY, [0, 160], ["64px", "0px"]);
  const contentOpacity = useTransform(scrollY, [0, 160], [1, 0]);
  const navHeight = useTransform(scrollY, [0, 200], ["100px", "0px"]);
  const navOpacity = useTransform(scrollY, [0, 200], [1, 0]);
  const navMargin = useTransform(scrollY, [0, 200], [4, 0]);
  const categorySpacing = useTransform(scrollY, [0, 200], [3, 0]);
  const cartOpacity = useTransform(scrollY, [0, 110, 150], [1, 0.7, 0]);
  const cartScale = useTransform(scrollY, [0, 110, 150], [1, 0.9, 0.75]);

  // Helper to hide elements completely when collapsed to prevent clicks
  const displayContent = useTransform(scrollY, (value) =>
    value > 160 ? "none" : "block",
  );
  const displayNav = useTransform(scrollY, (value) => {
    return value > 200 ? "none" : "flex";
  });
  const displayCart = useTransform(scrollY, (value) =>
    value > 150 ? "none" : "block",
  );

  const baseHeaderColor = activeCategory?.headerColor || "#1a6e2e";
  const headerFontColor = "#1f2937";
  const headerIconColor = "#4b5563";

  const searchBarBg = "#f3f4f6";
  const categoryAccent = activeCategory?.headerColor || "#3a2a83";

  useEffect(() => {
    const c = buildMiniCartColor(baseHeaderColor);
    document.documentElement.style.setProperty("--customer-mini-cart-color", c);
    return () => {
      document.documentElement.style.removeProperty(
        "--customer-mini-cart-color",
      );
    };
  }, [baseHeaderColor]);

  return (
    <>
      <div
        className={cn(
          "fixed top-0 left-0 right-0 z-200",
          isProductDetailOpen && "hidden md:block",
        )}>
        <motion.div
          initial={false}
          style={{
            paddingTop: headerTopPadding,
            paddingBottom: headerBottomPadding,
            borderBottomLeftRadius: headerRoundness,
            borderBottomRightRadius: headerRoundness,
            opacity: bgOpacity,
            backgroundColor: "#ffffff",

          }}
          className="px-4 overflow-hidden transform-gpu will-change-transform">

          {/* Corner Lottie */}
          <motion.button
            initial={{ opacity: 0, scale: 0.9, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
            style={{
              opacity: cartOpacity,
              scale: cartScale,
              display: displayCart,
            }}
            type="button"
            aria-label="Open cart"
            onClick={() => navigate("/checkout")}
            className="absolute top-3 right-5 sm:top-4 sm:right-6 md:top-5 md:right-8 z-20 w-12 h-12 sm:w-14 sm:h-14 md:w-20 md:h-20 cursor-pointer">
            {cartAnimData ? (
              <Lottie
                animationData={cartAnimData}
                loop
                className="w-full h-full pointer-events-none"
              />
            ) : (
              <div className="w-full h-full" />
            )}
          </motion.button>

          {/* Desktop/Tablet Header Layout (md and above) */}
          <div className="hidden md:flex items-center justify-between relative z-20 px-2 lg:px-6 mb-4 mt-1">
            {/* Left Section: Logo + Location row */}
            <div className="flex items-center gap-4 lg:gap-8">
              <div
                onClick={() => navigate("/")}
                className="flex items-center cursor-pointer group shrink-0">
                <div className="flex items-center group-hover:scale-105 transition-all duration-300">
                  <img
                    src={logoUrl}
                    alt="Athreya Delivery Logo"
                    loading="lazy"
                    className="h-16 w-auto md:h-20 object-contain scale-[1.2]"
                  />
                </div>
              </div>

              {/* Location Block (Desktop inline row) */}
              <div className="flex flex-col border-l border-black/10 pl-4 lg:pl-8 h-10 justify-center">

                <button
                  type="button"
                  data-lenis-prevent
                  data-lenis-prevent-touch
                  onClick={() => {
                    setIsLocationOpen(true);
                  }}
                  className="flex items-center gap-1 text-slate-900 hover:text-slate-700 cursor-pointer group active:scale-95 transition-all border-0 bg-transparent p-0 text-left">
                  <LocationOnIcon sx={{ fontSize: 14, color: "inherit" }} />
                  <div
                    className="text-[13px] font-bold leading-tight max-w-[250px] lg:max-w-[320px] truncate"
                    style={{ color: headerFontColor }}
                  >
                    {isFetchingLocation
                      ? "Detecting location..."
                      : currentLocation.name}
                  </div>
                  <ChevronDownIcon
                    sx={{ fontSize: 12, opacity: 0.5, color: headerFontColor }}
                  />
                </button>
              </div>
            </div>

            {/* Center Section: Search Bar */}
            <div className="flex-1 max-w-[450px] lg:max-w-2xl px-6">
              <motion.div
                onClick={handleSearchClick}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                style={{ backgroundColor: searchBarBg }}
                className="rounded-full px-4 h-11 border border-[#1a6e2e]/20 flex items-center border border-white/50 transition-all duration-200 focus-within:ring-2 focus-within:ring-brand-400/60 cursor-pointer">
                <SearchIcon sx={{ color: "#000000", fontSize: 20 }} />
                <input
                  type="text"
                  placeholder={searchPlaceholder || "Search Products..."}
                  readOnly
                  className="flex-1 bg-transparent border-none outline-none pl-2 text-slate-800 font-semibold placeholder:text-black text-[15px] cursor-pointer"
                />
                <div className="flex items-center gap-2 border-l border-slate-100 pl-3">
                  <MicIcon sx={{ color: "#000000", fontSize: 20 }} />
                </div>
              </motion.div>
            </div>

            {/* Right Section: Action Icons */}
            <div className="flex items-center gap-5 lg:gap-8 shrink-0">
              <motion.button
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate("/wishlist")}
                className="transition-all hover:text-red-500 header-action-button"
                style={{ color: headerFontColor }}
              >
                <FavoriteBorderOutlinedIcon sx={{ fontSize: 24 }} />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate("/checkout")}
                className="transition-all hover:text-slate-700 relative group header-action-button"
                style={{ color: headerFontColor }}
              >
                <ShoppingCartOutlinedIcon sx={{ fontSize: 24 }} />
                <span className="absolute -top-1.5 -right-1.5 bg-yellow-400 text-[#1a6e2e] text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-[#1a6e2e]/20 border border-[#1a6e2e]/20 transition-transform group-hover:-translate-y-0.5">
                  0
                </span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate("/profile")}
                className="lg:bg-white/30 p-1.5 lg:rounded-full hover:bg-white transition-all header-action-button"
                style={{ color: headerFontColor }}
              >
                <AccountCircleOutlinedIcon sx={{ fontSize: 28 }} />
              </motion.button>
            </div>
          </div>

          {/* Collapsible Delivery Info & Location (MOBILE ONLY) */}
          <div className="md:hidden">
            <motion.div
              style={{
                height: contentHeight,
                opacity: contentOpacity,
                marginBottom: navMargin,
                display: displayContent,
                overflow: "hidden",
              }}
              className="relative z-10">
              <div className="mb-2 flex items-center cursor-pointer" onClick={() => navigate("/")}>
                <img
                  src={logoUrl}
                  alt="Athreya Delivery Logo"
                  loading="lazy"
                  className="h-14 w-auto sm:h-16 object-contain scale-[1.2]"
                />
              </div>
              <div className="flex justify-between items-start">
                <div className="flex flex-col">

                  <button
                    type="button"
                    data-lenis-prevent
                    data-lenis-prevent-touch
                    onClick={() => {
                      setIsLocationOpen(true);
                    }}
                    className="flex items-center gap-1 text-slate-800 cursor-pointer group active:scale-95 transition-transform border-0 bg-transparent p-0 text-left">
                    <LocationOnIcon sx={{ fontSize: 14, color: "#1a6e2e" }} />
                    <div
                      className="text-[10px] font-medium leading-tight max-w-[280px] truncate"
                      style={{ color: headerFontColor }}
                    >
                      {isFetchingLocation
                        ? "Detecting location..."
                        : currentLocation.name}
                    </div>
                    <ChevronDownIcon
                      sx={{ fontSize: 12, opacity: 0.5, color: headerFontColor }}
                    />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Search Bar (MOBILE ONLY) */}
          <div className="relative z-10 mt-[1.5px] flex items-center gap-2 md:hidden">
            <motion.div
              onClick={handleSearchClick}
              whileTap={{ scale: 0.98 }}
              style={{ backgroundColor: searchBarBg }}
              className="flex-1 rounded-[10px] px-3 h-10 flex items-center border border-[#1a6e2e] transition-all duration-200 focus-within:ring-2 focus-within:ring-[#1a6e2e] cursor-pointer">
              <SearchIcon sx={{ color: "#1a6e2e", fontSize: 18 }} />
              <input
                type="text"
                placeholder={searchPlaceholder || "Search Products..."}
                readOnly
                className="flex-1 bg-transparent border-none outline-none pl-2 text-slate-800 font-semibold placeholder:text-black text-[14px] cursor-pointer"
              />
              <div className="flex items-center gap-2 border-l border-[#1a6e2e] pl-2.5">
                <MicIcon sx={{ color: "#1a6e2e", fontSize: 18 }} />
              </div>
            </motion.div>
          </div>

          {/* Categories Navigation - Smooth Collapse */}
          {categories.length > 0 && (
            <motion.div
              layout
              transition={{
                layout: {
                  type: "spring",
                  stiffness: 420,
                  damping: 34,
                  mass: 0.6,
                },
              }}
              style={{
                height: navHeight,
                opacity: navOpacity,
                marginTop: categorySpacing,
                display: displayNav,
                overflowY: "hidden",
              }}
              className="relative flex items-end md:justify-center gap-0 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 z-10 snap-x pt-1 min-h-[100px] md:min-h-[96px] pb-1 bg-white border-t border-[#1a6e2e]">
              {categories.slice(0, 10).map((cat) => {
                const isActive = activeCategory?.id === cat.id;
                return (
                  <CategoryNavColumn
                    key={cat.id}
                    cat={cat}
                    isActive={isActive}
                    categoryAccent={categoryAccent}
                    onCategorySelect={onCategorySelect}
                    headerFontColor={headerFontColor}
                    headerIconColor={headerIconColor}
                  />
                );
              })}
            </motion.div>
          )}

          {/* Background Decorative patterns */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-[100px] -mr-40 -mt-40 pointer-events-none" />
        </motion.div>
      </div>

      <LocationDrawer
        isOpen={isLocationOpen}
        onClose={() => setIsLocationOpen(false)}
      />
    </>
  );
};

export default MainLocationHeader;

