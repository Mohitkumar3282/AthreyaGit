import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Search, Mic, ChevronRight, ShoppingCart, Languages, Menu } from 'lucide-react';
import { customerApi } from '../services/customerApi';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';
import { useCart } from '../context/CartContext';
import { useLocation } from '../context/LocationContext';
import MiniCart from '../components/shared/MiniCart';
import LogoTransparent from '@/assets/LogoTransparent.png';



const ShopsPage = () => {
    const navigate = useNavigate();
    const { cartCount } = useCart();
    const { currentLocation } = useLocation();
    
    const [shops, setShops] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const fetchShopsAndProducts = async () => {
            setIsLoading(true);
            try {
                // Fetch all verified shops without location limits
                const res = await customerApi.getNearbySellers();
                if (res.data?.success) {
                    const sellerList = res.data.results || res.data.result || [];
                    
                    // Fetch products for each seller (limit to 4 products)
                    const sellersWithProducts = await Promise.all(
                        sellerList.map(async (seller) => {
                            try {
                                const prodRes = await customerApi.getShopProducts(seller._id || seller.id, { limit: 4 });
                                if (prodRes.data?.success) {
                                    const rawResult = prodRes.data.result;
                                    const dbProds = Array.isArray(prodRes.data.results)
                                        ? prodRes.data.results
                                        : Array.isArray(rawResult?.items)
                                        ? rawResult.items
                                        : Array.isArray(rawResult)
                                        ? rawResult
                                        : [];
                                    
                                    seller.products = dbProds.map(p => ({
                                        ...p,
                                        id: p._id,
                                        image: p.mainImage || p.image || "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&q=80&w=400&h=400",
                                        price: p.salePrice || p.price,
                                        originalPrice: p.price,
                                        weight: p.weight || "1 unit"
                                    }));
                                } else {
                                    seller.products = [];
                                }
                            } catch (e) {
                                console.error("Error fetching products for seller", seller._id, e);
                                seller.products = [];
                            }
                            return seller;
                        })
                    );
                    
                    // Set database sellers only (no mock shops)
                    setShops(sellersWithProducts);
                } else {
                    setShops([]);
                }
            } catch (error) {
                console.error("Error loading shops page data:", error);
                setShops([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchShopsAndProducts();
    }, []);

    const filteredShops = shops.filter(shop => 
        shop.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (shop.category && shop.category.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 max-w-md mx-auto relative font-sans pb-24">
            
            {/* Header section (Dark Green) */}
            <div className="bg-[#042A0F] text-white px-4 pt-3 pb-4 sticky top-0 z-50 rounded-b-3xl shadow-md">
                
                {/* Logo & Location Row */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => navigate(-1)}
                            className="p-1 hover:bg-white/10 rounded-full transition-colors text-white border-0 bg-transparent cursor-pointer"
                        >
                            <ChevronLeft size={24} />
                        </button>
                        
                        <div onClick={() => navigate("/")} className="cursor-pointer flex items-center gap-1.5">
                            <img src={LogoTransparent} alt="Athreya Delivery" className="h-8.5 w-auto object-contain rounded-full" />
                            <div className="flex flex-col items-start leading-none font-sans">
                                <span className="text-[12.5px] font-black text-white tracking-wide uppercase">ATHREYA</span>
                                <span className="text-[8.5px] font-bold text-white tracking-[0.12em] mt-0.5 uppercase">DELIVERY</span>
                            </div>
                        </div>
                    </div>

                    {/* Location Badge */}
                    <div className="flex items-center gap-1 text-[11.5px] font-black tracking-tight bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
                        <span className="text-red-500 text-[12px]">📍</span>
                        <span className="max-w-[120px] truncate">
                            {currentLocation?.name?.includes("Aswapuram") 
                              ? currentLocation.name.split(",")[0] 
                              : "Aswapuram (507116)"}
                        </span>
                    </div>

                    {/* Cart Icon */}
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
                    </button>
                </div>

                {/* Search Bar */}
                <div className="relative flex items-center bg-[#021f0b] rounded-full border border-[#0d4f1c] px-3.5 py-2">
                    <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                    <input 
                        type="text" 
                        placeholder="Search in Shops... (షాపులలో వెతకండి...)" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-transparent border-none outline-none text-white text-[12.5px] font-bold w-full placeholder-slate-400"
                    />
                    <button className="w-7 h-7 rounded-full bg-[#A3E635] flex items-center justify-center text-[#042A0F] cursor-pointer hover:opacity-90 active:scale-95 transition-transform border-0 shrink-0 ml-1">
                        <Mic size={14} className="text-[#042A0F]" />
                    </button>
                </div>
            </div>

            {/* Title Block */}
            <div className="px-4 pt-4 pb-2">
                <h1 className="text-[18px] font-black text-slate-800 tracking-tight leading-none">
                    SHOPS AVAILABLE
                </h1>
                <p className="text-[11px] font-bold text-[#1a6e2e] mt-1">
                    అందుబాటులో ఉన్న దుకాణాలు ({filteredShops.length})
                </p>
            </div>

            {/* Shops List Content */}
            <div className="flex-1 px-4 py-2 space-y-4">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 font-bold text-sm">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a6e2e] mb-4"></div>
                        Loading Shops...
                    </div>
                ) : filteredShops.length === 0 ? (
                    <div className="text-center text-slate-500 py-20 font-bold text-sm bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                        No shops found matching your search.
                    </div>
                ) : (
                    filteredShops.map((shop) => (
                        <div key={shop._id} className="bg-white rounded-3xl p-4 border border-slate-200/80 flex flex-col gap-3.5 shadow-sm transition-transform active:scale-[0.99] duration-150">
                            
                            {/* Shop Header Details */}
                            <div className="flex justify-between items-start">
                                <div className="flex gap-3 items-center min-w-0">
                                    {/* Shop Logo */}
                                    <div className="w-12 h-12 rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 shrink-0">
                                        <img 
                                            src={applyCloudinaryTransform(shop.shopLogo || shop.storeFrontImage || "https://images.unsplash.com/photo-1534723452862-4c874018d66d?q=80&w=200&fit=crop")} 
                                            alt={shop.shopName} 
                                            className="w-full h-full object-cover" 
                                        />
                                    </div>
                                    {/* Shop metadata */}
                                    <div className="min-w-0">
                                        <h4 className="text-[14.5px] font-black text-slate-900 flex items-center gap-1 leading-snug">
                                            {shop.shopName}
                                            <span className="w-4 h-4 rounded-full bg-green-500 text-white flex items-center justify-center text-[9px] font-bold shrink-0">✓</span>
                                        </h4>
                                        <div className="flex items-center gap-1.5 mt-0.5 text-[10.5px] text-slate-500 font-bold flex-wrap">
                                            <span className="text-amber-500 flex items-center gap-0.5 shrink-0">
                                                {shop.rating || "4.5"} ★
                                            </span>
                                            <span className="text-slate-300">•</span>
                                            <span className="shrink-0">{shop.storeTimings || "20-25 mins"}</span>
                                            <span className="text-slate-300">•</span>
                                            <span className="shrink-0">Min. Order ₹{shop.minimumOrderAmount || 0}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Free Delivery tag */}
                                <span className="text-[9px] font-black text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-200 uppercase tracking-wider shrink-0 mt-0.5">
                                    Free Delivery
                                </span>
                            </div>

                            {/* Horizontal scroll of products + green arrow button */}
                            <div className="flex items-center gap-2 relative">
                                <div className="flex-1 flex gap-2.5 overflow-x-auto no-scrollbar py-0.5">
                                    {(!shop.products || shop.products.length === 0) ? (
                                        <div className="text-slate-400 text-xs font-semibold py-4 px-2">
                                            No products listed yet.
                                        </div>
                                    ) : (
                                        shop.products.map((product) => (
                                            <div 
                                                key={product.id} 
                                                onClick={() => {
                                                    if (product.id.startsWith("p")) {
                                                        // It's a mock product, do not trigger crash on invalid objectId
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
                                                {/* Product details */}
                                                <div className="text-center w-full leading-none flex flex-col items-center">
                                                    <span className="text-[9.5px] font-extrabold text-slate-800 truncate max-w-full block">
                                                        {product.name}
                                                    </span>
                                                    <span className="text-[8.5px] font-bold text-slate-500 mt-1 block">
                                                        ₹{product.price}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Green navigation arrow circle button */}
                                <button 
                                    onClick={() => {
                                        if (shop._id.startsWith("mock-")) {
                                            // Fallback navigation for mock shops
                                            navigate(`/category/vegetables`);
                                            return;
                                        }
                                        navigate(`/shops/${shop._id || shop.id}`);
                                    }}
                                    className="w-8 h-8 rounded-full bg-[#1a6e2e] flex items-center justify-center text-white cursor-pointer hover:bg-green-800 transition-all shrink-0 active:scale-95 border-0 shadow-sm"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>

                        </div>
                    ))
                )}
            </div>

            <MiniCart />
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

export default ShopsPage;
