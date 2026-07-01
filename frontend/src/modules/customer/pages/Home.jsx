import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useInViewAnimation } from "@/core/hooks/useInViewAnimation";
import { Sparkles, Heart, Snowflake, ChevronLeft, ChevronRight } from "lucide-react";

// MUI Icons (shared with admin & icon selector)
import HomeIcon from "@mui/icons-material/Home";
import DevicesIcon from "@mui/icons-material/Devices";
import LocalGroceryStoreIcon from "@mui/icons-material/LocalGroceryStore";
import KitchenIcon from "@mui/icons-material/Kitchen";
import ChildCareIcon from "@mui/icons-material/ChildCare";
import PetsIcon from "@mui/icons-material/Pets";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
import VerifiedIcon from "@mui/icons-material/Verified";
import RestaurantIcon from "@mui/icons-material/Restaurant";
import SpaIcon from "@mui/icons-material/Spa";
import LocalPharmacyIcon from "@mui/icons-material/LocalPharmacy";

import { motion, useScroll, useTransform } from "framer-motion";
import { isMobileOrWebView } from "@/core/utils/deviceUtils";
import { customerApi } from "../services/customerApi";
import { toast } from "sonner";
import ProductCard from "../components/shared/ProductCard";
import MainLocationHeader from "../components/shared/MainLocationHeader";
import { useProductDetail } from "../context/ProductDetailContext";
import { cn } from "@/lib/utils";
import CardBanner from "@/assets/CardBanner.jpg";
import SectionRenderer from "../components/experience/SectionRenderer";
import ExperienceBannerCarousel from "../components/experience/ExperienceBannerCarousel";
import { useLocation } from "../context/LocationContext";
import { useSettings } from "@core/context/SettingsContext";
import Lottie from "lottie-react";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";
import { getJSON, remove as removeStorage, STORAGE_KEYS } from "@core/utils/storage";
import SkeletonLoader from "../components/shared/SkeletonLoader";
import LogoImage from "@/assets/Logo.png";


import {
  MARQUEE_MESSAGES,
  ICON_COMPONENTS,
} from "../constants/homeConstants";


import LowestPriceSection from "../components/home/LowestPriceSection";
import OfferSections from "../components/home/OfferSections";

const DAILY_NEEDS = [
  {
    name: "Fruits",
    path: "/category/fruits",
    bgColor: "bg-red-50/80 border-red-100/50 hover:bg-red-100/50",
    iconColor: "text-red-500",
    icon: (
      <img src="https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=400&q=80" alt="Fruits" className="w-full h-full object-cover rounded-[14px]" />
    ),
  },
  {
    name: "Vegetables",
    path: "/category/vegetables",
    bgColor: "bg-green-50/80 border-green-100/50 hover:bg-green-100/50",
    iconColor: "text-green-600",
    icon: (
      <img src="https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?auto=format&fit=crop&w=400&q=80" alt="Vegetables" className="w-full h-full object-cover rounded-[14px]" />
    ),
  },
  {
    name: "Chicken",
    path: "/category/chicken",
    bgColor: "bg-orange-50/80 border-orange-100/50 hover:bg-orange-100/50",
    iconColor: "text-orange-600",
    icon: (
      <img src="https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=400&q=80" alt="Chicken" className="w-full h-full object-cover rounded-[14px]" />
    ),
  },
  {
    name: "Mutton",
    path: "/category/mutton",
    bgColor: "bg-red-50/80 border-red-100/50 hover:bg-red-100/50",
    iconColor: "text-rose-700",
    icon: (
      <img src="https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=400&q=80" alt="Mutton" className="w-full h-full object-cover rounded-[14px]" />
    ),
  },

];
const getShopImage = (category, shopName, shopLogo) => {
  if (shopLogo) {
    return applyCloudinaryTransform(shopLogo, "f_auto,q_auto,w_400,h_300,c_fill");
  }
  const cat = String(category || "").toLowerCase();
  const name = String(shopName || "").toLowerCase();
  if (cat.includes("milk") || cat.includes("dairy") || name.includes("milk") || name.includes("dairy")) {
    return "https://images.unsplash.com/photo-1528498033373-386cc8224357?auto=format&fit=crop&q=80&w=400";
  }
  if (cat.includes("veg") || cat.includes("fruit") || name.includes("veg") || name.includes("fruit")) {
    return "https://images.unsplash.com/photo-1543083503-0c355536ee47?auto=format&fit=crop&q=80&w=400";
  }
  if (cat.includes("restaurant") || cat.includes("food") || name.includes("restaurant") || name.includes("food") || cat.includes("cafe")) {
    return "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&q=80&w=400";
  }
  return "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400";
};

const DEFAULT_SHOPS = [
  { _id: '1', shopName: "Sri Lakshmi Kirana", category: "Grocery", locality: "Downtown", distance: 1.2, rating: "4.6", deliveryTime: "30-40 min" },
  { _id: '2', shopName: "Fresh Vegetables", category: "Vegetables", locality: "Green Market", distance: 0.8, rating: "4.5", deliveryTime: "10-20 min" },
  { _id: '3', shopName: "Sri Krishna Dairy", category: "Milk Shop", locality: "Green Avenue", distance: 1.5, rating: "4.7", deliveryTime: "15-25 min" },
  { _id: '4', shopName: "Swagath Restaurant", category: "Restaurant", locality: "Main Road", distance: 2.2, rating: "4.6", deliveryTime: "25-35 min" },
];

