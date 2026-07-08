import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, ShoppingCart, Heart, User, Menu, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWishlist } from '../../context/WishlistContext';
import { useCart } from '../../context/CartContext';
import { useLocation as useAppLocation } from "../../context/LocationContext";
import { useSettings } from '@core/context/SettingsContext';
import LocationDrawer from '../shared/LocationDrawer';
import LogoTransparent from "../../../../assets/LogoTransparent.png";

const Header = () => {
    const { settings } = useSettings();
    const logoUrl = settings?.logoUrl || LogoTransparent;
    const { count: wishlistCount } = useWishlist();
    const { cartCount } = useCart();
    const location = useLocation();
    const isCheckoutPage = location.pathname === '/checkout';
    const [isLocationOpen, setIsLocationOpen] = useState(false);
    const { currentLocation, refreshLocation } = useAppLocation();

    // Search placeholder animation
    const [searchPlaceholder, setSearchPlaceholder] = useState('Search ');
    const [typingState, setTypingState] = useState({
        textIndex: 0,
        charIndex: 0,
        isDeleting: false,
        isPaused: false
    });

    const staticText = "Search ";
    const typingPhrases = ['"bread"', '"milk"', '"chocolate"', '"eggs"', '"chips"'];

    React.useEffect(() => {
        const { textIndex, charIndex, isDeleting, isPaused } = typingState;
        const currentPhrase = typingPhrases[textIndex];

        if (isPaused) {
            const timeout = setTimeout(() => {
                setTypingState(prev => ({ ...prev, isPaused: false, isDeleting: true }));
            }, 2000); // Pause after full phrase
            return () => clearTimeout(timeout);
        }

        const timeout = setTimeout(() => {
            if (!isDeleting) {
                // Typing
                if (charIndex < currentPhrase.length) {
                    setSearchPlaceholder(staticText + currentPhrase.substring(0, charIndex + 1));
                    setTypingState(prev => ({ ...prev, charIndex: prev.charIndex + 1 }));
                } else {
                    // Finished typing
                    setTypingState(prev => ({ ...prev, isPaused: true }));
                }
            } else {
                // Deleting
                if (charIndex > 0) {
                    setSearchPlaceholder(staticText + currentPhrase.substring(0, charIndex - 1));
                    setTypingState(prev => ({ ...prev, charIndex: prev.charIndex - 1 }));
                } else {
                    // Finished deleting
                    setTypingState(prev => ({
                        ...prev,
                        isDeleting: false,
                        textIndex: (prev.textIndex + 1) % typingPhrases.length
                    }));
                }
            }
        }, isDeleting ? 50 : 100);

        return () => clearTimeout(timeout);
    }, [typingState]);

    return (
        <header className="absolute top-2 md:top-8 left-0 right-0 z-[200] px-2 md:px-4">
            <div className="container mx-auto max-w-6xl">
                {/* Main Header Capsule */}
                <div className="px-3 md:px-8 py-2 md:py-0 h-auto md:h-18 bg-white/95 rounded-[2rem] md:rounded-full border border-[#1a6e2e]/20 flex flex-col md:flex-row md:items-center md:justify-between border border-white/20 gap-3 md:gap-0">
                    {/* Logo & Mobile Actions Wrapper */}
                    <div className="flex items-center justify-between md:justify-start w-full md:w-auto gap-4 md:gap-6 mr-0 md:mr-12">
                        <Link to="/" className="flex items-center gap-0 group">
                            <img
                                src={logoUrl}
                                alt="Athreya Delivery Logo"
                                loading="lazy"
                                className="h-10 md:h-20 w-auto object-contain transition-transform group-hover:scale-105 mr-1.5 md:-mr-3 scale-[1.1] md:scale-[1.2]"
                                style={{ filter: "url(#logo-yellow-watch-green-rider)" }}
                            />
                            <span className="text-xs md:text-lg font-black tracking-tight flex flex-col md:flex-row md:gap-1 leading-tight text-slate-800">
                                <span className="text-[#3a2a83]">ATHREYA</span>
                                <span className="text-[#f15a24]">DELIVERY</span>
                            </span>
                        </Link>

                        {/* Location Selector (Desktop ONLY) */}
                        <button
                            type="button"
                            data-lenis-prevent
                            data-lenis-prevent-touch
                            onClick={() => {
                                refreshLocation();
                                setIsLocationOpen(true);
                            }}
                            className="hidden md:flex items-center gap-2 pl-6 border-l border-slate-200 cursor-pointer active:scale-95 transition-transform border-0 bg-transparent p-0"
                        >
                            <div className="flex flex-col items-start leading-none group">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 group-hover:text-[#1a6e2e] transition-colors">
                                    Delivery in {currentLocation.time}
                                </span>
                                <div className="flex items-center gap-1 font-bold text-slate-700 text-sm group-hover:text-[#1a6e2e] transition-colors">
                                    <span className="max-w-[150px] truncate">{currentLocation.name}</span> <MapPin size={14} className="fill-current" />
                                </div>
                            </div>
                        </button>

                        {/* Mobile Cart Icon */}
                        <div className="flex md:hidden items-center">
                            <Link to="/checkout" id="header-cart-icon-mobile" className="relative flex items-center justify-center p-2 hover:bg-slate-50 rounded-full transition-colors group">
                                <ShoppingCart className="h-6 w-6 text-slate-600 group-hover:text-[#1a6e2e] transition-colors" />
                                {cartCount > 0 && (
                                    <span className="absolute top-0 right-0 h-5 w-5 rounded-full bg-[#1a6e2e] text-[10px] font-bold text-white flex items-center justify-center border-2 border-white border border-[#1a6e2e]/20 animate-in zoom-in duration-300">
                                        {cartCount}
                                    </span>
                                )}
                            </Link>
                        </div>
                    </div>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center gap-6">
                        <Link to="/" className="text-sm font-medium transition-colors hover:text-[#1a6e2e]">Home</Link>

                        <Link to="/categories" className="text-sm font-medium transition-colors hover:text-[#1a6e2e]">Categories</Link>
                        <Link to="/offers" className="text-sm font-medium transition-colors hover:text-[#1a6e2e]">Offers</Link>
                    </nav>

                    {/* Search Bar - Hidden on checkout page */}
                    {!isCheckoutPage && (
                        <div className="w-full md:flex-1 flex items-center md:max-w-sm m-0 md:ml-8 md:mr-8">
                            <div className="relative w-full">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    type="search"
                                    placeholder={searchPlaceholder}
                                    className="w-full rounded-full border border-slate-200/80 bg-slate-50 md:bg-white pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-[#1a6e2e] transition-all outline-none"
                                />
                            </div>
                        </div>
                    )}

                    {/* Desktop Right Icons */}
                    <div className="hidden md:flex items-center gap-4">
                        <Link to="/wishlist" className="relative flex items-center justify-center p-2 hover:bg-slate-50 rounded-full transition-colors group">
                            <Heart className="h-6 w-6 text-slate-600 group-hover:text-[#1a6e2e] transition-colors" />
                            {wishlistCount > 0 && (
                                <span className="absolute top-0 right-0 h-5 w-5 rounded-full bg-[#1a6e2e] text-[10px] font-bold text-white flex items-center justify-center border-2 border-white border border-[#1a6e2e]/20 animate-in zoom-in duration-300">
                                    {wishlistCount}
                                </span>
                            )}
                        </Link>

                        <Link to="/checkout" id="header-cart-icon" className="relative flex items-center justify-center p-2 hover:bg-slate-50 rounded-full transition-colors group">
                            <ShoppingCart className="h-6 w-6 text-slate-600 group-hover:text-[#1a6e2e] transition-colors" />
                            {cartCount > 0 && (
                                <span className="absolute top-0 right-0 h-5 w-5 rounded-full bg-[#1a6e2e] text-[10px] font-bold text-white flex items-center justify-center border-2 border-white border border-[#1a6e2e]/20 animate-in zoom-in duration-300">
                                    {cartCount}
                                </span>
                            )}
                        </Link>

                        <Link to="/profile" className="flex items-center justify-center">
                            <User className="h-6 w-6 text-slate-600 hover:text-[#1a6e2e] transition-colors" />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Location Selection Drawer */}
            <LocationDrawer
                isOpen={isLocationOpen}
                onClose={() => setIsLocationOpen(false)}
            />
        </header>
    );
};

export default Header;

