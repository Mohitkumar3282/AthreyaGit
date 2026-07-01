import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ChevronLeft, Search, Star, Clock, MapPin, Phone, AlertCircle,
  HelpCircle, ShieldCheck, CheckCircle, Sparkles, Tag, ShoppingCart,
  Info, ChevronRight, SlidersHorizontal, ChevronDown, X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { customerApi } from "../services/customerApi";
import ProductCard from "../components/shared/ProductCard";
import { useCart } from "../context/CartContext";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";
import SkeletonLoader from "../components/shared/SkeletonLoader";

const SHOP_CATEGORIES = [
  "All", "Groceries", "Fruits & Vegetables", "Dairy & Milk", "Bakery",
  "Snacks", "Beverages", "Frozen Foods", "Personal Care", "Household",
  "Medicines", "Health Devices", "Pet Supplies", "Electronics",
  "Stationery", "Baby Care"
];

const CATEGORY_ICONS = {
  "All": "https://cdn-icons-png.flaticon.com/128/9716/9716843.png",
  "Groceries": "https://cdn-icons-png.flaticon.com/128/3724/3724720.png",
  "Fruits & Vegetables": "https://cdn-icons-png.flaticon.com/128/2329/2329903.png",
  "Dairy & Milk": "https://cdn-icons-png.flaticon.com/128/3058/3058995.png",
  "Bakery": "https://cdn-icons-png.flaticon.com/128/3014/3014533.png",
  "Snacks": "https://cdn-icons-png.flaticon.com/128/2553/2553691.png",
  "Beverages": "https://cdn-icons-png.flaticon.com/128/2405/2405479.png",
  "Frozen Foods": "https://cdn-icons-png.flaticon.com/128/4126/4126244.png",
  "Personal Care": "https://cdn-icons-png.flaticon.com/128/822/822143.png",
  "Household": "https://cdn-icons-png.flaticon.com/128/4764/4764835.png",
  "Medicines": "https://cdn-icons-png.flaticon.com/128/883/883407.png",
  "Health Devices": "https://cdn-icons-png.flaticon.com/128/3004/3004458.png",
  "Pet Supplies": "https://cdn-icons-png.flaticon.com/128/620/620851.png",
  "Electronics": "https://cdn-icons-png.flaticon.com/128/3659/3659899.png",
  "Stationery": "https://cdn-icons-png.flaticon.com/128/2232/2232688.png",
  "Baby Care": "https://cdn-icons-png.flaticon.com/128/3531/3531742.png"
};

const ShopDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { cart, cartCount, cartTotal } = useCart();

  // State variables
  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [gallery, setGallery] = useState({ shopGallery: [], storeFrontImage: "", storeInteriorImages: [] });
  const [similarShops, setSimilarShops] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [gallerySlideIndex, setGallerySlideIndex] = useState(0);

  // Advanced Filters State
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState("Type");
  const [selectedFilters, setSelectedFilters] = useState({
    types: [],
    brands: [],
    priceRange: null
  });

  // Fetch all shop related details on mount / ID change
  useEffect(() => {
    const fetchShopData = async () => {
      setIsLoading(true);
      try {
        const [shopRes, prodRes, reviewRes, galleryRes, similarRes] = await Promise.all([
          customerApi.getShopById(id).catch(() => null),
          customerApi.getShopProducts(id).catch(() => ({ data: { result: { items: [] } } })),
          customerApi.getShopReviews(id).catch(() => ({ data: { result: [] } })),
          customerApi.getShopGallery(id).catch(() => ({ data: { result: { shopGallery: [], storeFrontImage: "", storeInteriorImages: [] } } })),
          customerApi.getSimilarShops(id).catch(() => ({ data: { result: [] } }))
        ]);

        if (shopRes?.data?.success) {
          setShop(shopRes.data.result);
        } else {
          setShop(null);
        }

        setProducts(prodRes?.data?.result?.items || prodRes?.data?.results || []);
        setReviews(reviewRes?.data?.result || reviewRes?.data?.results || []);
        setGallery(galleryRes?.data?.result || { shopGallery: [], storeFrontImage: "", storeInteriorImages: [] });
        setSimilarShops(similarRes?.data?.result || similarRes?.data?.results || []);

      } catch (err) {
        console.error("Error loading shop details:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchShopData();
  }, [id]);

  // Derived filter options
  const uniqueBrands = useMemo(() => {
    const brands = new Set();
    products.forEach(p => {
      if (p.brand) {
        brands.add(p.brand.trim());
      }
    });
    return Array.from(brands).sort();
  }, [products]);

  const uniqueTypes = useMemo(() => {
    const types = new Set();
    products.forEach(p => {
      const typeName = p.subcategoryId?.name || p.categoryId?.name || p.category;
      if (typeName) {
        types.add(typeName.trim());
      }
    });
    return Array.from(types).sort();
  }, [products]);

  const priceRanges = useMemo(() => [
    { label: "Under ₹100", min: 0, max: 100 },
    { label: "₹100 - ₹200", min: 100, max: 200 },
    { label: "₹200 - ₹500", min: 200, max: 500 },
    { label: "Above ₹500", min: 500, max: Infinity }
  ], []);

  // Derived arrays
  const filteredProducts = useMemo(() => {
    // Temporary console logs for diagnosis
    console.log("All products:", products);
    console.log("Selected category:", selectedCategory);
    console.log("Filtered:", products.filter(p => p.category === selectedCategory));

    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === "All" || (() => {
        const selLower = selectedCategory.toLowerCase();
        const prodCategory = (p.category || "").toLowerCase();
        const prodCatName = (p.categoryId?.name || "").toLowerCase();
        const prodSubcatName = (p.subcategoryId?.name || "").toLowerCase();
        const prodHeaderName = (p.headerId?.name || "").toLowerCase();
        const prodTags = Array.isArray(p.tags) ? p.tags.map(t => String(t).toLowerCase()) : [];

        // Direct exact / substring matches
        if (prodCategory.includes(selLower) || (prodCategory && selLower.includes(prodCategory))) return true;
        if (prodCatName.includes(selLower) || (prodCatName && selLower.includes(prodCatName))) return true;
        if (prodSubcatName.includes(selLower) || (prodSubcatName && selLower.includes(prodSubcatName))) return true;
        if (prodHeaderName.includes(selLower) || (prodHeaderName && selLower.includes(prodHeaderName))) return true;
        if (prodTags.some(t => t.includes(selLower) || selLower.includes(t))) return true;

        // Semantic word translations for standard SHOP_CATEGORIES
        const categoryKeywords = {
          "groceries": ["grocery", "groceries", "masala", "spices", "oil", "flour", "atta", "dal", "pulses", "grains", "rice", "salt", "sugar", "jaggery"],
          "fruits & vegetables": ["fruits and veg", "fruits & vegetables", "fresh fruits", "fresh vegetables", "fruit", "veg", "banana", "apple", "guava", "tomato"],
          "dairy & milk": ["dairy & milk", "dairy & breads", "milk", "ghee", "butter", "cheese", "curd", "yogurt", "whitener", "cream"],
          "bakery": ["bakery", "breads", "bread", "cookies", "wafers", "cakes", "rolls", "rusks"],
          "snacks": ["snacks", "chips", "crisps", "bhujia", "mixtures", "popcorn", "chocolates", "candies", "gum", "sweets"],
          "beverages": ["beverages", "beverage", "drinks", "juice", "soda", "mixers", "tea", "coffee", "syrup"],
          "personal care": ["personal care", "personal", "care", "hygiene", "bathing", "skin", "hair", "oral", "nasal", "body", "body care", "skincare", "groming"],
          "pet supplies": ["pet supplies", "pet", "dog", "cat", "animal"],
          "baby care": ["baby care", "baby", "kids", "diapers", "nursing"],
          "electronics": ["electronics", "headphones", "gadgets", "watch", "mobile", "phone", "tv"],
          "medicines": ["medicines", "medicine", "pharmacy", "cold", "tablet", "cough"],
          "health devices": ["health devices", "pharmacy", "thermometer", "bp monitor"],
          "household": ["household", "cleaning", "cookware", "pan", "tiffin", "bottle"],
        };

        const keywords = categoryKeywords[selLower] || [];
        return keywords.some(kw => {
          return prodCategory.includes(kw) || 
                 prodCatName.includes(kw) || 
                 prodSubcatName.includes(kw) || 
                 prodHeaderName.includes(kw) ||
                 prodTags.some(t => t.includes(kw));
        });
      })();

      const matchesTypeFilter = selectedFilters.types.length === 0 ||
        selectedFilters.types.includes(p.subcategoryId?.name || p.categoryId?.name || p.category);

      const matchesBrandFilter = selectedFilters.brands.length === 0 ||
        (p.brand && selectedFilters.brands.includes(p.brand.trim()));

      let matchesPriceFilter = true;
      if (selectedFilters.priceRange) {
        const price = p.price;
        const range = selectedFilters.priceRange;
        matchesPriceFilter = price >= range.min && price <= range.max;
      }

      return matchesSearch && matchesCategory && matchesTypeFilter && matchesBrandFilter && matchesPriceFilter;
    });
  }, [products, searchQuery, selectedCategory, selectedFilters]);

  const bestSellers = useMemo(() => {
    return products.filter(p => p.isFeatured || p.isBestSeller).slice(0, 8);
  }, [products]);

  // Gallery slider / list
  const allGalleryImages = useMemo(() => {
    const list = [];
    if (gallery.storeFrontImage) list.push(gallery.storeFrontImage);
    if (gallery.storeInteriorImages?.length) list.push(...gallery.storeInteriorImages);
    if (gallery.shopGallery?.length) list.push(...gallery.shopGallery);
    // If no images are available, use fallbacks
    if (!list.length) {
      list.push(
        "https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&q=80&w=600",
        "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=600",
        "https://images.unsplash.com/photo-1534723452862-4c874018d66d?auto=format&fit=crop&q=80&w=600"
      );
    }
    return list;
  }, [gallery]);

  useEffect(() => {
    if (allGalleryImages.length <= 1) return;
    const timer = setInterval(() => {
      setGallerySlideIndex((prev) => (prev + 1) % allGalleryImages.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [allGalleryImages]);

  // Fallback category banner helpers
  const categoryBannerMap = {
    grocery: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=1200&h=400",
    vegetables: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&q=80&w=1200&h=400",
    dairy: "https://images.unsplash.com/photo-1528498033373-386cc8224357?auto=format&fit=crop&q=80&w=1200&h=400",
    pharmacy: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=1200&h=400",
    default: "https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&q=80&w=1200&h=400"
  };

  const getShopBanner = () => {
    if (shop?.shopBanner) return shop.shopBanner;
    if (shop?.storeInteriorImages?.[0]) return shop.storeInteriorImages[0];
    if (shop?.storeFrontImage) return shop.storeFrontImage;
    if (shop?.shopGallery?.[0]) return shop.shopGallery[0];
    const cat = String(shop?.category || "").toLowerCase();
    if (cat.includes("grocery") || cat.includes("kirana")) return categoryBannerMap.grocery;
    if (cat.includes("veg") || cat.includes("fruit")) return categoryBannerMap.vegetables;
    if (cat.includes("dairy") || cat.includes("milk")) return categoryBannerMap.dairy;
    if (cat.includes("pharmacy") || cat.includes("chemist") || cat.includes("medicine")) return categoryBannerMap.pharmacy;
    return categoryBannerMap.default;
  };

  const getInitials = (name) => {
    return String(name || "S").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 pb-24 font-sans">
        <SkeletonLoader variant="shopHeader" />
        <div className="max-w-6xl mx-auto px-4 md:px-8 space-y-6">
          <SkeletonLoader variant="categoryList" />
          <SkeletonLoader variant="productGrid" count={8} />
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-sans">
        <AlertCircle size={64} className="text-red-500 mb-4" />
        <h2 className="text-2xl font-black text-slate-800 mb-2">Shop Not Found</h2>
        <p className="text-slate-500 mb-6 max-w-sm">The shop you are trying to view does not exist or may have been deactivated.</p>
        <button onClick={() => navigate("/")} className="bg-[#1a6e2e] text-white px-8 py-3 rounded-full font-bold transition-all active:scale-95 border border-transparent">
          Go Back Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-32 font-sans">

      
      {/* 1. Header Banner Area */}
      <div className="relative w-full h-48 md:h-72 overflow-hidden bg-slate-900">
        <img src={applyCloudinaryTransform(getShopBanner(), "f_auto,q_auto,w_1200,h_400,c_fill")} alt={shop.shopName} className="w-full h-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-[#1a6e2e]/20 pointer-events-none" />

        
        {/* Back Button */}
        <button onClick={() => navigate(-1)} className="absolute top-4 left-4 z-20 w-10 h-10 flex items-center justify-center bg-white/90  rounded-full border border-[#1a6e2e]/20 hover:bg-white transition-all active:scale-95">
          <ChevronLeft size={22} className="text-slate-800" />
        </button>
      </div>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 relative -mt-16 z-10">
        
        {/* 2. Shop Info Card */}
        <div className="bg-white rounded-3xl p-6 border border-[#1a6e2e]/20 mb-6 relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            
            {/* Logo and Core details */}
            <div className="flex items-center gap-4.5">
              <div className="h-20 w-20 rounded-2xl overflow-hidden bg-[#1a6e2e]/10 border border-[#1a6e2e]/20 flex items-center justify-center flex-shrink-0">
                {shop.shopLogo ? (
                  <img src={applyCloudinaryTransform(shop.shopLogo, "f_auto,q_auto,w_200,h_200,c_fill")} alt={shop.shopName} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl font-black text-[#1a6e2e]">{getInitials(shop.shopName)}</span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <h1 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                    {shop.shopName}
                  </h1>
                  {shop.isVerified && (
                    <span className="inline-flex items-center gap-0.5 bg-blue-50 text-blue-600 font-extrabold text-[9px] px-1.5 py-0.5 rounded-full border border-blue-100 uppercase tracking-wider">
                      <ShieldCheck size={10} /> Verified
                    </span>
                  )}
                  {shop.hygieneAssured && (
                    <span className="inline-flex items-center gap-0.5 bg-emerald-50 text-emerald-600 font-extrabold text-[9px] px-1.5 py-0.5 rounded-full border border-emerald-100 uppercase tracking-wider">
                      <CheckCircle size={10} /> Hygiene Assured
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-slate-500 text-xs md:text-sm font-semibold flex-wrap">
                  <span className="bg-slate-100 px-2.5 py-0.5 rounded-full font-bold text-slate-700">{shop.category || "General Store"}</span>
                  <span className="flex items-center gap-1"><MapPin size={14} className="text-slate-400" /> {shop.locality || "Local Area"}, {shop.city}</span>
                </div>
              </div>
            </div>

            {/* Performance and Operational Specs */}
            <div className="flex items-center gap-4 bg-slate-50 p-4.5 rounded-2xl border border-slate-100/60 md:self-stretch">
              <div className="text-center border-r border-slate-200 pr-4">
                <div className="flex items-center gap-1 justify-center text-amber-500 font-black text-sm md:text-base">
                  ⭐ {shop.rating || "4.5"}
                </div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Rating</div>
              </div>
              <div className="text-center border-r border-slate-200 pr-4">
                <div className="font-black text-slate-800 text-sm md:text-base">
                  {shop.deliveryTime || "15-25 min"}
                </div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Delivery</div>
              </div>
              <div className="text-center">
                <div className={`font-black text-xs px-2 py-0.5 rounded-full uppercase ${shop.isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {shop.isOpen ? 'Open' : 'Closed'}
                </div>
                <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">{shop.storeTimings || "9am - 10pm"}</div>
              </div>
            </div>
          </div>

          {/* Dynamic Badges & Specs Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-slate-100 pt-5 mt-5 text-[11px] md:text-xs font-semibold text-slate-600">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-[#1a6e2e]/10 text-[#1a6e2e] rounded-lg"><Clock size={14} /></span>
              <span>Radius: {shop.deliveryRadius || shop.serviceRadius || 5} km</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-[#1a6e2e]/10 text-[#1a6e2e] rounded-lg"><Tag size={14} /></span>
              <span>Min. Order: ₹{shop.minimumOrderAmount || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-[#1a6e2e]/10 text-[#1a6e2e] rounded-lg"><Tag size={14} /></span>
              <span>Delivery Fee: ₹{shop.deliveryFee || 30}</span>
            </div>
            {shop.freeDeliveryAbove > 0 && (
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle size={14} /></span>
                <span>Free Above: ₹{shop.freeDeliveryAbove}</span>
              </div>
            )}
          </div>
        </div>

        {/* 3. Top Filter Panel & Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 no-scrollbar sticky top-[0px] bg-white pt-3 z-20 border-b border-slate-100/80">

          {/* Filter Button */}
          <button 
            onClick={() => {
              setActiveFilterTab("Type");
              setIsFilterModalOpen(true);
            }}
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-white border border-[#1a6e2e]/20 rounded-xl hover:bg-[#1a6e2e]/10 transition-all active:scale-95 cursor-pointer"
          >
            <SlidersHorizontal size={16} className="text-slate-700" />
          </button>

          {/* Type Pill */}
          <button
            onClick={() => {
              setActiveFilterTab("Type");
              setIsFilterModalOpen(true);
            }}
            className={`flex-shrink-0 px-3.5 py-2 border rounded-xl flex items-center gap-1 text-xs font-bold transition-all active:scale-95 cursor-pointer ${
              selectedFilters.types.length > 0
                ? "bg-[#1a6e2e]/10 text-[#1a6e2e] border-[#1a6e2e]"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Type {selectedFilters.types.length > 0 ? `(${selectedFilters.types.length})` : ""}
            <ChevronDown size={12} className="opacity-60" />
          </button>

          {/* Brand Pill */}
          <button
            onClick={() => {
              setActiveFilterTab("Brand");
              setIsFilterModalOpen(true);
            }}
            className={`flex-shrink-0 px-3.5 py-2 border rounded-xl flex items-center gap-1 text-xs font-bold transition-all active:scale-95 cursor-pointer ${
              selectedFilters.brands.length > 0
                ? "bg-[#1a6e2e]/10 text-[#1a6e2e] border-[#1a6e2e]"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Brand {selectedFilters.brands.length > 0 ? `(${selectedFilters.brands.length})` : ""}
            <ChevronDown size={12} className="opacity-60" />
          </button>

          {/* Price Pill */}
          <button
            onClick={() => {
              setActiveFilterTab("Price");
              setIsFilterModalOpen(true);
            }}
            className={`flex-shrink-0 px-3.5 py-2 border rounded-xl flex items-center gap-1 text-xs font-bold transition-all active:scale-95 cursor-pointer ${
              selectedFilters.priceRange
                ? "bg-[#1a6e2e]/10 text-[#1a6e2e] border-[#1a6e2e]"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Price {selectedFilters.priceRange ? `(${selectedFilters.priceRange.label})` : ""}
            <ChevronDown size={12} className="opacity-60" />
          </button>

          <div className="w-[1.5px] h-6 bg-slate-200 flex-shrink-0 mx-1" />

          {/* Scrollable Quick Category Pills */}
          {SHOP_CATEGORIES.map(cat => {
            const isCatActive = selectedCategory === cat;
            const icon = CATEGORY_ICONS[cat] || "https://cdn-icons-png.flaticon.com/128/9716/9716843.png";
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                  isCatActive
                    ? "bg-[#1a6e2e] text-white border-[#1a6e2e] font-black"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <img src={icon} alt={cat} className="w-4 h-4 object-contain shrink-0" />
                {cat}
              </button>
            );
          })}
        </div>

        {/* 4. Single Pane Content Area: Search & Products */}
        <div className="space-y-6 min-w-0 mt-4">
          {/* Search inside Shop */}
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search products in this shop..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-[#1a6e2e]/20 pl-11 pr-4 py-3 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-[#1a6e2e] transition-all outline-none"
            />
          </div>

          {/* Best Sellers (only if search/category/drawer filters are cleared) */}
          {!searchQuery && selectedCategory === "All" && !selectedFilters.types.length && !selectedFilters.brands.length && !selectedFilters.priceRange && bestSellers.length > 0 && (
            <div>
              <h2 className="text-sm md:text-base font-black text-slate-800 tracking-tight uppercase mb-4 px-1 flex items-center gap-1.5">
                <Sparkles size={16} className="text-amber-500" /> Best Sellers
              </h2>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-2.5 md:gap-4">
                {bestSellers.map(product => (
                  <ProductCard key={product.id} product={product} compact={true} />
                ))}
              </div>
            </div>
          )}

          {/* Main product listings */}
          <div>
            <h2 className="text-sm md:text-base font-black text-slate-800 tracking-tight uppercase mb-4 px-1">
              {searchQuery || selectedCategory !== "All" || selectedFilters.types.length || selectedFilters.brands.length || selectedFilters.priceRange 
                ? "Filtered Products" 
                : "All Products"}
            </h2>
            {filteredProducts.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 p-6 flex flex-col items-center">
                <AlertCircle size={40} className="text-slate-400 mb-3" />
                <p className="font-bold text-slate-700 text-sm">No products found</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">Try resetting filters or changing the search keyword.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 gap-2.5 md:gap-4">
                {filteredProducts.map(product => (
                  <ProductCard key={product.id} product={product} compact={true} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 6. Shop Gallery Section */}
        <div className="mt-12">
          <h2 className="text-base md:text-lg font-black text-slate-800 tracking-tight uppercase mb-4 flex items-center gap-1.5">
            📸 Shop Gallery
          </h2>
          
          <div className="relative w-full aspect-[4/3] md:aspect-[21/9] rounded-3xl overflow-hidden border border-[#1a6e2e]/20 bg-slate-50 group">
            {allGalleryImages.map((img, idx) => (
              <div
                key={idx}
                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                  idx === gallerySlideIndex ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              >
                <img
                  src={applyCloudinaryTransform(img, "f_auto,q_auto,w_1200,h_600,c_fill")}
                  alt={`Gallery Image ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
            
            {/* Prev/Next Navigation Buttons */}
            {allGalleryImages.length > 1 && (
              <>
                <button
                  onClick={() => setGallerySlideIndex((prev) => (prev === 0 ? allGalleryImages.length - 1 : prev - 1))}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white border border-[#1a6e2e]/20 flex items-center justify-center text-slate-850 hover:text-[#1a6e2e] transition-all active:scale-90 opacity-0 group-hover:opacity-100 z-10"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() => setGallerySlideIndex((prev) => (prev + 1) % allGalleryImages.length)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white border border-[#1a6e2e]/20 flex items-center justify-center text-slate-850 hover:text-[#1a6e2e] transition-all active:scale-90 opacity-0 group-hover:opacity-100 z-10"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}

            {/* Slider Dots */}
            {allGalleryImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/25  px-2.5 py-1.5 rounded-full z-10">
                {allGalleryImages.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setGallerySlideIndex(idx)}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                      idx === gallerySlideIndex ? "bg-white scale-125" : "bg-white/40 hover:bg-white/60"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 7. Reviews Section */}
        <div className="mt-12 bg-white rounded-3xl p-6 border border-[#1a6e2e]/20">
          <h2 className="text-base md:text-lg font-black text-slate-800 tracking-tight uppercase mb-6 flex items-center gap-1.5">
            ⭐ Customer Reviews
          </h2>
          
          <div className="divide-y divide-slate-100">
            {reviews.map((r) => (
              <div key={r._id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-slate-100 border border-[#1a6e2e]/20 flex items-center justify-center text-xs font-black text-[#1a6e2e] overflow-hidden">
                      {r.userId?.profileImage ? (
                        <img src={r.userId.profileImage} alt={r.userId.name} className="h-full w-full object-cover" />
                      ) : (
                        getInitials(r.userId?.name || "Customer")
                      )}
                    </div>
                    <span className="font-bold text-slate-800 text-sm">{r.userId?.name || "Verified Customer"}</span>
                  </div>
                  <div className="flex items-center gap-0.5 text-amber-500 text-xs font-extrabold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                    ⭐ {r.rating}
                  </div>
                </div>
                <p className="text-slate-600 text-xs md:text-sm font-medium leading-relaxed mb-1">{r.comment}</p>
                <span className="text-[10px] text-slate-400 font-semibold">
                  {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 8. Similar Shops Section */}
        {similarShops.length > 0 && (
          <div className="mt-12">
            <h2 className="text-base md:text-lg font-black text-slate-800 tracking-tight uppercase mb-4 px-1">
              Similar Shops Near You
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-3 no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
              {similarShops.map(s => (
                <Link
                  to={`/shops/${s._id}`}
                  key={s._id}
                  className="w-60 bg-white border border-[#1a6e2e]/20 rounded-3xl p-3 hover:border-[#1a6e2e]/50 transition-all shrink-0 flex flex-col gap-2 group"
                >
                  <div className="aspect-[4/3] rounded-2xl bg-[#1a6e2e]/10 overflow-hidden relative border border-slate-100">
                    {s.shopLogo ? (
                      <img src={applyCloudinaryTransform(s.shopLogo, "f_auto,q_auto,w_400,h_300,c_fill")} alt={s.shopName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-black text-[#1a6e2e] text-lg">
                        {getInitials(s.shopName)}
                      </div>
                    )}
                    <span className="absolute top-2 right-2 bg-white/95 px-2 py-0.5 rounded-full text-[9px] font-black text-slate-800 border border-[#1a6e2e]/20">
                      ⭐ {s.rating || "4.5"}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm line-clamp-1 group-hover:text-[#1a6e2e] transition-colors">{s.shopName}</h4>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wide">{s.category || "General Store"}</p>
                    {s.distance !== undefined && (
                      <p className="text-[10px] text-slate-400 font-semibold mt-1">
                        {typeof s.distance === 'number' ? `${s.distance.toFixed(1)} km away` : s.distance}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* 9. Mobile Sticky Bottom Cart Bar */}
      {cartCount > 0 && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#1a6e2e]/20 px-4 py-4.5 z-50 rounded-t-[2rem] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 bg-[#1a6e2e]/10 text-[#1a6e2e] rounded-2xl flex items-center justify-center">
              <ShoppingCart size={20} className="fill-current" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{cartCount} {cartCount === 1 ? 'item' : 'items'} added</span>
              <span className="text-base font-black text-slate-800 mt-1">₹{cartTotal}</span>
            </div>
          </div>
          <button onClick={() => navigate("/checkout")} className="bg-[#1a6e2e] hover:bg-[#1a6e2e]/90 text-white px-7 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-transform border border-transparent">
            View Cart <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* 10. Filters Bottom Modal / Drawer */}
      <AnimatePresence>
        {isFilterModalOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFilterModalOpen(false)}
              className="fixed inset-0 bg-black/60 z-50 "
            />

            {/* Bottom Drawer */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="fixed bottom-0 left-0 right-0 max-h-[85vh] md:max-h-[75vh] bg-white rounded-t-[2rem] md:max-w-2xl md:mx-auto md:bottom-[5vh] md:rounded-[2rem] border border-[#1a6e2e]/20 flex flex-col overflow-hidden z-50"
            >
              {/* Header */}
              <div className="relative p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-800">Filters</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Customize your search</p>
                </div>
                <button
                  onClick={() => setIsFilterModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-all flex items-center justify-center cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body split */}
              <div className="flex flex-1 overflow-hidden h-[380px] md:h-[450px]">
                {/* Left side tabs */}
                <div className="w-1/3 border-r border-slate-100 bg-slate-50 flex flex-col overflow-y-auto no-scrollbar">
                  {[
                    { id: "Type", label: "Type", count: selectedFilters.types.length },
                    { id: "Brand", label: "Brand", count: selectedFilters.brands.length },
                    { id: "Price", label: "Price", count: selectedFilters.priceRange ? 1 : 0 }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveFilterTab(tab.id)}
                      className={`w-full py-4.5 px-4 text-left font-bold text-xs md:text-sm transition-all border-l-4 relative flex items-center justify-between ${
                        activeFilterTab === tab.id
                          ? "bg-[#1a6e2e]/10 text-[#1a6e2e] border-[#1a6e2e]"
                          : "bg-transparent text-slate-600 border-transparent hover:bg-slate-100/50"
                      }`}
                    >
                      <span>{tab.label}</span>
                      {tab.count > 0 && (
                        <span className="bg-[#1a6e2e] text-white text-[9px] font-black h-4 px-1.5 rounded-full flex items-center justify-center">
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Right side options */}
                <div className="w-2/3 p-5 overflow-y-auto">
                  {activeFilterTab === "Type" && (
                    <div className="space-y-2">
                      {uniqueTypes.length === 0 ? (
                        <p className="text-xs text-slate-400 font-bold italic py-4">No types available</p>
                      ) : (
                        uniqueTypes.map(type => {
                          const isChecked = selectedFilters.types.includes(type);
                          return (
                            <div
                              key={type}
                              onClick={() => {
                                setSelectedFilters(prev => {
                                  const types = prev.types.includes(type)
                                    ? prev.types.filter(t => t !== type)
                                    : [...prev.types, type];
                                  return { ...prev, types };
                                });
                              }}
                              className="flex items-center justify-between py-2.5 px-1 cursor-pointer group rounded-lg hover:bg-slate-50 transition-all"
                            >
                              <span className={`text-xs md:text-sm font-bold text-slate-700 transition-colors group-hover:text-[#1a6e2e] ${isChecked ? "text-[#1a6e2e]" : ""}`}>
                                {type}
                              </span>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                isChecked ? "border-[#1a6e2e] bg-[#1a6e2e]" : "border-slate-300"
                              }`}>
                                {isChecked && <div className="w-2 h-2 rounded-full bg-white" />}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {activeFilterTab === "Brand" && (
                    <div className="space-y-2">
                      {uniqueBrands.length === 0 ? (
                        <p className="text-xs text-slate-400 font-bold italic py-4">No brands available</p>
                      ) : (
                        uniqueBrands.map(brand => {
                          const isChecked = selectedFilters.brands.includes(brand);
                          return (
                            <div
                              key={brand}
                              onClick={() => {
                                setSelectedFilters(prev => {
                                  const brands = prev.brands.includes(brand)
                                    ? prev.brands.filter(b => b !== brand)
                                    : [...prev.brands, brand];
                                  return { ...prev, brands };
                                });
                              }}
                              className="flex items-center justify-between py-2.5 px-1 cursor-pointer group rounded-lg hover:bg-slate-50 transition-all"
                            >
                              <span className={`text-xs md:text-sm font-bold text-slate-700 transition-colors group-hover:text-[#1a6e2e] ${isChecked ? "text-[#1a6e2e]" : ""}`}>
                                {brand}
                              </span>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                isChecked ? "border-[#1a6e2e] bg-[#1a6e2e]" : "border-slate-300"
                              }`}>
                                {isChecked && <div className="w-2 h-2 rounded-full bg-white" />}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {activeFilterTab === "Price" && (
                    <div className="space-y-2">
                      {priceRanges.map(range => {
                        const isChecked = selectedFilters.priceRange?.label === range.label;
                        return (
                          <div
                            key={range.label}
                            onClick={() => {
                              setSelectedFilters(prev => ({
                                ...prev,
                                priceRange: isChecked ? null : range
                              }));
                            }}
                            className="flex items-center justify-between py-2.5 px-1 cursor-pointer group rounded-lg hover:bg-slate-50 transition-all"
                          >
                            <span className={`text-xs md:text-sm font-bold text-slate-700 transition-colors group-hover:text-[#1a6e2e] ${isChecked ? "text-[#1a6e2e]" : ""}`}>
                              {range.label}
                            </span>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                              isChecked ? "border-[#1a6e2e] bg-[#1a6e2e]" : "border-slate-300"
                            }`}>
                              {isChecked && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Action Bar */}
              <div className="border-t border-slate-100 p-4 bg-white flex items-center justify-between gap-4">
                <button
                  onClick={() => {
                    setSelectedFilters({ types: [], brands: [], priceRange: null });
                  }}
                  className="w-1/2 py-3.5 border border-slate-200 hover:border-red-200 hover:bg-red-50 text-slate-600 hover:text-red-500 rounded-xl font-bold text-xs md:text-sm transition-all active:scale-95 text-center"
                >
                  Clear all
                </button>
                <button
                  onClick={() => setIsFilterModalOpen(false)}
                  className="w-1/2 py-3.5 bg-[#1a6e2e] hover:bg-[#1a6e2e]/90 text-white rounded-xl font-bold text-xs md:text-sm transition-all active:scale-95 text-center border border-transparent"
                >
                  Show {filteredProducts.length} products
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
};

export default ShopDetails;