const DEFAULT_CATEGORY_THEME = {
  gradient: "#ffffff",
  shadow: "border border-[#1a6e2e]/20",
  accent: "text-[#1a6e2e]",
};

const CATEGORY_METADATA = {
  All: {
    icon: HomeIcon,
    theme: DEFAULT_CATEGORY_THEME,
    banner: {
      title: "HOUSEFULL",
      subtitle: "SALE",
      floatingElements: "sparkles",
    },
  },
  Grocery: {
    icon: LocalGroceryStoreIcon,
    theme: {
      gradient: "#ffffff",
      shadow: "border border-[#1a6e2e]/20",
      accent: "text-[#1a6e2e]",
    },
    banner: {
      title: "SUPERSAVER",
      subtitle: "FRESH & FAST",
      floatingElements: "leaves",
    },
  },
  GROCERY: {
    icon: LocalGroceryStoreIcon,
    theme: {
      gradient: "#ffffff",
      shadow: "border border-[#1a6e2e]/20",
      accent: "text-[#1a6e2e]",
    },
    banner: {
      title: "SUPERSAVER",
      subtitle: "FRESH & FAST",
      floatingElements: "leaves",
    },
  },
  Wedding: {
    icon: CardGiftcardIcon,
    theme: {
      gradient: "#ffffff",
      shadow: "border border-[#1a6e2e]/20",
      accent: "text-[#1a6e2e]",
    },
    banner: { title: "WEDDING", subtitle: "BLISS", floatingElements: "hearts" },
  },
  WEDDING: {
    icon: CardGiftcardIcon,
    theme: {
      gradient: "#ffffff",
      shadow: "border border-[#1a6e2e]/20",
      accent: "text-[#1a6e2e]",
    },
    banner: { title: "WEDDING", subtitle: "BLISS", floatingElements: "hearts" },
  },
  "Home & Kitchen": {
    icon: KitchenIcon,
    theme: {
      gradient: "#ffffff",
      shadow: "border border-[#1a6e2e]/20",
      accent: "text-[#1a6e2e]",
    },
    banner: { title: "HOME", subtitle: "KITCHEN", floatingElements: "smoke" },
  },
  "HOME & KITCHEN": {
    icon: KitchenIcon,
    theme: {
      gradient: "#ffffff",
      shadow: "border border-[#1a6e2e]/20",
      accent: "text-[#1a6e2e]",
    },
    banner: { title: "HOME", subtitle: "KITCHEN", floatingElements: "smoke" },
  },
  Electronics: {
    icon: DevicesIcon,
    theme: {
      gradient: "#ffffff",
      shadow: "border border-[#1a6e2e]/20",
      accent: "text-[#1a6e2e]",
    },
    banner: {
      title: "TECH FEST",
      subtitle: "GADGETS",
      floatingElements: "tech",
    },
  },
  ELECTRONICS: {
    icon: DevicesIcon,
    theme: {
      gradient: "#ffffff",
      shadow: "border border-[#1a6e2e]/20",
      accent: "text-[#1a6e2e]",
    },
    banner: {
      title: "TECH FEST",
      subtitle: "GADGETS",
      floatingElements: "tech",
    },
  },
  Kids: {
    icon: ChildCareIcon,
    theme: {
      gradient: "#ffffff",
      shadow: "border border-[#1a6e2e]/20",
      accent: "text-[#1a6e2e]",
    },
    banner: {
      title: "LITTLE ONE",
      subtitle: "CARE",
      floatingElements: "bubbles",
    },
  },
  KIDS: {
    icon: ChildCareIcon,
    theme: {
      gradient: "#ffffff",
      shadow: "border border-[#1a6e2e]/20",
      accent: "text-[#1a6e2e]",
    },
    banner: {
      title: "LITTLE ONE",
      subtitle: "CARE",
      floatingElements: "bubbles",
    },
  },
  "Pet Supplies": {
    icon: PetsIcon,
    theme: {
      gradient: "#ffffff",
      shadow: "border border-[#1a6e2e]/20",
      accent: "text-[#1a6e2e]",
    },
    banner: { title: "PAWSOME", subtitle: "DEALS", floatingElements: "bones" },
  },
  "PET SUPPLIES": {
    icon: PetsIcon,
    theme: {
      gradient: "#ffffff",
      shadow: "border border-[#1a6e2e]/20",
      accent: "text-[#1a6e2e]",
    },
    banner: { title: "PAWSOME", subtitle: "DEALS", floatingElements: "bones" },
  },
  Sports: {
    icon: SportsSoccerIcon,
    theme: {
      gradient: "#ffffff",
      shadow: "border border-[#1a6e2e]/20",
      accent: "text-[#1a6e2e]",
    },
    banner: { title: "SPORTS", subtitle: "GEAR", floatingElements: "confetti" },
  },
  SPORTS: {
    icon: SportsSoccerIcon,
    theme: {
      gradient: "#ffffff",
      shadow: "border border-[#1a6e2e]/20",
      accent: "text-[#1a6e2e]",
    },
    banner: { title: "SPORTS", subtitle: "GEAR", floatingElements: "confetti" },
  },
  Food: {
    icon: RestaurantIcon,
    theme: {
      gradient: "#ffffff",
      shadow: "border border-[#1a6e2e]/20",
      accent: "text-[#1a6e2e]",
    },
    banner: { title: "DELICIOUS", subtitle: "FOODS", floatingElements: "sparkles" },
  },
  FOOD: {
    icon: RestaurantIcon,
    theme: {
      gradient: "#ffffff",
      shadow: "border border-[#1a6e2e]/20",
      accent: "text-[#1a6e2e]",
    },
    banner: { title: "DELICIOUS", subtitle: "FOODS", floatingElements: "sparkles" },
  },
  "Fruits & Vegetables": {
    icon: SpaIcon,
    theme: {
      gradient: "#ffffff",
      shadow: "border border-[#1a6e2e]/20",
      accent: "text-[#1a6e2e]",
    },
    banner: { title: "FRESH", subtitle: "VEGGIES", floatingElements: "leaves" },
  },
  "FRUITS & VEGETABLES": {
    icon: SpaIcon,
    theme: {
      gradient: "#ffffff",
      shadow: "border border-[#1a6e2e]/20",
      accent: "text-[#1a6e2e]",
    },
    banner: { title: "FRESH", subtitle: "VEGGIES", floatingElements: "leaves" },
  },
  "FRUITS AND VEG": {
    icon: SpaIcon,
    theme: {
      gradient: "#ffffff",
      shadow: "border border-[#1a6e2e]/20",
      accent: "text-[#1a6e2e]",
    },
    banner: { title: "FRESH", subtitle: "VEGGIES", floatingElements: "leaves" },
  },
  "Fruits and Veg": {
    icon: SpaIcon,
    theme: {
      gradient: "#ffffff",
      shadow: "border border-[#1a6e2e]/20",
      accent: "text-[#1a6e2e]",
    },
    banner: { title: "FRESH", subtitle: "VEGGIES", floatingElements: "leaves" },
  },
  Pharmacy: {
    icon: LocalPharmacyIcon,
    theme: {
      gradient: "#ffffff",
      shadow: "border border-[#1a6e2e]/20",
      accent: "text-[#1a6e2e]",
    },
    banner: { title: "PHARMACY", subtitle: "ESSENTIALS", floatingElements: "bubbles" },
  },
  PHARMACY: {
    icon: LocalPharmacyIcon,
    theme: {
      gradient: "#ffffff",
      shadow: "border border-[#1a6e2e]/20",
      accent: "text-[#1a6e2e]",
    },
    banner: { title: "PHARMACY", subtitle: "PHARMACY", floatingElements: "bubbles" },
  },
};

