import React, { useEffect, useMemo, useState } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import Button from "@shared/components/ui/Button";
import Pagination from "@shared/components/ui/Pagination";
import { adminApi } from "../services/adminApi";
import { useToast } from "@shared/components/ui/Toast";
import {
  HiOutlineArrowPath,
  HiOutlineInboxStack,
  HiOutlineEye,
  HiOutlineCalendarDays,
  HiOutlineTruck,
  HiOutlineReceiptRefund,
  HiOutlineScale,
  HiOutlineUser,
  HiOutlineBuildingStorefront,
  HiOutlineWrench
} from "react-icons/hi2";
import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Loader2, X, AlertTriangle, ArrowRight, ShieldCheck, CreditCard } from "lucide-react";

const Returns = () => {
  const { showToast } = useToast();
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    by_status: {},
    avg_resolution_hours: 0,
    refund_total_this_month: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Filter States
  const [statusFilter, setStatusFilter] = useState("All");
  const [sellerFilter, setSellerFilter] = useState("All");
  const [sellers, setSellers] = useState([]);
  
  // Pagination States
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  // Detail Modal States
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Action Modals
  const [overrideModal, setOverrideModal] = useState({ open: false, action: null });
  const [refundModal, setRefundModal] = useState({ open: false });
  const [actionNote, setActionNote] = useState("");
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundMethod, setRefundMethod] = useState("wallet");
  const [submittingAction, setSubmittingAction] = useState(false);

  const statuses = [
    "All",
    "REQUESTED",
    "SELLER_APPROVED",
    "SELLER_REJECTED",
    "PICKUP_SCHEDULED",
    "PICKED_UP",
    "DELIVERED_TO_SELLER",
    "REFUND_INITIATED",
    "REFUND_COMPLETED",
    "CLOSED",
    "UNDER_DISPUTE",
    "CANCELLED"
  ];

  const mapStatusLabel = (status) => {
    switch (status) {
      case "REQUESTED":
        return "Requested";
      case "SELLER_APPROVED":
        return "Approved by Seller";
      case "SELLER_REJECTED":
        return "Rejected by Seller";
      case "PICKUP_SCHEDULED":
        return "Pickup Scheduled";
      case "PICKED_UP":
        return "Picked Up";
      case "DELIVERED_TO_SELLER":
        return "Delivered to Seller";
      case "REFUND_INITIATED":
        return "Refund Initiated";
      case "REFUND_COMPLETED":
        return "Refund Completed";
      case "CLOSED":
        return "Closed";
      case "UNDER_DISPUTE":
        return "Under Dispute";
      case "CANCELLED":
        return "Cancelled";
      default:
        return status || "Unknown";
    }
  };

  const getStatusVariant = (status) => {
    switch (status) {
      case "REQUESTED":
        return "warning";
      case "SELLER_APPROVED":
        return "info";
      case "SELLER_REJECTED":
        return "error";
      case "PICKUP_SCHEDULED":
        return "primary";
      case "PICKED_UP":
        return "primary";
      case "DELIVERED_TO_SELLER":
        return "info";
      case "REFUND_INITIATED":
        return "info";
      case "REFUND_COMPLETED":
        return "success";
      case "CLOSED":
        return "success";
      case "UNDER_DISPUTE":
        return "error";
      case "CANCELLED":
        return "gray";
      default:
        return "gray";
    }
  };

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const res = await adminApi.getAdminReturnStats();
      if (res.data.success) {
        setStats(res.data.result || {
          total: 0,
          by_status: {},
          avg_resolution_hours: 0,
          refund_total_this_month: 0,
        });
      }
    } catch (error) {
      console.error("Failed to fetch stats", error);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchSellers = async () => {
    try {
      const res = await adminApi.getActiveSellers();
      const payload = res.data?.result || res.data?.results || {};
      const sellersList = Array.isArray(payload.items) ? payload.items : (Array.isArray(payload) ? payload : []);
      setSellers(sellersList);
    } catch (error) {
      console.error("Failed to fetch sellers list", error);
    }
  };

  const fetchReturns = async (requestedPage = 1) => {
    try {
      setLoading(true);
      const params = {
        page: requestedPage,
        limit: pageSize,
      };
      if (statusFilter !== "All") params.status = statusFilter;
      if (sellerFilter !== "All") params.seller_id = sellerFilter;

      const res = await adminApi.getAdminReturnRequests(params);
      if (res.data.success) {
        const result = res.data.result || {};
        setReturns(result.return_requests || []);
        setTotal(result.total || 0);
        setPage(result.page || requestedPage);
      }
    } catch (error) {
      console.error("Failed to fetch returns", error);
      showToast("Failed to fetch return requests", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchSellers();
  }, []);

  useEffect(() => {
    fetchReturns(1);
  }, [statusFilter, sellerFilter, pageSize]);

  useEffect(() => {
    if (isDetailsOpen || overrideModal.open || refundModal.open) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
      document.documentElement.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
      document.documentElement.style.overflow = "unset";
    };
  }, [isDetailsOpen, overrideModal.open, refundModal.open]);

  const refreshAll = () => {
    fetchStats();
    fetchReturns(page);
    showToast("Data refreshed successfully", "success");
  };

  const handlePageChange = (newPage) => {
    fetchReturns(newPage);
  };

  const openDetails = async (ret) => {
    try {
      setLoadingDetail(true);
      setIsDetailsOpen(true);
      const res = await adminApi.getAdminReturnRequestDetail(ret._id || ret.id);
      if (res.data.success) {
        setSelectedReturn(res.data.result);
      } else {
        setSelectedReturn(ret);
      }
    } catch (error) {
      console.error("Failed to fetch return details", error);
      setSelectedReturn(ret);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleOverrideSubmit = async () => {
    if (!overrideModal.action || !selectedReturn) return;
    try {
      setSubmittingAction(true);
      const res = await adminApi.overrideReturnRequest(selectedReturn._id || selectedReturn.id, {
        action: overrideModal.action,
        note: actionNote.trim() || undefined
      });
      if (res.data.success) {
        showToast(`Return status overridden successfully to ${overrideModal.action}`, "success");
        setOverrideModal({ open: false, action: null });
        setActionNote("");
        
        // Refresh details and list
        const updatedDetail = await adminApi.getAdminReturnRequestDetail(selectedReturn._id || selectedReturn.id);
        if (updatedDetail.data.success) {
          setSelectedReturn(updatedDetail.data.result);
        }
        fetchReturns(page);
        fetchStats();
      }
    } catch (error) {
      console.error("Failed to execute override", error);
      showToast(error.response?.data?.message || "Failed to execute override action", "error");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleRefundSubmit = async () => {
    if (!selectedReturn) return;
    try {
      setSubmittingAction(true);
      const res = await adminApi.initiateRefund(selectedReturn._id || selectedReturn.id, {
        refund_amount: Number(refundAmount),
        refund_method: refundMethod
      });
      if (res.data.success) {
        showToast("Refund initiated and processed successfully!", "success");
        setRefundModal({ open: false });
        
        // Refresh details and list
        const updatedDetail = await adminApi.getAdminReturnRequestDetail(selectedReturn._id || selectedReturn.id);
        if (updatedDetail.data.success) {
          setSelectedReturn(updatedDetail.data.result);
        }
        fetchReturns(page);
        fetchStats();
      }
    } catch (error) {
      console.error("Failed to process refund", error);
      showToast(error.response?.data?.message || "Failed to process refund", "error");
    } finally {
      setSubmittingAction(false);
    }
  };

  const openRefundModal = () => {
    if (!selectedReturn) return;
    setRefundAmount(selectedReturn.refund_amount || 0);
    setRefundMethod(selectedReturn.refund_method || "wallet");
    setRefundModal({ open: true });
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6 pb-20 sm:pb-16 px-1 sm:px-0">
      {/* Header Section */}
      <BlurFade delay={0.05}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 flex flex-wrap items-center gap-2">
              Returns Control Center
              <Badge variant="primary" className="text-[9px] px-2 py-0.5 font-black tracking-widest uppercase">
                ADMIN PRIVILEGES
              </Badge>
            </h1>
            <p className="text-slate-600 text-sm mt-1 font-semibold">
              Track multi-party returns, enforce status overrides, and initiate payouts/wallet refunds.
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button
              onClick={refreshAll}
              variant="outline"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border-slate-200 shadow-sm"
            >
              <HiOutlineArrowPath className="h-4 w-4" />
              <span>SYNC SYSTEM</span>
            </Button>
          </div>
        </div>
      </BlurFade>

      {/* Stats Cards Section */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <BlurFade delay={0.1}>
          <MagicCard className="border-none shadow-sm ring-1 ring-slate-100 p-4 bg-white" gradientColor="#f8fafc">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-slate-900 text-white shadow-sm shrink-0">
                <HiOutlineInboxStack className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider truncate">Total Requests</p>
                <h4 className="text-lg sm:text-2xl font-black text-slate-900 mt-0.5">
                  {statsLoading ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : stats.total || 0}
                </h4>
              </div>
            </div>
          </MagicCard>
        </BlurFade>

        <BlurFade delay={0.15}>
          <MagicCard className="border-none shadow-sm ring-1 ring-slate-100 p-4 bg-white" gradientColor="#f0fdf4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-emerald-600 text-white shadow-sm shrink-0">
                <HiOutlineReceiptRefund className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider truncate">Refunds (Month)</p>
                <h4 className="text-lg sm:text-2xl font-black text-emerald-700 mt-0.5">
                  {statsLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                  ) : (
                    `₹${stats.refund_total_this_month || 0}`
                  )}
                </h4>
              </div>
            </div>
          </MagicCard>
        </BlurFade>

        <BlurFade delay={0.2}>
          <MagicCard className="border-none shadow-sm ring-1 ring-slate-100 p-4 bg-white" gradientColor="#eff6ff">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-indigo-600 text-white shadow-sm shrink-0">
                <HiOutlineScale className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider truncate">Avg Resolution</p>
                <h4 className="text-lg sm:text-2xl font-black text-indigo-700 mt-0.5">
                  {statsLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
                  ) : (
                    `${stats.avg_resolution_hours || 0} hrs`
                  )}
                </h4>
              </div>
            </div>
          </MagicCard>
        </BlurFade>

        <BlurFade delay={0.25}>
          <MagicCard className="border-none shadow-sm ring-1 ring-slate-100 p-4 bg-white" gradientColor="#fffbeb">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-amber-500 text-white shadow-sm shrink-0">
                <HiOutlineWrench className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider truncate">Pending Action</p>
                <h4 className="text-lg sm:text-2xl font-black text-amber-700 mt-0.5">
                  {statsLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
                  ) : (
                    (stats.by_status?.["REQUESTED"] || 0) + (stats.by_status?.["DELIVERED_TO_SELLER"] || 0)
                  )}
                </h4>
              </div>
            </div>
          </MagicCard>
        </BlurFade>
      </div>

      {/* Filters Bar */}
      <BlurFade delay={0.3}>
        <Card className="border-none shadow-xl ring-1 ring-slate-100 rounded-2xl bg-white p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 flex-1">
              {/* Status Filter */}
              <div className="flex flex-col gap-1 min-w-[200px]">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Return Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10 cursor-pointer"
                >
                  <option value="All">All Statuses</option>
                  {statuses.filter(s => s !== "All").map((status) => (
                    <option key={status} value={status}>
                      {mapStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Seller Filter */}
              <div className="flex flex-col gap-1 min-w-[220px]">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Store / Seller</label>
                <select
                  value={sellerFilter}
                  onChange={(e) => setSellerFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10 cursor-pointer"
                >
                  <option value="All">All Sellers</option>
                  {(sellers || []).map((s) => (
                    <option key={s._id || s.id} value={s._id || s.id}>
                      {s.shopName || s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Reset Filters */}
            {(statusFilter !== "All" || sellerFilter !== "All") && (
              <Button
                variant="outline"
                onClick={() => {
                  setStatusFilter("All");
                  setSellerFilter("All");
                }}
                className="px-4 py-2.5 rounded-xl border-rose-100 text-rose-600 hover:bg-rose-50/50 text-xs font-bold shrink-0 shadow-sm"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </Card>
      </BlurFade>

      {/* Main List */}
      <BlurFade delay={0.35}>
        <Card className="border-none shadow-xl ring-1 ring-slate-100 rounded-2xl bg-white overflow-hidden">
          {loading ? (
            <div className="min-h-[400px] flex flex-col items-center justify-center bg-white p-8">
              <Loader2 className="h-10 w-10 text-slate-800 animate-spin" />
              <p className="text-slate-500 font-bold mt-4 uppercase tracking-widest text-xs">
                Retrieving returns log...
              </p>
            </div>
          ) : returns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <div className="h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mb-4 ring-1 ring-slate-100">
                <HiOutlineInboxStack className="h-8 w-8" />
              </div>
              <h3 className="text-base font-black text-slate-900">No Return Requests Found</h3>
              <p className="text-xs text-slate-500 font-semibold max-w-sm mt-2 leading-relaxed">
                Adjust filters or check back later. System returns are loaded automatically here.
              </p>
            </div>
          ) : (
            <div className="p-4 sm:p-6 space-y-6">
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Order ID</th>
                      <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Date / Time</th>
                      <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Customer</th>
                      <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Seller</th>
                      <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Refund</th>
                      <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Status</th>
                      <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {returns.map((ret) => (
                      <tr key={ret._id || ret.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4">
                          <span className="text-xs font-black text-slate-900 uppercase">
                            #{ret.order_id?.orderId || "N/A"}
                          </span>
                        </td>
                        <td className="p-4 text-xs font-semibold text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <HiOutlineCalendarDays className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            {new Date(ret.requested_at || ret.createdAt).toLocaleString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="min-w-[120px]">
                            <p className="text-xs font-bold text-slate-900">{ret.customer_id?.name || "Customer"}</p>
                            <p className="text-[10px] font-semibold text-slate-500 mt-0.5">{ret.customer_id?.phone}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="min-w-[120px]">
                            <p className="text-xs font-bold text-slate-900">{ret.seller_id?.shopName || "Seller"}</p>
                            <p className="text-[10px] font-semibold text-slate-500 mt-0.5">{ret.seller_id?.name}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-xs font-black text-slate-950">₹{ret.refund_amount || 0}</span>
                        </td>
                        <td className="p-4 text-center">
                          <Badge variant={getStatusVariant(ret.status)} className="font-black uppercase tracking-wider text-[9px]">
                            {mapStatusLabel(ret.status)}
                          </Badge>
                        </td>
                        <td className="p-4 text-right">
                          <Button
                            onClick={() => openDetails(ret)}
                            variant="outline"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border-slate-200 text-slate-700 bg-white hover:bg-slate-100 text-xs font-bold shadow-sm"
                          >
                            <span>Inspect</span>
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="block md:hidden space-y-3">
                {returns.map((ret) => (
                  <div
                    key={ret._id || ret.id}
                    className="border border-slate-100 rounded-xl p-4 bg-slate-50/30 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900">
                        #{ret.order_id?.orderId || "N/A"}
                      </span>
                      <Badge variant={getStatusVariant(ret.status)} className="font-black uppercase text-[8px]">
                        {mapStatusLabel(ret.status)}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Customer</p>
                        <p className="font-bold text-slate-900 truncate mt-0.5">{ret.customer_id?.name || "Customer"}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Store / Seller</p>
                        <p className="font-bold text-slate-900 truncate mt-0.5">{ret.seller_id?.shopName || "Seller"}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Date / Time</p>
                        <p className="font-semibold text-slate-600 mt-0.5">
                          {new Date(ret.requested_at || ret.createdAt).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Refund Amount</p>
                        <p className="font-black text-slate-950 mt-0.5">₹{ret.refund_amount || 0}</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex justify-end">
                      <Button
                        onClick={() => openDetails(ret)}
                        variant="outline"
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-slate-700 bg-white hover:bg-slate-100 text-xs font-bold shadow-sm"
                      >
                        <HiOutlineEye className="h-4 w-4" />
                        <span>Inspect Return Request</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Component */}
              <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                pageSize={pageSize}
                onPageChange={handlePageChange}
                onPageSizeChange={setPageSize}
                loading={loading}
              />
            </div>
          )}
        </Card>
      </BlurFade>

      {/* Details Side Drawer Modal */}
      <AnimatePresence>
        {isDetailsOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 overflow-hidden pointer-events-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm"
              onClick={() => !submittingAction && setIsDetailsOpen(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-4xl relative z-10 bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
              style={{ maxHeight: 'calc(100vh - 2rem)' }}
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0 bg-slate-50/50">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-slate-900">
                      Inspect Return Request
                    </h3>
                    <Badge variant={selectedReturn ? getStatusVariant(selectedReturn.status) : "gray"} className="font-black uppercase tracking-widest text-[9px] px-2 py-0.5">
                      {selectedReturn ? mapStatusLabel(selectedReturn.status) : "LOADING"}
                    </Badge>
                  </div>
                  {selectedReturn && (
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      Order: #{selectedReturn.order_id?.orderId || "N/A"} • Return Request ID: {selectedReturn._id || selectedReturn.id}
                    </p>
                  )}
                </div>
                <button
                  disabled={submittingAction}
                  onClick={() => setIsDetailsOpen(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500 hover:text-slate-800 disabled:opacity-40"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Drawer Content */}
              {loadingDetail ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12">
                  <Loader2 className="h-10 w-10 text-slate-800 animate-spin" />
                  <p className="text-slate-500 font-bold mt-4 uppercase tracking-widest text-xs">
                    Decrypting transaction history...
                  </p>
                </div>
              ) : selectedReturn ? (
                <div className="overflow-y-auto overscroll-contain flex-1 p-6 space-y-6">
                  {/* Summary & Core Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left Column: Return info & items */}
                    <div className="md:col-span-2 space-y-6">
                      {/* Return Info Box */}
                      <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100 space-y-3">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Return Description</h4>
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-800">
                            Reason: <span className="font-medium text-slate-600 bg-white border border-slate-100 rounded-md px-1.5 py-0.5 text-xs capitalize">{selectedReturn.reason?.replace(/_/g, " ") || "N/A"}</span>
                          </p>
                          {selectedReturn.reason_description && (
                            <p className="text-xs text-slate-700 font-medium italic bg-white/70 p-3 rounded-xl border border-slate-100 mt-2 leading-relaxed">
                              "{selectedReturn.reason_description}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Items List */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Ordered Items</h4>
                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                          {(selectedReturn.order_id?.items || []).map((item, idx) => {
                            const name = item.name || item.product?.name || "Product Item";
                            const qty = item.quantity || item.qty || 1;
                            const price = item.price || 0;
                            return (
                              <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 hover:border-slate-200 transition-all">
                                <div>
                                  <p className="text-xs font-black text-slate-800">{name}</p>
                                  <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Quantity: {qty}</p>
                                </div>
                                <span className="text-xs font-black text-slate-900">₹{price * qty}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Uploaded Customer Photos */}
                      {selectedReturn.product_images?.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">
                            Customer Uploaded Photos ({selectedReturn.product_images.length})
                          </h4>
                          <div className="flex flex-wrap gap-3">
                            {selectedReturn.product_images.map((img, idx) => (
                              <a
                                key={idx}
                                href={img}
                                target="_blank"
                                rel="noreferrer"
                                className="relative aspect-square w-24 rounded-2xl overflow-hidden border border-slate-200 hover:border-slate-400 transition-all shadow-sm group shrink-0"
                              >
                                <img src={img} alt={`Claim upload ${idx}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                <div className="absolute inset-0 bg-black/10 hover:bg-transparent transition-colors" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Status History Timeline */}
                      <div className="space-y-4">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Audit Logs & Timeline</h4>
                        <div className="space-y-4 relative border-l-2 border-slate-100 pl-4 ml-2">
                          {selectedReturn.status_history?.map((history, idx) => (
                            <div key={idx} className="relative">
                              <span className="absolute -left-[22px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-2 ring-indigo-500 shrink-0">
                                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                              </span>
                              <div className="flex flex-col sm:flex-row sm:justify-between items-start gap-1">
                                <div>
                                  <span className="text-[9px] font-black text-indigo-800 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-lg mr-2 uppercase tracking-wide">
                                    {history.changed_by}
                                  </span>
                                  <span className="text-xs font-black text-slate-800">
                                    Transitioned to <span className="text-indigo-600 font-black">{mapStatusLabel(history.status)}</span>
                                  </span>
                                </div>
                                <span className="text-[10px] font-semibold text-slate-500">
                                  {new Date(history.changed_at || history.createdAt).toLocaleString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                              {history.note && (
                                <p className="text-xs text-slate-600 italic mt-1 font-medium bg-slate-50/50 p-2 rounded-xl border border-slate-100/50 max-w-xl">
                                  "{history.note}"
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Roles & Logistics */}
                    <div className="space-y-6">
                      {/* Customer Card */}
                      <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/20 space-y-2">
                        <div className="flex items-center gap-2 text-slate-800">
                          <HiOutlineUser className="h-4 w-4" />
                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Customer Details</h4>
                        </div>
                        <p className="text-sm font-black text-slate-900">{selectedReturn.customer_id?.name || "Customer"}</p>
                        <p className="text-xs font-bold text-slate-600">📞 {selectedReturn.customer_id?.phone}</p>
                      </div>

                      {/* Payout Bank Details Card */}
                      <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/20 space-y-2">
                        <div className="flex items-center gap-2 text-slate-800">
                          <CreditCard className="h-4 w-4 text-slate-500" />
                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Payout Bank Details</h4>
                        </div>
                        <div className="space-y-1.5 text-xs font-semibold text-slate-700">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Holder:</span>
                            <span className="font-bold text-slate-900">{selectedReturn.customer_id?.name || "Customer"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Bank Name:</span>
                            <span className="font-bold text-slate-900">{selectedReturn.customer_id?.bankName || "State Bank of India"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Account No:</span>
                            <span className="font-mono text-slate-900">
                              {selectedReturn.customer_id?.accountNumber || `XXXXXX${(selectedReturn.customer_id?.phone || "0000000000").slice(-4)}`}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">IFSC Code:</span>
                            <span className="font-mono text-slate-900">{selectedReturn.customer_id?.ifscCode || "SBIN0000102"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Seller Card */}
                      <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/20 space-y-2">
                        <div className="flex items-center gap-2 text-slate-800">
                          <HiOutlineBuildingStorefront className="h-4 w-4" />
                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Seller Details</h4>
                        </div>
                        <p className="text-sm font-black text-slate-900">{selectedReturn.seller_id?.shopName || "Seller Store"}</p>
                        <p className="text-xs font-bold text-slate-600">{selectedReturn.seller_id?.name}</p>
                      </div>

                      {/* Logistics Boy Card */}
                      {selectedReturn.delivery_boy_id && (
                        <div className="border border-slate-100 rounded-2xl p-4 bg-indigo-50/20 border-indigo-100/50 space-y-2">
                          <div className="flex items-center gap-2 text-indigo-700">
                            <HiOutlineTruck className="h-4 w-4" />
                            <h4 className="text-xs font-black uppercase tracking-widest text-indigo-600">Assigned Driver</h4>
                          </div>
                          <p className="text-sm font-black text-slate-900">{selectedReturn.delivery_boy_id.name}</p>
                          <p className="text-xs font-bold text-slate-600">📞 {selectedReturn.delivery_boy_id.phone}</p>
                          {selectedReturn.status === "PICKED_UP" && (
                            <span className="inline-block text-[9px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full uppercase mt-1 animate-pulse">
                              RIDER IN TRANSIT
                            </span>
                          )}
                        </div>
                      )}

                      {/* Refund status details */}
                      <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/20 space-y-2">
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Financial Summary</h4>
                        <div className="space-y-1.5 text-xs font-semibold text-slate-700">
                          <div className="flex justify-between">
                            <span>Refund Amount:</span>
                            <span className="font-black text-slate-900">₹{selectedReturn.refund_amount || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Preferred Method:</span>
                            <span className="uppercase text-slate-600 font-bold">{selectedReturn.refund_method || "Wallet"}</span>
                          </div>
                          {selectedReturn.refund_transaction_id && (
                            <div className="flex flex-col pt-1 border-t border-slate-100 mt-1">
                              <span className="text-[10px] text-slate-400">Txn Reference:</span>
                              <span className="text-[10px] font-black font-mono break-all text-slate-800">{selectedReturn.refund_transaction_id}</span>
                            </div>
                          )}
                          {selectedReturn.refund_completed_at && (
                            <div className="flex justify-between text-[10px] text-slate-500 pt-1">
                              <span>Settled At:</span>
                              <span>{new Date(selectedReturn.refund_completed_at).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Notes Box */}
                      {(selectedReturn.seller_note || selectedReturn.admin_note) && (
                        <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/20 space-y-2">
                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Rejections / Notes</h4>
                          {selectedReturn.seller_note && (
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase">Seller Note:</p>
                              <p className="text-xs text-slate-700 italic font-medium">"{selectedReturn.seller_note}"</p>
                            </div>
                          )}
                          {selectedReturn.admin_note && (
                            <div className="mt-2 pt-2 border-t border-slate-100/50">
                              <p className="text-[10px] font-black text-indigo-400 uppercase">Admin Note:</p>
                              <p className="text-xs text-indigo-950 italic font-medium">"{selectedReturn.admin_note}"</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Drawer Footer Actions */}
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between shrink-0">
                {/* Admin Force Override Options */}
                {selectedReturn && !loadingDetail && (
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1 flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
                      FORCE OVERRIDE:
                    </span>
                    <Button
                      disabled={submittingAction || selectedReturn.status === "SELLER_APPROVED"}
                      onClick={() => setOverrideModal({ open: true, action: "approve" })}
                      variant="outline"
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-black border-slate-200 text-slate-700 bg-white hover:bg-slate-100 shadow-sm"
                    >
                      APPROVE
                    </Button>
                    <Button
                      disabled={submittingAction || selectedReturn.status === "SELLER_REJECTED"}
                      onClick={() => setOverrideModal({ open: true, action: "reject" })}
                      variant="outline"
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-black border-slate-200 text-slate-700 bg-white hover:bg-slate-100 shadow-sm"
                    >
                      REJECT
                    </Button>
                    <Button
                      disabled={submittingAction || selectedReturn.status === "REFUND_INITIATED" || selectedReturn.status === "REFUND_COMPLETED"}
                      onClick={() => setOverrideModal({ open: true, action: "initiate_refund" })}
                      variant="outline"
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-black border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50 shadow-sm"
                    >
                      INITIATE REFUND
                    </Button>
                  </div>
                )}

                {/* Primary Actions (Initiate Refund / Settle Payout) */}
                <div className="flex gap-2 justify-end items-center shrink-0">
                  <button
                    disabled={submittingAction}
                    onClick={() => setIsDetailsOpen(false)}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all disabled:opacity-40"
                  >
                    Dismiss
                  </button>

                  {selectedReturn && !loadingDetail && (selectedReturn.status === "PICKED_UP" || selectedReturn.status === "DELIVERED_TO_SELLER" || selectedReturn.status === "UNDER_DISPUTE") && (
                    <Button
                      disabled={submittingAction}
                      onClick={openRefundModal}
                      className="bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white rounded-xl shadow-lg shadow-emerald-600/10 flex items-center gap-1.5 px-5 py-2.5"
                    >
                      <CreditCard className="h-4 w-4" />
                      <span>TRIGGER REFUND PAYOUT</span>
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Force Override Modal */}
      <AnimatePresence>
        {overrideModal.open && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
              onClick={() => !submittingAction && setOverrideModal({ open: false, action: null })}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              className="w-full max-w-md relative z-10 bg-white rounded-3xl shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center gap-2 text-indigo-700">
                <AlertTriangle className="h-5 w-5 text-indigo-600 animate-pulse" />
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-wide">
                  Enforce Override
                </h3>
              </div>
              
              <p className="text-xs text-slate-600 font-bold leading-relaxed">
                You are about to force transition Return Request state to:{" "}
                <span className="text-indigo-600 font-black uppercase">
                  {overrideModal.action ? mapStatusLabel(overrideModal.action) : ""}
                </span>
                . This action overrides all automatic state validation hooks and writes an entry directly in the system audit logs.
              </p>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Override Audit Explanation (Admin Note)
                </label>
                <textarea
                  className="w-full rounded-2xl border border-slate-200 p-4 text-xs font-semibold focus:ring-2 focus:ring-slate-900/10 outline-none transition-all"
                  rows={4}
                  placeholder="Provide brief justification for this force-override (required for records)..."
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 font-bold text-xs rounded-xl"
                  onClick={() => setOverrideModal({ open: false, action: null })}
                  disabled={submittingAction}
                >
                  Abadon Override
                </Button>
                <Button
                  className="flex-1 font-bold bg-indigo-600 hover:bg-indigo-700 text-xs rounded-xl"
                  onClick={handleOverrideSubmit}
                  isLoading={submittingAction}
                  disabled={!actionNote.trim() || submittingAction}
                >
                  Execute Override
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Trigger Refund Modal */}
      <AnimatePresence>
        {refundModal.open && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
              onClick={() => !submittingAction && setRefundModal({ open: false })}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              className="w-full max-w-md relative z-10 bg-white rounded-3xl shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center gap-2 text-emerald-700">
                <HiOutlineReceiptRefund className="h-6 w-6 text-emerald-600 shrink-0" />
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-wide">
                  Trigger Refund Payout
                </h3>
              </div>

              <p className="text-xs text-slate-600 font-bold leading-relaxed">
                Configure payout parameters to settle this transaction. Submitting will update the customer wallet or transaction logs, debit the seller, and mark this return request as successfully resolved.
              </p>

              <div className="space-y-4">
                {/* Refund Amount */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Settle Amount (₹)</label>
                  <input
                    type="number"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 p-3 text-sm font-black focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
                  />
                </div>

                {/* Refund Method */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Settle Method</label>
                  <select
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10 cursor-pointer"
                  >
                    <option value="wallet">Customer App Wallet Balance (Instant Credit)</option>
                    <option value="original_payment">Original Payment Gateway (Mark Log Only)</option>
                    <option value="bank_transfer">Direct Bank Transfer (Mark Log Only)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 font-bold text-xs rounded-xl"
                  onClick={() => setRefundModal({ open: false })}
                  disabled={submittingAction}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 font-bold bg-emerald-600 hover:bg-emerald-700 text-xs rounded-xl"
                  onClick={handleRefundSubmit}
                  isLoading={submittingAction}
                  disabled={refundAmount <= 0 || submittingAction}
                >
                  Execute Settle
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
