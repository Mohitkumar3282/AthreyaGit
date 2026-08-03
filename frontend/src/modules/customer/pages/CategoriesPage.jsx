import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import MainLocationHeader from '../components/shared/MainLocationHeader';
import { customerApi } from '../services/customerApi';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';
import { getTeluguCategoryName } from '@shared/utils/categoryTranslations';

const COLORS = [
    "#ffffff"
];

const CategoriesPage = () => {
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchCategories = async () => {
        setIsLoading(true);
        try {
            const res = await customerApi.getCategories({ tree: true });
            const tree = Array.isArray(res.data?.results) 
                ? res.data.results 
                : Array.isArray(res.data?.result)
                ? res.data.result
                : Array.isArray(res.data)
                ? res.data
                : [];
            
            const flatCategories = [];
            tree
                .filter((header) => (header?.name || '').trim().toLowerCase() !== 'all')
                .forEach((header, idx) => {
                    const children = header.children || [];
                    if (children.length > 0) {
                        children.forEach((cat, cIdx) => {
                            const catId = cat._id || cat.id;
                            if (catId && !flatCategories.some(existing => existing.id === catId)) {
                                flatCategories.push({
                                    id: catId,
                                    name: cat.name,
                                    image: cat.image || "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout-engine/2022-11/Slice-1_9.png",
                                    color: COLORS[(idx + cIdx) % COLORS.length]
                                });
                            }
                        });
                    }
                    
                    // Also include header item itself so categories without children are included
                    const headerId = header._id || header.id;
                    if (headerId && !flatCategories.some(existing => existing.id === headerId)) {
                        flatCategories.push({
                            id: headerId,
                            name: header.name,
                            image: header.image || "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout-engine/2022-11/Slice-1_9.png",
                            color: COLORS[idx % COLORS.length]
                        });
                    }
                });

            // Fallback: If flatCategories is still empty, call flat getCategories API
            if (flatCategories.length === 0) {
                const flatRes = await customerApi.getCategories();
                const rawFlat = Array.isArray(flatRes.data?.results) 
                    ? flatRes.data.results 
                    : Array.isArray(flatRes.data?.result)
                    ? flatRes.data.result
                    : Array.isArray(flatRes.data)
                    ? flatRes.data
                    : [];
                
                rawFlat.forEach((cat, idx) => {
                    const catId = cat._id || cat.id;
                    if (catId && (cat.name || '').trim().toLowerCase() !== 'all' && !flatCategories.some(existing => existing.id === catId)) {
                        flatCategories.push({
                            id: catId,
                            name: cat.name,
                            image: cat.image || "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout-engine/2022-11/Slice-1_9.png",
                            color: COLORS[idx % COLORS.length]
                        });
                    }
                });
            }

            setCategories(flatCategories);
        } catch (error) {
            console.error("Error fetching categories:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    return (
        <div className="min-h-screen bg-[#042A0F] text-white">
            <MainLocationHeader />
            <div className="max-w-[1280px] mx-auto px-4 pt-[110px] md:pt-[140px] pb-20">
                <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Group Title */}
                    <h2 className="text-[12.5px] md:text-sm font-black text-white tracking-wide uppercase mb-4 px-1 font-sans">
                        ALL CATEGORIES
                    </h2>

                    {/* Loading Skeletons */}
                    {isLoading ? (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-x-3.5 gap-y-4">
                            {Array.from({ length: 12 }).map((_, idx) => (
                                <div key={idx} className="w-full rounded-[18px] bg-[#021f0b] border border-[#0d4f1c] p-2 flex flex-col items-center animate-pulse">
                                    <div className="w-full aspect-square rounded-xl bg-[#042A0F]/60 mb-2" />
                                    <div className="h-3 bg-[#A3E635]/20 rounded w-3/4 mb-1" />
                                    <div className="h-2 bg-[#A3E635]/10 rounded w-1/2" />
                                </div>
                            ))}
                        </div>
                    ) : categories.length === 0 ? (
                        <div className="py-16 text-center text-slate-400 font-semibold">
                            No categories available at the moment.
                        </div>
                    ) : (
                        /* Categories Grid */
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-x-3.5 gap-y-4">
                            {categories.map((category) => (
                                <div key={category.id} className="flex flex-col group cursor-pointer">
                                    <Link
                                        to={`/category/${category.id}`}
                                        className="block"
                                    >
                                        <div className="w-full rounded-[18px] bg-white border border-[#0d4f1c] flex flex-col items-center p-2 transition-transform active:scale-95 duration-200 shadow-md">
                                            <div className="w-full aspect-square rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center mb-1.5 p-1">
                                                <img
                                                    src={applyCloudinaryTransform(category.image)}
                                                    alt={category.name}
                                                    loading="lazy"
                                                    className="w-[85%] h-[85%] object-contain"
                                                />
                                            </div>
                                            <div className="text-center w-full flex flex-col items-center justify-center leading-none pb-0.5">
                                                <span className="text-[9.5px] md:text-[11.5px] font-extrabold text-slate-900 tracking-tight block truncate max-w-full font-sans uppercase">
                                                    {category.name}
                                                </span>
                                                {getTeluguCategoryName(category.name) && (
                                                    <span className="text-[8px] md:text-[10px] font-semibold text-slate-500 mt-1 block truncate max-w-full font-sans">
                                                        {getTeluguCategoryName(category.name)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CategoriesPage;
