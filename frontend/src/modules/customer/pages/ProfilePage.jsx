import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    User, MapPin, Package, CreditCard, Wallet, ChevronRight,
    LogOut, ShieldCheck, Heart, HelpCircle, Info, Edit2, ChevronLeft, Bell
} from 'lucide-react';
import { useAuth } from '@core/context/AuthContext';
import { useSettings } from '@core/context/SettingsContext';
import { customerApi } from '../services/customerApi';
import { toast } from 'sonner';
import LogoImage from "../../../assets/Logo.png";
import {
    describePushSupport,
    ensureFcmTokenRegistered,
    startForegroundPushListener
} from '@core/firebase/pushClient';

const TEST_PUSH_STATUS_POLL_INTERVAL_MS = 1500;
const TEST_PUSH_STATUS_MAX_ATTEMPTS = 20;

const ProfilePage = () => {
    const navigate = useNavigate();
    const { user, role, logout } = useAuth();
    const { settings } = useSettings();
    const logoUrl = settings?.logoUrl || LogoImage;
    const appName = settings?.appName || 'App';
    const [isTestingPush, setIsTestingPush] = React.useState(false);

    const formatIndiaPhone = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (raw.startsWith('+91')) return raw.replace(/^\+91[\s-]*/, '');
        if (raw.startsWith('91') && raw.length >= 12) return raw.replace(/^91[\s-]*/, '');
        return raw;
    };

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const waitForTestPushResult = async (orderId) => {
        for (let attempt = 0; attempt < TEST_PUSH_STATUS_MAX_ATTEMPTS; attempt += 1) {
            const statusRes = await customerApi.getTestPushNotificationStatus(orderId);
            const result = statusRes?.data?.result || {};
            const status = String(result.status || '').trim().toLowerCase();

            if (status === 'sent' || status === 'failed') {
                return result;
            }

            if (attempt < TEST_PUSH_STATUS_MAX_ATTEMPTS - 1) {
                await wait(TEST_PUSH_STATUS_POLL_INTERVAL_MS);
            }
        }
        return null;
    };

    const handleTestPush = async () => {
        if (isTestingPush) return;
        setIsTestingPush(true);
        try {
            const support = describePushSupport();
            if (!support.supported) {
                throw new Error(support.message || 'Push notifications are not supported on this device/browser setup.');
            }

            await ensureFcmTokenRegistered({ role, platform: 'web' });
            await startForegroundPushListener();
            const res = await customerApi.testPushNotification();
            const orderId = res?.data?.result?.orderId || '';
            if (!orderId) {
                toast.success('Test push triggered');
                return;
            }

            const statusResult = await waitForTestPushResult(orderId);
            if (!statusResult) {
                toast.message(`Test push processing (${orderId})`, {
                    description: 'Notification delivery is taking longer than expected.',
                });
                return;
            }

            if (statusResult.status === 'sent') {
                toast.success(`Test push sent (${orderId})`, {
                    description: 'MongoDB status is marked as sent.',
                });
                return;
            }

            toast.error(`Test push failed (${orderId})`, {
                description: String(statusResult.failureReason || 'Notification delivery failed.'),
            });
        } catch (error) {
            const message = error?.response?.data?.message || error?.message || 'Unknown error';
            toast.error('Failed to trigger test push', {
                description: message,
            });
        } finally {
            setIsTestingPush(false);
        }
    };

    return (
        <div className="min-h-screen bg-white pb-24 md:pb-8 font-sans">

            <div className="sticky top-0 z-30 bg-[#1a6e2e] px-4 pt-4 pb-3 border-b border-[#1a6e2e] mb-4 flex items-center justify-between gap-2">

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-10 h-10 flex items-center justify-center hover:bg-slate-200/70 rounded-full transition-colors -ml-1"
                    >
                        <ChevronLeft size={22} className="text-white" />
                    </button>
                    <h1 className="text-xl font-semibold text-white tracking-tight">My Profile</h1>
                </div>
                <div className="flex items-center gap-4 ml-auto">
                    <div className="hidden md:flex items-center gap-0 cursor-pointer" onClick={() => navigate("/")}>
                        <img
                            src={logoUrl}
                            alt="Athreya Delivery Logo"
                            className="h-10 md:h-12 w-auto object-contain -mr-2 md:-mr-3"
                        />
                        <span className="text-sm md:text-base font-black tracking-tight flex gap-1">
                            <span className="text-white">ATHREYA</span>
                            <span className="text-white">DELIVERY</span>
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={handleTestPush}
                        disabled={isTestingPush}
                        title="Test push notification"
                        className="w-10 h-10 flex items-center justify-center rounded-full transition-colors bg-transparent border-none disabled:opacity-60 disabled:cursor-not-allowed text-white"
                    >
                        <Bell size={18} className={isTestingPush ? "opacity-50" : "text-white"} />
                    </button>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 pt-1 relative z-20 space-y-4">

                {/* User Identity Card */}
                <div className="bg-white p-4 border border-[#1a6e2e]/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-14 w-14 rounded-xl bg-slate-100 flex items-center justify-center p-1 border border-slate-200">
                            <div className="h-full w-full rounded-lg bg-white flex items-center justify-center overflow-hidden">
                                <User size={28} className="text-slate-700" />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-base leading-tight font-semibold text-slate-900">{user?.name || 'Customer'}</h2>
                            <p className="text-slate-500 text-xs font-medium flex items-center gap-1 mt-0.5">
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] uppercase">India</span> +91 {formatIndiaPhone(user?.phone)}
                            </p>
                        </div>
                    </div>
                    <Link to="/profile/edit" className="p-2.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                        <Edit2 size={16} />
                    </Link>
                </div>

                {/* Menu Sections */}
                <div className="space-y-4">
                    {/* Account Section */}
                    <div className="bg-white overflow-hidden border border-[#1a6e2e]/20">
                        <div className="px-4 py-3 bg-white border-b border-[#1a6e2e]/10">
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Personal Account</p>
                        </div>
                        <div className="divide-y divide-slate-100">
                            <MenuItem
                                icon={Package}
                                label="Your Orders"
                                sub="Track, return or buy things again"
                                path="/orders"
                            />
                            <MenuItem
                                icon={CreditCard}
                                label="Order Transactions"
                                sub="View all payments & refunds"
                                path="/transactions"
                            />
                            <MenuItem
                                icon={Wallet}
                                label="Wallet"
                                sub="Balance & return refunds"
                                path="/wallet"
                            />
                            <MenuItem
                                icon={Heart}
                                label="Your Wishlist"
                                sub="Your saved items"
                                path="/wishlist"
                            />
                            <MenuItem
                                icon={MapPin}
                                label="Saved Addresses"
                                sub="Manage your delivery locations"
                                path="/addresses"
                            />
                        </div>
                    </div>

                    {/* Support Section */}
                    <div className="bg-white overflow-hidden border border-[#1a6e2e]/20">
                        <div className="px-4 py-3 bg-white border-b border-[#1a6e2e]/10">
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Help & Settings</p>
                        </div>
                        <div className="divide-y divide-slate-100">
                            <MenuItem
                                icon={HelpCircle}
                                label="Help & Support"
                                path="/support"
                            />
                            <MenuItem
                                icon={ShieldCheck}
                                label="Privacy Policy"
                                path="/privacy"
                            />
                            <MenuItem
                                icon={Info}
                                label="About Us"
                                path="/about"
                            />
                        </div>
                    </div>
                </div>

                {/* Logout Button */}
                <button
                    onClick={logout}
                    className="w-full py-3 border-none text-white font-semibold bg-[#1a6e2e] transition-colors flex items-center justify-center gap-2 mt-2"
                >
                    <LogOut size={20} />
                    Sign out
                </button>

                <div className="text-center pb-8">
                    <p className="text-[10px] text-slate-400 font-medium">Version 2.4.0 - {appName}</p>
                </div>

            </div>
        </div>
    );
};

const MenuItem = ({ icon: Icon, label, sub, path, color = '#1a6e2e', bg = 'rgba(26,110,46,0.1)' }) => (
    <Link to={path || '#'} className="px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors group">
        <div className="flex items-center gap-3">
            <div
                className="h-10 w-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: bg }}
            >
                <Icon
                    size={20}
                    className="transition-colors"
                    style={{ color }}
                />
            </div>
            <div>
                <h3 className="text-sm font-semibold text-slate-800">{label}</h3>
                {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
            </div>
        </div>
        <div className="p-1.5 rounded-md group-hover:bg-slate-100 transition-colors">
            <ChevronRight size={16} className="text-slate-400 group-hover:text-slate-600 transition-all group-hover:translate-x-0.5" />
        </div>
    </Link>
);

export default ProfilePage;


