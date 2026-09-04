import React from 'react';
import { Facebook, Twitter, Instagram, Youtube, Mail, MapPin, Phone } from 'lucide-react';
import LogoTransparent from '@/assets/LogoTransparent.png';
import { useSettings } from '@core/context/SettingsContext';

const Footer = () => {
    const { settings } = useSettings();
    const logoUrl = settings?.logoUrl || LogoTransparent;
    const primaryColor = settings?.primaryColor || '#1a6e2e';

    return (
        <footer className="relative bg-white pt-8 pb-10 mt-6 text-[#0d4d29] md:pt-12 md:pb-14 md:mt-8 overflow-hidden border-t border-emerald-100 font-sans">
            <div className="container mx-auto px-4 z-10 relative">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">

                    {/* Brand Info */}
                    <div className="space-y-4 md:space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 md:h-14 md:w-14 rounded-2xl bg-emerald-50 border border-emerald-200/80 p-1.5 flex items-center justify-center shrink-0 shadow-2xs">
                                <img
                                    src={logoUrl}
                                    alt={`${settings?.appName || 'App'} Logo`}
                                    loading="lazy"
                                    className="h-full w-full object-contain"
                                    style={{ filter: "url(#logo-yellow-watch-green-rider)" }}
                                />
                            </div>
                            <div className="flex flex-col items-start leading-none font-sans">
                                <span className="text-base md:text-lg font-[1000] text-[#0d4d29] tracking-wide uppercase">ATHREYA</span>
                                <span className="text-[9px] md:text-[10px] font-bold text-[#0d4d29] tracking-[0.14em] mt-0.5 uppercase">DELIVERY</span>
                            </div>
                        </div>
                        <p className="text-xs leading-relaxed md:text-sm md:leading-normal text-slate-600 md:max-w-xs font-medium">
                            Your daily dose of fresh, organic, and healthy products delivered straight to your door. Freshness guaranteed.
                        </p>
                        <div className="flex gap-3">
                            {settings?.facebook && <a href={settings.facebook} target="_blank" rel="noopener noreferrer" className="p-2 bg-emerald-50 border border-emerald-100 text-[#0d4d29] rounded-xl transition-all group active:scale-95 hover:bg-emerald-100"><Facebook size={18} /></a>}
                            {settings?.twitter && <a href={settings.twitter} target="_blank" rel="noopener noreferrer" className="p-2 bg-emerald-50 border border-emerald-100 text-[#0d4d29] rounded-xl transition-all group active:scale-95 hover:bg-emerald-100"><Twitter size={18} /></a>}
                            {settings?.instagram && <a href={settings.instagram} target="_blank" rel="noopener noreferrer" className="p-2 bg-emerald-50 border border-emerald-100 text-[#0d4d29] rounded-xl transition-all group active:scale-95 hover:bg-emerald-100"><Instagram size={18} /></a>}
                            {settings?.youtube && <a href={settings.youtube} target="_blank" rel="noopener noreferrer" className="p-2 bg-emerald-50 border border-emerald-100 text-[#0d4d29] rounded-xl transition-all group active:scale-95 hover:bg-emerald-100"><Youtube size={18} /></a>}
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div className="md:pt-2">
                        <h3 className="text-[#0d4d29] font-[1000] text-sm md:text-base uppercase tracking-wider mb-3 md:mb-5 flex items-center gap-2">
                            <span className="h-1 w-3 bg-[#0d4d29] rounded-full"></span> Quick Links
                        </h3>
                        <ul className="space-y-2 md:space-y-3 text-xs md:text-sm">
                            <li><a href="#" className="hover:text-[#0d4d29] transition-colors font-medium text-slate-600 flex items-center group"><span className="hidden md:block w-0 h-px bg-[#0d4d29] group-hover:w-3 group-hover:mr-1.5 transition-all"></span>Home</a></li>
                            <li><a href="#" className="hover:text-[#0d4d29] transition-colors font-medium text-slate-600 flex items-center group"><span className="hidden md:block w-0 h-px bg-[#0d4d29] group-hover:w-3 group-hover:mr-1.5 transition-all"></span>About Us</a></li>
                            <li><a href="#" className="hover:text-[#0d4d29] transition-colors font-medium text-slate-600 flex items-center group"><span className="hidden md:block w-0 h-px bg-[#0d4d29] group-hover:w-3 group-hover:mr-1.5 transition-all"></span>Shop</a></li>
                            <li><a href="#" className="hover:text-[#0d4d29] transition-colors font-medium text-slate-600 flex items-center group"><span className="hidden md:block w-0 h-px bg-[#0d4d29] group-hover:w-3 group-hover:mr-1.5 transition-all"></span>Blogs</a></li>
                            <li><a href="#" className="hover:text-[#0d4d29] transition-colors font-medium text-slate-600 flex items-center group"><span className="hidden md:block w-0 h-px bg-[#0d4d29] group-hover:w-3 group-hover:mr-1.5 transition-all"></span>Contact</a></li>
                        </ul>
                    </div>

                    {/* Categories */}
                    <div className="md:pt-2">
                        <h3 className="text-[#0d4d29] font-[1000] text-sm md:text-base uppercase tracking-wider mb-3 md:mb-5 flex items-center gap-2">
                            <span className="h-1 w-3 bg-[#0d4d29] rounded-full"></span> Categories
                        </h3>
                        <ul className="space-y-2 md:space-y-3 text-xs md:text-sm">
                            <li><a href="#" className="hover:text-[#0d4d29] transition-colors font-medium text-slate-600 flex items-center group"><span className="hidden md:block w-0 h-px bg-[#0d4d29] group-hover:w-3 group-hover:mr-1.5 transition-all"></span>Fruits & Vegetables</a></li>
                            <li><a href="#" className="hover:text-[#0d4d29] transition-colors font-medium text-slate-600 flex items-center group"><span className="hidden md:block w-0 h-px bg-[#0d4d29] group-hover:w-3 group-hover:mr-1.5 transition-all"></span>Dairy Products</a></li>
                            <li><a href="#" className="hover:text-[#0d4d29] transition-colors font-medium text-slate-600 flex items-center group"><span className="hidden md:block w-0 h-px bg-[#0d4d29] group-hover:w-3 group-hover:mr-1.5 transition-all"></span>Meat & Fish</a></li>
                            <li><a href="#" className="hover:text-[#0d4d29] transition-colors font-medium text-slate-600 flex items-center group"><span className="hidden md:block w-0 h-px bg-[#0d4d29] group-hover:w-3 group-hover:mr-1.5 transition-all"></span>Bakery & Snacks</a></li>
                            <li><a href="#" className="hover:text-[#0d4d29] transition-colors font-medium text-slate-600 flex items-center group"><span className="hidden md:block w-0 h-px bg-[#0d4d29] group-hover:w-3 group-hover:mr-1.5 transition-all"></span>Beverages</a></li>
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div className="md:pt-2">
                        <h3 className="text-[#0d4d29] font-[1000] text-sm md:text-base uppercase tracking-wider mb-3 md:mb-5 flex items-center gap-2">
                            <span className="h-1 w-3 bg-[#0d4d29] rounded-full"></span> Contact Us
                        </h3>
                        <ul className="space-y-3 md:space-y-4 text-xs md:text-sm">
                            <li className="flex items-start gap-3 group">
                                <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#0d4d29] shrink-0"><MapPin size={18} /></div>
                                <span className="text-slate-600 pt-1 font-medium">{settings?.address || '—'}</span>
                            </li>
                            <li className="flex items-center gap-3 group">
                                <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#0d4d29] shrink-0"><Phone size={18} /></div>
                                <span className="text-slate-600 font-medium">{settings?.supportPhone || '—'}</span>
                            </li>
                            <li className="flex items-center gap-3 group">
                                <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#0d4d29] shrink-0"><Mail size={18} /></div>
                                <span className="text-slate-600 font-medium">{settings?.supportEmail || '—'}</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-slate-100 mt-8 pt-6 text-center text-xs md:flex md:justify-between md:text-left md:mt-10 md:pt-6">
                    <p className="text-slate-500 font-medium">&copy; {new Date().getFullYear()} {settings?.appName || 'Athreya'}. All rights reserved.</p>
                    <div className="flex gap-6 justify-center md:justify-end mt-3 md:mt-0">
                        <a href="#" className="hover:text-[#0d4d29] text-slate-500 font-medium transition-colors">Privacy Policy</a>
                        <a href="#" className="hover:text-[#0d4d29] text-slate-500 font-medium transition-colors">Terms of Service</a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;