const ALL_CATEGORY = {
  id: "all",
  _id: "all",
  name: "All",
  icon: HomeIcon,
  theme: DEFAULT_CATEGORY_THEME,
  headerColor: "#0e7490",
  headerFontColor: "#111111",
  headerIconColor: "#111111",
  banner: {
    title: "HOUSEFULL",
    subtitle: "SALE",
    floatingElements: "sparkles",
    textColor: "text-white",
  },
};

const EMPTY_HERO_CONFIG = {
  banners: { items: [] },
  categoryIds: [],
};

const homePageDataCache = new Map();
const headerSectionsMemoryCache = {};
const heroConfigMemoryCache = {};

const getHomePageDataCacheKey = (location) => {
  const lat = Number(location?.latitude);
  const lng = Number(location?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "home:no-location";
  return `home:${lat.toFixed(5)}:${lng.toFixed(5)}`;
};

const getCachedHomePageData = (location) =>
  homePageDataCache.get(getHomePageDataCacheKey(location)) || null;

const DailyNeedsSection = () => {
  const navigate = useNavigate();
  return (
    <div className="container mx-auto max-w-6xl px-4 md:px-8 py-4 my-2">
      <h3 className="text-base md:text-xl font-black text-[#1A1A1A] tracking-tight uppercase mb-3">
        Daily needs
      </h3>
      <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-2">
        {DAILY_NEEDS.map((item) => (
          <div
            key={item.name}
            onClick={() => navigate(item.path)}
            className="flex flex-col items-center gap-2 cursor-pointer group min-w-[76px] md:min-w-[96px]"
          >
            <div className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center border bg-white border-[#1a6e2e]/20 transition-all duration-300 group-hover:-translate-y-0.5 text-[#1a6e2e]`}>
              {item.icon}
            </div>
            <span className="text-[11px] md:text-xs font-bold text-slate-700 group-hover:text-[#1a6e2e] transition-colors">
              {item.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Home = () => {
  const { scrollY } = useScroll();
  const { isOpen: isProductDetailOpen } = useProductDetail();
  const { currentLocation } = useLocation();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const quickCatsRef = useRef(null);
  const cachedHomePageData = getCachedHomePageData(currentLocation);

  const { ref: particleContainerRef, isVisible: particlesVisible } = useInViewAnimation();
  const heroRef = useRef(null);
  const [heroVisible, setHeroVisible] = useState(true);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setHeroVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setHeroVisible(entry.isIntersecting), { rootMargin: "0px" });
    const el = heroRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [categories, setCategories] = useState(() => cachedHomePageData?.categories || [ALL_CATEGORY]);
  const [activeCategory, setActiveCategory] = useState(() => cachedHomePageData?.activeCategory || ALL_CATEGORY);
  const [products, setProducts] = useState(() => cachedHomePageData?.products || []);
  const productsRef = useRef(cachedHomePageData?.products || []);
  const [quickCategories, setQuickCategories] = useState(() => cachedHomePageData?.quickCategories || []);
  const [isLoading, setIsLoading] = useState(() => !cachedHomePageData);
  const [experienceSections, setExperienceSections] = useState(() => cachedHomePageData?.experienceSections || []);
  const [headerSections, setHeaderSections] = useState([]);
  const [nearbySellers, setNearbySellers] = useState(() => cachedHomePageData?.nearbySellers || []);
  const [heroConfig, setHeroConfig] = useState(() => cachedHomePageData?.heroConfig || heroConfigMemoryCache.__home__ || EMPTY_HERO_CONFIG);
  const [mobileBannerIndex, setMobileBannerIndex] = useState(0);
  const [isInstantBannerJump, setIsInstantBannerJump] = useState(false);
  const [categoryMap, setCategoryMap] = useState(() => cachedHomePageData?.categoryMap || {});
  const [subcategoryMap, setSubcategoryMap] = useState(() => cachedHomePageData?.subcategoryMap || {});
  const [pendingReturn, setPendingReturn] = useState(null);
  const [offerSections, setOfferSections] = useState(() => cachedHomePageData?.offerSections || []);
  const [noServiceData, setNoServiceData] = useState(null);

  const dynamicShops = useMemo(() => {
    if (nearbySellers.length > 0) {
      return nearbySellers;
    }
    // Fallback dynamic shops using currentLocation coordinates & address
    const city = currentLocation.city || "Indore";
    const sublocality = currentLocation.name.split(',')[2]?.trim() || currentLocation.name.split(',')[1]?.trim() || "Local Area";
    const lat = currentLocation.latitude || 22.711140989838025;
    const lng = currentLocation.longitude || 75.9001552518043;

    return [
      {
        _id: 'mock-1',
        shopName: `${city} Fresh Kirana`,
        category: "Grocery",
        locality: sublocality,
        distance: 1.2 + (Math.abs(Math.sin(lat)) * 0.5),
        rating: "4.6",
        deliveryTime: "30-40 min"
      },
      {
        _id: 'mock-2',
        shopName: `Fresh Vegetables & Fruits`,
        category: "Vegetables",
        locality: sublocality,
        distance: 0.8 + (Math.abs(Math.cos(lng)) * 0.4),
        rating: "4.5",
        deliveryTime: "10-20 min"
      },
      {
        _id: 'mock-3',
        shopName: `${city} Krishna Dairy`,
        category: "Milk Shop",
        locality: sublocality,
        distance: 1.5 + (Math.abs(Math.sin(lat + lng)) * 0.6),
        rating: "4.7",
        deliveryTime: "15-25 min"
      },
      {
        _id: 'mock-4',
        shopName: `${city} Spice Restaurant`,
        category: "Restaurant",
        locality: "Main Road",
        distance: 2.2 + (Math.abs(Math.cos(lat - lng)) * 0.8),
        rating: "4.6",
        deliveryTime: "25-35 min"
      },
    ];
  }, [nearbySellers, currentLocation]);

  useEffect(() => {
    productsRef.current = products || [];
  }, [products]);

  useEffect(() => {
    if (products.length === 0 && !isLoading) {
      import("@/assets/lottie/animation.json").then((m) => setNoServiceData(m.default)).catch(() => { });
    }
  }, [products.length, isLoading]);

  const applyHomePageData = (data, { cacheKey, persist = true } = {}) => {
    if (!data) return;
    setCategoryMap(data.categoryMap || {});
    setSubcategoryMap(data.subcategoryMap || {});
    setCategories(data.categories || [ALL_CATEGORY]);
    setQuickCategories(data.quickCategories || []);
    setProducts(data.products || []);
    setExperienceSections(data.experienceSections || []);
    setOfferSections(data.offerSections || []);
    if (data.heroConfig) setHeroConfig(data.heroConfig);
    if (data.nearbySellers) setNearbySellers(data.nearbySellers);
    setActiveCategory((prev) => {
      const parsed = getJSON(STORAGE_KEYS.EXPERIENCE_RETURN, null, { storage: "session" });
      if (parsed?.headerId) {
        const match = (data.formattedHeaders || []).find((h) => h._id === parsed.headerId);
        if (match) return match;
      }
      if (!prev || prev._id === "all") return data.activeCategory || data.categories?.[0] || ALL_CATEGORY;
      return (data.categories || []).find((cat) => cat._id === prev._id) || data.activeCategory || prev;
    });
    if (persist && cacheKey) homePageDataCache.set(cacheKey, data);
  };

  const fetchData = async ({ forceRefresh = false } = {}) => {
    const cacheKey = getHomePageDataCacheKey(currentLocation);
    if (!forceRefresh) {
      const cached = homePageDataCache.get(cacheKey);
      if (cached) {
        applyHomePageData(cached, { cacheKey, persist: false });
        setIsLoading(false);
        window.__homeDataLoaded__ = true;
        if (typeof window !== "undefined" && window.__resolveHomeData__) {
          window.__resolveHomeData__();
        }
        return;
      }
    }
    setIsLoading(true);

    const withTimeout = (promise, ms = 2200) => {
      return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms))
      ]);
    };

    const MOCK_CATEGORIES_DATA = [
      { _id: "all", id: "all", name: "All", type: "header" },
      { _id: "cat_food", id: "cat_food", name: "Food", type: "header", image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&q=80&w=120" },
      { _id: "cat_veg", id: "cat_veg", name: "Fruits & Vegetables", type: "header", image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&q=80&w=120" },
      { _id: "cat_grocery", id: "cat_grocery", name: "Grocery", type: "header", image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=120" },
      { _id: "cat_pharmacy", id: "cat_pharmacy", name: "Pharmacy", type: "header", image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=120" },
      { _id: "cat_sports", id: "cat_sports", name: "Sports", type: "header", image: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=120" }
    ];

    const MOCK_PRODUCTS_DATA = [
      { _id: "p1", name: "Fresh Milk 1L", headerId: "cat_food", mainImage: "https://images.unsplash.com/photo-1528498033373-386cc8224357?auto=format&fit=crop&q=80&w=400", salePrice: 60, price: 65, weight: "1 L", deliveryTime: "8-15 mins" },
      { _id: "p2", name: "Organic Tomatoes 500g", headerId: "cat_veg", mainImage: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400", salePrice: 30, price: 35, weight: "500 g", deliveryTime: "8-15 mins" },
      { _id: "p3", name: "Fresh Bananas 1 Dozen", headerId: "cat_veg", mainImage: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&q=80&w=400", salePrice: 50, price: 60, weight: "12 units", deliveryTime: "8-15 mins" },
      { _id: "p4", name: "Whole Wheat Bread", headerId: "cat_grocery", mainImage: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=400", salePrice: 40, price: 45, weight: "400 g", deliveryTime: "8-15 mins" }
    ];

    try {
      const hasValidLocation = Number.isFinite(currentLocation?.latitude) && Number.isFinite(currentLocation?.longitude);
      const productParams = { limit: 20 };
      if (hasValidLocation) {
        productParams.lat = currentLocation.latitude;
        productParams.lng = currentLocation.longitude;
      }
      const [catRes, prodRes, expRes, sectionsRes, shopsRes] = await Promise.all([
        withTimeout(customerApi.getCategories()).catch(() => ({ data: { success: false } })),
        hasValidLocation ? withTimeout(customerApi.getProducts(productParams)).catch(() => ({ data: { success: false } })) : Promise.resolve({ data: { success: true, result: { items: [] } } }),
        withTimeout(customerApi.getExperienceSections({ pageType: "home" })).catch(() => null),
        hasValidLocation ? withTimeout(customerApi.getOfferSections({ lat: currentLocation.latitude, lng: currentLocation.longitude })).catch(() => ({ data: {} })) : Promise.resolve({ data: { results: [] } }),
        hasValidLocation ? withTimeout(customerApi.getNearbySellers({ lat: currentLocation.latitude, lng: currentLocation.longitude })).catch(() => ({ data: { results: [] } })) : Promise.resolve({ data: { results: [] } }),
      ]);
      const nextHomeData = {
        categories: [ALL_CATEGORY],
        activeCategory: ALL_CATEGORY,
        products: [],
        quickCategories: [],
        experienceSections: [],
        offerSections: [],
        categoryMap: {},
        subcategoryMap: {},
        formattedHeaders: [],
        nearbySellers: (shopsRes?.data?.results || shopsRes?.data?.result || []),
        heroConfig: heroConfigMemoryCache.__home__ || EMPTY_HERO_CONFIG,
      };

      const isCatSuccess = catRes && catRes.data && catRes.data.success;
      const dbCats = isCatSuccess ? (catRes.data.results || catRes.data.result || []) : MOCK_CATEGORIES_DATA;
      const catMap = {};
      const subMap = {};
      dbCats.forEach((c) => { if (c.type === "category") catMap[c._id] = c; else if (c.type === "subcategory") subMap[c._id] = c; });
      nextHomeData.categoryMap = catMap;
      nextHomeData.subcategoryMap = subMap;
      const formattedHeaders = dbCats.filter((cat) => cat.type === "header").map((cat) => {
        const catName = cat.name;
        const meta = CATEGORY_METADATA[catName] || CATEGORY_METADATA[catName.toUpperCase()] || { icon: Sparkles, theme: DEFAULT_CATEGORY_THEME, banner: { title: catName.toUpperCase(), subtitle: "TOP PICKS", floatingElements: "sparkles" } };
        let IconComp = Sparkles;
        if (cat.displayType === "image" && cat.image) {
          IconComp = cat.image;
        } else if (cat.displayType === "icon") {
          if (cat.iconUrl) {
            IconComp = cat.iconUrl;
          } else {
            IconComp = (cat.iconId && ICON_COMPONENTS[cat.iconId]) || meta.icon || Sparkles;
          }
        } else {
          if (cat.image) {
            IconComp = cat.image;
          } else if (cat.iconUrl) {
            IconComp = cat.iconUrl;
          } else {
            IconComp = (cat.iconId && ICON_COMPONENTS[cat.iconId]) || meta.icon || Sparkles;
          }
        }
        return { ...cat, id: cat._id, icon: IconComp, theme: meta.theme, banner: { ...meta.banner, textColor: "text-white" } };
      });
      nextHomeData.formattedHeaders = formattedHeaders;
      const allHeaderFromAdmin = formattedHeaders.find((h) => (h.slug?.toLowerCase() === "all") || (h.name?.toLowerCase() === "all"));
      const mergedAllCategory = allHeaderFromAdmin ? { ...ALL_CATEGORY, headerColor: allHeaderFromAdmin.headerColor || ALL_CATEGORY.headerColor, headerFontColor: allHeaderFromAdmin.headerFontColor || ALL_CATEGORY.headerFontColor, headerIconColor: allHeaderFromAdmin.headerIconColor || ALL_CATEGORY.headerIconColor, icon: allHeaderFromAdmin.icon || ALL_CATEGORY.icon } : ALL_CATEGORY;
      nextHomeData.categories = [mergedAllCategory, ...formattedHeaders.filter((h) => !((h.slug?.toLowerCase() === "all") || (h.name?.toLowerCase() === "all")))];
      nextHomeData.activeCategory = mergedAllCategory;
      nextHomeData.quickCategories = dbCats.filter((cat) => cat.type === "category").map((cat) => ({ id: cat._id, name: cat.name, image: cat.image || "https://cdn-icons-png.flaticon.com/128/2321/2321831.png" }));

      const isProdSuccess = prodRes && prodRes.data && prodRes.data.success;
      const dbProds = isProdSuccess ? (Array.isArray(prodRes.data.results) ? prodRes.data.results : Array.isArray(prodRes.data.result?.items) ? prodRes.data.result.items : Array.isArray(prodRes.data.result) ? prodRes.data.result : []) : MOCK_PRODUCTS_DATA;
      nextHomeData.products = dbProds.map((p) => ({ ...p, id: p._id, image: p.mainImage || p.image || "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&q=80&w=400&h=400", price: p.salePrice || p.price, originalPrice: p.price, weight: p.weight || "1 unit", deliveryTime: "8-15 mins" }));

      if (expRes?.data?.success) nextHomeData.experienceSections = Array.isArray(expRes.data.result || expRes.data.results) ? (expRes.data.result || expRes.data.results) : [];
      const sectionsList = sectionsRes?.data?.results || sectionsRes?.data?.result || sectionsRes?.data;
      nextHomeData.offerSections = Array.isArray(sectionsList) ? sectionsList : [];
      applyHomePageData(nextHomeData, { cacheKey });
    } catch (error) { console.error("Error:", error); } finally {
      setIsLoading(false);
      window.__homeDataLoaded__ = true;
      if (typeof window !== "undefined" && window.__resolveHomeData__) {
        window.__resolveHomeData__();
      }
    }
  };

  const hydrateSelectedSectionProducts = async (sections = []) => {
    const selectedProductIds = Array.from(new Set(sections.flatMap((s) => s?.displayType === "products" ? (s?.config?.products?.productIds || []) : []).map((id) => String(id || "").trim()).filter(Boolean)));
    if (!selectedProductIds.length) return;
    const existingIds = new Set(productsRef.current.map((p) => String(p?._id || p?.id || "").trim()));
    const missingIds = selectedProductIds.filter((id) => !existingIds.has(id));
    if (!missingIds.length) return;
    try {
      const locationParams = Number.isFinite(currentLocation?.latitude) ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : undefined;
      const missingResults = await Promise.allSettled(missingIds.map((id) => customerApi.getProductById(id, locationParams)));
      const fetchedMissing = missingResults.filter((r) => r.status === "fulfilled").flatMap((r) => { const p = r.value?.data?.result || r.value?.data?.results; return Array.isArray(p) ? p : (p ? [p] : []); }).map((p) => ({ ...p, id: p._id, image: p.mainImage || p.image || "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&q=80&w=400&h=400", price: p.salePrice || p.price, originalPrice: p.price, weight: p.weight || "1 unit", deliveryTime: "8-15 mins" }));
      if (fetchedMissing.length) setProducts((prev) => { const merged = [...prev]; const mergedIds = new Set(merged.map((p) => String(p?._id || p?.id || "").trim())); fetchedMissing.forEach((p) => { const key = String(p?._id || p?.id || "").trim(); if (!mergedIds.has(key)) { merged.push(p); mergedIds.add(key); } }); return merged; });
    } catch (e) { }
  };

  useEffect(() => { fetchData(); }, [currentLocation?.latitude, currentLocation?.longitude]);
  const headerSectionsCache = useRef(headerSectionsMemoryCache);
  const heroConfigCache = useRef(heroConfigMemoryCache);

  useEffect(() => {
    const fetchHeaderSections = async () => {
      if (!activeCategory || activeCategory._id === "all") { setHeaderSections([]); return; }
      const cacheKey = activeCategory._id;
      if (headerSectionsCache.current[cacheKey]) { setHeaderSections(headerSectionsCache.current[cacheKey]); return; }
      try {
        const res = await customerApi.getExperienceSections({ pageType: "header", headerId: activeCategory._id });
        if (res.data.success) { const sections = Array.isArray(res.data.result || res.data.results) ? (res.data.result || res.data.results) : []; headerSectionsCache.current[cacheKey] = sections; setHeaderSections(sections); await hydrateSelectedSectionProducts(sections); }
        else setHeaderSections([]);
      } catch (e) { setHeaderSections([]); }
    };
    fetchHeaderSections();
  }, [activeCategory]);

  useEffect(() => {
    const fetchHeroConfig = async () => {
      try {
        const cacheKey = "__home__";
        if (heroConfigCache.current[cacheKey]) { setHeroConfig(heroConfigCache.current[cacheKey]); return; }
        const homeRes = await customerApi.getHeroConfig({ pageType: "home" });
        const payload = homeRes.data?.result;
        const resolved = payload && (payload.banners?.items?.length > 0 || payload.categoryIds?.length > 0) ? { banners: payload.banners || { items: [] }, categoryIds: payload.categoryIds || [] } : { banners: { items: [] }, categoryIds: [] };
        heroConfigCache.current[cacheKey] = resolved;
        setHeroConfig(resolved);
      } catch (e) { setHeroConfig(EMPTY_HERO_CONFIG); }
    };
    fetchHeroConfig();
  }, [currentLocation?.latitude, currentLocation?.longitude]);

  useEffect(() => {
    const firstUrl = heroConfig?.banners?.items?.[0]?.imageUrl;
    if (!firstUrl || firstUrl.includes("/video/upload/") || /\.(mp4|webm|ogg|mov|m4v)($|\?)/i.test(firstUrl)) return;
    const link = document.createElement("link");
    link.rel = "preload"; link.as = "image"; link.href = applyCloudinaryTransform(firstUrl, "f_auto,q_auto,c_fill,g_auto,w_824,h_440");
    link.setAttribute("fetchpriority", "high"); document.head.appendChild(link);
    return () => { if (link.parentNode) link.parentNode.removeChild(link); };
  }, [heroConfig?.banners?.items?.[0]?.imageUrl]);

  useEffect(() => {
    const totalSlides = 3;
    const intervalId = setInterval(() => { setMobileBannerIndex((prev) => prev >= totalSlides - 1 ? prev : prev + 1); }, 3500);
    return () => clearInterval(intervalId);
  }, []);

  const handleBannerTransitionEnd = () => { if (mobileBannerIndex === 2) { setIsInstantBannerJump(true); setMobileBannerIndex(0); } };
  useEffect(() => { if (!isInstantBannerJump) return; const id = requestAnimationFrame(() => setIsInstantBannerJump(false)); return () => cancelAnimationFrame(id); }, [isInstantBannerJump]);

  const productsSectionRef = useRef(null);

  const filteredCategoryProducts = useMemo(() => {
    if (!activeCategory || activeCategory._id === "all") return null;
    return products.filter((p) => {
      const hId = typeof p.headerId === 'object' ? p.headerId?._id : p.headerId;
      const cId = typeof p.categoryId === 'object' ? p.categoryId?._id : p.categoryId;
      return String(hId) === String(activeCategory._id) || String(cId) === String(activeCategory._id);
    });
  }, [products, activeCategory]);

  useEffect(() => {
    if (activeCategory && activeCategory._id !== "all" && productsSectionRef.current) {
      setTimeout(() => {
        productsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [activeCategory]);

  const productsById = useMemo(() => { const map = {}; products.forEach((p) => { map[p._id || p.id] = p; }); return map; }, [products]);
  const effectiveQuickCategories = useMemo(() => {
    const ids = heroConfig.categoryIds || [];
    if (ids.length > 0) { const resolved = ids.map((id) => categoryMap[id]).filter(Boolean).map((c) => ({ id: c._id, name: c.name, image: c.image || "https://cdn-icons-png.flaticon.com/128/2321/2321831.png" })); if (resolved.length > 0) return resolved; }
    return quickCategories;
  }, [heroConfig.categoryIds, categoryMap, quickCategories]);

  const sectionsForRenderer = useMemo(() => {
    const rawSections = headerSections.length ? headerSections : experienceSections;
    return rawSections.filter((s) => s.displayType !== "banners");
  }, [headerSections, experienceSections]);
  const isMobile = useMemo(() => isMobileOrWebView(), []);
  const opacity = useTransform(scrollY, (heroVisible && !isMobile) ? [0, 300] : [0, 0], [1, 0.6]);
  const y = useTransform(scrollY, (heroVisible && !isMobile) ? [0, 300] : [0, 0], [0, 80]);
  const scale = useTransform(scrollY, (heroVisible && !isMobile) ? [0, 300] : [0, 0], [1, 0.95]);
  const pointerEvents = useTransform(scrollY, (heroVisible && !isMobile) ? [0, 100] : [0, 0], ["auto", "none"]);

  useEffect(() => {
    if (!pendingReturn?.sectionId) return;
    const allSections = headerSections.length ? headerSections : experienceSections;
    if (!allSections.length) return;
    if (allSections.some((s) => s._id === pendingReturn.sectionId)) { const el = document.getElementById(`section-${pendingReturn.sectionId}`); if (el) { el.scrollIntoView({ behavior: "instant", block: "start" }); removeStorage(STORAGE_KEYS.EXPERIENCE_RETURN, { storage: "session" }); setPendingReturn(null); } }
  }, [headerSections, experienceSections, pendingReturn]);

  const renderFloatingElements = (type, isVisible = true) => {
    if (isMobile) return null;
    return null; // Particles were already simplified out earlier
  };

  return (
    <div className={`min-h-screen pt-[215px] md:pt-[245px] ${products.length === 0 && !isLoading ? "bg-white" : "bg-white"}`}>

      <div className={cn("contents", isProductDetailOpen && "hidden md:contents")}>
        <MainLocationHeader categories={categories} activeCategory={activeCategory} onCategorySelect={setActiveCategory} />
      </div>

      {products.length === 0 && !isLoading ? (
        <div className="flex flex-col items-center justify-center pt-24 pb-48">
          <div className="w-64 h-64 md:w-96 md:h-96 mb-8">{noServiceData && <Lottie animationData={noServiceData} loop={true} />}</div>
          <h3 className="text-3xl md:text-5xl font-black text-slate-800 text-center uppercase">Service <span className="text-[#1a6e2e]">Unavailable</span></h3>
          <p className="text-slate-500 font-bold max-w-md text-center px-10 text-sm md:text-lg opacity-80">Ah! We haven't reached your neighborhood yet.</p>
          <button onClick={() => window.location.reload()} className="mt-12 px-10 py-4 bg-[#1a6e2e] text-white font-black rounded-[24px] uppercase text-[13px] tracking-widest transition-all active:scale-95">Check Again</button>
        </div>
      ) : (
        <>
          <motion.div ref={heroRef} className="block will-change-transform" style={isMobile ? { opacity: 1 } : { opacity, y, scale, pointerEvents }}>
            <div className="relative w-full overflow-hidden">
              {heroConfig.banners?.items?.length ? (
                <ExperienceBannerCarousel section={{ title: "" }} items={heroConfig.banners.items} fullWidth edgeToEdge />
              ) : isLoading ? (
                <div className="w-full h-[200px] sm:h-[280px] md:h-[380px] lg:h-[440px] bg-white animate-pulse relative overflow-hidden flex items-center justify-center border-y border-[#1a6e2e]/20">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-6 w-48 bg-slate-200 rounded-lg animate-pulse" />
                    <div className="h-4 w-32 bg-slate-200/80 rounded-lg animate-pulse" />
                  </div>
                </div>
              ) : (
                <div className="w-full h-[200px] sm:h-[280px] md:h-[380px] lg:h-[440px] relative overflow-hidden bg-white flex items-center justify-center border-y border-[#1a6e2e]/20">
                  <video
                    src="https://assets.mixkit.co/videos/preview/mixkit-delivery-man-carrying-a-box-41584-large.mp4"
                    className="w-full h-full object-cover object-center pointer-events-none"
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                  {/* Logo overlay on video */}
                  <div className="absolute top-4 left-4 z-20 bg-white px-3 py-1.5 rounded-xl border border-[#1a6e2e]/20 flex items-center justify-center max-h-24 pointer-events-none">
                    <img src={settings?.logoUrl || LogoImage} alt="Logo" className="h-12 sm:h-16 w-auto object-contain scale-[1.2]" />
                  </div>

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
                </div>
              )}
            </div>
          </motion.div>

          {/* Daily Needs Section */}
          <DailyNeedsSection />

          {/* All Shops Near You Section */}
          <div className="container mx-auto max-w-6xl px-4 md:px-8 py-5 my-4 bg-white rounded-[2rem] border border-[#1a6e2e]/20">

            <h3 className="text-base md:text-xl font-black text-[#1A1A1A] tracking-tight uppercase leading-none">
              All Shops near me
            </h3>
            <div className="flex items-center gap-1.5 md:gap-2 mt-1.5 md:mt-3 mb-6">
              <div className="h-1.5 w-1.5 bg-[#1a6e2e] rounded-full animate-pulse" />
              <span className="text-[10px] md:text-xs font-bold text-[#1a6e2e] uppercase tracking-wide opacity-80">
                PARTNER STORES IN YOUR AREA &bull; HYGIENE ASSURED
              </span>
            </div>

            {isLoading ? (
              <SkeletonLoader variant="shopGrid" count={4} />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {dynamicShops.map((shop) => (
                  <div key={shop._id} onClick={() => navigate(`/shops/${shop._id}`)} className="bg-white rounded-2xl p-3 border border-[#1a6e2e]/20 flex flex-col gap-2.5 hover:-translate-y-0.5 transition-all duration-300 group cursor-pointer">
                    <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-white relative">
                      <img
                        src={getShopImage(shop.category, shop.shopName, shop.storeFrontImage || shop.shopLogo || shop.logo || shop.shopImage)}
                        alt={shop.shopName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <span className="absolute top-2 right-2 bg-white px-2 py-0.5 rounded-full text-[10px] font-extrabold text-slate-800 border border-[#1a6e2e]/20 flex items-center gap-0.5">
                        ⭐ {shop.rating || "4.6"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <h4 className="font-extrabold text-slate-850 text-xs md:text-sm lg:text-base line-clamp-1 leading-tight group-hover:text-[#1a6e2e] transition-colors">
                        {shop.shopName}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[10px] md:text-[11px] font-bold text-slate-500">
                        <span>{shop.deliveryTime || "15-25 min"}</span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                        <span className="text-[#10b981]">Free Delivery</span>
                      </div>
                      {shop.distance !== undefined && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          {typeof shop.distance === 'number' ? `${shop.distance.toFixed(1)} km away` : shop.distance}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="container mx-auto max-w-6xl px-4 md:px-8 py-5 md:py-6">
              <h3 className="text-base md:text-xl font-black text-[#1A1A1A] tracking-tight uppercase mb-4">
                Loading products...
              </h3>
              <SkeletonLoader variant="productGrid" count={8} />
            </div>
          ) : (
            <div ref={productsSectionRef}>
              {activeCategory && activeCategory._id !== "all" ? (
                <div className="container mx-auto max-w-6xl px-4 md:px-8 py-5 md:py-6 min-h-[50vh]">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg md:text-2xl font-black text-[#1A1A1A] tracking-tight uppercase">
                      {activeCategory.name} <span className="text-[#1a6e2e]">Products</span>
                    </h3>
                  </div>
                  
                  {filteredCategoryProducts && filteredCategoryProducts.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4 lg:gap-6">
                      {filteredCategoryProducts.map(p => (
                        <div key={p.id} className="smooth-transform">
                          <ProductCard product={p} className="bg-white border border-[#1a6e2e]/20" compact={true} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16">
                       <h3 className="text-xl md:text-2xl font-black text-slate-700 tracking-tighter mb-2 uppercase">No products available</h3>
                       <p className="text-slate-500 font-bold text-sm">Check back later! We are adding new items daily.</p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <LowestPriceSection products={products} onSeeAll={() => navigate("/category/all")} />
                  <OfferSections sections={offerSections} noServiceData={noServiceData} />

                  {sectionsForRenderer.length > 0 && (
                    <div className="container mx-auto max-w-6xl px-4 md:px-8 py-5 md:py-6">
                      <SectionRenderer sections={sectionsForRenderer} productsById={productsById} categoriesById={categoryMap} subcategoriesById={subcategoryMap} />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Home;
