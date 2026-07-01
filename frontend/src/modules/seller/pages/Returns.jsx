import React, { useEffect, useMemo, useState } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import Button from "@shared/components/ui/Button";
import { sellerApi } from "../services/sellerApi";
import { useToast } from "@shared/components/ui/Toast";
import {
    HiOutlineArrowPath,
    HiOutlineInboxStack,
    HiOutlineEye,
    HiOutlineCalendarDays,
    HiOutlineTruck,
} from "react-icons/hi2";
import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Loader2, X } from "lucide-react";
import { onReturnDropOtp, onCancellationDropOtp } from "@core/services/orderSocket";
import { createSocketTokenReader } from "@core/utils/authStorage";
import { STORAGE_KEYS } from "@core/utils/storage";
import AssignDeliveryBoy from "./AssignDeliveryBoy";

const Returns = () => {
    const { showToast } = useToast();
    const [requestType, setRequestType] = useState("return"); // "return" | "cancellation"
    const [returns, setReturns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("All");
    const [selectedReturn, setSelectedReturn] = useState(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [isAssignOpen, setIsAssignOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [submittingReject, setSubmittingReject] = useState(false);
    const [assigningPickup, setAssigningPickup] = useState(false);
    const [activeOtps, setActiveOtps] = useState({}); // { orderId: { otp, expiresAt } }
    const canManageReturns = true;

    const tabs = [
        "All",
        "Requested",
        "Approved",
        "Rejected",
        "Pickup Assigned",
        "In Transit",
        "Under Dispute",
        "Cancelled",
        "Completed",
    ];

    const mapReturnStatusLabel = (status) => {
        const norm = String(status || "").toUpperCase();
        switch (norm) {
            case "REQUESTED":
                return "Requested";
            case "SELLER_APPROVED":
                return "Approved";
            case "SELLER_REJECTED":
                return "Rejected";
            case "PICKUP_SCHEDULED":
                return "Pickup Assigned";
            case "PICKED_UP":
            case "DELIVERED_TO_SELLER":
            case "REFUND_INITIATED":
                return "In Transit";
            case "REFUND_COMPLETED":
            case "CLOSED":
                return "Completed";
            case "UNDER_DISPUTE":
                return "Under Dispute";
            case "CANCELLED":
                return "Cancelled";
            default:
                return status || "Unknown";
        }
    };

    const getStatusVariant = (status) => {
        const norm = String(status || "").toUpperCase();
        switch (norm) {
            case "REQUESTED":
                return "warning";
            case "SELLER_APPROVED":
                return "info";
            case "SELLER_REJECTED":
            case "CANCELLED":
                return "error";
            case "PICKUP_SCHEDULED":
            case "PICKED_UP":
            case "DELIVERED_TO_SELLER":
            case "REFUND_INITIATED":
                return "secondary";
            case "REFUND_COMPLETED":
            case "CLOSED":
                return "success";
            case "UNDER_DISPUTE":
                return "warning";
            default:
                return "secondary";
        }
    };

    const fetchReturns = async () => {
        try {
            setLoading(true);
            const res = requestType === "cancellation"
                ? await sellerApi.getSellerCancellationRequests()
                : await sellerApi.getSellerReturnRequests();
            const payload = res.data.result || res.data;
            const items = Array.isArray(payload) ? payload : payload.cancellation_requests || payload.return_requests || payload.items || [];
            setReturns(items);
        } catch (error) {
            console.error(`Failed to fetch ${requestType} requests`, error);
            showToast(`Failed to fetch ${requestType} requests`, "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReturns();

        // Listen for return/cancellation drop OTPs (when rider arrives at seller)
        const getToken = createSocketTokenReader(STORAGE_KEYS.AUTH_SELLER);
        let unsubscribe;

        if (requestType === "cancellation") {
            unsubscribe = onCancellationDropOtp(getToken, (payload) => {
                const { orderId, otp, expiresAt } = payload;
                setActiveOtps(prev => ({
                    ...prev,
                    [orderId]: { otp, expiresAt }
                }));
                showToast(`Rider arrived for Cancellation #${orderId}. OTP: ${otp}`, "info");
            });
        } else {
            unsubscribe = onReturnDropOtp(getToken, (payload) => {
                const { orderId, otp, expiresAt } = payload;
                setActiveOtps(prev => ({
                    ...prev,
                    [orderId]: { otp, expiresAt }
                }));
                showToast(`Rider arrived for Return #${orderId}. OTP: ${otp}`, "info");
            });
        }

        return () => {
            if (typeof unsubscribe === "function") unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requestType]);

    useEffect(() => {
        if (isDetailsOpen || isRejectModalOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isDetailsOpen, isRejectModalOpen]);

    const filteredReturns = useMemo(() => {
        if (activeTab === "All") return returns;
        return returns.filter((r) => {
            const label = mapReturnStatusLabel(r.status);
            return label === activeTab;
        });
    }, [returns, activeTab]);

    const openDetails = (ret) => {
        setSelectedReturn(ret);
        setIsDetailsOpen(true);
    };

    const handleApprove = async (returnRequestId) => {
        try {
            if (requestType === "cancellation") {
                await sellerApi.approveSellerCancellationRequest(returnRequestId, { note: "Approved by seller" });
            } else {
                await sellerApi.approveSellerReturnRequest(returnRequestId, { seller_note: "Approved by seller" });
            }
            showToast(`${requestType === "cancellation" ? "Cancellation" : "Return"} approved successfully`, "success");
            setIsDetailsOpen(false);
            await fetchReturns();
        } catch (error) {
            console.error(`Failed to approve ${requestType}`, error);
            showToast(
                error.response?.data?.message || `Failed to approve ${requestType}`,
                "error"
            );
        }
    };

    const handleReject = async () => {
        if (!rejectReason.trim() || !selectedReturn) return;
        const returnRequestId = selectedReturn._id || selectedReturn.id;
        try {
            setSubmittingReject(true);
            if (requestType === "cancellation") {
                await sellerApi.rejectSellerCancellationRequest(returnRequestId, { note: rejectReason });
            } else {
                await sellerApi.rejectSellerReturnRequest(returnRequestId, { seller_note: rejectReason });
            }
            showToast(`${requestType === "cancellation" ? "Cancellation" : "Return"} rejected successfully`, "success");
            setIsRejectModalOpen(false);
            setRejectReason("");
            setIsDetailsOpen(false);
            await fetchReturns();
        } catch (error) {
            console.error(`Failed to reject ${requestType}`, error);
            showToast(
                error.response?.data?.message || `Failed to reject ${requestType}`,
                "error"
            );
        } finally {
            setSubmittingReject(false);
        }
    };

    const handleAssignPickup = () => {
        setIsAssignOpen(true);
    };

    return (
        <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-16">
            <BlurFade delay={0.1}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
                    <div className="min-w-0">
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 flex flex-wrap items-center gap-2">
                            {requestType === "cancellation" ? "Cancellation" : "Return"} Requests
                            <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 font-bold tracking-widest uppercase"
                            >
                                New
                            </Badge>
                        </h1>
                        <p className="text-slate-600 text-sm sm:text-base mt-0.5 font-medium">
                            Review and manage customer {requestType === "cancellation" ? "order cancellation" : "return"} requests.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
                        <div className="flex items-center gap-1.5 bg-slate-100/80 backdrop-blur-sm p-1 rounded-xl border border-slate-200/50">
                            <button
                                onClick={() => { setRequestType("return"); setActiveTab("All"); }}
                                className={cn(
                                    "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                                    requestType === "return"
                                        ? "bg-slate-900 text-white shadow-md shadow-slate-900/10 scale-[1.02]"
                                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                                )}
                            >
                                Returns
                            </button>
                            <button
                                onClick={() => { setRequestType("cancellation"); setActiveTab("All"); }}
                                className={cn(
                                    "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                                    requestType === "cancellation"
                                        ? "bg-slate-900 text-white shadow-md shadow-slate-900/10 scale-[1.02]"
                                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                                )}
                            >
                                Cancellations
                            </button>
                        </div>
                        <Button
                            onClick={fetchReturns}
                            variant="outline"
                            className="flex items-center space-x-1.5 sm:space-x-2 px-3 py-2 sm:px-5 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold text-slate-600 bg-white hover:bg-slate-50 border-slate-200"
                        >
                            <HiOutlineArrowPath className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <span className="hidden sm:inline">REFRESH</span>
                        </Button>
                    </div>
                </div>
            </BlurFade>

            {loading ? (
                <div className="min-h-[320px] flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <Loader2 className="h-10 w-10 text-primary animate-spin" />
                    <p className="text-slate-600 font-bold mt-4 uppercase tracking-widest text-xs">
                        Loading Return Requests...
                    </p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        {["Requested", "Approved", "Rejected", "Completed"].map(
                            (label, i) => {
                                const count = returns.filter(
                                    (r) => mapReturnStatusLabel(r.status) === label
                                ).length;
                                return (
                                    <BlurFade key={label} delay={0.1 + i * 0.05}>
                                        <MagicCard
                                            className="border-none shadow-sm ring-1 ring-slate-100 p-0 overflow-hidden group bg-white"
                                            gradientColor="#eef2ff"
                                        >
                                            <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 relative z-10">
                                                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg flex items-center justify-center bg-slate-900 text-white shadow-sm shrink-0">
                                                    <HiOutlineInboxStack className="h-5 w-5 sm:h-6 sm:w-6" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest truncate">
                                                        {label}
                                                    </p>
                                                    <h4 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
                                                        {count}
                                                    </h4>
                                                </div>
                                            </div>
                                        </MagicCard>
                                    </BlurFade>
                                );
                            }
                        )}
                    </div>

                    <BlurFade delay={0.2}>
                        <Card className="border-none shadow-xl ring-1 ring-slate-100 rounded-lg bg-white overflow-hidden">
                            <div className="border-b border-slate-100 bg-slate-50/30 overflow-x-auto scrollbar-hide">
                                <div className="flex px-3 sm:px-6 items-center min-w-max">
                                    {tabs.map((tab) => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab)}
                                            className={cn(
                                                "relative py-3 sm:py-4 px-2.5 sm:px-4 text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-300",
                                                activeTab === tab
                                                    ? "text-primary scale-105"
                                                    : "text-slate-600 hover:text-slate-700"
                                            )}
                                        >
                                            {tab}
                                            {activeTab === tab && (
                                                <motion.div
                                                    layoutId="returns-tab-underline"
                                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full mx-2 sm:mx-4"
                                                />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="p-3 sm:p-4">
                                {filteredReturns.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 px-4">
                                        <div className="h-14 w-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mb-3">
                                            <HiOutlineInboxStack className="h-7 w-7" />
                                        </div>
                                        <h3 className="text-sm font-bold text-slate-900">
                                            No return requests found
                                        </h3>
                                        <p className="text-xs text-slate-600 font-medium text-center mt-1">
                                            You will see customer return requests here.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {filteredReturns.map((ret) => (
                                            <div
                                                key={ret._id}
                                                className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm hover:bg-slate-50/40 transition-colors flex items-start justify-between gap-3"
                                            >
                                                <div
                                                    className="min-w-0 flex-1 cursor-pointer"
                                                    onClick={() => openDetails(ret)}
                                                >
                                                    <p className="text-xs font-black text-slate-900 truncate">
                                                        #{ret.order_id?.orderId || ret.orderId}
                                                    </p>
                                                    <p className="text-xs font-semibold text-slate-600 mt-0.5 flex items-center gap-1">
                                                        <HiOutlineCalendarDays className="h-3 w-3 shrink-0" />
                                                        {ret.createdAt
                                                            ? new Date(
                                                                ret.createdAt
                                                            ).toLocaleString("en-IN", {
                                                                day: "2-digit",
                                                                month: "short",
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            })
                                                            : "N/A"}
                                                    </p>
                                                    <p className="text-xs font-bold text-slate-800 mt-1">
                                                        {ret.customer_id?.name || ret.customer?.name || "Customer"}
                                                    </p>
                                                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                                        {ret.reason_description || ret.reason || "No description"}
                                                    </p>
                                                    {/* Proper Data: Rider tracking for in-transit */}
                                                    {(ret.status === "PICKUP_SCHEDULED" || ret.status === "PICKED_UP" || ret.status === "DELIVERED_TO_SELLER") && ret.delivery_boy_id && (
                                                        <div className="mt-2 flex items-center gap-1.5 px-2 py-1 bg-brand-50 rounded-lg border border-brand-100 w-fit">
                                                            <HiOutlineTruck className="h-3 w-3 text-brand-600" />
                                                            <span className="text-[10px] font-bold text-brand-700">Rider: {ret.delivery_boy_id.name}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col items-end gap-2 shrink-0">
                                                    <Badge
                                                        variant={getStatusVariant(
                                                            ret.status
                                                        )}
                                                        className="text-[10px] font-black uppercase px-2 py-0"
                                                    >
                                                        {mapReturnStatusLabel(ret.status)}
                                                    </Badge>
                                                    <p className="text-xs font-black text-slate-900">
                                                        {"\u20B9"}
                                                        {requestType === "cancellation"
                                                            ? (ret.order_id?.paymentBreakdown?.grandTotal || ret.order_id?.pricing?.total || 0)
                                                            : (ret.refund_amount || 0)}
                                                    </p>
                                                    <button
                                                        onClick={() => openDetails(ret)}
                                                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"
                                                    >
                                                        <HiOutlineEye className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </Card>
                    </BlurFade>
                </>
            )}

            <AnimatePresence>
                {isDetailsOpen && selectedReturn && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 lg:p-8">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
                            onClick={() => setIsDetailsOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="w-full max-w-2xl relative z-10 bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
                            style={{ maxHeight: 'calc(100vh - 2rem)' }}
                        >
                            <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 shrink-0">
                                <div>
                                    <h3 className="text-base font-black text-slate-900">
                                        {requestType === "cancellation" ? "Cancellation" : "Return"} for Order #{selectedReturn.order_id?.orderId || selectedReturn.orderId}
                                    </h3>
                                    <div className="flex items-center space-x-2 mt-0.5">
                                        <Badge
                                            variant={getStatusVariant(
                                                selectedReturn.status
                                            )}
                                            className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0"
                                        >
                                            {mapReturnStatusLabel(
                                                selectedReturn.status
                                            )}
                                        </Badge>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsDetailsOpen(false)}
                                    className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="px-4 py-4 sm:px-6 sm:py-5 overflow-y-auto overscroll-contain flex-1 space-y-4">
                                <div className="space-y-2">
                                    <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                                        Customer
                                    </p>
                                    <p className="text-sm font-bold text-slate-900">
                                        {selectedReturn.customer_id?.name || selectedReturn.customer?.name || "Customer"}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {selectedReturn.customer_id?.phone || selectedReturn.customer?.phone || ""}
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                                        {requestType === "cancellation" ? "Cancellation" : "Return"} Details
                                    </p>
                                    <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-2">
                                        <p className="text-sm font-bold text-slate-800">
                                            Reason: <span className="font-medium text-slate-600">{selectedReturn.reason || "N/A"}</span>
                                        </p>
                                        {selectedReturn.reason_description && (
                                            <p className="text-sm text-slate-700 italic border-l-2 border-slate-300 pl-2">
                                                {selectedReturn.reason_description}
                                            </p>
                                        )}
                                    </div>

                                    {selectedReturn.product_images?.length > 0 && (
                                        <div className="pt-2 space-y-2">
                                            <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                                                Customer Photos ({selectedReturn.product_images.length})
                                            </p>
                                            <div className="flex gap-2 overflow-x-auto pb-2">
                                                {selectedReturn.product_images.map((img, idx) => (
                                                    <div key={idx} className="relative aspect-square w-20 rounded-xl overflow-hidden border border-slate-200 shrink-0 cursor-pointer hover:border-slate-400" onClick={() => window.open(img, '_blank')}>
                                                        <img src={img} alt={`Return ${idx}`} className="w-full h-full object-cover" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {selectedReturn.seller_note && (
                                        <p className="text-xs text-rose-600 font-semibold bg-rose-50 p-2.5 rounded-xl border border-rose-100">
                                            Seller Rejection Note:{" "}
                                            {selectedReturn.seller_note}
                                        </p>
                                    )}
                                </div>

                                {/* Tracking Info Section */}
                                {(selectedReturn.status === "PICKUP_SCHEDULED" ||
                                    selectedReturn.status === "PICKED_UP" ||
                                    selectedReturn.status === "DELIVERED_TO_SELLER") && selectedReturn.delivery_boy_id && (
                                        <div className="bg-brand-50 rounded-2xl p-4 border border-brand-100 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <div className="h-8 w-8 rounded-lg bg-black  flex items-center justify-center text-white">
                                                    <HiOutlineTruck className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest leading-none mb-1">Rider Assigned</p>
                                                    <p className="text-sm font-bold text-slate-900 leading-none">{selectedReturn.delivery_boy_id.name}</p>
                                                </div>
                                            </div>
                                            {selectedReturn.delivery_boy_id.phone && (
                                                <a
                                                    href={`tel:${selectedReturn.delivery_boy_id.phone}`}
                                                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-brand-700 bg-white px-3 py-1.5 rounded-lg border border-brand-200 shadow-sm hover:bg-brand-100 transition-colors"
                                                >
                                                    📞 {selectedReturn.delivery_boy_id.phone}
                                                </a>
                                            )}
                                        </div>
                                    )}

                                {/* Quality Check Comparison (2-Way) */}
                                {requestType !== "cancellation" && (
                                    <div className="space-y-3 pt-2">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                                            Product Comparison
                                        </p>
                                        <div className="grid grid-cols-2 gap-3">
                                            {/* 1. Original Listing Image */}
                                            <div className="space-y-1.5 flex flex-col h-full group">
                                                <div className="relative aspect-square rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-inner group-hover:border-slate-300 transition-colors">
                                                    <img
                                                        src={selectedReturn.order_id?.items?.[0]?.image || "https://placehold.co/400x400/f8fafc/64748b?text=Original"}
                                                        alt="Original"
                                                        className="h-full w-full object-cover"
                                                    />
                                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/60 to-transparent p-2">
                                                        <p className="text-[9px] font-black text-white uppercase leading-none">Listing</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 3. Return Proof */}
                                            <div className="space-y-1.5 flex flex-col h-full group">
                                                <div className="relative aspect-square rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-inner group-hover:border-slate-300 transition-colors flex items-center justify-center">
                                                    {selectedReturn.product_images?.[0] ? (
                                                        <img
                                                            src={selectedReturn.product_images[0]}
                                                            alt="Return Proof"
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-1.5 text-slate-400 px-3 text-center">
                                                            <HiOutlineInboxStack className="h-5 w-5" />
                                                            <p className="text-[8px] font-bold leading-tight uppercase">No Photos</p>
                                                        </div>
                                                    )}
                                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-emerald-900/60 to-transparent p-2">
                                                        <p className="text-[9px] font-black text-white uppercase leading-none">Proof</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                                        Items
                                    </p>
                                    <div className="space-y-2">
                                        {(selectedReturn.order_id?.items || []).map(
                                            (item, idx) => (
                                                <div
                                                    key={idx}
                                                    className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100"
                                                >
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-900">
                                                            {item.name}
                                                        </p>
                                                        <p className="text-xs text-slate-500">
                                                            Qty: {item.quantity}
                                                        </p>
                                                    </div>
                                                    <p className="text-xs font-black text-slate-900">
                                                        ₹{item.price * item.quantity}
                                                    </p>
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                                        Payment Breakdown
                                    </p>
                                    <p className="text-xs text-slate-700">
                                        {requestType === "cancellation" ? "Total order refund:" : "Product refund:"}{" "}
                                        <span className="font-black">
                                            {"\u20B9"}
                                            {requestType === "cancellation"
                                                ? (selectedReturn.order_id?.paymentBreakdown?.grandTotal || selectedReturn.order_id?.pricing?.total || 0)
                                                : (selectedReturn.refund_amount || 0)}
                                        </span>
                                    </p>
                                </div>

                                {/* Active OTP Display */}
                                {activeOtps[selectedReturn.order_id?._id || selectedReturn.order_id] && (
                                    <div className="bg-brand-50 border-2 border-dashed border-brand-200 rounded-3xl p-6 text-center space-y-3 animate-in fade-in zoom-in duration-500">
                                        <p className="text-[10px] font-black text-brand-600 uppercase tracking-[0.2em]">
                                            Rider Arrived - Share OTP
                                        </p>
                                        <div className="flex items-center justify-center gap-3">
                                            {activeOtps[selectedReturn.order_id?._id || selectedReturn.order_id].otp.split('').map((char, i) => (
                                                <div key={i} className="h-14 w-12 bg-white rounded-xl shadow-sm border border-brand-100 flex items-center justify-center text-3xl font-black text-slate-900 border-b-4 border-b-brand-500">
                                                    {char}
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-500 italic">
                                            Sharing this code confirms you have received the product.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center justify-end shrink-0">
                                <div className="flex gap-2 items-center">
                                    <button
                                        onClick={() => setIsDetailsOpen(false)}
                                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all"
                                    >
                                        Close
                                    </button>

                                    {/* Action: Approve/Reject */}
                                    {canManageReturns && selectedReturn.status === "REQUESTED" && (
                                        <>
                                            <Button
                                                variant="outline"
                                                className="text-xs font-bold border-rose-200 text-rose-600 hover:bg-rose-50"
                                                onClick={() => setIsRejectModalOpen(true)}
                                            >
                                                Reject Request
                                            </Button>
                                            <Button
                                                className="text-xs font-bold bg-slate-900"
                                                onClick={() => handleApprove(selectedReturn._id || selectedReturn.id)}
                                            >
                                                Approve {requestType === "cancellation" ? "Cancellation" : "Return"}
                                            </Button>
                                        </>
                                    )}

                                    {/* Action: Assign Pickup */}
                                    {canManageReturns && (selectedReturn.status === "SELLER_APPROVED") && (
                                        <Button
                                            className="text-xs font-bold bg-black  hover:bg-brand-700"
                                            onClick={handleAssignPickup}
                                        >
                                            <HiOutlineInboxStack className="h-4 w-4 mr-2" />
                                            Assign Pickup
                                        </Button>
                                    )}

                                    {/* Action: Reassign Pickup */}
                                    {canManageReturns && (selectedReturn.status === "PICKUP_SCHEDULED") && (
                                        <Button
                                            className="text-xs font-bold bg-black  hover:bg-brand-700"
                                            onClick={handleAssignPickup}
                                        >
                                            <HiOutlineInboxStack className="h-4 w-4 mr-2" />
                                            Reassign Rider
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            <AnimatePresence>
                {isAssignOpen && selectedReturn && (
                    <AssignDeliveryBoy
                        returnRequest={selectedReturn}
                        cancellationRequest={selectedReturn}
                        type={requestType}
                        onClose={() => setIsAssignOpen(false)}
                        onAssigned={() => {
                            setIsAssignOpen(false);
                            setIsDetailsOpen(false);
                            fetchReturns();
                        }}
                    />
                )}
            </AnimatePresence>
            <AnimatePresence>
                {canManageReturns && isRejectModalOpen && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                            onClick={() => !submittingReject && setIsRejectModalOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="w-full max-w-md relative z-10 bg-white rounded-3xl shadow-2xl p-6 space-y-4"
                        >
                            <h3 className="text-xl font-black text-slate-900">Reject Return</h3>
                            <p className="text-sm text-slate-600 font-medium">Please provide a reason for rejecting this return request. This will be shared with the customer.</p>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Reason for Rejection</label>
                                <textarea
                                    className="w-full rounded-2xl border border-slate-200 p-4 text-sm font-medium focus:ring-2 focus:ring-slate-900/10 outline-none transition-all"
                                    rows={4}
                                    placeholder="e.g. Product returned in damaged condition..."
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button
                                    variant="outline"
                                    className="flex-1 font-bold"
                                    onClick={() => setIsRejectModalOpen(false)}
                                    disabled={submittingReject}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    className="flex-1 font-bold bg-rose-600 hover:bg-rose-700"
                                    onClick={handleReject}
                                    isLoading={submittingReject}
                                    disabled={!rejectReason.trim() || submittingReject}
                                >
                                    Reject Request
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Returns;
