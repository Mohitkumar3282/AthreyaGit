import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutGrid, ShoppingBag, User, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
    { label: 'Home', teluguLabel: 'హోమ్', icon: Home, path: '/' },
    { label: 'Pickup', teluguLabel: 'పికప్', icon: Package, path: '/pickup-delivery' },
    { label: 'Category', teluguLabel: 'కేటగిరీలు', icon: LayoutGrid, path: '/categories' },
    { label: 'Orders', teluguLabel: 'ఆర్డర్లు', icon: ShoppingBag, path: '/orders' },
    { label: 'Profile', teluguLabel: 'ప్రొఫైల్', icon: User, path: '/profile' },
];

const BottomNav = () => {
    const location = useLocation();
    const path = location.pathname.replace(/\/$/, '') || '/';
    const isHome = path === '/';
    const isCategories = path === '/categories';
    const isGreenTheme = isHome || isCategories;

    return (
        <div 
            className={cn(
                "fixed bottom-0 left-0 right-0 z-[500] flex items-center justify-around md:hidden px-4 transition-colors duration-300",
                isGreenTheme 
                    ? "bg-[#042A0F] border-t border-[#063A16]/40" 
                    : "bg-white border-t border-[#1a6e2e]/20"
            )}
            style={{
                height: "calc(65px + env(safe-area-inset-bottom, 0px))",
                paddingBottom: "env(safe-area-inset-bottom, 0px)"
            }}
        >
            {navItems.map((item) => {
                const isActive = location.pathname === item.path ||
                    (item.path !== '/' && location.pathname.startsWith(item.path));

                return (
                    <Link
                        key={item.path}
                        to={item.path}
                        className="flex-1 flex flex-col items-center justify-center h-full relative group transition-all"
                    >
                        {isActive && !isGreenTheme && (
                            <div className="absolute -inset-y-2 -inset-x-4 bg-[#1a6e2e]/5 rounded-[20px] -z-10 transition-opacity duration-300" />
                        )}

                        <div className="flex flex-col items-center justify-center relative">
                            <div
                                className={cn(
                                    "transition-transform duration-300",
                                    isActive ? "-translate-y-0.5 scale-110" : "translate-y-0 scale-100"
                                )}
                            >
                                <item.icon
                                    size={24}
                                    strokeWidth={isActive ? 2.5 : 2}
                                    className={cn(
                                        "transition-colors duration-300",
                                        isGreenTheme 
                                            ? (isActive ? "text-white" : "text-slate-400")
                                            : (isActive ? "text-[#1a6e2e]" : "text-gray-400")
                                    )}
                                />
                            </div>

                            <div className="flex flex-col items-center mt-1">
                                <span
                                    className={cn(
                                        "text-[10px] font-bold tracking-tight transition-all duration-300 leading-none",
                                        isGreenTheme 
                                            ? (isActive ? "text-white" : "text-slate-400")
                                            : (isActive ? "text-[#1a6e2e]" : "text-gray-400")
                                    )}
                                >
                                    {item.label}
                                </span>
                                {isGreenTheme && (
                                    <span
                                        className={cn(
                                            "text-[9px] font-medium tracking-tight mt-0.5 leading-none transition-all duration-300",
                                            isActive ? "text-white" : "text-slate-400"
                                        )}
                                    >
                                        {item.teluguLabel}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Top Accent Line for Active State (white on home/categories, green otherwise) */}
                        {isActive && (
                            <div 
                                className={cn(
                                    "absolute -top-[1px] w-8 h-[3px] rounded-full transition-opacity duration-300",
                                    isGreenTheme ? "bg-white" : "bg-[#1a6e2e]"
                                )} 
                            />
                        )}
                    </Link>
                );
            })}
        </div>
    );
};

export default BottomNav;

