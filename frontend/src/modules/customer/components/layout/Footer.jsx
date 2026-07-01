import React from 'react';
import { Facebook, Twitter, Instagram, Youtube, Mail, MapPin, Phone } from 'lucide-react';
import Logo from '@/assets/Logo.png';
import { useSettings } from '@core/context/SettingsContext';

const Footer = () => {
    const { settings } = useSettings();
    const logoUrl = settings?.logoUrl || Logo;
    const primaryColor = settings?.primaryColor || '#1a6e2e';

    return (
        <footer className="relative bg-white pt-20 pb-10 mt-20 text-[#1a6e2e] md:pt-32 md:pb-16 md:mt-32 overflow-hidden border-t border-[#1a6e2e]/20">
            <div className="container mx-auto px-4 z-10 relative">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 md:gap-16">

                    {/* Brand Info */}
                    <div className="space-y-4 md:space-y-8">
                        <div className="flex items-center">
                            <img src={logoUrl} alt={`${settings?.appName || 'App'} Logo`} loading="lazy" className="h-16 md:h-24 w-auto object-contain scale-[1.2]" />
                        </div>
                        <p className="text-sm leading-relaxed md:text-base md:leading-loose text-[#1a6e2e] md:max-w-xs transition-opacity hover:opacity-100 font-medium">
                            Your daily dose of fresh, organic, and healthy products delivered straight to your door. Freshness guaranteed.
                        </p>
                        <div className="flex gap-4">
                            {settings?.facebook && <a href={settings.facebook} target="_blank" rel="noopener noreferrer" className="p-2 bg-[#1a6e2e]/10 text-[#1a6e2e] rounded-full transition-all group active:scale-95 hover:opacity-90"><Facebook size={18} /></a>}
                            {settings?.twitter && <a href={settings.twitter} target="_blank" rel="noopener noreferrer" className="p-2 bg-[#1a6e2e]/10 text-[#1a6e2e] rounded-full transition-all group active:scale-95 hover:opacity-90"><Twitter size={18} /></a>}
                            {settings?.instagram && <a href={settings.instagram} target="_blank" rel="noopener noreferrer" className="p-2 bg-[#1a6e2e]/10 text-[#1a6e2e] rounded-full transition-all group active:scale-95 hover:opacity-90"><Instagram size={18} /></a>}
                            {settings?.youtube && <a href={settings.youtube} target="_blank" rel="noopener noreferrer" className="p-2 bg-[#1a6e2e]/10 text-[#1a6e2e] rounded-full transition-all group active:scale-95 hover:opacity-90"><Youtube size={18} /></a>}
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div className="md:pt-4">
                        <h3 className="text-[#1a6e2e] font-bold text-lg mb-4 md:text-xl md:font-black md:uppercase md:tracking-widest md:mb-8 flex items-center gap-2">
                            <span className="h-1 w-4 hidden md:block" style={{ backgroundColor: primaryColor }}></span> Quick Links
                        </h3>
                        <ul className="space-y-2 md:space-y-4">
                            <li><a href="#" className="hover:text-[#1a6e2e] transition-colors md:text-base md:font-semibold flex items-center group text-[#1a6e2e]"><span className="hidden md:block w-0 h-px bg-[#1a6e2e] group-hover:w-4 group-hover:mr-2 transition-all"></span>Home</a></li>
                            <li><a href="#" className="hover:text-[#1a6e2e] transition-colors md:text-base md:font-semibold flex items-center group text-[#1a6e2e]"><span className="hidden md:block w-0 h-px bg-[#1a6e2e] group-hover:w-4 group-hover:mr-2 transition-all"></span>About Us</a></li>
                            <li><a href="#" className="hover:text-[#1a6e2e] transition-colors md:text-base md:font-semibold flex items-center group text-[#1a6e2e]"><span className="hidden md:block w-0 h-px bg-[#1a6e2e] group-hover:w-4 group-hover:mr-2 transition-all"></span>Shop</a></li>
                            <li><a href="#" className="hover:text-[#1a6e2e] transition-colors md:text-base md:font-semibold flex items-center group text-[#1a6e2e]"><span className="hidden md:block w-0 h-px bg-[#1a6e2e] group-hover:w-4 group-hover:mr-2 transition-all"></span>Blogs</a></li>
                            <li><a href="#" className="hover:text-[#1a6e2e] transition-colors md:text-base md:font-semibold flex items-center group text-[#1a6e2e]"><span className="hidden md:block w-0 h-px bg-[#1a6e2e] group-hover:w-4 group-hover:mr-2 transition-all"></span>Contact</a></li>
                        </ul>
                    </div>

                    {/* Categories */}
                    <div className="md:pt-4">
                        <h3 className="text-[#1a6e2e] font-bold text-lg mb-4 md:text-xl md:font-black md:uppercase md:tracking-widest md:mb-8 flex items-center gap-2">
                            <span className="h-1 w-4 hidden md:block" style={{ backgroundColor: primaryColor }}></span> Categories
                        </h3>
                        <ul className="space-y-2 md:space-y-4">
                            <li><a href="#" className="hover:text-[#1a6e2e] transition-colors md:text-base md:font-semibold flex items-center group text-[#1a6e2e]"><span className="hidden md:block w-0 h-px bg-[#1a6e2e] group-hover:w-4 group-hover:mr-2 transition-all"></span>Fruits & Vegetables</a></li>
                            <li><a href="#" className="hover:text-[#1a6e2e] transition-colors md:text-base md:font-semibold flex items-center group text-[#1a6e2e]"><span className="hidden md:block w-0 h-px bg-[#1a6e2e] group-hover:w-4 group-hover:mr-2 transition-all"></span>Dairy Products</a></li>
                            <li><a href="#" className="hover:text-[#1a6e2e] transition-colors md:text-base md:font-semibold flex items-center group text-[#1a6e2e]"><span className="hidden md:block w-0 h-px bg-[#1a6e2e] group-hover:w-4 group-hover:mr-2 transition-all"></span>Meat & Fish</a></li>
                            <li><a href="#" className="hover:text-[#1a6e2e] transition-colors md:text-base md:font-semibold flex items-center group text-[#1a6e2e]"><span className="hidden md:block w-0 h-px bg-[#1a6e2e] group-hover:w-4 group-hover:mr-2 transition-all"></span>Bakery & Snacks</a></li>
                            <li><a href="#" className="hover:text-[#1a6e2e] transition-colors md:text-base md:font-semibold flex items-center group text-[#1a6e2e]"><span className="hidden md:block w-0 h-px bg-[#1a6e2e] group-hover:w-4 group-hover:mr-2 transition-all"></span>Beverages</a></li>
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div className="md:pt-4">
                        <h3 className="text-[#1a6e2e] font-bold text-lg mb-4 md:text-xl md:font-black md:uppercase md:tracking-widest md:mb-8 flex items-center gap-2">
                            <span className="h-1 w-4 hidden md:block" style={{ backgroundColor: primaryColor }}></span> Contact Us
                        </h3>
                        <ul className="space-y-4 md:space-y-6">
                            <li className="flex items-start gap-3 md:gap-5 group">
                                <div className="hidden md:flex h-12 w-12 rounded-xl bg-[#1a6e2e]/10 items-center justify-center text-[#1a6e2e] transition-all shrink-0 group-hover:opacity-90"><MapPin size={22} /></div>
                                <MapPin className="mt-1 shrink-0 md:hidden" size={18} style={{ color: primaryColor }} />
                                <span className="md:text-base text-[#1a6e2e] md:pt-1 font-medium">{settings?.address || '—'}</span>
                            </li>
                            <li className="flex items-center gap-3 md:gap-5 group">
                                <div className="hidden md:flex h-12 w-12 rounded-xl bg-[#1a6e2e]/10 items-center justify-center text-[#1a6e2e] transition-all shrink-0 group-hover:opacity-90"><Phone size={22} /></div>
                                <Phone className="shrink-0 md:hidden" size={18} style={{ color: primaryColor }} />
                                <span className="md:text-base text-[#1a6e2e] font-medium">{settings?.supportPhone || '—'}</span>
                            </li>
                            <li className="flex items-center gap-3 md:gap-5 group">
                                <div className="hidden md:flex h-12 w-12 rounded-xl bg-[#1a6e2e]/10 items-center justify-center text-[#1a6e2e] transition-all shrink-0 group-hover:opacity-90"><Mail size={22} /></div>
                                <Mail className="shrink-0 md:hidden" size={18} style={{ color: primaryColor }} />
                                <span className="md:text-base text-[#1a6e2e] font-medium">{settings?.supportEmail || '—'}</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-[#1a6e2e]/20 mt-12 pt-8 text-center text-sm md:flex md:justify-between md:text-left md:mt-24 md:pt-12">
                    <p className="md:text-base text-[#1a6e2e]">&copy; {new Date().getFullYear()} {settings?.appName || 'App'}. All rights reserved.</p>
                    <div className="flex gap-6 justify-center md:justify-end mt-4 md:mt-0 md:gap-12">
                        <a href="#" className="hover:text-[#1a6e2e] md:text-base text-[#1a6e2e] transition-all">Privacy Policy</a>
                        <a href="#" className="hover:text-[#1a6e2e] md:text-base text-[#1a6e2e] transition-all">Terms of Service</a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;


