import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import Lottie from "lottie-react";
import { Menu, Languages, ShoppingCart } from "lucide-react";
import LocationDrawer from "./LocationDrawer";
import { useLocation } from "../../context/LocationContext";
import { useProductDetail } from "../../context/ProductDetailContext";
import { useSettings } from "@core/context/SettingsContext";
import { useCart } from "../../context/CartContext";
import { cn } from "@/lib/utils";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";
import { isMobileOrWebView } from "@/core/utils/deviceUtils";
import {
  buildHeaderGradient,
  buildMiniCartColor,
  buildSearchBarBackgroundColor,
  shiftHex,
} from "../../utils/headerTheme";
import LogoTransparent from "../../../../assets/LogoTransparent.png";

// MUI Icons
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import SearchIcon from "@mui/icons-material/Search";
import MicIcon from "@mui/icons-material/Mic";
import ChevronDownIcon from "@mui/icons-material/KeyboardArrowDown";
import FavoriteBorderOutlinedIcon from "@mui/icons-material/FavoriteBorderOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";

export const getAreaName = (loc) => {
  if (!loc) return "Select Location";
  
  const parts = loc.name.split(",");
  const cleanParts = parts
    .map(p => p.trim())
    .filter(p => p && !/^\d+$/.test(p) && p.length > 2);
    
  if (cleanParts.length > 0) {
    const primary = cleanParts[0];
    return primary + (loc.pincode ? ` (${loc.pincode})` : "");
  }
  
  return loc.city ? `${loc.city}${loc.pincode ? ` (${loc.pincode})` : ""}` : loc.name;
};

