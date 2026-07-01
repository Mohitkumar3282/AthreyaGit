import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import {
    ChevronLeft,
    Building2,
    User,
    Mail,
    Phone,
    MapPin,
    Star,
    Calendar,
    Wallet,
    TrendingUp,
    ShoppingBag,
    History,
    Banknote,
    Clock,
    ArrowUpRight,
    Edit3,
    MoreVertical,
    CheckCircle2,
    XCircle,
    RotateCw,
    Search,
    Download,
    Image,
    ShieldAlert,
    ExternalLink,
    Check,
    X,
    FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@shared/components/ui/Toast';
import Modal from '@shared/components/ui/Modal';
import { motion } from 'framer-motion';
import { adminApi } from '../services/adminApi';

const SellerDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState('info');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [seller, setSeller] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

    useEffect(() => {
        fetchSellerDetails();
    }, [id]);

    const fetchSellerDetails = async () => {
        setIsLoading(true);
        try {
            const response = await adminApi.getSellerById(id);
            setSeller(response.data.result);
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to fetch seller details', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await fetchSellerDetails();
            showToast('Seller data synchronized', 'success');
        } catch (error) {
            // Error already handled in fetchSellerDetails
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleApprove = async () => {
        try {
            await adminApi.approveSeller(id);
            showToast('Seller application approved successfully', 'success');
            fetchSellerDetails();
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to approve seller', 'error');
        }
    };

    const handleReject = async () => {
        if (!rejectionReason.trim()) {
            showToast('Please enter a rejection reason', 'error');
            return;
        }
        try {
            await adminApi.rejectSeller(id, { reason: rejectionReason });
            showToast('Seller application rejected', 'success');
            setIsRejectModalOpen(false);
            setRejectionReason('');
            fetchSellerDetails();
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to reject seller', 'error');
        }
    };

    const handleToggleHygiene = async () => {
        try {
            const newStatus = !seller.hygieneAssured;
            await adminApi.updateSeller(id, { hygieneAssured: newStatus });
            setSeller(prev => ({ ...prev, hygieneAssured: newStatus }));
            showToast(`Hygiene assurance set to ${newStatus ? 'ON' : 'OFF'}`, 'success');
        } catch (error) {
            showToast('Failed to update hygiene status', 'error');
        }
    };

    const handleToggleActive = async () => {
        try {
            const newStatus = !seller.isActive;
            await adminApi.updateSeller(id, { isActive: newStatus });
            setSeller(prev => ({ ...prev, isActive: newStatus }));
            showToast(`Store is now ${newStatus ? 'Active' : 'Inactive'}`, 'success');
        } catch (error) {
            showToast('Failed to update store status', 'error');
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
            </div>
        );
    }

    if (!seller) {
        return (
            <div className="text-center py-20">
                <p className="text-slate-500 font-bold">Seller not found</p>
                <button
                    onClick={() => navigate('/admin/sellers/active')}
                    className="mt-4 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold"
                >
                    Back to Directory
                </button>
            </div>
        );
    }

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 font-['Outfit']">
            {/* Header / Action Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(seller.applicationStatus === 'pending' ? '/admin/sellers/pending' : '/admin/sellers/active')}
                        className="p-2.5 bg-white ring-1 ring-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm group"
                    >
                        <ChevronLeft className="h-5 w-5 text-slate-500 group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black text-slate-900">{seller.shopName}</h1>
                            <Badge 
                                variant={seller.applicationStatus === 'approved' ? 'success' : seller.applicationStatus === 'rejected' ? 'danger' : 'warning'} 
                                className="text-[10px] font-black uppercase tracking-widest"
                            >
                                {seller.applicationStatus}
                            </Badge>
                        </div>
                        <p className="text-sm text-slate-500 font-medium mt-1">
                            Owned by {seller.name} • {seller.category || 'General'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRefresh}
                        className="flex items-center gap-2 px-5 py-3 bg-white ring-1 ring-slate-200 text-slate-700 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all"
                    >
                        <RotateCw className={cn("h-4 w-4 text-primary", isRefreshing && "animate-spin")} />
                        SYNC DATA
                    </button>
                    
                    {seller.applicationStatus === 'pending' && (
                        <>
                            <button
                                onClick={handleApprove}
                                className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-2xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-md"
                            >
                                <CheckCircle2 className="h-4 w-4" />
                                APPROVE
                            </button>
                            <button
                                onClick={() => setIsRejectModalOpen(true)}
                                className="flex items-center gap-2 px-5 py-3 bg-rose-600 text-white rounded-2xl text-xs font-bold hover:bg-rose-700 transition-all shadow-md"
                            >
                                <XCircle className="h-4 w-4" />
                                REJECT
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
                {[
                    { label: 'Wallet Balance', value: `₹${seller.walletBalance.toLocaleString()}`, icon: Wallet, color: 'emerald', sub: 'Settled Available' },
                    { label: 'Total Revenue', value: `₹${(seller.totalRevenue || 0).toLocaleString()}`, icon: TrendingUp, color: 'blue', sub: 'Gross Deliveries' },
                    { label: 'Orders Handled', value: seller.totalOrders || 0, icon: ShoppingBag, color: 'indigo', sub: 'Lifetime Orders' },
                    { label: 'Store Rating', value: `${seller.rating || 4.5} / 5.0`, icon: Star, color: 'amber', sub: 'Store Average' },
                ].map((stat, i) => (
                    <Card key={i} className="p-6 border-none shadow-xl ring-1 ring-slate-100 bg-white group hover:ring-primary/20 transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className={cn("p-2.5 rounded-2xl",
                                stat.color === 'emerald' && "bg-emerald-50 text-emerald-600",
                                stat.color === 'blue' && "bg-blue-50 text-blue-600",
                                stat.color === 'indigo' && "bg-indigo-50 text-indigo-600",
                                stat.color === 'amber' && "bg-amber-50 text-amber-600",
                            )}>
                                <stat.icon className="h-5 w-5" />
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.sub}</span>
                        </div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{stat.label}</h4>
                        <h3 className="text-2xl font-black text-slate-900">{stat.value}</h3>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                {/* Main Content Area */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Tabs Navigation */}
                    <div className="flex items-center gap-2 p-1 bg-slate-100/50 backdrop-blur-sm rounded-2xl w-fit">
                        {[
                            { id: 'info', label: 'Store Info', icon: Building2 },
                            { id: 'visuals', label: 'Store Media', icon: Image },
                            { id: 'verification', label: 'Controls & Safety', icon: ShieldAlert },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
                                    activeTab === tab.id
                                        ? "bg-white text-primary shadow-sm ring-1 ring-slate-200"
                                        : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                <tab.icon className="h-4 w-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden p-6 min-h-[450px]">
                        {activeTab === 'info' && (
                            <div className="space-y-8 animate-in fade-in duration-300">
                                <div>
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Operational Benchmarks</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Minimum Order</p>
                                            <p className="text-base font-black text-slate-900">₹{seller.minimumOrderAmount || 0}</p>
                                        </div>
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Delivery Fee</p>
                                            <p className="text-base font-black text-slate-900">₹{seller.deliveryFee || 30}</p>
                                        </div>
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Free Delivery Above</p>
                                            <p className="text-base font-black text-slate-900">₹{seller.freeDeliveryAbove || 499}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Store Timings & Contact</h4>
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3 text-slate-600">
                                                <Clock className="h-4 w-4 text-slate-400" />
                                                <span className="text-xs font-bold">{seller.storeTimings || "9:00 AM - 10:00 PM"}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-slate-600">
                                                <Phone className="h-4 w-4 text-slate-400" />
                                                <span className="text-xs font-bold">{seller.contactNumber || seller.phone}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">FSSAI / Documentation</h4>
                                        {seller.documents ? (
                                            <div className="space-y-2">
                                                {Object.entries(seller.documents).map(([key, val]) => val && (
                                                    <a 
                                                        key={key}
                                                        href={val} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200/50 text-xs font-bold text-slate-700 transition-colors"
                                                    >
                                                        <span className="uppercase tracking-wider">{key.replace(/([A-Z])/g, ' $1')}</span>
                                                        <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                                                    </a>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-slate-400 italic">No verification documents uploaded</p>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Description</h4>
                                    <p className="text-xs text-slate-600 leading-relaxed font-bold">
                                        {seller.businessDescription || seller.description || "No business description provided by the merchant."}
                                    </p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'visuals' && (
                            <div className="space-y-8 animate-in fade-in duration-300">
                                {/* Banner & Logo previews */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="md:col-span-2">
                                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Shop Banner</h5>
                                        <div className="w-full aspect-video rounded-xl bg-slate-100 overflow-hidden border border-slate-200">
                                            {seller.shopBanner ? (
                                                <img src={seller.shopBanner} alt="Banner" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-xs">No Banner</div>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Shop Logo</h5>
                                        <div className="w-full aspect-square rounded-xl bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center">
                                            {seller.shopLogo ? (
                                                <img src={seller.shopLogo} alt="Logo" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="text-slate-400 font-bold text-xs">No Logo</div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Store Front image */}
                                <div>
                                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Store Front Image (Verification)</h5>
                                    <div className="w-48 aspect-video rounded-xl bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center">
                                        {seller.storeFrontImage ? (
                                            <img src={seller.storeFrontImage} alt="Store Front" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="text-slate-400 font-bold text-xs">No Store Front Image</div>
                                        )}
                                    </div>
                                </div>

                                {/* Store Interior Images */}
                                <div>
                                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Interior Layouts</h5>
                                    {seller.storeInteriorImages && seller.storeInteriorImages.length > 0 ? (
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {seller.storeInteriorImages.map((img, idx) => (
                                                <div key={idx} className="aspect-video rounded-xl bg-slate-100 overflow-hidden border border-slate-200">
                                                    <img src={img} alt={`Interior ${idx + 1}`} className="w-full h-full object-cover" />
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-400 italic">No interior images uploaded</p>
                                    )}
                                </div>

                                {/* Shop Gallery Images */}
                                <div>
                                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Store Gallery</h5>
                                    {seller.shopGallery && seller.shopGallery.length > 0 ? (
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {seller.shopGallery.map((img, idx) => (
                                                <div key={idx} className="aspect-square rounded-xl bg-slate-100 overflow-hidden border border-slate-200">
                                                    <img src={img} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" />
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-400 italic">No gallery images uploaded</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'verification' && (
                            <div className="space-y-8 animate-in fade-in duration-300">
                                <div>
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Safety & Certification Badges</h4>
                                    <div className="flex items-center justify-between p-5 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                                        <div className="space-y-1">
                                            <p className="text-xs font-black text-emerald-950 uppercase tracking-wider">Hygiene Assured Status</p>
                                            <p className="text-xs text-emerald-700 font-bold">Showcases the hygiene/safety seal on customer storefront.</p>
                                        </div>
                                        <button
                                            onClick={handleToggleHygiene}
                                            className={cn(
                                                "w-12 h-6 rounded-full transition-colors relative",
                                                seller.hygieneAssured ? "bg-emerald-600" : "bg-slate-300"
                                            )}
                                        >
                                            <span className={cn(
                                                "w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform",
                                                seller.hygieneAssured ? "left-6.5" : "left-0.5"
                                            )} />
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Merchant Operations Status</h4>
                                    <div className="flex items-center justify-between p-5 bg-slate-50 border border-slate-200/60 rounded-2xl">
                                        <div className="space-y-1">
                                            <p className="text-xs font-black text-slate-900 uppercase tracking-wider">Visibility & Activation Status</p>
                                            <p className="text-xs text-slate-500 font-bold">Temporarily suspend or restore this seller within the marketplace.</p>
                                        </div>
                                        <button
                                            onClick={handleToggleActive}
                                            className={cn(
                                                "w-12 h-6 rounded-full transition-colors relative",
                                                seller.isActive ? "bg-slate-900" : "bg-slate-300"
                                            )}
                                        >
                                            <span className={cn(
                                                "w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform",
                                                seller.isActive ? "left-6.5" : "left-0.5"
                                            )} />
                                        </button>
                                    </div>
                                </div>

                                {seller.applicationStatus === 'rejected' && seller.rejectionReason && (
                                    <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl">
                                        <p className="text-xs font-black text-rose-800 uppercase tracking-wider mb-1">Rejection Reason</p>
                                        <p className="text-xs text-rose-700 font-bold">{seller.rejectionReason}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>
                </div>

                {/* Sidebar Context */}
                <div className="space-y-6">
                    {/* Owner Card */}
                    <Card className="p-6 border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl text-left">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-6">Owner Information</h4>
                        
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-slate-600">
                                <div className="p-2 bg-slate-50 rounded-xl">
                                    <User className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-bold">{seller.name}</span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-600">
                                <div className="p-2 bg-slate-50 rounded-xl">
                                    <Mail className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-bold break-all">{seller.email}</span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-600">
                                <div className="p-2 bg-slate-50 rounded-xl">
                                    <Phone className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-bold">{seller.phone}</span>
                            </div>
                            <div className="flex items-start gap-3 text-slate-600">
                                <div className="p-2 bg-slate-50 rounded-xl mt-0.5">
                                    <MapPin className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-bold leading-relaxed">
                                    {seller.address || "Address not provided"}, {seller.locality || ""}, {seller.city || ""}, {seller.state || ""} - {seller.pincode || ""}
                                </span>
                            </div>
                        </div>
                    </Card>

                    {/* Geofencing info */}
                    <Card className="p-6 border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl text-left space-y-4">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Delivery Boundary</h4>
                        <div className="space-y-3">
                            <div className="flex justify-between py-1.5 border-b border-slate-100">
                                <span className="text-xs font-bold text-slate-500">Service Radius</span>
                                <span className="text-xs font-black text-slate-900">{seller.serviceRadius || 5} km</span>
                            </div>
                            {seller.location?.coordinates && (
                                <div className="flex justify-between py-1.5 border-b border-slate-100">
                                    <span className="text-xs font-bold text-slate-500">Coordinates</span>
                                    <span className="text-xs font-black text-slate-900 font-mono">
                                        {seller.location.coordinates[1]?.toFixed(4)}, {seller.location.coordinates[0]?.toFixed(4)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>

            {/* Rejection Reason Modal */}
            {isRejectModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-black text-slate-900 uppercase">Reject Application</h3>
                            <button onClick={() => setIsRejectModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-full">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <label className="text-xs font-black uppercase tracking-wider text-slate-500">Reason for rejection</label>
                            <textarea
                                rows={4}
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Describe why this seller application is being rejected (sent to merchant)..."
                                className="w-full p-4 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-slate-900 transition-colors resize-none"
                            />
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setIsRejectModalOpen(false)}
                                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-bold rounded-xl"
                            >
                                CANCEL
                            </button>
                            <button
                                onClick={handleReject}
                                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl"
                            >
                                SUBMIT REJECTION
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SellerDetail;
