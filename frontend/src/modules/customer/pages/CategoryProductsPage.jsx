import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Search, Mic, ChevronRight, ShoppingCart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '@shared/components/ui/Toast';
import { cn } from '@/lib/utils';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';

import ProductDetailSheet from '../components/shared/ProductDetailSheet';
import { useProductDetail } from '../context/ProductDetailContext';
import { customerApi } from '../services/customerApi';
import MiniCart from '../components/shared/MiniCart';
import { useLocation as useAppLocation } from '../context/LocationContext';
import { useSettings } from '@core/context/SettingsContext';
import LogoTransparent from '@/assets/LogoTransparent.png';

const MOCK_SHOPS = [
    {
        _id: "mock-shop-1",
        shopName: "Sri Sai Vegetables",
        shopLogo: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=200",
        rating: "4.6",
        storeTimings: "20-25 mins",
        minimumOrderAmount: 50,
        products: [
            { id: "p1", name: "Tomato", price: 25, weight: "1 kg", image: "https://images.unsplash.com/photo-1595855759920-86582396756a?auto=format&fit=crop&q=80&w=200" },
            { id: "p2", name: "Potato", price: 20, weight: "1 kg", image: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&q=80&w=200" },
            { id: "p3", name: "Onion", price: 28, weight: "1 kg", image: "https://images.unsplash.com/photo-1508747703725-719777637510?auto=format&fit=crop&q=80&w=200" },
            { id: "p4", name: "Carrot", price: 30, weight: "1 kg", image: "https://images.unsplash.com/photo-1444731961956-751edd90465a?auto=format&fit=crop&q=80&w=200" }
        ]
    },
    {
        _id: "mock-shop-2",
        shopName: "Fresh Veggies Store",
        shopLogo: "https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&q=80&w=200",
        rating: "4.5",
        storeTimings: "15-20 mins",
        minimumOrderAmount: 60,
        products: [
            { id: "p5", name: "Spinach", price: 15, weight: "1 bunch", image: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&q=80&w=200" },
            { id: "p6", name: "Beans", price: 40, weight: "1 kg", image: "https://images.unsplash.com/photo-1567375699076-2448b1a724c0?auto=format&fit=crop&q=80&w=200" },
            { id: "p7", name: "Capsicum", price: 50, weight: "1 kg", image: "https://images.unsplash.com/photo-1563565088989-410095220414?auto=format&fit=crop&q=80&w=200" },
            { id: "p8", name: "Cabbage", price: 20, weight: "1 kg", image: "https://images.unsplash.com/photo-1550142413-05c2434d7829?auto=format&fit=crop&q=80&w=200" }
        ]
    },
    {
        _id: "mock-shop-3",
        shopName: "Green Land Vegetables",
        shopLogo: "https://images.unsplash.com/photo-1583258292688-d0213df4a3a8?auto=format&fit=crop&q=80&w=200",
        rating: "4.4",
        storeTimings: "20-30 mins",
        minimumOrderAmount: 50,
        products: [
            { id: "p9", name: "Lady Finger", price: 40, weight: "1 kg", image: "https://images.unsplash.com/photo-1425543103975-343004115f85?auto=format&fit=crop&q=80&w=200" },
            { id: "p10", name: "Brinjal", price: 30, weight: "1 kg", image: "https://images.unsplash.com/photo-1528825871115-3581a5387919?auto=format&fit=crop&q=80&w=200" },
            { id: "p11", name: "Bitter Gourd", price: 35, weight: "1 kg", image: "https://images.unsplash.com/photo-1582515073490-39981397c445?auto=format&fit=crop&q=80&w=200" },
            { id: "p12", name: "Bottle Gourd", price: 25, weight: "1 kg", image: "https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?auto=format&fit=crop&q=80&w=200" }
        ]
    },
    {
        _id: "mock-shop-4",
        shopName: "Natural Veggies",
        shopLogo: "https://images.unsplash.com/photo-1534723452862-4c874018d66d?auto=format&fit=crop&q=80&w=200",
        rating: "4.7",
        storeTimings: "15-20 mins",
        minimumOrderAmount: 60,
        products: [
            { id: "p13", name: "Cauliflower", price: 25, weight: "1 pc", image: "https://images.unsplash.com/photo-1568584711291-75be79402b9f?auto=format&fit=crop&q=80&w=200" },
            { id: "p14", name: "Beetroot", price: 30, weight: "1 kg", image: "https://images.unsplash.com/photo-1528137871380-6069a42f030d?auto=format&fit=crop&q=80&w=200" },
            { id: "p15", name: "Cucumber", price: 20, weight: "1 kg", image: "https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?auto=format&fit=crop&q=80&w=200" },
            { id: "p16", name: "Radish", price: 20, weight: "1 kg", image: "https://images.unsplash.com/photo-1587486913049-53fc88980cfc?auto=format&fit=crop&q=80&w=200" }
        ]
    },
    {
        _id: "mock-shop-5",
        shopName: "Aswapuram Veg Mart",
        shopLogo: "https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&q=80&w=200",
        rating: "4.3",
        storeTimings: "25-30 mins",
        minimumOrderAmount: 50,
        products: [
            { id: "p17", name: "Drumstick", price: 40, weight: "1 kg", image: "https://images.unsplash.com/photo-1587486913049-53fc88980cfc?auto=format&fit=crop&q=80&w=200" },
            { id: "p18", name: "Pumpkin", price: 20, weight: "1 kg", image: "https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&q=80&w=200" },
            { id: "p19", name: "Green Chili", price: 60, weight: "1 kg", image: "https://images.unsplash.com/photo-1588252398513-fb2167d40a2a?auto=format&fit=crop&q=80&w=200" },
            { id: "p20", name: "Coriander", price: 10, weight: "1 bunch", image: "https://images.unsplash.com/photo-1608797178974-15b35a61d121?auto=format&fit=crop&q=80&w=200" }
        ]
    }
];

const CategoryProductsPage = () => {
    const { categoryName: catId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { currentLocation } = useAppLocation();
    const { settings } = useSettings();
    const { cartCount } = useCart();
    const initialSubcategoryId = location.state?.activeSubcategoryId || 'all';
    const { isOpen: isProductDetailOpen } = useProductDetail();
    
    const [selectedSubCategory, setSelectedSubCategory] = useState(initialSubcategoryId);
    const [category, setCategory] = useState(null);
    const [subCategories, setSubCategories] = useState([{ id: 'all', name: 'All', icon: 'https://cdn-icons-png.flaticon.com/128/2321/2321831.png' }]);
    const [products, setProducts] = useState([]);
    const [allSellers, setAllSellers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const slugMap = {
                fruits: settings?.dailyNeeds?.fruits || "6a3fc1728bb6d217bf338f1d",
                vegetables: settings?.dailyNeeds?.vegetables || "6a3fc1738bb6d217bf338f24",
                chicken: settings?.dailyNeeds?.chicken || "6a3fc1748bb6d217bf338f2b",
                mutton: settings?.dailyNeeds?.mutton || "6a3fc1748bb6d217bf338f32",
                eggs: settings?.dailyNeeds?.eggs || "6a3fc1748bb6d217bf338f39",
            };
            const resolvedCatId = slugMap[catId?.toLowerCase()] || catId;

            // Fetch products, categories tree, and sellers in parallel
            const [prodRes, catRes, sellersRes] = await Promise.all([
                customerApi.getProducts({
                    categoryId: resolvedCatId,
                }),
                customerApi.getCategories({ tree: true }),
                customerApi.getNearbySellers(),
            ]);

            if (sellersRes.data?.success) {
                setAllSellers(sellersRes.data.results || sellersRes.data.result || []);
            }

            if (prodRes.data.success) {
                const rawResult = prodRes.data.result;
                const dbProds = Array.isArray(prodRes.data.results)
                    ? prodRes.data.results
                    : Array.isArray(rawResult?.items)
                    ? rawResult.items
                    : Array.isArray(rawResult)
                    ? rawResult
                    : [];

                const formattedProds = dbProds.map(p => ({
                    ...p,
                    id: p._id,
                    image: p.mainImage || p.image || "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&q=80&w=400&h=400",
                    price: p.salePrice || p.price,
                    originalPrice: p.price,
                    weight: p.weight || "1 unit",
                    deliveryTime: "8-15 mins"
                }));
                setProducts(Array.isArray(formattedProds) ? formattedProds : []);
            } else {
                setProducts([]);
            }

            if (catRes.data.success) {
                const tree = catRes.data.results || catRes.data.result || [];
                let currentCat = null;
                
                // First check if resolvedCatId is a header category
                const headerFound = tree.find(h => h._id === resolvedCatId);
                if (headerFound) {
                    currentCat = headerFound;
                } else {
                    for (const header of tree) {
                        const found = (header.children || []).find(c => c._id === resolvedCatId);
                        if (found) {
                            currentCat = found;
                            break;
                        }
                    }
                }

                if (currentCat) {
                    setCategory(currentCat);
                    const subs = (currentCat.children || []).map(s => ({
                        id: s._id,
                        name: s.name,
                        icon: s.image || 'https://cdn-icons-png.flaticon.com/128/2321/2321801.png'
                    }));
                    setSubCategories([{ id: 'all', name: 'All', icon: 'https://cdn-icons-png.flaticon.com/128/2321/2321831.png' }, ...subs]);
                }
            }
        } catch (error) {
            console.error("Error fetching category data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        setSelectedSubCategory(location.state?.activeSubcategoryId || 'all');
    }, [catId, location.state?.activeSubcategoryId]);

    const safeProducts = Array.isArray(products) ? products : [];

    // Filter products by selected subcategory or category
    const filteredProducts = safeProducts.filter(p =>
        selectedSubCategory === 'all' || 
        p.subcategoryId?._id === selectedSubCategory || 
        p.subcategoryId === selectedSubCategory ||
        p.categoryId?._id === selectedSubCategory ||
        p.categoryId === selectedSubCategory
    );

    // Group the filtered products by their sellerId
    const groupedSellers = React.useMemo(() => {
        const groupedMap = {};
        filteredProducts.forEach((product) => {
            const sellerIdVal = product.sellerId?._id || product.sellerId;
            if (!sellerIdVal) return;
            const sellerIdStr = String(sellerIdVal);

            if (!groupedMap[sellerIdStr]) {
                const matchedSeller = allSellers.find(s => String(s._id || s.id) === sellerIdStr);
                groupedMap[sellerIdStr] = {
                    _id: sellerIdStr,
                    shopName: matchedSeller?.shopName || product.sellerId?.shopName || 'Store',
                    shopLogo: matchedSeller?.shopLogo || matchedSeller?.storeFrontImage || '',
                    rating: matchedSeller?.rating || '4.5',
                    storeTimings: matchedSeller?.storeTimings || '20-25 mins',
                    minimumOrderAmount: matchedSeller?.minimumOrderAmount || 0,
                    products: []
                };
            }
            groupedMap[sellerIdStr].products.push(product);
        });
        
        const dbGrouped = Object.values(groupedMap);

        // Only prepend/append mock shops if this is a Vegetables category view
        const isVegetablesCategory = catId?.toLowerCase() === 'vegetables' || category?.name?.toLowerCase() === 'vegetables';
        if (isVegetablesCategory) {
            return [...dbGrouped, ...MOCK_SHOPS];
        }
        return dbGrouped;
    }, [filteredProducts, allSellers, category, catId]);

    const getTeluguCategoryName = (name) => {
        const TRANSLATIONS = {
            "Vegetables": "కూరగాయలు",
            "Fruits": "పండ్లు",
            "Chicken": "చికెన్",
            "Mutton": "మాంసం",
            "Eggs": "గుడ్లు",
        };
        return TRANSLATIONS[name] || "";
    };

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 max-w-md mx-auto relative font-sans pb-24">

            {/* Header (Dark Green background matching home) */}
            <div className="bg-[#042A0F] text-white px-4 pt-3 pb-3 sticky top-0 z-50 rounded-b-3xl shadow-md">
                {/* Logo & Location Row */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {/* Back Button */}
                        <button 
                            onClick={() => navigate(-1)}
                            className="p-1 hover:bg-white/10 rounded-full transition-colors text-white border-0 bg-transparent cursor-pointer shrink-0"
                        >
                            <ChevronLeft size={24} />
                        </button>
                        
                        {/* Logo */}
                        <div onClick={() => navigate("/")} className="cursor-pointer shrink-0 flex items-center gap-1.5">
                            <img src={LogoTransparent} alt="Athreya Delivery" className="h-8.5 w-auto object-contain" />
                            <div className="flex flex-col items-start leading-none font-sans">
                                <span className="text-[12.5px] font-black text-white tracking-wide uppercase">ATHREYA</span>
                                <span className="text-[8.5px] font-bold text-white tracking-[0.12em] mt-0.5 uppercase">DELIVERY</span>
                            </div>
                        </div>

                        <div className="h-7 w-px bg-white/20 mx-1 shrink-0" />

                        {/* Location Badge */}
                        <div className="flex flex-col items-start min-w-0 flex-1 pl-0.5">
                            <div className="flex items-center gap-1 text-white min-w-0 w-full">
                                <span className="text-red-500 text-sm shrink-0">📍</span>
                                <span className="block text-[12px] font-black tracking-tight leading-none truncate">
                                    {currentLocation?.name?.includes("Aswapuram") 
                                      ? currentLocation.name.split(",")[0] 
                                      : "Aswapuram (507116)"}
                                </span>
                            </div>
                            <span className="block text-[10px] font-semibold text-slate-300 ml-4 leading-tight mt-0.5 truncate max-w-full">
                                అశ్వాపురం
                            </span>
                        </div>
                    </div>

                    {/* Language & Cart */}
                    <div className="flex items-center gap-3.5 shrink-0 ml-2">
                        {/* Language Selector */}
                        <button className="flex flex-col items-center justify-center text-white bg-transparent border-0 p-0 cursor-pointer hover:opacity-80">
                            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/20">
                                <span className="text-xs">🌐</span>
                            </div>
                            <span className="text-[9px] font-black text-slate-300 mt-1">భాష</span>
                        </button>

                        {/* Cart Badge */}
                        <button 
                            onClick={() => navigate("/checkout")}
                            className="flex flex-col items-center justify-center text-white bg-transparent border-0 p-0 cursor-pointer hover:opacity-80 relative"
                        >
                            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/20 relative">
                                <ShoppingCart size={16} />
                                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[8px] font-black rounded-full h-3.5 w-3.5 flex items-center justify-center border border-[#042A0F]">
                                    {cartCount > 0 ? cartCount : 3}
                                </span>
                            </div>
                            <span className="text-[9px] font-black text-slate-300 mt-1">కార్ట్</span>
                        </button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative flex items-center bg-[#021f0b] rounded-full border border-[#0d4f1c] px-3.5 py-2">
                    <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                    <input 
                        type="text" 
                        placeholder={`Search in ${category?.name || catId}...`} 
                        className="bg-transparent border-none outline-none text-white text-[12.5px] font-bold w-full placeholder-slate-400"
                        onClick={() => navigate('/search')}
                        readOnly
                    />
                    <button className="w-7 h-7 rounded-full bg-[#A3E635] flex items-center justify-center text-[#042A0F] cursor-pointer hover:opacity-90 active:scale-95 transition-transform border-0 shrink-0 ml-1">
                        <span className="text-xs">🎤</span>
                    </button>
                </div>
            </div>

            {/* Category Title Block */}
            <div className="px-4 pt-4 pb-1">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-[20px] font-black text-slate-900 leading-none">
                            {category?.name || catId}
                        </h1>
                        <span className="text-[12px] font-bold text-[#1a6e2e] mt-1.5 block">
                            {getTeluguCategoryName(category?.name) || 'అశ్వాపురం'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Horizontal Subcategories Scroll Strip */}
            {subCategories.length > 1 && (
                <div className="bg-white border-b border-slate-100 py-3.5 px-4 flex gap-2.5 overflow-x-auto no-scrollbar shrink-0 shadow-sm">
                    {subCategories.map((sub) => {
                        const isActive = selectedSubCategory === sub.id;
                        return (
                            <button
                                key={sub.id}
                                onClick={() => setSelectedSubCategory(sub.id)}
                                className={cn(
                                    "flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black transition-all border shrink-0 cursor-pointer shadow-sm active:scale-95",
                                    isActive
                                        ? "bg-[#1a6e2e] border-[#1a6e2e] text-white"
                                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                )}
                            >
                                <img 
                                    src={applyCloudinaryTransform(sub.icon)} 
                                    alt={sub.name} 
                                    className="w-4 h-4 object-contain"
                                />
                                {sub.name}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Page Content area */}
            <div className="flex-1 px-4 py-3 space-y-4">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 font-bold text-sm">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a6e2e] mb-4"></div>
                        Loading Products...
                    </div>
                ) : (
                    <>
                        {/* Heading indicating count of stores selling this category */}
                        <div className="pt-1.5 pb-0.5">
                            <h3 className="text-[12.5px] font-black text-[#1a6e2e] tracking-wide uppercase leading-none">
                                {groupedSellers.length} STORES AVAILABLE
                            </h3>
                        </div>

                        {/* Stores List with Category Products scroll */}
                        <div className="space-y-4">
                            {groupedSellers.map((shop) => (
                                <div key={shop._id} className="bg-white rounded-3xl p-4 border border-slate-200/80 flex flex-col gap-3.5 shadow-sm">
                                    
                                    {/* Shop header */}
                                    <div className="flex justify-between items-start">
                                        <div className="flex gap-3 items-center min-w-0">
                                            {/* Logo */}
                                            <div className="w-12 h-12 rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 shrink-0">
                                                <img 
                                                    src={applyCloudinaryTransform(shop.shopLogo || "https://images.unsplash.com/photo-1534723452862-4c874018d66d?q=80&w=200&fit=crop")} 
                                                    alt={shop.shopName} 
                                                    className="w-full h-full object-cover" 
                                                />
                                            </div>
                                            {/* Shop metadata info */}
                                            <div className="min-w-0">
                                                <h4 className="text-[14.5px] font-black text-slate-950 flex items-center gap-1 leading-snug">
                                                    {shop.shopName}
                                                    <span className="w-4 h-4 rounded-full bg-green-500 text-white flex items-center justify-center text-[9px] font-bold shrink-0">✓</span>
                                                </h4>
                                                <div className="flex items-center gap-1.5 mt-0.5 text-[10.5px] text-slate-500 font-bold flex-wrap">
                                                    <span className="text-amber-500 flex items-center gap-0.5 shrink-0">
                                                        {shop.rating} ★
                                                    </span>
                                                    <span className="text-slate-300">•</span>
                                                    <span className="shrink-0">{shop.storeTimings}</span>
                                                    <span className="text-slate-300">•</span>
                                                    <span className="shrink-0">Min. Order ₹{shop.minimumOrderAmount}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Free Delivery Tag */}
                                        <span className="text-[9px] font-black text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-200 uppercase tracking-wider shrink-0 mt-0.5">
                                            Free Delivery
                                        </span>
                                    </div>

                                    {/* Horizontal scroll of products + navigation right arrow button */}
                                    <div className="flex items-center gap-2 relative">
                                        <div className="flex-1 flex gap-2.5 overflow-x-auto no-scrollbar py-0.5">
                                            {shop.products.map((product) => (
                                                <div 
                                                    key={product.id} 
                                                    onClick={() => {
                                                        if (product.id.startsWith("p")) {
                                                            // Mock product, do not trigger crash on invalid objectId navigation
                                                            return;
                                                        }
                                                        navigate(`/product/${product.id}`);
                                                    }}
                                                    className="w-[78px] shrink-0 flex flex-col items-center gap-1 cursor-pointer active:scale-95 transition-transform"
                                                >
                                                    {/* Product Image Card */}
                                                    <div className="w-[70px] h-[70px] rounded-2xl bg-white border border-slate-200 p-1 flex items-center justify-center overflow-hidden">
                                                        <img 
                                                            src={applyCloudinaryTransform(product.image)} 
                                                            alt={product.name} 
                                                            className="w-full h-full object-contain rounded-xl"
                                                        />
                                                    </div>
                                                    {/* Product Details */}
                                                    <div className="text-center w-full leading-none flex flex-col items-center">
                                                        <span className="text-[9.5px] font-extrabold text-slate-800 truncate max-w-full block">
                                                            {product.name}
                                                        </span>
                                                        <span className="text-[8.5px] font-bold text-slate-500 mt-1 block">
                                                            ₹{product.price}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Green arrow button to navigate to the shop page */}
                                        <button 
                                            onClick={() => {
                                                if (shop._id.startsWith("mock-")) {
                                                    // Fallback navigation for mock shops
                                                    navigate(`/category/vegetables`);
                                                    return;
                                                }
                                                navigate(`/shops/${shop._id}`);
                                            }}
                                            className="w-8 h-8 rounded-full bg-[#1a6e2e] flex items-center justify-center text-white cursor-pointer hover:bg-green-800 transition-all shrink-0 active:scale-95 border-0 shadow-sm"
                                        >
                                            <ChevronRight size={18} />
                                        </button>
                                    </div>

                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            <MiniCart />
            <ProductDetailSheet />

            <style dangerouslySetInnerHTML={{
                __html: `
                    .no-scrollbar::-webkit-scrollbar {
                        display: none;
                    }
                    .no-scrollbar {
                        -ms-overflow-style: none;
                        scrollbar-width: none;
                    }
                `}} />
        </div>
    );
};

export default CategoryProductsPage;
