import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Package, ChevronRight, CheckCircle, Loader2, ChevronLeft, XCircle, Clock, Sparkles } from 'lucide-react';
import { customerApi } from '../services/customerApi';
import { getOrderStatusLabel, getLegacyStatusFromOrder } from '@/shared/utils/orderStatus';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';
import { useSettings } from '@core/context/SettingsContext';
import LogoTransparent from "../../../assets/LogoTransparent.png";

/**
 * Helper to compute or extract Athreya Coins earned for an order.
 */
const getCoinsEarned = (order) => {
    if (order?.coins?.earned && Number(order.coins.earned) > 0) {
        return Math.floor(Number(order.coins.earned));
    }
    if (order?.coins?.savingsBase && Number(order.coins.savingsBase) > 0) {
        return Math.floor(Number(order.coins.savingsBase) * 10);
    }
    let itemsSaving = 0;
    if (Array.isArray(order?.items)) {
        order.items.forEach((item) => {
            const mrp = Number(item.mrp || item.originalPrice || item.price || 0);
            const price = Number(item.price || 0);
            const diff = Math.max(0, mrp - price);
            itemsSaving += diff * Number(item.quantity || 1);
        });
    }
    const totalSavings = itemsSaving + Number(order?.pricing?.discount || 0);
    if (totalSavings > 0) {
        return Math.floor(totalSavings * 10);
    }
    return 0;
};

const getStatusBadgeStyle = (legacy) => {
    switch (legacy) {
        case 'delivered':
            return {
                badge: 'bg-[#1a6e2e]/10 text-[#1a6e2e] border-[#1a6e2e]/20',
                iconBg: 'bg-white/80',
                iconColor: 'text-[#1a6e2e]',
                Icon: CheckCircle,
            };
        case 'cancelled':
            return {
                badge: 'bg-slate-100 text-slate-600 border-slate-200',
                iconBg: 'bg-white/80',
                iconColor: 'text-slate-500',
                Icon: XCircle,
            };
        case 'out_for_delivery':
            return {
                badge: 'bg-blue-50 text-blue-700 border-blue-200',
                iconBg: 'bg-white/80',
                iconColor: 'text-blue-600',
                Icon: Clock,
            };
        default:
            return {
                badge: 'bg-[#1a6e2e]/10 text-[#1a6e2e] border-[#1a6e2e]/20',
                iconBg: 'bg-white/80',
                iconColor: 'text-[#1a6e2e]',
                Icon: CheckCircle,
            };
    }
};

