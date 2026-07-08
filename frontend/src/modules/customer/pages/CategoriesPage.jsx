import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import MainLocationHeader from '../components/shared/MainLocationHeader';
import { customerApi } from '../services/customerApi';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';

const COLORS = [
    "#ffffff"
];

const TELUGU_TRANSLATIONS = {
  "Water Can": "వాటర్ క్యాన్",
  "Milk": "పాలు",
  "Tiffins": "టిఫిన్స్",
  "Restaurant": "రెస్టారెంట్",
  "Vegetables": "కూరగాయలు",
  "Fruits": "పండ్లు",
  "Chiken": "చికెన్",
  "Chicken": "చికెన్",
  "Food": "ఆహారం",
  "horse food": "గుర్రం ఆహారం",
  "Cookware": "వంట పాత్రలు",
  "Rice n": "బియ్యం",
  "Meat": "మాంసం",
  "Grocery": "కిరాణా",
  "Groceries": "కిరాణా",
  "Chiken fried": "ఫ్రైడ్ చికెన్",
  "Sea Food": "సముద్ర ఆహారం",
  "Bakery": "బేకరీ",
  "Snacks": "స్నాక్స్",
  "Tea & Coffee": "టీ & కాఫీ",
  "Pharmacy": "మెడిసిన్",
  "Flowers": "పూలు",
  "Electronics": "ఎలక్ట్రానిక్స్",
  "Stationery": "స్టేషనరీ",
  "Pets": "పెట్స్",
  "Home Needs": "హోమ్ నీడ్స్",
  "Baby Care": "బేబీ కేర్",
  "Fashion": "ఫ్యాషన్",
  "More": "మరిన్ని",
};

const getTeluguCategoryName = (name) => {
    if (!name) return "";
    const cleanName = name.trim().toLowerCase();
    
    // Check direct match
    if (TELUGU_TRANSLATIONS[name]) return TELUGU_TRANSLATIONS[name];
    
    // Check case-insensitive match
    for (const [key, value] of Object.entries(TELUGU_TRANSLATIONS)) {
        if (key.toLowerCase() === cleanName) {
            return value;
        }
    }
    
    // Check partial match
    if (cleanName.includes("chicken") || cleanName.includes("chiken")) return "చికెన్";
    if (cleanName.includes("vegetable")) return "కూరగాయలు";
    if (cleanName.includes("fruit")) return "పండ్లు";
    if (cleanName.includes("milk")) return "పాలు";
    if (cleanName.includes("water")) return "వాటర్ క్యాన్";
    if (cleanName.includes("grocery") || cleanName.includes("kirana")) return "కిరాణా";
    if (cleanName.includes("food")) return "ఆహారం";
    
    return "";
};

const CategoriesPage = () => {
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchCategories = async () => {
        setIsLoading(true);
        try {
            const res = await customerApi.getCategories({ tree: true });
            if (res.data.success) {
                const tree = res.data.results || res.data.result || [];
                const flatCategories = [];
                tree
                    .filter((header) => (header.name || '').trim().toLowerCase() !== 'all')
                    .forEach((header, idx) => {
                        (header.children || []).forEach((cat, cIdx) => {
                            if (!flatCategories.some(existing => existing.id === cat._id)) {
                                flatCategories.push({
                                    id: cat._id,
                                    name: cat.name,
                                    image: cat.image || "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout-engine/2022-11/Slice-1_9.png",
                                    color: COLORS[(idx + cIdx) % COLORS.length]
                                });
                            }
                        });
                    });
                setCategories(flatCategories);
            }
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
            <div className="max-w-[1280px] mx-auto px-4 pt-[150px] md:pt-[170px] pb-20">
                <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Group Title */}
                    <h2 className="text-[12.5px] md:text-sm font-black text-white tracking-wide uppercase mb-4.5 px-1 font-sans">
                        ALL CATEGORIES
                    </h2>
 
                    {/* Categories Grid */}
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-x-3.5 gap-y-4">
                        {categories.map((category) => (
                            <div key={category.id} className="flex flex-col group cursor-pointer">
                                <Link
                                    to={`/category/${category.id}`}
                                    className="block"
                                >
                                    <div className="w-full rounded-[18px] bg-white border border-[#0d4f1c] flex flex-col items-center p-2 transition-transform active:scale-95 duration-200">
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
                </div>
            </div>
        </div>
    );
};

export default CategoriesPage;
