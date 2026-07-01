import React from "react";
import { Tag, Check, Search } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * CheckoutCouponSection
 *
 * Props:
 *   coupons           – array of coupon objects
 *   selectedCoupon    – currently applied coupon or null
 *   manualCode        – string value of the manual code input
 *   onApplyCoupon     – (coupon) => void
 *   onRemoveCoupon    – () => void
 *   onManualCodeChange – (value) => void
 *   isOpen            – boolean — controls the coupon modal
 *   onOpenChange      – (open) => void
 *   onApplyManualCode – () => void — triggered when user clicks CHECK
 */
const CheckoutCouponSection = React.memo(function CheckoutCouponSection({
  coupons,
  selectedCoupon,
  manualCode,
  onApplyCoupon,
  onRemoveCoupon,
  onManualCodeChange,
  isOpen,
  onOpenChange,
  onApplyManualCode,
}) {
  return (
    <>
      {/* Inline coupon carousel */}
      <motion.div className="bg-white rounded-2xl p-4 border border-[#1a6e2e]/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Tag size={20} className="text-[#1a6e2e]" />
            <h3 className="font-black text-slate-800">Available Coupons</h3>
          </div>
          <button
            onClick={() => onOpenChange(true)}
            className="text-[#1a6e2e] text-sm font-bold hover:underline">
            See All
          </button>
        </div>
        {coupons.length === 0 ? (
          <p className="text-xs text-slate-400 font-medium py-2">
            No coupons available right now.
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar -mx-4 px-4 snap-x">
            {coupons.map((coupon) => {
              const isApplied = selectedCoupon?.code === coupon.code;
              return (
                <div
                  key={coupon.code}
                  className={`flex-shrink-0 w-[200px] snap-start rounded-2xl border-2 border-dashed p-3 flex flex-col gap-2 transition-all ${
                    isApplied
                      ? "border-[#1a6e2e] bg-[#1a6e2e]/10"
                      : "border-[#1a6e2e]/20 bg-white"
                  }`}>
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-black px-2 py-0.5 rounded-lg tracking-widest uppercase ${
                        isApplied
                          ? "bg-[#1a6e2e]/20 text-[#1a6e2e]"
                          : "bg-[#1a6e2e]/10 text-[#1a6e2e]"
                      }`}>
                      {coupon.code}
                    </span>
                    {isApplied && (
                      <span className="text-[10px] font-black text-[#1a6e2e] uppercase tracking-wide">
                        ✓ Applied
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-black text-slate-800 leading-tight">
                    {coupon.discountType === "percentage"
                      ? `${coupon.discountValue}% OFF`
                      : `₹${coupon.discountValue} OFF`}
                    {coupon.minOrderValue > 0 && (
                      <span className="block text-[10px] font-medium text-slate-500">
                        on orders above ₹{coupon.minOrderValue}
                      </span>
                    )}
                  </p>
                  {coupon.description && (
                    <p className="text-[10px] text-slate-500 leading-snug line-clamp-2">
                      {coupon.description}
                    </p>
                  )}
                  {isApplied ? (
                    <button
                      onClick={onRemoveCoupon}
                      className="mt-auto w-full py-1.5 rounded-xl text-xs font-black bg-[#1a6e2e]/10 text-[#1a6e2e] hover:bg-[#1a6e2e]/20 active:scale-95 transition-all">
                      Remove
                    </button>
                  ) : (
                    <button
                      onClick={() => onApplyCoupon(coupon)}
                      className="mt-auto w-full py-1.5 rounded-xl text-xs font-black bg-[#1a6e2e] text-white hover:opacity-90 active:scale-95 transition-all">
                      Apply
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Coupon Selection Modal */}
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Apply Coupon</DialogTitle>
            <DialogDescription>Browse available offers and save more.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {coupons.map((coupon) => (
              <div
                key={coupon.code}
                className={`p-4 rounded-2xl border-2 transition-all relative overflow-hidden ${
                  selectedCoupon?.code === coupon.code
                    ? "border-[#1a6e2e] bg-[#1a6e2e]/10"
                    : "border-[#1a6e2e]/20 bg-white hover:border-[#1a6e2e]/40"
                }`}>
                {selectedCoupon?.code === coupon.code && (
                  <div className="absolute top-0 right-0 p-1.5 bg-[#1a6e2e] text-white rounded-bl-xl">
                    <Check size={12} strokeWidth={4} />
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <div
                    className={`p-3 rounded-2xl ${
                      selectedCoupon?.code === coupon.code
                        ? "bg-[#1a6e2e]/20 text-[#1a6e2e]"
                        : "bg-[#1a6e2e]/10 text-[#1a6e2e]"
                    }`}>
                    <Tag size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-slate-800 tracking-wider mb-1">
                      {coupon.code}
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed mb-3">
                      {coupon.description}
                    </p>
                    <button
                      onClick={() => onApplyCoupon(coupon)}
                      disabled={selectedCoupon?.code === coupon.code}
                      className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${
                        selectedCoupon?.code === coupon.code
                          ? "bg-white text-[#1a6e2e] border-2 border-[#1a6e2e] cursor-default"
                          : "bg-[#1a6e2e] text-white hover:opacity-90"
                      }`}>
                      {selectedCoupon?.code === coupon.code ? "Applied" : "Apply Now"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-2">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <Input
                placeholder="Enter coupon code manually"
                value={manualCode}
                onChange={(e) => onManualCodeChange(e.target.value.toUpperCase())}
                className="pl-10 h-12 rounded-xl focus-visible:ring-[#1a6e2e]"
              />
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1a6e2e] font-bold text-xs"
                onClick={onApplyManualCode}>
                CHECK
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

export default CheckoutCouponSection;
