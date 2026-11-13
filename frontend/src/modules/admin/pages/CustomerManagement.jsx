import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import PageHeader from '@shared/components/ui/PageHeader';
import StatCard from '@shared/components/ui/StatCard';
import {
    Users,
    Search,
    Download,
    Eye,
    Phone,
    ShoppingBag,
    MoreVertical,
    UserRoundCheck,
    UserRoundX,
    Trash2,
    UserPlus,
    RotateCw,
    Activity,
    Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import Pagination from '@shared/components/ui/Pagination';
import { adminApi } from '../services/adminApi';
import { toast } from 'sonner';

const CustomerManagement = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [isExporting, setIsExporting] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [activeDropdownId, setActiveDropdownId] = useState(null);
    const [dropdownPosition, setDropdownPosition] = useState(null);
    const [updatingCustomerId, setUpdatingCustomerId] = useState(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchCustomers(1);
        }, 500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageSize, searchTerm, filterStatus]);
    const fetchCustomers = async (requestedPage = 1) => {
        try {
            setLoading(true);
            const params = { page: requestedPage, limit: pageSize };
            if (searchTerm.trim()) params.search = searchTerm.trim();
            if (filterStatus !== 'all') params.status = filterStatus;
            const { data } = await adminApi.getUsers(params);
            if (data.success) {
                const payload = data.result || {};
                const list = Array.isArray(payload.items) ? payload.items : (data.results || []);
                setCustomers(list);
                if (typeof payload.total === 'number') {
                    setTotal(payload.total);
                } else {
                    setTotal(list.length);
                }
                if (typeof payload.page === 'number') {
                    setPage(payload.page);
                } else {
                    setPage(requestedPage);
                }
            }
        } catch (error) {
            console.error("Error fetching customers:", error);
            toast.error("Failed to load customers");
        } finally {
            setLoading(false);
        }
    };

    const stats = useMemo(() => {
        const safeCustomers = Array.isArray(customers) ? customers : [];
        return {
            total: total,
            active: safeCustomers.filter(c => c.status === 'active').length,
            newToday: safeCustomers.filter(c => {
                const today = new Date().toISOString().split('T')[0];
                const joined = new Date(c.joinedDate).toISOString().split('T')[0];
                return joined === today;
            }).length
        };
    }, [customers, total]);

    const filteredCustomers = useMemo(() => {
        const safeCustomers = Array.isArray(customers) ? customers : [];
        return safeCustomers.filter(c => {
            const matchesSearch = (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (c.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (c.phone || '').includes(searchTerm);
            const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [customers, searchTerm, filterStatus]);

    const handleExport = () => {
        setIsExporting(true);
        setTimeout(() => {
            setIsExporting(false);
            toast.success('Customer database exported successfully!');
        }, 1500);
    };

    const handleCustomerStatus = async (customer, isActive) => {
        const id = customer.id || customer._id;
        try {
            setUpdatingCustomerId(id);
            await adminApi.updateUser(id, { isActive });
            toast.success(`Customer ${isActive ? 'activated' : 'deactivated'}`);
            await fetchCustomers(page);
        } catch (error) {
            console.error('Failed to update customer status:', error);
            toast.error(error.response?.data?.message || 'Failed to update customer status');
        } finally {
            setUpdatingCustomerId(null);
            setActiveDropdownId(null);
            setDropdownPosition(null);
        }
    };

    const handleDeleteCustomer = async (customer) => {
        const id = customer.id || customer._id;
        if (!window.confirm(`Delete ${customer.name || 'this customer'}? This will remove them from the customer list.`)) return;
        try {
            setUpdatingCustomerId(id);
            await adminApi.deleteUser(id);
            toast.success('Customer deleted');
            await fetchCustomers(page);
        } catch (error) {
            console.error('Failed to delete customer:', error);
            toast.error(error.response?.data?.message || 'Failed to delete customer');
        } finally {
            setUpdatingCustomerId(null);
            setActiveDropdownId(null);
            setDropdownPosition(null);
        }
    };

    const getTimeAgo = (date) => {
        if (!date) return 'Never';
        const now = new Date();
        const past = new Date(date);
        const diffInMs = now - past;
        const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));

        if (diffInHours < 1) return 'Recently';
        if (diffInHours < 24) return `${diffInHours}h ago`;
        const diffInDays = Math.floor(diffInHours / 24);
        return `${diffInDays}d ago`;
    };

    return (
        <div className="ds-section-spacing">
            <PageHeader
                title="Customers"
                description="Manage and track all customer accounts"
                badge={
                    <div className="ds-stat-card-icon bg-brand-50">
                        <Users className="ds-icon-lg text-brand-600" />
                    </div>
                }
                actions={
                    <>
                        <button
                            onClick={handleExport}
                            disabled={isExporting}
                            className="ds-btn ds-btn-md bg-white ring-1 ring-gray-200 text-gray-700 hover:bg-gray-50"
                        >
                            {isExporting ? <RotateCw className="ds-icon-sm animate-spin" /> : <Download className="ds-icon-sm" />}
                            {isExporting ? 'EXPORTING...' : 'EXPORT'}
                        </button>
                        <button className="ds-btn ds-btn-md bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                            <UserPlus className="ds-icon-sm" />
                            NEW CUSTOMER
                        </button>
                    </>
                }
            />

            {/* Quick Stats Grid */}
            <div className="ds-grid-cards-3">
                <StatCard
                    label="Total Customers"
                    value={stats.total}
                    icon={Users}
                    color="text-brand-600"
                    bg="bg-brand-50"
                />
                <StatCard
                    label="Active Users"
                    value={stats.active}
                    icon={Activity}
                    color="text-brand-600"
                    bg="bg-brand-50"
                />
                <StatCard
                    label="New Today"
                    value={stats.newToday}
                    icon={UserPlus}
                    color="text-brand-600"
                    bg="bg-brand-50"
                />
            </div>

            {/* Filter & Search Bar */}
            <Card className="ds-card-compact">
                <div className="flex flex-col lg:flex-row gap-3">
                    <div className="flex-1 relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 ds-icon-sm text-gray-400 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Search by name, email or phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="ds-input pl-9"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex bg-gray-100 p-0.5 rounded-lg">
                            {['all', 'active', 'inactive'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-md ds-caption transition-all",
                                        filterStatus === status ? "bg-white text-primary shadow-sm" : "text-gray-400 hover:text-gray-600"
                                    )}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </Card>

            {/* Customer List Table */}
            <Card className="overflow-hidden relative min-h-[400px]">
                {loading && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-8 w-8 text-primary animate-spin" />
                            <p className="ds-caption text-gray-500 font-medium">Loading Customers...</p>
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="ds-table">
                        <thead className="ds-table-header">
                            <tr>
                                <th className="ds-table-header-cell">Customer</th>
                                <th className="ds-table-header-cell">Activity</th>
                                <th className="ds-table-header-cell">Total Spend</th>
                                <th className="ds-table-header-cell">Status</th>
                                <th className="ds-table-header-cell text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!loading && filteredCustomers.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-4 bg-gray-50 rounded-full">
                                                <Users className="h-8 w-8 text-gray-300" />
                                            </div>
                                            <p className="ds-h4 text-gray-400">No customers found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredCustomers.map((cust) => (
                                    <tr key={cust.id} className="ds-table-row">
                                        <td className="ds-table-cell">
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src="https://cdn-icons-png.flaticon.com/512/149/149071.png"
                                                    alt=""
                                                    className="h-10 w-10 rounded-lg bg-gray-100 ring-2 ring-white shadow-sm object-cover"
                                                />
                                                <div>
                                                    <p
                                                        onClick={() => navigate(`/admin/customers/${cust.id}`)}
                                                        className="ds-h4 hover:text-primary cursor-pointer transition-colors"
                                                    >
                                                        {cust.name}
                                                    </p>
                                                    <p className="ds-body-sm text-gray-500">{cust.email || 'No email'}</p>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <Phone className="ds-icon-sm text-gray-300" />
                                                        <span className="text-[9px] text-gray-400">{cust.phone}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="ds-table-cell">
                                            <div>
                                                <div className="flex items-center gap-1.5 ds-body font-semibold">
                                                    <ShoppingBag className="ds-icon-sm text-primary" />
                                                    {cust.totalOrders} Orders
                                                </div>
                                                <p className="ds-body-sm text-gray-400 mt-0.5">Last: {getTimeAgo(cust.lastOrderDate)}</p>
                                            </div>
                                        </td>
                                        <td className="ds-table-cell ds-h4">
                                            ₹{(cust.totalSpent || 0).toLocaleString()}
                                        </td>
                                        <td className="ds-table-cell">
                                            <Badge
                                                variant={cust.status === 'active' ? 'success' : 'error'}
                                                className="ds-badge"
                                            >
                                                {cust.status}
                                            </Badge>
                                        </td>
                                        <td className="ds-table-cell text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => navigate(`/admin/customers/${cust.id}`)}
                                                    aria-label={`View ${cust.name}`}
                                                    className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary hover:text-white transition-all"
                                                >
                                                    <Eye className="ds-icon-sm" />
                                                </button>
                                                <div className="relative">
                                                    <button
                                                        type="button"
                                                        aria-label={`More actions for ${cust.name}`}
                                                        aria-haspopup="menu"
                                                        aria-expanded={activeDropdownId === (cust.id || cust._id)}
                                                        disabled={updatingCustomerId === (cust.id || cust._id)}
                                                        onClick={(event) => {
                                                            const id = cust.id || cust._id;
                                                            if (activeDropdownId === id) {
                                                                setActiveDropdownId(null);
                                                                setDropdownPosition(null);
                                                                return;
                                                            }
                                                            const rect = event.currentTarget.getBoundingClientRect();
                                                            const menuHeight = 104;
                                                            const opensAbove = rect.bottom + menuHeight > window.innerHeight;
                                                            setDropdownPosition({
                                                                top: opensAbove ? Math.max(8, rect.top - menuHeight - 8) : rect.bottom + 8,
                                                                right: Math.max(8, window.innerWidth - rect.right),
                                                            });
                                                            setActiveDropdownId(id);
                                                        }}
                                                        className="p-2 bg-gray-50 text-gray-400 rounded-lg hover:bg-gray-900 hover:text-white transition-all disabled:opacity-50"
                                                    >
                                                        <MoreVertical className="ds-icon-sm" />
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {activeDropdownId && dropdownPosition && createPortal(
                    <>
                        <button
                            type="button"
                            aria-label="Close actions menu"
                            className="fixed inset-0 z-[99] cursor-default"
                            onClick={() => { setActiveDropdownId(null); setDropdownPosition(null); }}
                        />
                        <div
                            role="menu"
                            style={{ top: dropdownPosition.top, right: dropdownPosition.right }}
                            className="fixed z-[100] w-48 rounded-xl border border-gray-100 bg-white p-1.5 text-left shadow-xl"
                        >
                            {(() => {
                                const customer = customers.find((item) => (item.id || item._id) === activeDropdownId);
                                if (!customer) return null;
                                return <>
                                    <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => handleCustomerStatus(customer, customer.status !== 'active')}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                        {customer.status === 'active' ? <UserRoundX className="h-4 w-4" /> : <UserRoundCheck className="h-4 w-4" />}
                                        {customer.status === 'active' ? 'Deactivate' : 'Activate'}
                                    </button>
                                    <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => handleDeleteCustomer(customer)}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Delete customer
                                    </button>
                                </>;
                            })()}
                        </div>
                    </>,
                    document.body,
                )}
                <div className="px-6 py-3 border-t border-gray-100">
                    <Pagination
                        page={page}
                        totalPages={Math.ceil(total / pageSize) || 1}
                        total={total}
                        pageSize={pageSize}
                        onPageChange={(p) => fetchCustomers(p)}
                        onPageSizeChange={(newSize) => {
                            setPageSize(newSize);
                            setPage(1);
                        }}
                        loading={loading}
                    />
                </div>
            </Card>
        </div>
    );
};

export default CustomerManagement;