export const getTeluguAreaName = (loc) => {
  const translations = {
    "aswapuram": "అశ్వాపురం",
    "indore": "ఇండోర్",
    "hyderabad": "హైదరాబాద్",
    "manuguru": "మనుగూరు",
    "bhadrachalam": "భద్రాచలం",
    "khammam": "ఖమ్మం",
    "palvancha": "పాల్వంచ",
    "kothagudem": "కొత్తగూడెం"
  };
  const nameLower = (loc?.city || loc?.name || "").toLowerCase();
  for (const [eng, tel] of Object.entries(translations)) {
    if (nameLower.includes(eng)) {
      return tel;
    }
  }
  return "";
};

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
  const { cartCount } = useCart();

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
  const logoUrl = settings?.logoUrl || LogoTransparent;
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
  const headerFontColor = "#ffffff";
  const headerIconColor = "#ffffff";

  const searchBarBg = "#021f0b";
  const categoryAccent = activeCategory?.headerColor || "#A3E635";

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
            backgroundColor: "#042A0F",

          }}
          className="px-4 overflow-hidden transform-gpu will-change-transform">

          {/* Desktop/Tablet Header Layout (md and above) */}
          <div className="hidden md:flex items-center justify-between relative z-20 px-2 lg:px-6 mb-4 mt-1">
            {/* Left Section: Logo + Location row */}
            <div className="flex items-center gap-4 lg:gap-8">
              <div
                onClick={() => navigate("/")}
                className="flex items-center cursor-pointer group shrink-0 gap-2.5">
                <img
                  src={logoUrl}
                  alt="Athreya Delivery"
                  loading="lazy"
                  className="h-14 w-auto object-contain transition-transform group-hover:scale-105 duration-300 rounded-full"
                />
                <div className="flex flex-col items-start leading-none font-sans">
                  <span className="text-[17px] font-black text-white tracking-wide uppercase">ATHREYA</span>
                  <span className="text-[11px] font-bold text-white tracking-[0.12em] mt-0.5 uppercase">DELIVERY</span>
                </div>
              </div>

              {/* Location Block (Desktop inline row) */}
              <div className="flex flex-col border-l border-white/20 pl-4 lg:pl-8 h-10 justify-center">

                <button
                  type="button"
                  data-lenis-prevent
                  data-lenis-prevent-touch
                  onClick={() => {
                    setIsLocationOpen(true);
                  }}
                  className="flex items-center gap-1 text-white hover:text-slate-200 cursor-pointer group active:scale-95 transition-all border-0 bg-transparent p-0 text-left">
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
                className="rounded-full px-4 h-11 border border-[#0d4f1c] flex items-center border border-white/50 transition-all duration-200 focus-within:ring-2 focus-within:ring-brand-400/60 cursor-pointer">
                <SearchIcon sx={{ color: "#9ca3af", fontSize: 20 }} />
                <input
                  type="text"
                  placeholder={searchPlaceholder || "Search Products..."}
                  readOnly
                  className="flex-1 bg-transparent border-none outline-none pl-2 text-white font-semibold placeholder:text-slate-400 text-[15px] cursor-pointer"
                />
                <div className="flex items-center gap-2 border-l border-white/10 pl-3">
                  <MicIcon sx={{ color: "#ffffff", fontSize: 20 }} />
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
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-[#042A0F] transition-transform group-hover:-translate-y-0.5 animate-in zoom-in duration-300">
                    {cartCount}
                  </span>
                )}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate("/profile")}
                className="lg:bg-white/10 p-1.5 lg:rounded-full hover:bg-white/20 transition-all header-action-button"
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
              className="relative z-10 animate-in fade-in duration-300">
              <div className="flex items-center justify-between pt-1 pb-1.5 bg-[#042A0F] relative overflow-hidden">
                {/* Left Section: Menu, Logo, Divider, Location */}
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <button className="text-white hover:opacity-80 active:scale-95 transition-transform bg-transparent border-0 cursor-pointer p-1 shrink-0">
                    <Menu size={24} />
                  </button>
                  
                  <div onClick={() => navigate("/")} className="cursor-pointer shrink-0 flex items-center gap-1.5">
                    <img src={logoUrl} alt="Athreya Delivery" className="h-8.5 w-auto object-contain rounded-full" />
                    <div className="flex flex-col items-start leading-none font-sans">
                      <span className="text-[12.5px] font-black text-white tracking-wide uppercase">ATHREYA</span>
                      <span className="text-[8.5px] font-bold text-white tracking-[0.12em] mt-0.5 uppercase">DELIVERY</span>
                    </div>
                  </div>

                  <div className="h-7 w-px bg-white/20 mx-1 shrink-0" />

                  {/* Location Dropdown */}
                  <div 
                    onClick={() => setIsLocationOpen(true)}
                    className="flex flex-col items-start cursor-pointer group active:opacity-90 min-w-0 flex-1 pl-0.5"
                  >
                    <div className="flex items-center gap-0.5 text-white min-w-0 w-full">
                      <span className="text-red-500 text-[12px] shrink-0">📍</span>
                      <span className="block text-[11.5px] font-black tracking-tight leading-none group-hover:underline truncate">
                        {getAreaName(currentLocation)}
                      </span>
                      <ChevronDownIcon sx={{ fontSize: 13, opacity: 0.8, color: "#ffffff" }} className="shrink-0" />
                    </div>
                    {getTeluguAreaName(currentLocation) && (
                      <span className="block text-[9px] font-semibold text-slate-300 ml-3.5 leading-tight mt-0.5 truncate max-w-full">
                        {getTeluguAreaName(currentLocation)}
                      </span>
                    )}
                  </div>
                </div>
 
                {/* Language & Cart */}
                <div className="flex items-center gap-2.5 shrink-0 ml-2">
                  {/* Language Selector */}
                  <button className="flex flex-col items-center justify-center text-white bg-transparent border-0 p-0 cursor-pointer hover:opacity-80">
                    <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center border border-white/25">
                      <Languages size={15} />
                    </div>
                    <span className="text-[8px] font-black text-slate-300 mt-0.5">భాష</span>
                  </button>
 
                  {/* Cart with badge */}
                  <button 
                    onClick={() => navigate("/checkout")}
                    className="flex flex-col items-center justify-center text-white bg-transparent border-0 p-0 cursor-pointer hover:opacity-80 relative"
                  >
                    <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center border border-white/25 relative">
                      <ShoppingCart size={15} />
                      <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[8px] font-black rounded-full h-3.5 w-3.5 flex items-center justify-center border border-[#042A0F]">
                        {cartCount > 0 ? cartCount : 3}
                      </span>
                    </div>
                    <span className="text-[8px] font-black text-slate-300 mt-0.5">కార్ట్</span>
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
              className="flex-1 rounded-full px-3.5 h-10 flex items-center border border-[#0d4f1c] transition-all duration-200 focus-within:ring-2 focus-within:ring-[#0d4f1c] cursor-pointer">
              <SearchIcon sx={{ color: "#9ca3af", fontSize: 18 }} />
              <input
                type="text"
                placeholder={searchPlaceholder || `Search ${currentLocation?.city || 'Aswapuram'} stores...`}
                readOnly
                className="flex-1 bg-transparent border-none outline-none pl-2 text-white font-bold placeholder-slate-400 text-[12.5px] cursor-pointer"
              />
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/search');
                }}
                className="w-7 h-7 rounded-full bg-[#A3E635] flex items-center justify-center text-[#042A0F] cursor-pointer hover:opacity-90 active:scale-95 transition-transform border-0"
              >
                <MicIcon sx={{ color: "#042A0F", fontSize: 16 }} />
              </button>
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

