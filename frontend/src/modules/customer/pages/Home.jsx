import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Menu, 
  Search, 
  Mic, 
  ChevronDown, 
  Languages, 
  ShoppingCart, 
  Package, 
  LayoutGrid, 
  FileText, 
  Tag, 
  Bus,
  Volume2
} from "lucide-react";
import { motion } from "framer-motion";
import Lottie from "lottie-react";
import deliveryRiding from "@/assets/Delivery Riding.json";
import { useLocation } from "../context/LocationContext";
import { useCart } from "../context/CartContext";
import { useSettings } from "@core/context/SettingsContext";
import LocationDrawer from "../components/shared/LocationDrawer";
import LogoTransparent from "@/assets/LogoTransparent.png";
import { customerApi } from "../services/customerApi";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";
import { getAreaName, getTeluguAreaName } from "../components/shared/MainLocationHeader";
import { getLegacyStatusFromOrder, getOrderStatusLabel } from "@/shared/utils/orderStatus";

// Module-level variable to track if the brand animation has played in this SPA session
let hasBikePlayedGlobal = false;

const Home = () => {
  const navigate = useNavigate();
  const { currentLocation } = useLocation();
  const { cartCount } = useCart();
  const { settings } = useSettings();
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [headerCategories, setHeaderCategories] = useState([]);
  const [shops, setShops] = useState([]);
  const [liveOrder, setLiveOrder] = useState(null);

  useEffect(() => {
    customerApi.getMyOrders()
      .then(res => {
        const items = res.data?.result?.items || res.data?.results || [];
        if (Array.isArray(items)) {
          const active = items.find(order => {
            const status = getLegacyStatusFromOrder(order);
            return ["pending", "confirmed", "packed", "out_for_delivery"].includes(status);
          });
          if (active) {
            setLiveOrder(active);
          }
        }
      })
      .catch(e => console.log("Guest session or no live orders:", e));
  }, []);

  // Session-bound brand animation state
  const [showBikeAnimation, setShowBikeAnimation] = useState(() => {
    return !hasBikePlayedGlobal;
  });

  useEffect(() => {
    if (showBikeAnimation) {
      hasBikePlayedGlobal = true;
    }
  }, [showBikeAnimation]);

  // Fetch real data to bind navigation dynamically if stores/categories exist
  useEffect(() => {
    customerApi.getCategories({ tree: true })
      .then(res => {
        if (res.data?.success) {
          const tree = res.data.results || res.data.result || [];
          
          const headers = tree.filter((header) => (header.name || '').trim().toLowerCase() !== 'all');
          setHeaderCategories(headers);

          const flatCategories = [];
          tree
            .filter((header) => (header.name || '').trim().toLowerCase() !== 'all')
            .forEach((header) => {
              (header.children || []).forEach((cat) => {
                if (!flatCategories.some(existing => existing.id === cat._id)) {
                  flatCategories.push({
                    id: cat._id,
                    _id: cat._id,
                    name: cat.name,
                    image: cat.image,
                  });
                }
              });
            });
          setCategories(flatCategories);
        }
      })
      .catch(e => console.error("Error fetching categories:", e));

    if (currentLocation?.latitude && currentLocation?.longitude) {
      customerApi.getNearbySellers({ lat: currentLocation.latitude, lng: currentLocation.longitude })
        .then(res => {
          if (res.data?.success) {
            setShops(res.data.results || res.data.result || []);
          }
        })
        .catch(e => console.error("Error fetching shops:", e));
    }
  }, [currentLocation]);


  // Helper to map category navigation to database IDs if found
  const getCategoryPath = (name, fallback) => {
    const found = categories.find(c => 
      c.name.toLowerCase().includes(name.toLowerCase()) || 
      (c.slug && c.slug.toLowerCase().includes(name.toLowerCase()))
    );
    return found ? `/category/${found._id || found.id}` : fallback;
  };

  const getTeluguCategoryName = (name) => {
    const TELUGU_TRANSLATIONS = {
      "Water Can": "వాటర్ క్యాన్",
      "Milk": "పాలు",
      "Tiffins": "టిఫిన్స్",
      "Restaurant": "రెస్టారెంట్",
      "Vegetables": "కూరగాయలు",
      "Fruits": "పండ్లు",
      "Chicken": "చికెన్",
      "Meat": "మాంసం",
      "Groceries": "కిరాణా",
      "Grocery": "కిరాణా",
    };
    if (!name) return "";
    const cleanName = name.trim().toLowerCase();
    if (TELUGU_TRANSLATIONS[name]) return TELUGU_TRANSLATIONS[name];
    for (const [key, value] of Object.entries(TELUGU_TRANSLATIONS)) {
      if (key.toLowerCase() === cleanName) return value;
    }
    if (cleanName.includes("chicken") || cleanName.includes("chiken")) return "చికెన్";
    if (cleanName.includes("vegetable")) return "కూరగాయలు";
    if (cleanName.includes("fruit")) return "పండ్లు";
    if (cleanName.includes("milk")) return "పాలు";
    if (cleanName.includes("water")) return "వాటర్ క్యాన్";
    if (cleanName.includes("grocery") || cleanName.includes("kirana")) return "కిరాణా";
    return "";
  };

  // Build category lists dynamically from DB, or fallback to mock if empty
  const dynamicCategories = categories.length > 0 
    ? categories.map(c => ({
        label: c.name,
        teluguLabel: getTeluguCategoryName(c.name) || c.name,
        image: c.image || "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout-engine/2022-11/Slice-1_9.png",
        path: `/category/${c._id || c.id}`
      }))
    : [];

  // Build header category lists dynamically from DB, or fallback to mock if empty
  const dynamicHeaderCategories = headerCategories.length > 0 
    ? headerCategories.map(c => ({
        label: c.name,
        teluguLabel: getTeluguCategoryName(c.name) || c.name,
        image: c.image || "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout-engine/2022-11/Slice-1_9.png",
        path: `/category/${c._id || c.id}`
      }))
    : [];

  // Helper to map shop navigation to database IDs if found
  const getShopPath = (name, fallback) => {
    const found = shops.find(s => 
      s.shopName.toLowerCase().includes(name.toLowerCase())
    );
    return found ? `/shops/${found._id || found.id}` : fallback;
  };

  // 1. Quick categories row
  const quickCategoriesList = dynamicHeaderCategories.length > 0
    ? [...dynamicHeaderCategories.slice(0, 6), { label: "More", teluguLabel: "మరిన్ని", isMore: true, path: "/categories" }]
    : [];

  const dailyNeedsCategoryIds = settings?.dailyNeedsCategoryIds || [];
  const mappedDailyNeedsCategories = dailyNeedsCategoryIds
    .map(id => {
      return categories.find(c => (c._id || c.id) === id) || 
             headerCategories.find(h => (h._id || h.id) === id);
    })
    .filter(Boolean);

  // 2. Today's Needs list
  const todaysNeedsList = mappedDailyNeedsCategories.length > 0
    ? mappedDailyNeedsCategories.map(c => ({
        label: c.name,
        teluguLabel: getTeluguCategoryName(c.name) || c.name,
        image: c.image || "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout-engine/2022-11/Slice-1_9.png",
        path: `/category/${c._id || c.id}`
      }))
    : (dynamicCategories.length > 0
        ? dynamicCategories.slice(0, 6)
        : []);

  // 3. Exclusive Partners
  const partnerStores = shops.map(shop => ({
    name: shop.shopName,
    teluguName: shop.locality || "",
    rating: shop.rating || "4.5",
    time: shop.storeTimings || "20-30 mins",
    image: applyCloudinaryTransform(shop.shopLogo || shop.shopBanner || "https://images.unsplash.com/photo-1534723452862-4c874018d66d?q=80&w=400&fit=crop"),
    path: `/shops/${shop._id || shop.id}`
  }));

  // 4. Bottom Quick Links
  const bottomQuickLinks = [
    { label: "Parcel Pickup", teluguLabel: "పార్సెల్ పికప్", icon: <Package size={18} />, bgColor: "bg-[#16a34a]", path: "/pickup-delivery" },
    { label: "RTC / Cargo", teluguLabel: "ఆర్టీసీ / కార్గో", icon: <Bus size={18} />, bgColor: "bg-[#2563eb]", path: "/pickup-delivery" },
    { label: "Voice Order", teluguLabel: "వాయిస్ ఆర్డర్", icon: <Volume2 size={18} />, bgColor: "bg-[#8b5cf6]", path: "/search" },
    { label: "My Orders", teluguLabel: "నా ఆర్డర్లు", icon: <FileText size={18} />, bgColor: "bg-[#d97706]", path: "/orders" },
    { label: "Offers", teluguLabel: "ఆఫర్లు", icon: <Tag size={18} />, bgColor: "bg-[#ec4899]", path: "/offers" }
  ];

  return (
    <div className="min-h-screen bg-[#042A0F] text-white font-sans pb-4 overflow-x-hidden">
      
      {/* 1. Header Row */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 bg-[#042A0F] relative overflow-hidden">
        
        {/* Left Section: Menu, Logo, Divider, Location */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <button className="text-white hover:opacity-80 active:scale-95 transition-transform bg-transparent border-0 cursor-pointer p-1 shrink-0">
            <Menu size={26} />
          </button>
          
          <div onClick={() => navigate("/")} className="cursor-pointer shrink-0 flex items-center gap-1.5">
            <img src={LogoTransparent} alt="Athreya Delivery" className="h-9 w-auto object-contain" />
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
            <div className="flex items-center gap-1 text-white min-w-0 w-full">
              <span className="text-red-500 text-sm shrink-0">📍</span>
              <span className="block text-[12px] font-black tracking-tight leading-none group-hover:underline truncate">
                {getAreaName(currentLocation)}
              </span>
              <ChevronDown size={12} className="opacity-80 shrink-0" />
            </div>
            {getTeluguAreaName(currentLocation) && (
              <span className="block text-[10px] font-semibold text-slate-355 ml-4 leading-tight mt-0.5 truncate max-w-full">
                {getTeluguAreaName(currentLocation)}
              </span>
            )}
          </div>
        </div>

        {/* Language & Cart */}
        <div className="flex items-center gap-3.5 shrink-0 ml-2">
          {/* Language Selector */}
          <button className="flex flex-col items-center justify-center text-white bg-transparent border-0 p-0 cursor-pointer hover:opacity-80">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/20">
              <Languages size={18} />
            </div>
            <span className="text-[9px] font-black text-slate-300 mt-1">భాష</span>
          </button>

          {/* Cart with badge */}
          <button 
            onClick={() => navigate("/checkout")}
            className="flex flex-col items-center justify-center text-white bg-transparent border-0 p-0 cursor-pointer hover:opacity-80 relative"
          >
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/20 relative">
              <ShoppingCart size={18} />
              <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[9px] font-black rounded-full h-4 w-4 flex items-center justify-center border border-[#042A0F]">
                {cartCount > 0 ? cartCount : 3}
              </span>
            </div>
            <span className="text-[9px] font-black text-slate-300 mt-1">కార్ట్</span>
          </button>
        </div>

        {/* Animated Brand Bike Logo Overlay */}
        {showBikeAnimation && (
          <motion.div
            initial={{ left: "10px", opacity: 0 }}
            animate={{ 
              left: "calc(100% - 70px)", 
              opacity: [0, 1, 1, 0] 
            }}
            transition={{ 
              duration: 3, 
              ease: "easeInOut",
              times: [0, 0.1, 0.9, 1]
            }}
            onAnimationComplete={() => setShowBikeAnimation(false)}
            className="absolute top-1/2 -translate-y-1/2 z-50 pointer-events-none w-14 h-14"
          >
            <Lottie 
              animationData={deliveryRiding} 
              loop={true} 
              className="w-full h-full"
            />
          </motion.div>
        )}
      </div>

      {/* 2. Search Bar */}
      <div className="mx-4 my-2.5 relative flex items-center bg-[#021f0b] rounded-full border border-[#0d4f1c] px-3.5 py-2">
        <Search className="w-4.5 h-4.5 text-slate-400 mr-2" />
        <input 
          type="text" 
          placeholder="Search Aswapuram stores... (అశ్వాపురం స్టోర్లలో వెతకండి...)" 
          className="bg-transparent border-none outline-none text-white text-[12.5px] font-bold w-full placeholder-slate-400"
          onClick={() => navigate('/search')}
          readOnly
        />
        <button 
          onClick={() => navigate('/search')}
          className="w-7 h-7 rounded-full bg-[#A3E635] flex items-center justify-center text-[#042A0F] cursor-pointer hover:opacity-90 active:scale-95 transition-transform"
        >
          <Mic className="w-4 h-4 text-[#042A0F]" />
        </button>
      </div>

      {/* 3. Quick Categories Row */}
      <div className="flex justify-start md:justify-center gap-4 md:gap-8 items-start px-4 py-3 overflow-x-auto no-scrollbar">
        {quickCategoriesList.map((cat, idx) => (
          <div 
            key={idx} 
            onClick={() => navigate(cat.path)} 
            className="flex flex-col items-center gap-1.5 cursor-pointer shrink-0 min-w-[58px]"
          >
            <div className="w-[50px] h-[50px] rounded-[14px] bg-white flex items-center justify-center overflow-hidden border border-[#0d4f1c] shadow-sm transition-transform active:scale-95">
              {cat.isMore ? (
                <div className="grid grid-cols-2 gap-1 w-6 h-6">
                  <div className="w-2.5 h-2.5 bg-[#042A0F] rounded-sm" />
                  <div className="w-2.5 h-2.5 bg-[#042A0F] rounded-sm" />
                  <div className="w-2.5 h-2.5 bg-[#042A0F] rounded-sm" />
                  <div className="w-2.5 h-2.5 bg-[#042A0F] rounded-sm" />
                </div>
              ) : (
                <img src={applyCloudinaryTransform(cat.image)} alt={cat.label} className="w-full h-full object-cover" />
              )}
            </div>
            <div className="flex flex-col items-center leading-none text-center">
              <span className="text-[9.5px] font-black text-white">{cat.label}</span>
              <span className="text-[8.5px] font-bold text-slate-300 mt-0.5">{cat.teluguLabel}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 4. Active Live Orders Widget / Promotion */}
      {liveOrder && (
        <div className="flex gap-3 px-4 py-2">
          {/* Left Live Order Card */}
          <div 
            onClick={() => navigate(`/orders/${liveOrder.orderId}`)}
            className="flex-1 min-h-[175px] rounded-2xl relative overflow-hidden border border-[#0d4f1c] bg-cover bg-center cursor-pointer" 
            style={{ backgroundImage: `url('https://images.unsplash.com/photo-1578916171728-46686eac8d58?q=80&w=400&fit=crop')` }}
          >
            <div className="absolute inset-0 bg-black/65 z-0" />
            <div className="relative z-10 p-3.5 flex flex-col justify-between h-full">
              
              {/* Header info */}
              <div className="flex justify-between items-start">
                {/* Store Circle Logo */}
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center overflow-hidden border-2 border-[#A3E635] shadow-md">
                  <div className="w-7 h-7 rounded-full bg-green-900 flex items-center justify-center text-white text-[8px] font-black">
                    {liveOrder.seller?.shopName ? liveOrder.seller.shopName.substring(0, 2).toUpperCase() : 'SR'}
                  </div>
                </div>
                
                {/* ETA / Live */}
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-black text-white bg-black/50 px-2 py-0.5 rounded-full border border-white/20">
                    ETA: {liveOrder.seller?.storeTimings || '20-30 min'}
                  </span>
                  <span className="flex items-center gap-1 bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
                    LIVE
                  </span>
                </div>
              </div>
              
              {/* Wording exactly like screenshot */}
              <div className="mt-1.5">
                <p className="text-[9px] text-white/80 font-bold uppercase tracking-wider">Live Order in progress</p>
                <h4 className="text-[14px] font-black text-white leading-tight">{liveOrder.seller?.shopName || 'Store'}</h4>
                <p className="text-[9px] text-slate-355 font-bold mt-0.5 leading-tight">
                  Status: {getOrderStatusLabel(liveOrder).toUpperCase()} <br />
                  <span className="text-[#A3E635]">Order #{liveOrder.orderId.slice(-6)}</span>
                </p>
              </div>

              <button className="mt-2.5 w-max px-3 py-1.5 bg-white text-black font-black rounded-lg text-[10px] uppercase shadow-sm">
                View Live Order
              </button>
            </div>
          </div>

          {/* Right Safe Delivery Card */}
          <div 
            className="w-[36%] rounded-2xl relative overflow-hidden border border-[#0d4f1c] bg-cover bg-center flex flex-col justify-end" 
            style={{ backgroundImage: `url('https://images.unsplash.com/photo-1619191168248-906fe35555bb?q=80&w=400&fit=crop')` }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-0" />
            <div className="relative z-10 bg-black/70 p-2 text-center flex flex-col items-center justify-center gap-1 border-t border-white/10">
              <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center text-white shrink-0 shadow-sm border border-white/20">
                <span className="text-[10px] font-black">✓</span>
              </div>
              <p className="text-[8.5px] font-black leading-tight text-white">
                సురక్షిత డెలివరీ <br />
                మీ ఇంటికి వరకు
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 5. TODAY'S NEEDS (ఈరోజు అవసరాలు) */}
      <div className="px-4 py-3">
        <div className="flex justify-between items-center mb-2.5">
          <h3 className="text-[12.5px] font-black text-[#A3E635] tracking-wide uppercase">
            TODAYS NEEDS (ఈరోజు అవసరాలు)
          </h3>
          <button onClick={() => navigate('/categories')} className="text-[10.5px] font-black text-[#A3E635] hover:underline">
            See All
          </button>
        </div>
        <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
          {todaysNeedsList.map((item, idx) => (
            <div 
              key={idx} 
              onClick={() => navigate(item.path)} 
              className="w-[84px] shrink-0 bg-[#021f0b] border border-[#0d4f1c] rounded-2xl p-2 flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
            >
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-white">
                <img src={applyCloudinaryTransform(item.image)} alt={item.label} className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col items-center text-center leading-none">
                <span className="text-[9.5px] font-black text-white">{item.label}</span>
                <span className="text-[8.5px] font-bold text-slate-300 mt-0.5">{item.teluguLabel}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Combo & Deals & Orders Promo Row */}
      <div className="grid grid-cols-3 gap-2 px-4 py-2">
        {/* Combo Offers Card */}
        <div 
          onClick={() => navigate('/offers')} 
          className="bg-white rounded-2xl p-2 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform shadow-md"
        >
          <div className="text-xl">🎁</div>
          <div className="flex flex-col leading-tight min-w-0">
            <span className="text-[7.5px] font-black text-orange-600 uppercase tracking-tight truncate">COMBO OFFERS</span>
            <span className="text-[8.5px] font-black text-slate-800 tracking-tight truncate">Best Deals & Savings</span>
            <span className="text-[7.5px] font-bold text-slate-500 tracking-tight truncate">ఉత్తమ ఆఫర్లు & ఆదా</span>
          </div>
        </div>

        {/* Today's Deals Card */}
        <div 
          onClick={() => navigate('/offers')} 
          className="bg-white rounded-2xl p-2 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform shadow-md"
        >
          <div className="text-xl">🏷️</div>
          <div className="flex flex-col leading-tight min-w-0">
            <span className="text-[7.5px] font-black text-blue-600 uppercase tracking-tight truncate">TODAY'S DEALS</span>
            <span className="text-[8.5px] font-black text-slate-800 tracking-tight truncate">Limited Time Offers</span>
            <span className="text-[7.5px] font-bold text-slate-500 tracking-tight truncate">పరిమిత సమయ ఆఫర్లు</span>
          </div>
        </div>

        {/* My Orders Card */}
        <div 
          onClick={() => navigate('/orders')} 
          className="bg-white rounded-2xl p-2 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform shadow-md"
        >
          <div className="text-xl">📋</div>
          <div className="flex flex-col leading-tight min-w-0">
            <span className="text-[7.5px] font-black text-green-600 uppercase tracking-tight truncate">MY ORDERS</span>
            <span className="text-[8.5px] font-black text-slate-800 tracking-tight truncate">Track your orders</span>
            <span className="text-[7.5px] font-bold text-slate-500 tracking-tight truncate">మీ ఆర్డర్లు ట్రాక్ చేయండి</span>
          </div>
        </div>
      </div>

      {/* 7. ATHREYA EXCLUSIVE PARTNERS (ప్రత్యేక భాగస్వాములు) */}
      {shops.length > 0 && (
        <div className="px-4 py-3">
          <div className="flex justify-between items-center mb-2.5">
            <h3 className="text-[12.5px] font-black text-[#A3E635] tracking-wide uppercase">
              ATHREYA EXCLUSIVE PARTNERS (ప్రత్యేక భాగస్వాములు)
            </h3>
            <button onClick={() => navigate('/shop-by-store')} className="text-[10.5px] font-black text-[#A3E635] hover:underline">
              See All
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {partnerStores.map((store, idx) => (
              <div 
                key={idx} 
                onClick={() => navigate(store.path)} 
                className="w-[145px] shrink-0 bg-white rounded-2xl overflow-hidden shadow-md cursor-pointer active:scale-95 transition-transform flex flex-col"
              >
                <div className="w-full h-[95px] relative">
                  <img src={store.image} alt={store.name} className="w-full h-full object-cover" />
                </div>
                <div className="p-2 flex flex-col justify-between flex-1 leading-none">
                  <div>
                    <h4 className="text-[10.5px] font-black text-slate-800 line-clamp-1">{store.name}</h4>
                    {store.teluguName && (
                      <p className="text-[8.5px] font-bold text-slate-500 line-clamp-1 mt-0.5">{store.teluguName}</p>
                    )}
                  </div>
                  <div className="flex justify-between items-center mt-2 pt-1.5 border-t border-slate-100">
                    <span className="text-[9px] font-black text-slate-700 flex items-center gap-0.5">
                      {store.rating} <span className="text-yellow-500 text-[8px]">★</span>
                    </span>
                    <span className="text-[8.5px] font-bold text-slate-500">
                      {store.time}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8. PARCEL PICKUP (పార్సెల్ పికప్) Section */}
      <div className="mx-4 my-3 bg-[#03210b] border border-[#0d4f1c] rounded-2xl p-4 flex gap-4 items-center shadow-md">
        {/* Cardboard Box 3D-like representation */}
        <div className="w-16 h-16 shrink-0 bg-[#A3E635]/10 border border-[#0d4f1c] rounded-2xl flex items-center justify-center text-4xl">
          📦
        </div>
        
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <div>
            <h4 className="text-[12px] font-black text-[#A3E635] tracking-wide uppercase">
              PARCEL PICKUP (పార్సెల్ పికప్)
            </h4>
            <p className="text-[10px] font-black text-white mt-0.5 leading-tight">
              Send anything, anywhere <br />
              <span className="text-slate-300 font-bold text-[9px]">Fast & Safe Delivery</span>
            </p>
          </div>

          <div className="flex gap-1.5 mt-0.5 overflow-x-auto no-scrollbar">
            <button 
              onClick={() => navigate('/pickup-delivery')} 
              className="px-2.5 py-1 bg-[#042A0F] border border-[#0d4f1c] text-white rounded-full text-[8.5px] font-black flex items-center gap-1 shrink-0 active:scale-95"
            >
              🛵 Request Pickup
            </button>
            <button 
              onClick={() => navigate('/pickup-delivery')} 
              className="px-2.5 py-1 bg-[#042A0F] border border-[#0d4f1c] text-white rounded-full text-[8.5px] font-black flex items-center gap-1 shrink-0 active:scale-95"
            >
              📋 Add List
            </button>
            <button 
              onClick={() => navigate('/pickup-delivery')} 
              className="px-2.5 py-1 bg-[#042A0F] border border-[#0d4f1c] text-white rounded-full text-[8.5px] font-black flex items-center gap-1 shrink-0 active:scale-95"
            >
              📷 Upload Photo
            </button>
          </div>
        </div>
      </div>

      {/* 9. Extra links row on dark green background */}
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar px-4 py-3 bg-[#031d0b] border-y border-[#0c4c1a] my-2">
        {bottomQuickLinks.map((link, idx) => (
          <div 
            key={idx} 
            onClick={() => navigate(link.path)} 
            className="flex items-center gap-2.5 bg-[#042A0F] border border-[#0d4f1c] px-3.5 py-2 rounded-2xl cursor-pointer shrink-0 active:scale-95 transition-transform"
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 ${link.bgColor} shadow-sm border border-white/10`}>
              {link.icon}
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[10px] font-black text-white">{link.label}</span>
              <span className="text-[8px] font-bold text-slate-355 mt-0.5">{link.teluguLabel}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Drawer selector for location confirmation */}
      <LocationDrawer 
        isOpen={isLocationOpen} 
        onClose={() => setIsLocationOpen(false)} 
      />
    </div>
  );
};

export default Home;
