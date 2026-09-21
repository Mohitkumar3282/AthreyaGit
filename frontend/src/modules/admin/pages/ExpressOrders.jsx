// Athreya Express — admin management tab
// Lets ops see every Home-to-Home / Shop-to-Home / Cargo-to-Home / Rider Delivery /
// WhatsApp order, watch it move through rider search -> assigned -> delivered,
// and manually re-broadcast a job that no rider picked up.
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Pagination from '@shared/components/ui/Pagination';
import { adminApi } from '../services/adminApi';
import { toast } from 'sonner';
import {
    Zap,
    Search,
    Home,
    Store,
    Truck,
    Bike,
    MessageSquare,
    RotateCw,
    MapPin,
    Phone,
    Clock,
    ArrowUpRight,
    IndianRupee,
    User,
    Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const SERVICE_META = {
    home_to_home: { label: 'Home to Home', icon: Home, color: 'text-emerald-700 bg-emerald-100' },
    shop_to_home: { label: 'Shop to Home', icon: Store, color: 'text-blue-700 bg-blue-100' },
    cargo_to_home: { label: 'Cargo to Home', icon: Truck, color: 'text-orange-700 bg-orange-100' },
    rider_delivery: { label: 'Rider Pickup', icon: Bike, color: 'text-purple-700 bg-purple-100' },
    whatsapp: { label: 'WhatsApp Order', icon: MessageSquare, color: 'text-green-700 bg-green-100' },
};

const STATUS_TABS = [
    { key: 'all', label: 'All' },
    { key: 'searching', label: 'Finding Rider' },
    { key: 'active', label: 'Active' },
    { key: 'delivered', label: 'Delivered' },
    { key: 'cancelled', label: 'Cancelled' },
];

const STATUS_BADGE = {
    SELLER_PENDING: { label: 'Finding Rider', className: 'bg-amber-100 text-amber-800' },
    DELIVERY_SEARCH: { label: 'Finding Rider', className: 'bg-amber-100 text-amber-800' },
    DELIVERY_ASSIGNED: { label: 'Rider Assigned', className: 'bg-blue-100 text-blue-800' },
    PICKUP_READY: { label: 'Rider Assigned', className: 'bg-blue-100 text-blue-800' },
    OUT_FOR_DELIVERY: { label: 'On the Way', className: 'bg-indigo-100 text-indigo-800' },
    DELIVERED: { label: 'Delivered', className: 'bg-emerald-100 text-emerald-800' },
    CANCELLED: { label: 'Cancelled', className: 'bg-red-100 text-red-800' },
};

const ExpressOrders = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [summary, setSummary] = useState({ total: 0, searching: 0, active: 0, delivered: 0, cancelled: 0, revenue: 0, byService: {} });
    const [statusTab, setStatusTab] = useState('all');
    const [serviceFilter, setServiceFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize] = useState(25);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [rebroadcastingId, setRebroadcastingId] = useState(null);

    const fetchOrders = useCallback(async (targetPage = 1) => {
        setIsLoading(true);
        try {
            const params = { page: targetPage, limit: pageSize };
            if (statusTab !== 'all') params.status = statusTab;
            if (serviceFilter !== 'all') params.service = serviceFilter;
            if (searchTerm.trim()) params.search = searchTerm.trim();

            const res = await adminApi.getExpressOrders(params);
            if (res.data.success) {
                const payload = res.data.result || {};
                setOrders(Array.isArray(payload.items) ? payload.items : []);
                setTotal(typeof payload.total === 'number' ? payload.total : 0);
                setPage(typeof payload.page === 'number' ? payload.page : targetPage);
                if (payload.summary) setSummary(payload.summary);
            }
        } catch (error) {
            console.error('Failed to fetch Athreya Express orders:', error);
            toast.error('Failed to load Athreya Express orders');
        } finally {
            setIsLoading(false);
        }
    }, [statusTab, serviceFilter, searchTerm, pageSize]);

    useEffect(() => {
        fetchOrders(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusTab, serviceFilter]);

    useEffect(() => {
        const t = setTimeout(() => fetchOrders(1), 350);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm]);

    const handleRebroadcast = async (order) => {
        setRebroadcastingId(order.orderId);
        try {
            const res = await adminApi.rebroadcastExpressOrder(order.orderId);
            if (res.data.success) {
                toast.success(`Order #${order.orderId} sent to nearby riders again`);
                fetchOrders(page);
            } else {
                throw new Error(res.data.message || 'Failed to re-broadcast');
            }
        } catch (error) {
            toast.error(error?.response?.data?.message || error.message || 'Failed to re-broadcast order');
        } finally {
            setRebroadcastingId(null);
        }
    };

    const pickupLabel = (order) => {
        if (order.expressService === 'shop_to_home' && order.expressMeta?.shopName) return order.expressMeta.shopName;
        if (order.expressService === 'cargo_to_home' && order.expressMeta?.cargoPointName) return order.expressMeta.cargoPointName;
        return order.pickupAddress?.address || 'Pickup point';
    };

    // Home/Shop/Cargo carry items + weight; Rider Pickup carries a trip distance instead.
    const loadDetail = (order) => {
        const meta = order.expressMeta || {};
        if (order.expressService === 'rider_delivery') {
            return meta.distanceKm ? `${meta.distanceKm} km trip` : null;
        }
        const parts = [];
        if (meta.itemsCount) parts.push(`${meta.itemsCount} item${Number(meta.itemsCount) === 1 ? '' : 's'}`);
        if (meta.weight) parts.push(meta.weight);
        return parts.length ? parts.join(' • ') : null;
    };

    const canRebroadcast = (order) => {
        const ws = order.workflowStatus;
        return !order.deliveryBoy && (ws === 'SELLER_PENDING' || ws === 'DELIVERY_SEARCH');
    };

    return (
        <div className="space-y-6 pb-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <Zap className="h-6 w-6 text-amber-500" />
                        Athreya Express
                    </h1>
                    <p className="text-sm text-slate-500 font-medium mt-1">
                        Manage Home-to-Home, Shop-to-Home, Cargo-to-Home, Rider Delivery &amp; WhatsApp Express orders.
                    </p>
                </div>
                <Link
                    to="/admin/express/fare"
                    className="inline-flex items-center gap-1.5 self-start rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-800 transition-colors"
                >
                    <IndianRupee className="h-3.5 w-3.5" /> Fare Management
                </Link>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                    { label: 'Total Orders', value: summary.total, color: 'text-slate-900' },
                    { label: 'Finding Rider', value: summary.searching, color: 'text-amber-600' },
                    { label: 'Active', value: summary.active, color: 'text-blue-600' },
                    { label: 'Delivered', value: summary.delivered, color: 'text-emerald-600' },
                    { label: 'Cancelled', value: summary.cancelled, color: 'text-red-600' },
                    { label: 'Revenue', value: `₹${Math.round(summary.revenue || 0).toLocaleString('en-IN')}`, color: 'text-fuchsia-600' },
                ].map((s) => (
                    <Card key={s.label} className="p-4 rounded-2xl shadow-sm border-slate-100">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.label}</p>
                        <p className={cn('text-xl font-black mt-1', s.color)}>{s.value}</p>
                    </Card>
                ))}
            </div>

            {/* Service filter chips */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setServiceFilter('all')}
                    className={cn(
                        'px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all',
                        serviceFilter === 'all'
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    )}
                >
                    All Services ({summary.total})
                </button>
                {Object.entries(SERVICE_META).map(([key, meta]) => {
                    const Icon = meta.icon;
                    return (
                        <button
                            key={key}
                            onClick={() => setServiceFilter(key)}
                            className={cn(
                                'px-3.5 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1.5 transition-all',
                                serviceFilter === key
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                            )}
                        >
                            <Icon className="h-3.5 w-3.5" />
                            {meta.label} ({summary.byService?.[key] || 0})
                        </button>
                    );
                })}
            </div>

            {/* Status tabs + search */}
            <Card className="rounded-2xl shadow-sm border-slate-100 overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-slate-100">
                    <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
                        {STATUS_TABS.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setStatusTab(tab.key)}
                                className={cn(
                                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                                    statusTab === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search order ID, phone, LR number..."
                            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
                        />
                    </div>
                </div>

                {/* Order list */}
                <div className="divide-y divide-slate-100">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-20">
                            <div className="h-8 w-8 border-4 border-fuchsia-600 border-t-transparent rounded-full animate-spin" />
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Express Orders...</p>
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
                            <Zap className="h-10 w-10 text-slate-200" />
                            <p className="text-sm font-bold text-slate-400">No Athreya Express orders found</p>
                        </div>
                    ) : (
                        orders.map((order) => {
                            const meta = SERVICE_META[order.expressService] || SERVICE_META.home_to_home;
                            const Icon = meta.icon;
                            const statusBadge = STATUS_BADGE[order.workflowStatus] || { label: order.workflowStatus || order.status, className: 'bg-slate-100 text-slate-700' };
                            return (
                                <div
                                    key={order.orderId || order._id}
                                    className="p-4 hover:bg-slate-50/60 transition-all cursor-pointer group"
                                    onClick={() => navigate(`/admin/orders/view/${order.orderId}`)}
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', meta.color)}>
                                            <Icon className="h-5 w-5" />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="text-sm font-black text-slate-900 flex items-center gap-1">
                                                    #{order.orderId}
                                                    <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-all text-slate-400" />
                                                </h4>
                                                <Badge className={cn('border-none text-[9px] font-bold py-0.5', meta.color)}>
                                                    {meta.label}
                                                </Badge>
                                                <Badge className={cn('border-none text-[9px] font-bold py-0.5', statusBadge.className)}>
                                                    {statusBadge.label}
                                                </Badge>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-[11px] font-semibold text-slate-500">
                                                <span className="flex items-center gap-1"><User className="h-3 w-3" />{order.customer?.name || 'Customer'}</span>
                                                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />From: {pickupLabel(order)}</span>
                                                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />To: {order.address?.address || '—'}</span>
                                                {loadDetail(order) && (
                                                    <span className="flex items-center gap-1 text-slate-600 font-bold"><Package className="h-3 w-3" />{loadDetail(order)}</span>
                                                )}
                                                {order.deliveryBoy?.name && (
                                                    <span className="flex items-center gap-1"><Bike className="h-3 w-3" />{order.deliveryBoy.name}</span>
                                                )}
                                                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 shrink-0">
                                            <div className="text-right">
                                                <p className="text-sm font-black text-slate-900 flex items-center gap-0.5 justify-end">
                                                    <IndianRupee className="h-3.5 w-3.5" />
                                                    {Math.round(order.paymentBreakdown?.grandTotal || order.pricing?.total || 0)}
                                                </p>
                                                <p className="text-[10px] font-bold text-slate-400">{order.paymentMode || 'COD'}</p>
                                            </div>

                                            {canRebroadcast(order) && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRebroadcast(order);
                                                    }}
                                                    disabled={rebroadcastingId === order.orderId}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-fuchsia-50 text-fuchsia-700 text-[11px] font-bold hover:bg-fuchsia-100 transition-all disabled:opacity-50"
                                                    title="Send this order to nearby riders again"
                                                >
                                                    <RotateCw className={cn('h-3.5 w-3.5', rebroadcastingId === order.orderId && 'animate-spin')} />
                                                    Re-send to Riders
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {total > pageSize && (
                    <div className="p-4 border-t border-slate-100">
                        <Pagination
                            page={page}
                            total={total}
                            pageSize={pageSize}
                            totalPages={Math.ceil(total / pageSize) || 1}
                            onPageChange={(p) => fetchOrders(p)}
                            loading={isLoading}
                        />
                    </div>
                )}
            </Card>
        </div>
    );
};

export default ExpressOrders;
