// Comprehensive Order Management System
import ManualOrderForm from '../components/ManualOrderForm';
import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Pagination from '@shared/components/ui/Pagination';
import { adminApi } from '../services/adminApi';
import {
    Search,
    Filter,
    Truck,
    Eye,
    Download,
    Calendar,
    ArrowUpRight,
    Package,
    IndianRupee,
    ChevronDown,
    ShoppingBag,
    Clock,
    CheckCircle2,
    XCircle,
    Plus,
    X,
    User,
    Store,
    MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@shared/components/ui/Toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
    getLegacyStatusFromOrder,
    adminRouteMatchesOrder,
} from '@/shared/utils/orderStatus';

const OrdersList = () => {
    const { status = 'all' } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState('All Time'); // label shown on the button
    const [dateStart, setDateStart] = useState(''); // YYYY-MM-DD (India date), '' = no limit
    const [dateEnd, setDateEnd] = useState('');
    const [pickMode, setPickMode] = useState('day'); // day | month | year
    const [orders, setOrders] = useState([]);
    const [summary, setSummary] = useState({
        totalOrders: 0,
        totalAmount: 0,
        pending: 0,
        confirmed: 0,
        packed: 0,
        outForDelivery: 0,
        delivered: 0,
        cancelled: 0,
        returned: 0,
        activeOrders: 0,
    });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);

    // WhatsApp Manual Order Creation State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isSubmittingManual, setIsSubmittingManual] = useState(false);
    const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(false);
    const [customersList, setCustomersList] = useState([]);
    const [sellersList, setSellersList] = useState([]);
    const [ridersList, setRidersList] = useState([]);
    const [manualFormData, setManualFormData] = useState({
        customerId: '',
        sellerId: '',
        deliveryBoyId: '',
        address: '',
        notes: '',
        totalAmount: '',
        deliveryFee: '',
        paymentMode: 'COD',
    });

    const openCreateModal = () => setIsCreateModalOpen(true);

    const handleCreateManualOrder = async (e) => {
        e.preventDefault();
        if (!manualFormData.customerId) return showToast("Please select a customer", "warning");
        if (!manualFormData.sellerId) return showToast("Please select a seller", "warning");

        setIsSubmittingManual(true);
        try {
            const res = await adminApi.createManualOrder({
                customerId: manualFormData.customerId,
                sellerId: manualFormData.sellerId,
                deliveryBoyId: manualFormData.deliveryBoyId || undefined,
                address: manualFormData.address || undefined,
                totalAmount: Number(manualFormData.totalAmount || 0),
                deliveryFee: manualFormData.deliveryFee !== "" ? Number(manualFormData.deliveryFee) : undefined,
                paymentMode: manualFormData.paymentMode,
                notes: manualFormData.notes || "WhatsApp Order",
            });

            if (res.data?.success || res.status === 201) {
                showToast("WhatsApp Order created and assigned successfully!", "success");
                setIsCreateModalOpen(false);
                setManualFormData({
                    customerId: '',
                    sellerId: '',
                    deliveryBoyId: '',
                    address: '',
                    notes: '',
                    totalAmount: '',
                    deliveryFee: '',
                    paymentMode: 'COD',
                });
                fetchOrders(page);
            }
        } catch (error) {
            showToast(error.response?.data?.message || "Failed to create order", "error");
        } finally {
            setIsSubmittingManual(false);
        }
    };

    const handleCSVExport = () => {
        setIsExporting(true);
        try {
            const headers = ["Order ID", "Customer", "Seller", "Status", "Amount", "Date", "Payment"];
            const rows = orders.map(o => [
                o.id,
                o.customer,
                o.seller,
                o.status.toUpperCase(),
                `₹${o.amount}`,
                o.date,
                o.payment
            ]);

            const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `orders_${status}_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast("CSV Exported successfully", "success");
        } catch (error) {
            showToast("Export failed", "error");
        } finally {
            setIsExporting(false);
        }
    };

    // India calendar date helpers (the shop runs on IST regardless of the browser).
    const istYmd = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const addDays = (ymd, n) => {
        const d = new Date(`${ymd}T12:00:00+05:30`);
        d.setDate(d.getDate() + n);
        return istYmd(d);
    };
    const lastDayOfMonth = (y, m) => new Date(y, m, 0).getDate(); // m is 1-12
    const prettyDay = (ymd) =>
        new Date(`${ymd}T12:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    const applyRange = (label, start, end) => {
        setDateRange(label);
        setDateStart(start);
        setDateEnd(end);
        setPage(1);
        setIsDateMenuOpen(false);
    };

    const applyPreset = (range) => {
        const today = istYmd();
        if (range === 'All Time') return applyRange('All Time', '', '');
        if (range === 'Today') return applyRange('Today', today, today);
        if (range === 'Yesterday') return applyRange('Yesterday', addDays(today, -1), addDays(today, -1));
        if (range === 'Last 7 Days') return applyRange('Last 7 Days', addDays(today, -6), today);
        if (range === 'This Month') {
            const [y, m] = today.split('-').map(Number);
            return applyRange('This Month', `${y}-${String(m).padStart(2, '0')}-01`, `${y}-${String(m).padStart(2, '0')}-${lastDayOfMonth(y, m)}`);
        }
        return null;
    };

    const applyDay = (ymd) => ymd && applyRange(prettyDay(ymd), ymd, ymd);
    const applyMonth = (ym) => {
        if (!ym) return;
        const [y, m] = ym.split('-').map(Number);
        const label = new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        applyRange(label, `${ym}-01`, `${ym}-${lastDayOfMonth(y, m)}`);
    };
    const applyYear = (y) => y && applyRange(String(y), `${y}-01-01`, `${y}-12-31`);

    const fetchOrders = async (requestedPage = 1) => {
        setIsLoading(true);
        try {
            const params = { page: requestedPage, limit: pageSize };
            if (status !== 'all') params.status = status;
            if (searchTerm.trim()) params.search = searchTerm.trim();
            if (dateStart) params.startDate = dateStart;
            if (dateEnd) params.endDate = dateEnd;
            const response = await adminApi.getOrders(params);
            if (response.data.success) {
                const payload = response.data.result || {};
                const dbOrders = Array.isArray(payload.items) ? payload.items : (response.data.results || []);
                const formatted = dbOrders.map(o => ({
                    id: o.orderId || 'UNSET',
                    _id: o._id,
                    customer: o.customer?.name || 'Unknown',
                    seller: o.seller?.shopName || 'Unknown',
                    items: o.items?.length || 0,
                    orderType: o.orderType || 'regular',
                    amount: o.pricing?.total || 0,
                    status: getLegacyStatusFromOrder(o),
                    workflowStatus: o.workflowStatus,
                    workflowVersion: o.workflowVersion,
                    returnStatus: o.returnStatus,
                    date: new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
                    payment: o.payment?.method === 'cod' ? 'COD' : 'Digital',
                }));
                setOrders(formatted);
                setSummary({
                    totalOrders: Number(payload.summary?.totalOrders || payload.total || formatted.length || 0),
                    totalAmount: Number(payload.summary?.totalAmount || 0),
                    pending: Number(payload.summary?.pending || 0),
                    confirmed: Number(payload.summary?.confirmed || 0),
                    packed: Number(payload.summary?.packed || 0),
                    outForDelivery: Number(payload.summary?.outForDelivery || 0),
                    delivered: Number(payload.summary?.delivered || 0),
                    cancelled: Number(payload.summary?.cancelled || 0),
                    returned: Number(payload.summary?.returned || 0),
                    activeOrders: Number(payload.summary?.activeOrders || 0),
                });
                if (typeof payload.total === 'number') {
                    setTotal(payload.total);
                } else {
                    setTotal(formatted.length);
                }
                if (typeof payload.page === 'number') {
                    setPage(payload.page);
                } else {
                    setPage(requestedPage);
                }
            }
        } catch (error) {
            console.error("Fetch orders error:", error);
            showToast("Failed to load orders", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleStatusUpdate = async (orderId, newStatus) => {
        const payload = { status: newStatus };

        // Cancellation policy: every cancellation needs a reason on record —
        // the backend now rejects a cancel with none.
        if (newStatus === "cancelled") {
            const reason = window.prompt("Reason for cancelling this order:");
            if (!reason || !reason.trim()) {
                showToast("A cancellation reason is required", "error");
                return;
            }
            payload.reason = reason.trim();
        }

        try {
            await adminApi.updateOrderStatus(orderId, payload);
            showToast(`Order status updated to ${newStatus}`, "success");
            fetchOrders(); // Refresh table
        } catch (error) {
            console.error("Failed to update status:", error);
            showToast(error.response?.data?.message || "Failed to update status", "error");
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchOrders(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [pageSize, status, searchTerm, dateStart, dateEnd]);

    const safeOrders = useMemo(
        () => (Array.isArray(orders) ? orders : []),
        [orders]
    );

    const stats = useMemo(() => {
        const totalEarnings = summary.totalAmount;
        const activeOrders = summary.activeOrders;

        return [
            { label: 'Total Earnings', value: `₹${totalEarnings.toLocaleString('en-IN')}`, trend: '+12.5%', icon: IndianRupee, color: 'emerald' },
            { label: 'Active Orders', value: activeOrders, trend: '+5', icon: ShoppingBag, color: 'blue' },
            { label: 'Average Prep Time', value: '18m', trend: '-2m', icon: Clock, color: 'amber' },
            { label: 'Delivery Rate', value: '98.2%', trend: '+0.4%', icon: CheckCircle2, color: 'fuchsia' },
        ];
    }, [summary]);

    const filteredOrders = useMemo(() => {
        return safeOrders.filter(order => {
            const safeLower = (value) => String(value || '').toLowerCase();
            const query = safeLower(searchTerm);
            const matchesSearch =
                safeLower(order.id).includes(query) ||
                safeLower(order.customer).includes(query) ||
                safeLower(order.seller).includes(query);

            const matchesStatus = adminRouteMatchesOrder(status, order);

            return matchesSearch && matchesStatus;
        });
    }, [safeOrders, searchTerm, status]);

    const getStatusStyles = (status) => {
        switch (String(status || '').toLowerCase()) {
            case 'pending': return 'bg-amber-100 text-amber-600 border-amber-200';
            case 'confirmed': return 'bg-brand-100 text-brand-600 border-brand-200';
            case 'packed': return 'bg-brand-100 text-brand-600 border-brand-200';
            case 'out_for_delivery': return 'bg-purple-100 text-purple-600 border-purple-200';
            case 'delivered': return 'bg-brand-100 text-brand-600 border-brand-200';
            case 'cancelled': return 'bg-rose-100 text-rose-600 border-rose-200';
            case 'returned': return 'bg-slate-100 text-slate-600 border-slate-200';
            default: return 'bg-gray-100 text-gray-600 border-gray-200';
        }
    };

    const handleExport = () => {
        if (safeOrders.length === 0) {
            showToast('No data to export', 'warning');
            return;
        }

        const headers = ['Order ID', 'Date', 'Customer', 'Seller', 'Items', 'Amount', 'Status', 'Payment'];
        const csvContent = [
            headers.join(','),
            ...safeOrders.map(o => [
                String(o.id || ''),
                String(o.date || '').replace(/,/g, ''),
                String(o.customer || '').replace(/,/g, ''),
                String(o.seller || '').replace(/,/g, ''),
                o.items,
                o.amount,
                o.status,
                o.payment
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `noyo-orders-${status}-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('Order ledger exported successfully', 'success');
    };

    const pageTitle = status === 'all' ? 'All Orders' : status.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1">
                <div>
                    <h1 className="ds-h1 flex items-center gap-3">
                        {pageTitle}
                        <div className="p-2 bg-fuchsia-100 rounded-xl">
                            <ShoppingBag className="h-5 w-5 text-fuchsia-600" />
                        </div>
                    </h1>
                    <p className="ds-description mt-1">View and manage all orders.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={openCreateModal}
                        className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-2xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200 active:scale-95"
                    >
                        <Plus className="h-4 w-4" />
                        CREATE WHATSAPP ORDER
                    </button>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-5 py-3 bg-white ring-1 ring-slate-200 text-slate-700 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <Download className="h-4 w-4 text-brand-500" />
                        EXPORT
                    </button>
                    <div className="h-10 w-px bg-slate-200 mx-1 hidden lg:block" />
                    <div className="relative">
                        <button
                            onClick={() => setIsDateMenuOpen(!isDateMenuOpen)}
                            className="flex items-center gap-2 px-5 py-3 bg-white ring-1 ring-slate-200 text-slate-700 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                        >
                            <Calendar className="h-4 w-4 text-brand-500" />
                            {dateRange}
                        </button>

                        <AnimatePresence>
                            {isDateMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setIsDateMenuOpen(false)} />
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl ring-1 ring-slate-100 p-2 z-20"
                                    >
                                        {['All Time', 'Today', 'Yesterday', 'Last 7 Days', 'This Month'].map((range) => (
                                            <button
                                                key={range}
                                                onClick={() => applyPreset(range)}
                                                className={cn(
                                                    "w-full text-left px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                                                    dateRange === range ? "bg-brand-50 text-brand-600" : "text-slate-500 hover:bg-slate-50"
                                                )}
                                            >
                                                {range}
                                            </button>
                                        ))}

                                        <div className="mt-2 pt-2 border-t border-slate-100 px-2 pb-1">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Pick a specific</p>
                                            <div className="grid grid-cols-3 gap-1 mb-2">
                                                {['day', 'month', 'year'].map((m) => (
                                                    <button
                                                        key={m}
                                                        type="button"
                                                        onClick={() => setPickMode(m)}
                                                        className={cn(
                                                            "py-1.5 rounded-lg text-[10px] font-black uppercase",
                                                            pickMode === m ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-500"
                                                        )}
                                                    >
                                                        {m}
                                                    </button>
                                                ))}
                                            </div>
                                            {pickMode === 'day' && (
                                                <input
                                                    type="date"
                                                    max={istYmd()}
                                                    value={dateStart && dateStart === dateEnd ? dateStart : ''}
                                                    onChange={(e) => applyDay(e.target.value)}
                                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700"
                                                />
                                            )}
                                            {pickMode === 'month' && (
                                                <input
                                                    type="month"
                                                    max={istYmd().slice(0, 7)}
                                                    onChange={(e) => applyMonth(e.target.value)}
                                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700"
                                                />
                                            )}
                                            {pickMode === 'year' && (
                                                <select
                                                    defaultValue=""
                                                    onChange={(e) => applyYear(e.target.value)}
                                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700"
                                                >
                                                    <option value="">-- Select year --</option>
                                                    {Array.from({ length: 6 }, (_, i) => Number(istYmd().slice(0, 4)) - i).map((y) => (
                                                        <option key={y} value={y}>{y}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Orders placed in the selected period */}
            {dateStart && (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl bg-brand-50 ring-1 ring-brand-100 px-5 py-4">
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Orders placed · {dateRange}</p>
                        <p className="text-3xl font-black text-slate-900 leading-tight">{summary.totalOrders}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                        <span className="px-3 py-1 rounded-full bg-white text-emerald-700 ring-1 ring-emerald-100">Delivered {summary.delivered}</span>
                        <span className="px-3 py-1 rounded-full bg-white text-blue-700 ring-1 ring-blue-100">Active {summary.activeOrders}</span>
                        <span className="px-3 py-1 rounded-full bg-white text-rose-700 ring-1 ring-rose-100">Cancelled {summary.cancelled}</span>
                        {summary.returned > 0 && <span className="px-3 py-1 rounded-full bg-white text-amber-700 ring-1 ring-amber-100">Returned {summary.returned}</span>}
                    </div>
                    <button
                        type="button"
                        onClick={() => applyPreset('All Time')}
                        className="ml-auto text-[11px] font-black text-brand-600 hover:underline"
                    >
                        Clear date filter
                    </button>
                </div>
            )}

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                    <Card key={i} className="p-5 border-none shadow-sm ring-1 ring-slate-100 bg-white group hover:ring-fuchsia-200 transition-all text-left">
                        <div className="flex items-center justify-between mb-4">
                            <div className={cn("p-2 rounded-xl", `bg-${stat.color}-50`)}>
                                <stat.icon className={cn("h-5 w-5", `text-${stat.color}-600`)} />
                            </div>
                            {stat.trend && (
                                <Badge variant="success" className="bg-brand-50 text-brand-600 border-none font-bold text-[10px]">
                                    {stat.trend}
                                </Badge>
                            )}
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                            <h3 className="text-2xl font-black text-slate-900">{stat.value}</h3>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Orders Table Section */}
            <Card className="border-none shadow-2xl ring-1 ring-slate-100/50 bg-white rounded-xl overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative group flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-fuchsia-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search by Order ID, Customer, or Shop..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-semibold outline-none focus:ring-2 focus:ring-fuchsia-500/10 transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        {status === 'processed' && (
                            <button
                                onClick={handleCSVExport}
                                disabled={isExporting}
                                className="flex items-center gap-2 px-4 py-2.5 bg-fuchsia-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-fuchsia-700 transition-all shadow-lg shadow-fuchsia-100 disabled:opacity-50"
                            >
                                <Download className={cn("h-3.5 w-3.5", isExporting && "animate-bounce")} />
                                {isExporting ? 'Exporting...' : 'Export CSV'}
                            </button>
                        )}
                        <button className="p-3 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition-all">
                            <Filter className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Order Details</th>
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Seller</th>
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="6" className="px-4 py-20 text-center">
                                        <div className="flex justify-center flex-col items-center gap-2">
                                            <div className="h-8 w-8 border-4 border-fuchsia-600 border-t-transparent rounded-full animate-spin"></div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Orders...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredOrders.length > 0 ? filteredOrders.map((order) => (
                                <tr key={order.id} className="group hover:bg-slate-50/30 transition-all cursor-pointer" onClick={() => navigate(`/admin/orders/view/${order.id}`)}>
                                    <td className="px-4 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-white group-hover:shadow-sm transition-all text-slate-400 group-hover:text-fuchsia-500 font-bold text-xs">
                                                <Package className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                                    #{order.id}
                                                    <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-all text-slate-400" />
                                                </h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {order.orderType === 'custom_pickup' ? (
                                                        <Badge className="bg-fuchsia-100 text-fuchsia-750 hover:bg-fuchsia-200 border-none text-[9px] font-bold py-0.5">
                                                            ⚡ Athreya Express
                                                        </Badge>
                                                    ) : order.orderType === 'whatsapp_order' ? (
                                                        <Badge className="bg-emerald-100 text-emerald-800 border-none text-[9px] font-bold py-0.5">
                                                            WhatsApp Order
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-[9px] font-bold border-slate-200 text-slate-400 py-0.5">
                                                            {order.items} {order.items > 1 ? 'Items' : 'Item'}
                                                        </Badge>
                                                    )}
                                                    <span className="text-[10px] font-bold text-slate-300">•</span>
                                                    <span className="text-[10px] font-bold text-slate-400">{order.date}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-5">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-brand-500" />
                                            <span className="text-xs font-black text-slate-700">{order.customer}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-5">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-brand-500" />
                                            <span className="text-xs font-black text-slate-700">{order.seller}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-5" onClick={(e) => e.stopPropagation()}>
                                        <div className="relative inline-block w-40">
                                            <select
                                                value={order.status}
                                                onChange={(e) => handleStatusUpdate(order._id, e.target.value)}
                                                className={cn(
                                                    "w-full text-[10px] pl-3 pr-8 py-2 rounded-xl font-black uppercase tracking-wider border appearance-none cursor-pointer focus:ring-2 focus:ring-offset-1 transition-all outline-none shadow-sm",
                                                    getStatusStyles(order.status)
                                                )}
                                            >
                                                <option value="pending">Pending</option>
                                                <option value="confirmed">Confirmed</option>
                                                <option value="packed">Packed</option>
                                                <option value="out_for_delivery">Out for Delivery</option>
                                                <option value="delivered">Delivered</option>
                                                <option value="cancelled">Cancelled</option>
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none opacity-60" />
                                        </div>
                                    </td>
                                    <td className="px-4 py-5 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="text-sm font-black text-slate-900">₹{order.amount.toLocaleString()}</span>
                                            <span className="text-[10px] font-bold text-slate-400 mt-0.5">{order.payment}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-5 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {status === 'processed' && order.status === 'confirmed' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleStatusUpdate(order._id, 'packed');
                                                    }}
                                                    className="flex items-center gap-2 px-4 py-2 bg-black  text-primary-foreground rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-brand-700 transition-all shadow-lg shadow-brand-100"
                                                >
                                                    <Package className="h-3.5 w-3.5" />
                                                    MARK PACKED
                                                </button>
                                            )}
                                            {status === 'processed' && order.status === 'packed' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleStatusUpdate(order._id, 'out_for_delivery');
                                                    }}
                                                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-purple-700 transition-all shadow-lg shadow-purple-100"
                                                >
                                                    <Truck className="h-3.5 w-3.5" />
                                                    DISPATCH
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/admin/orders/view/${order.id}`);
                                                }}
                                                className="p-2.5 bg-slate-50 text-slate-400 hover:text-fuchsia-600 hover:bg-fuchsia-100 rounded-xl transition-all"
                                                title="View Details"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="6" className="px-4 py-20 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center">
                                                <Search className="h-10 w-10 text-slate-200" />
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-black text-slate-300 uppercase tracking-tight">No Orders Found</h4>
                                                <p className="text-sm font-bold text-slate-300 mt-1">We couldn't find any orders matching your search.</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 border-t border-slate-50">
                    <Pagination
                        page={page}
                        totalPages={Math.ceil(total / pageSize) || 1}
                        total={total}
                        pageSize={pageSize}
                        onPageChange={(p) => fetchOrders(p)}
                        onPageSizeChange={(newSize) => {
                            setPageSize(newSize);
                            setPage(1);
                        }}
                        loading={isLoading}
                    />
                </div>
            </Card>

            {/* Create WhatsApp Order Modal */}
            <AnimatePresence>
                {isCreateModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100"
                        >
                            <div className="p-6 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md">
                                        <MessageSquare className="h-6 w-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black tracking-tight">Create WhatsApp Order</h3>
                                        <p className="text-xs text-emerald-100 font-medium">Search customer & shop, automatic delivery charge, smart rider assignment</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="p-2 text-white/80 hover:text-white bg-white/10 rounded-xl hover:bg-white/20 transition-all"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <ManualOrderForm
                                showToast={showToast}
                                onCancel={() => setIsCreateModalOpen(false)}
                                onCreated={() => {
                                    setIsCreateModalOpen(false);
                                    fetchOrders(page);
                                }}
                            />
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default OrdersList;