const OrdersPage = () => {
    const navigate = useNavigate();
    const { settings } = useSettings();
    const logoUrl = settings?.logoUrl || LogoTransparent;
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const response = await customerApi.getMyOrders();
                // Backend uses handleResponse():
                // - arrays => { results: [...] }
                // - objects => { result: { items: [...] } }
                const payload = response?.data;
                const items =
                    payload?.result?.items ||
                    payload?.results ||
                    [];
                setOrders(Array.isArray(items) ? items : []);
            } catch (error) {
                console.error("Failed to fetch orders:", error);
                const apiMessage = error?.response?.data?.message;
                // Orders page is a primary screen; surface failures instead of silently showing empty state.
                if (apiMessage) {
                    console.warn("[OrdersPage] API error:", apiMessage);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border border-[#1a6e2e]/20">
                    <Loader2 className="animate-spin text-[#1a6e2e]" size={22} />
                    <span className="text-sm font-medium text-slate-600">Loading your orders…</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white pb-24">

            <div className="sticky top-0 z-30 bg-white px-4 pt-4 pb-3 border-b border-[#1a6e2e]/20 mb-4 flex items-center justify-between gap-2">

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-10 h-10 flex items-center justify-center hover:bg-slate-200/70 rounded-full transition-colors -ml-1"
                    >
                        <ChevronLeft size={22} className="text-slate-800" />
                    </button>
                    <h1 className="text-xl font-semibold text-slate-900 tracking-tight">My Orders</h1>
                </div>
                <div className="hidden md:flex items-center gap-0 cursor-pointer" onClick={() => navigate("/")}>
                    <img
                        src={logoUrl}
                        alt="Athreya Delivery Logo"
                        className="h-10 md:h-12 w-auto object-contain -mr-2 md:-mr-3"
                    />
                    <span className="text-sm md:text-base font-black tracking-tight flex gap-1">
                        <span className="text-[#3a2a83]">ATHREYA</span>
                        <span className="text-[#f15a24]">DELIVERY</span>
                    </span>
                </div>
            </div>

            <div className="space-y-4 px-4 pb-2">
                {orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <Package size={56} className="text-slate-300 mb-4" />
                        <h3 className="text-base font-semibold text-slate-900 mb-1">No orders yet</h3>
                        <p className="text-slate-500 text-sm mb-6 max-w-[260px]">
                            When you place an order, it will appear here so you can track it easily.
                        </p>
                        <Link to="/" className="bg-[#1a6e2e] hover:bg-[#1a6e2e]/90 text-white px-7 py-2.5 rounded-full font-semibold text-sm transition-colors">
                            Start Shopping
                        </Link>
                    </div>
                ) : (
                    orders.map((order) => {
                        const legacy = getLegacyStatusFromOrder(order);
                        const statusStyle = getStatusBadgeStyle(legacy);
                        const StatusIcon = statusStyle.Icon;
                        const coinsEarned = getCoinsEarned(order);
                        const coinsRedeemed = Number(order?.coins?.redeemed || 0);

                        return (
                            <Link
                                to={`/orders/${order.orderId}`}
                                key={order._id}
                                className="block bg-white rounded-2xl p-4 border border-[#1a6e2e]/20 active:scale-[0.985] transition-transform cursor-pointer shadow-xs hover:border-[#1a6e2e]/40"
                            >
                                <div className="flex justify-between items-start gap-3 mb-3">
                                    <div className="flex gap-3.5 flex-1 min-w-0">
                                        <div className="h-12 w-12 rounded-xl overflow-hidden flex items-center justify-center bg-slate-50 ring-1 ring-slate-200/90 shrink-0">
                                            {order.items?.[0]?.image ? (
                                                <img
                                                    src={applyCloudinaryTransform(order.items[0].image)}
                                                    alt={order.items[0]?.name || 'Order thumbnail'}
                                                    loading="lazy"
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <Package size={22} className="text-slate-400" />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-semibold text-slate-900 text-sm tracking-tight leading-snug">
                                                Order #{order.orderId?.slice(-6)}
                                            </h3>
                                            <p className="mt-0.5 text-[11px] text-slate-500 font-medium leading-tight">
                                                {new Date(order.createdAt).toLocaleDateString('en-IN', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                })}{' '}
                                                <span className="mx-1 text-slate-400">•</span>
                                                {new Date(order.createdAt).toLocaleTimeString('en-IN', {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                                        <span
                                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${statusStyle.badge}`}
                                        >
                                            <span className={`flex h-4 w-4 items-center justify-center rounded-full ${statusStyle.iconBg}`}>
                                                <StatusIcon
                                                    size={10}
                                                    className={statusStyle.iconColor}
                                                />
                                            </span>
                                            <span>{getOrderStatusLabel(order).toUpperCase()}</span>
                                        </span>
                                        <span className="inline-flex items-center text-[10px] font-medium text-slate-400">
                                            <span className="h-1 w-1 rounded-full bg-slate-300 mr-1" />
                                            Tap to view details
                                        </span>
                                    </div>
                                </div>

                                <div className="border-t border-slate-100 pt-3 flex justify-between items-center gap-3">
                                    <div className="text-[11px] text-slate-500 font-medium truncate max-w-[200px] sm:max-w-[260px]">
                                        {Array.isArray(order.items) ? order.items.map((i) => i.name).join(', ') : ''}
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-[11px] font-medium text-slate-400">Total</span>
                                        <span className="text-sm font-semibold text-slate-900">
                                            ₹{order.pricing?.total ?? order.pricing?.payableAmount ?? 0}
                                        </span>
                                        <ChevronRight size={16} className="text-slate-300" />
                                    </div>
                                </div>

                                {/* Athreya Coins Earned Row */}
                                {coinsEarned > 0 && legacy !== 'cancelled' && (
                                    <div className="mt-3 pt-2.5 border-t border-dashed border-amber-200/90 flex items-center justify-between gap-2 bg-gradient-to-r from-amber-50/90 via-emerald-50/50 to-transparent -mx-4 -mb-4 px-4 py-2 rounded-b-2xl">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="text-xs leading-none">🪙</span>
                                            <span className="text-[11px] font-bold text-amber-950 truncate">
                                                {legacy === 'delivered' ? 'Earned' : 'You Earn'}{' '}
                                                <span className="text-[#0d592e] font-extrabold">
                                                    +{coinsEarned.toLocaleString('en-IN')} Athreya Coins
                                                </span>
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-bold text-[#0d592e] bg-white/95 px-2 py-0.5 rounded-full border border-emerald-200/80 shrink-0 shadow-2xs">
                                            ₹{(coinsEarned * 0.001).toFixed(2)} value
                                        </span>
                                    </div>
                                )}

                                {coinsRedeemed > 0 && coinsEarned === 0 && (
                                    <div className="mt-3 pt-2 border-t border-dashed border-emerald-200/60 flex items-center justify-between text-[11px] text-emerald-800 -mx-4 -mb-4 px-4 py-1.5 bg-emerald-50/40 rounded-b-2xl">
                                        <span>🪙 Redeemed {coinsRedeemed.toLocaleString('en-IN')} Coins</span>
                                        <span className="font-bold">-₹{Number(order?.coins?.redeemedValue || 0).toFixed(2)}</span>
                                    </div>
                                )}
                            </Link>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default OrdersPage;

