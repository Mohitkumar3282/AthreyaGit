import React from "react";
import { Check, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import deliveryBagImg from "@/assets/coins/delivery_bag.jpg";

const formatRupees = (value) => {
  const amount = Number(value || 0);
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
};

/**
 * CheckoutOrderSuccess
 *
 * Implements the Order Placed / Delivered card and COINS EARNED breakdown matching the reference design.
 *
 * Props:
 *   orderId        – string order ID
 *   show           – boolean
 *   coinsEarned    – Athreya Coins this order will grant
 *   cashbackEarned – rupee wallet cashback
 *   savingsTotal   – savings amount
 *   coinValue      – rupee value of one coin (1 paisa by default)
 */
const CheckoutOrderSuccess = React.memo(function CheckoutOrderSuccess({
  orderId,
  show,
  coinsEarned = 0,
  cashbackEarned = 0,
  savingsTotal = 0,
  coinValue = 0.01,
}) {
  const earnedCoins = Number(coinsEarned || 0);
  const totalSaved = Number(savingsTotal || 0);
  const rupeeEarned = (earnedCoins * Number(coinValue || 0.01)).toFixed(2);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] bg-slate-900/70 backdrop-blur-sm flex flex-col items-center justify-center p-4 overflow-y-auto font-sans">
          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: "spring", damping: 20 }}
            className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-emerald-100 my-auto">
            {/* Header */}
            <div className="bg-[#0d4d29] text-white py-4 px-6 text-center">
              <h2 className="text-base font-black tracking-widest uppercase">
                ORDER CONFIRMATION
              </h2>
            </div>

            <div className="p-5 md:p-6 space-y-4 text-center">
              {/* Status Card matching Screen 1 */}
              <div className="bg-white border-2 border-emerald-100 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3 text-left">
                  <div className="h-10 w-10 rounded-full bg-[#0d4d29] text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Check size={22} strokeWidth={3.5} />
                  </div>
                  <div>
                    <h3 className="font-[1000] text-slate-800 text-sm md:text-base leading-tight">
                      Order Placed Successfully!
                    </h3>
                    <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                      Thank you for choosing Athreya Delivery
                    </p>
                    <p className="text-[10px] font-bold text-[#0d4d29] mt-0.5">
                      Order #{orderId?.slice(-6)}
                    </p>
                  </div>
                </div>

                <div className="h-14 w-14 shrink-0 rounded-xl overflow-hidden bg-amber-50 p-1 border border-amber-200">
                  <img
                    src={deliveryBagImg}
                    alt="Athreya Delivery Bag"
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>

              {/* COINS EARNED breakdown matching Screen 2 */}
              {earnedCoins > 0 && (
                <div className="bg-[#f6faf7] border border-emerald-100 rounded-2xl p-4 space-y-3">
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-bold text-slate-600">You saved</p>
                    <div className="text-3xl font-[1000] text-[#0d4d29]">
                      ₹{formatRupees(totalSaved)}
                    </div>
                    <p className="text-[11px] font-bold text-slate-600">on this order</p>
                  </div>

                  {/* Math Equation */}
                  <div className="bg-white py-1.5 px-3 rounded-xl border border-slate-200 text-xs font-black text-slate-700 flex items-center justify-center gap-1.5 shadow-2xs">
                    <span>₹{formatRupees(totalSaved)}</span>
                    <span className="text-slate-400 font-normal">(₹)</span>
                    <span className="text-slate-400">×</span>
                    <span>1%</span>
                    <span className="text-slate-500 font-medium">Rupee</span>
                    <span className="text-slate-400">=</span>
                    <span className="text-[#0d4d29] font-[1000]">{rupeeEarned} Rupee</span>
                  </div>

                  {/* Coins to Rupee visual flow */}
                  <div className="flex items-center justify-center gap-3 pt-1">
                    <div className="h-12 w-12 rounded-full bg-[#fcd34d] border-2 border-[#f59e0b] flex flex-col items-center justify-center text-center shadow-xs">
                      <span className="text-xs font-[1000] text-[#78350f] leading-none">
                        {earnedCoins}
                      </span>
                      <span className="text-[7px] font-black text-[#92400e] tracking-tight uppercase">
                        COINS
                      </span>
                    </div>

                    <span className="text-xs font-bold text-[#0d4d29]">➔</span>

                    <div className="h-12 w-12 rounded-full bg-[#86efac] border-2 border-[#22c55e] flex flex-col items-center justify-center text-center shadow-xs">
                      <span className="text-[10px] font-[1000] text-[#14532d] leading-none">
                        ₹{rupeeEarned}
                      </span>
                      <span className="text-[7px] font-black text-[#166534] tracking-tight uppercase">
                        RUPEE
                      </span>
                    </div>
                  </div>

                  {/* You Earned Reward Badge */}
                  <div className="bg-[#edf8f0] border border-[#bbf7d0] rounded-xl p-3 flex items-center justify-between px-4">
                    <div className="flex items-center gap-2.5 text-left">
                      <div className="h-7 w-7 rounded-full bg-[#0d592e] text-white flex items-center justify-center">
                        <Check size={16} strokeWidth={3.5} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-600 uppercase">You Earned</p>
                        <p className="text-base font-[1000] text-[#0d592e] leading-tight">
                          {earnedCoins.toLocaleString("en-IN")} Coins
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#166534] bg-white px-2 py-1 rounded-lg border border-emerald-200">
                      ₹{rupeeEarned} Value
                    </span>
                  </div>
                </div>
              )}

              {/* Progress bar and redirect indicator */}
              <div className="space-y-2 pt-2">
                <p className="text-xs text-slate-500 font-medium">
                  Redirecting to live order tracking…
                </p>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 2.5, ease: "linear" }}
                    className="h-full bg-[#0d4d29]"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default CheckoutOrderSuccess;
