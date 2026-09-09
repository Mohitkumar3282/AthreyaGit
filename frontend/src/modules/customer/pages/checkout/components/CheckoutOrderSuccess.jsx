import React, { useEffect } from "react";
import { Check, ArrowRight, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import deliveryBagImg from "@/assets/coins/delivery_bag.jpg";
import walletCoinsImg from "@/assets/coins/wallet_coins.jpg";
import { playCoinSound } from "@/utils/soundEffects";

/**
 * CheckoutOrderSuccess
 *
 * Implements the Order Placed / Delivered card and Athreya Coins celebration.
 *
 * Props:
 *   orderId        – string order ID
 *   show           – boolean
 *   coinsEarned    – Athreya Coins this order will grant
 *   cashbackEarned – rupee wallet cashback
 *   savingsTotal   – savings amount
 *   coinValue      – rupee value of one coin (10,000 coins = ₹1.00 -> 0.0001)
 *   onUseCoins     – navigate to the wallet; cancels the auto-redirect
 */
const CheckoutOrderSuccess = React.memo(function CheckoutOrderSuccess({
  orderId,
  show,
  coinsEarned = 0,
  cashbackEarned = 0,
  savingsTotal = 0,
  coinValue = 0.001,
  onUseCoins,
}) {
  const earnedCoins = Number(coinsEarned || 0);
  const rupeeEarned = (earnedCoins * Number(coinValue || 0.001)).toFixed(2);

  // Automatically play a short coin/reward sound when the success message appears
  useEffect(() => {
    if (show) {
      playCoinSound();
    }
  }, [show]);

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
            <div className="bg-[#0d4d29] text-white py-4 px-6 text-center relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-28 h-28 bg-emerald-400/20 rounded-full blur-xl pointer-events-none" />
              <h2 className="text-base font-black tracking-widest uppercase relative z-10">
                ORDER CONFIRMATION
              </h2>
            </div>

            <div className="p-5 md:p-6 space-y-4 text-center">
              {/* Status Card */}
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

              {/* Athreya Coins Earned Celebratory Card */}
              {earnedCoins > 0 && (
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.15 }}
                  className="bg-gradient-to-b from-[#f6faf7] to-[#edf8f0] border-2 border-[#bbf7d0] rounded-2xl p-5 space-y-3.5 shadow-sm text-center relative overflow-hidden">
                  {/* Decorative background sparkle */}
                  <div className="absolute top-2 right-2 text-amber-400/60 pointer-events-none">
                    <Sparkles size={20} />
                  </div>

                  {/* Headline: 🎉 Congratulations! You earned 1000 coins on this order */}
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 bg-[#fde047]/80 text-amber-950 px-3 py-1 rounded-full text-xs font-[1000] uppercase tracking-wide shadow-2xs">
                      <span>🎉</span>
                      <span>Congratulations!</span>
                    </div>
                    <h3 className="text-lg md:text-xl font-[1000] text-[#0d592e] leading-snug pt-1">
                      🎉 Congratulations! You earned {earnedCoins.toLocaleString("en-IN")} coins on this order
                    </h3>
                  </div>

                  {/* Coin Badge & Wallet Value Card */}
                  <div className="bg-white rounded-xl p-3.5 border border-emerald-200/80 shadow-2xs space-y-2">
                    <div className="flex items-center justify-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-[#f59e0b] to-[#fde047] p-0.5 shadow-sm flex items-center justify-center shrink-0">
                        <img
                          src={walletCoinsImg}
                          alt="Athreya Coins"
                          className="h-full w-full object-cover rounded-full"
                        />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-[1000] text-slate-800 leading-tight">
                          🪙 {earnedCoins.toLocaleString("en-IN")} Athreya Coins Won
                        </p>
                        <p className="text-[11px] font-black text-[#0d592e] mt-0.5">
                          Added to Your Wallet <span className="text-slate-600 font-bold">(Value: ₹{rupeeEarned})</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] font-bold text-slate-500">
                    Use your coins on your next order for instant discounts.
                  </p>

                  {onUseCoins && (
                    <button
                      type="button"
                      onClick={onUseCoins}
                      className="w-full rounded-xl bg-[#0d592e] hover:bg-[#0a4a26] text-white py-2.5 text-xs font-[1000] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-sm">
                      <span>Use Coins on Next Order</span>
                      <ArrowRight size={14} strokeWidth={3} />
                    </button>
                  )}
                </motion.div>
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
