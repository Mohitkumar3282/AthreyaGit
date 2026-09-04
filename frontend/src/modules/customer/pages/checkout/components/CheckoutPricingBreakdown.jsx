import React, { useState } from "react";
import { Clipboard, Heart, Wallet, ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import piggyBankImg from "@/assets/coins/piggy_bank.jpg";

/**
 * CheckoutPricingBreakdown
 *
 * Implements the Bill Summary + "SAVED MONEY ON THIS ORDER" card matching the reference image.
 *
 * Props:
 *   pricingPreview    – breakdown object from the preview API (or null)
 *   isPreviewLoading  – boolean
 *   selectedTip       – number
 *   onSelectTip       – (value) => void
 *   tipAmounts        – array of { value, label }
 *   walletAmountToUse – number (wallet balance the server applied)
 *   cashback          – number
 *   coinsDiscount     – number (rupee value of redeemed Athreya Coins)
 *   coinsRedeemed     – number (coin count)
 *   finalAmountToPay  – number
 *   cartTotal         – number (fallback while the preview is loading)
 *   selectedCoupon    – coupon object or null
 *   discountAmount    – number
 */

const currency = (value) => `₹${Number(value || 0).toFixed(2).replace(/\.00$/, "")}`;

function BillRow({ label, value, hint, tone = "default", isBold = false }) {
  const valueTone =
    tone === "credit" ? "text-[#1a6e2e]" : isBold ? "text-slate-900 font-[1000]" : "text-slate-800 font-bold";
  return (
    <div className="flex justify-between items-center py-1 px-1">
      <div className="flex flex-col">
        <span className={`text-[13px] ${isBold ? "font-[1000] text-slate-800" : "font-bold text-slate-600"}`}>
          {label}
        </span>
        {hint && (
          <span className="text-[11px] font-semibold text-slate-400 mt-0.5">
            {hint}
          </span>
        )}
      </div>
      <span className={`text-sm md:text-base ${valueTone}`}>{value}</span>
    </div>
  );
}

const CheckoutPricingBreakdown = React.memo(function CheckoutPricingBreakdown({
  pricingPreview,
  isPreviewLoading,
  selectedTip,
  onSelectTip,
  tipAmounts,
  walletAmountToUse,
  cashback = 0,
  coinsDiscount = 0,
  coinsRedeemed = 0,
  finalAmountToPay,
  cartTotal,
  selectedCoupon,
  discountAmount,
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const itemTotal = pricingPreview?.productSubtotal ?? cartTotal;
  const deliveryFee = pricingPreview?.deliveryFeeCharged || 0;
  const handlingFee = pricingPreview?.handlingFeeCharged || 3; // Platform fee
  const tipAmount = pricingPreview?.tipTotal ?? selectedTip ?? 0;
  const taxAmount = pricingPreview?.taxTotal || 0;
  const savingsTotal = Number(pricingPreview?.savingsTotal || 0) + Number(discountAmount || 0) + Number(coinsDiscount || 0);

  const distanceHint =
    typeof pricingPreview?.distanceKmActual === "number" &&
    pricingPreview.distanceKmActual > 0
      ? `${pricingPreview.distanceKmActual.toFixed(2)} km away`
      : null;

  return (
    <div className="space-y-4">
      {/* Tip for Partner (if tip amounts provided) */}
      {tipAmounts && tipAmounts.length > 0 && (
        <motion.div className="bg-white rounded-3xl p-4 border border-[#1a6e2e]/20 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <Heart size={16} className="text-[#1a6e2e] fill-[#1a6e2e]" />
            <h3 className="font-bold text-slate-800 text-sm">Tip your delivery partner</h3>
          </div>
          <p className="text-[11px] text-slate-500 mb-3">100% of the tip goes directly to the partner</p>
          <div className="grid grid-cols-4 gap-2">
            {tipAmounts.map((tip) => (
              <button
                key={tip.value}
                onClick={() => onSelectTip(tip.value)}
                className={`py-1.5 rounded-xl border-2 transition-all font-black text-xs ${
                  selectedTip === tip.value
                    ? "border-[#1a6e2e] bg-[#1a6e2e]/10 text-[#1a6e2e]"
                    : "border-slate-200 bg-white text-slate-700 hover:border-[#1a6e2e]/40"
                }`}>
                {tip.label}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Bill Summary Card */}
      <motion.div className="bg-white rounded-3xl p-5 md:p-6 border border-[#1a6e2e]/20 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-[#1a6e2e]/10 flex items-center justify-center">
              <Clipboard size={16} className="text-[#1a6e2e]" />
            </div>
            <h3 className="font-[1000] text-slate-800 text-base tracking-tight uppercase">
              Bill Summary
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            className="text-[11px] font-bold text-[#1a6e2e] flex items-center gap-1">
            <span>{isExpanded ? "Collapse" : "Details"}</span>
            <ChevronDown size={14} className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Breakdown Line Items */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-2 overflow-hidden border-b border-slate-100 pb-3">
              <BillRow label="Subtotal" value={currency(itemTotal)} />

              <BillRow
                label="Delivery Fee"
                value={deliveryFee > 0 ? currency(deliveryFee) : "FREE"}
                hint={distanceHint}
                tone={deliveryFee === 0 ? "credit" : "default"}
              />

              <BillRow label="Platform Fee" value={currency(handlingFee)} />

              {taxAmount > 0 && (
                <BillRow label="Taxes & Charges" value={currency(taxAmount)} />
              )}

              {selectedCoupon && discountAmount > 0 && (
                <BillRow
                  label="Coupon Discount"
                  value={`-${currency(discountAmount)}`}
                  hint={selectedCoupon.code}
                  tone="credit"
                />
              )}

              {tipAmount > 0 && (
                <BillRow label="Delivery Partner Tip" value={currency(tipAmount)} />
              )}

              {walletAmountToUse > 0 && (
                <BillRow
                  label="Wallet Applied"
                  value={`-${currency(walletAmountToUse)}`}
                  tone="credit"
                />
              )}

              {coinsDiscount > 0 && (
                <BillRow
                  label="Athreya Coins"
                  value={`-${currency(coinsDiscount)}`}
                  hint={`${coinsRedeemed.toLocaleString("en-IN")} coins redeemed`}
                  tone="credit"
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Total Paid / To Pay */}
        <div className="flex justify-between items-center pt-1">
          <div className="flex flex-col">
            <span className="font-[1000] text-slate-900 text-base md:text-lg uppercase tracking-tight">
              {finalAmountToPay === 0 ? "Total Paid" : "Total Paid"}
            </span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Inclusive of all taxes
            </span>
          </div>
          <span className="font-[1000] text-slate-900 text-2xl md:text-3xl tracking-tight">
            {isPreviewLoading ? "Calculating…" : `₹${Math.ceil(finalAmountToPay || itemTotal + deliveryFee + handlingFee)}`}
          </span>
        </div>
      </motion.div>

      {/* SAVED MONEY ON THIS ORDER Highlight Card — matches reference image */}
      {savingsTotal > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-[#fefce8] border-2 border-[#fef08a] p-4 md:p-5 flex items-center justify-between gap-4 shadow-sm relative overflow-hidden">
          <div className="space-y-1 z-10 min-w-0">
            <div className="inline-flex items-center gap-1.5 bg-[#fde047]/60 px-2.5 py-1 rounded-full text-[10px] font-[1000] text-amber-900 uppercase tracking-wider">
              <span className="h-3.5 w-3.5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[9px]">
                ✓
              </span>
              <span>SAVED MONEY ON THIS ORDER</span>
            </div>

            <div className="text-3xl md:text-4xl font-[1000] text-[#0d592e] tracking-tight pt-1">
              ₹{savingsTotal.toFixed(2)}
            </div>

            <p className="text-xs font-bold text-amber-950/80">
              Great! You saved ₹{Math.round(savingsTotal)} on this order.
            </p>
          </div>

          <div className="h-20 w-20 md:h-24 md:w-24 shrink-0 rounded-2xl overflow-hidden bg-white/70 p-1.5 shadow-sm border border-amber-200">
            <img
              src={piggyBankImg}
              alt="Savings Piggy Bank"
              className="h-full w-full object-contain"
            />
          </div>
        </motion.div>
      )}
    </div>
  );
});

export default CheckoutPricingBreakdown;
