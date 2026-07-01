import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Heart, Search, Minus, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '@shared/components/ui/Toast';
import { cn } from '@/lib/utils';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';

import ProductCard from '../components/shared/ProductCard';
import ProductDetailSheet from '../components/shared/ProductDetailSheet';
import { useProductDetail } from '../context/ProductDetailContext';
import { customerApi } from '../services/customerApi';
import MiniCart from '../components/shared/MiniCart';
import SectionRenderer from "../components/experience/SectionRenderer";
import { useLocation as useAppLocation } from '../context/LocationContext';
import { useSettings } from '@core/context/SettingsContext';
import Lottie from 'lottie-react';

const CategoryProductsPage = () => {
    const { categoryName: catId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { currentLocation } = useAppLocation();
    const { settings } = useSettings();
    const initialSubcategoryId = location.state?.activeSubcategoryId || 'all';
    const { isOpen: isProductDetailOpen } = useProductDetail();
    const [selectedSubCategory, setSelectedSubCategory] = useState(initialSubcategoryId);
    const [category, setCategory] = useState(null);
    const [subCategories, setSubCategories] = useState([{ id: 'all', name: 'All', icon: 'https://cdn-icons-png.flaticon.com/128/2321/2321831.png' }]);
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [noServiceData, setNoServiceData] = useState(null);

    // Dynamically load no-service Lottie on mount
    useEffect(() => {
        import('@/assets/lottie/animation.json')
            .then((m) => setNoServiceData(m.default))
            .catch(() => {});
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const slugMap = {
                fruits: "6a3fc1728bb6d217bf338f1d",
                vegetables: "6a3fc1738bb6d217bf338f24",
                chicken: "6a3fc1748bb6d217bf338f2b",
                mutton: "6a3fc1748bb6d217bf338f32",
                eggs: "6a3fc1748bb6d217bf338f39",
            };
            const resolvedCatId = slugMap[catId?.toLowerCase()] || catId;

            const hasValidLocation =
                Number.isFinite(currentLocation?.latitude) &&
                Number.isFinite(currentLocation?.longitude);

            // Fetch products and categories in parallel instead of sequentially
            const [prodRes, catRes] = await Promise.all([
                hasValidLocation
                    ? customerApi.getProducts({
                        categoryId: resolvedCatId,
                        lat: currentLocation.latitude,
                        lng: currentLocation.longitude,
                    })
                    : Promise.resolve({ data: { success: true, result: { items: [] } } }),
                customerApi.getCategories({ tree: true }),
            ]);

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
                    image:
                      p.mainImage ||
                      p.image ||
                      "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&q=80&w=400&h=400",
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
                for (const header of tree) {
                    const found = (header.children || []).find(c => c._id === resolvedCatId);
                    if (found) {
                        currentCat = found;
                        break;
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
    }, [catId, location.state?.activeSubcategoryId, currentLocation?.latitude, currentLocation?.longitude]);

    const safeProducts = Array.isArray(products) ? products : [];

    const filteredProducts = safeProducts.filter(p =>
        selectedSubCategory === 'all' || p.subcategoryId?._id === selectedSubCategory || p.subcategoryId === selectedSubCategory
    );

    const productsById = React.useMemo(() => {
        const map = {};
        safeProducts.forEach(p => {
            map[p._id || p.id] = p;
        });
        return map;
    }, [safeProducts]);

    return (
        <div className="flex flex-col min-h-screen bg-white max-w-md mx-auto relative font-sans">

            {/* Header */}
            <header className={cn(
                "sticky top-0 z-50 bg-white border-b border-[#1a6e2e]/20 px-4 py-4 flex items-center justify-between",
                isProductDetailOpen && "hidden md:flex"
            )}>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-1 hover:bg-gray-50 rounded-full transition-colors"
                    >
                        <ChevronLeft size={24} className="text-gray-900" />
                    </button>
                    <h1 className="text-[18px] font-bold text-gray-800 tracking-tight">
                        {category?.name || catId}
                    </h1>
                </div>

            </header>

            <div className="flex flex-1 relative items-start">
                {(safeProducts.length === 0 && !isLoading) ? (
                    <div className="w-full flex-grow py-20 px-8 flex flex-col items-center justify-center text-center self-center">
                        <h3 className="text-2xl font-black text-slate-700 tracking-tighter mb-2 uppercase">
                            No products available
                        </h3>
                        <p className="text-slate-500 font-bold text-sm max-w-[280px]">
                            Check back later! We are adding new items daily.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Sidebar */}
                        <aside className="w-[70px] border-r border-[#1a6e2e]/20 flex flex-col bg-white overflow-y-auto hide-scrollbar sticky top-[60px] h-[calc(100vh-60px)] pb-32 flex-shrink-0">

                            {subCategories.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedSubCategory(cat.id)}
                                    className={cn(
                                        "flex flex-col items-center py-4 px-1 gap-2 transition-all relative border-l-4",
                                        selectedSubCategory === cat.id
                                            ? "bg-white border-[#1a6e2e]"
                                            : "border-transparent hover:bg-white/40"
                                    )}
                                >
                                    <div className={cn(
                                        "w-14 h-14 rounded-2xl flex items-center justify-center p-1.5 transition-all duration-300",
                                        selectedSubCategory === cat.id ? "scale-110" : "opacity-100"
                                    )}>
                                        <img src={applyCloudinaryTransform(cat.icon)} alt={cat.name} loading="lazy" className="w-full h-full object-contain" />
                                    </div>
                                    <span className={cn(
                                        "text-[10px] text-center font-bold font-sans leading-tight px-1",
                                        selectedSubCategory === cat.id ? "text-[#1a6e2e]" : "text-gray-600"
                                    )}>
                                        {cat.name}
                                    </span>
                                </button>
                            ))}
                        </aside>

                        {/* Content */}
                        <main className="flex-1 p-2 pb-24 bg-transparent space-y-4 overflow-x-hidden">
                            <div className="grid grid-cols-2 gap-x-2 gap-y-3">
                                {filteredProducts.map((product) => (
                                    <ProductCard key={product.id} product={product} compact={true} />
                                ))}
                            </div>
                        </main>
                    </>
                )}
            </div>

            <MiniCart />
            <ProductDetailSheet />

            <style dangerouslySetInnerHTML={{
                __html: `
                    .hide-scrollbar::-webkit-scrollbar {
                        display: none;
                    }
                    .hide-scrollbar {
                        -ms-overflow-style: none;
                        scrollbar-width: none;
                    }
                `}} />
        </div>
    );
};

export default CategoryProductsPage;

