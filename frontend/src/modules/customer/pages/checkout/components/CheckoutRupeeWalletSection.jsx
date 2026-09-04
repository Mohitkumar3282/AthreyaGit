import React from "react";
import { Wallet, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * CheckoutRupeeWalletSection
 *
 * Displays the customer's Rupee Wallet (Cashback / Refunds) in emerald green.
 *
 * Props:
 *   walletBalance     – number (available rupee balance)
 *   useWallet         – boolean (is applied)
 *   onToggleWallet    – () => void
 *   walletAmountToUse – number (amount applied to this order)
 */
const CheckoutRupeeWalletSection = React.memo(function CheckoutRupeeWalletSection({
  walletBalance = 0,
  useWallet = false,
  onToggleWallet,
  walletAmountToUse = 0,
}) {
  const balance = Number(walletBalance || 0);

  if (balance <= 0) {
    return null;
  }

  return (
    <motion.div className="rounded-3xl bg-[#edf8f0] border-2 border-emerald-300 p-5 shadow-xs overflow-hidden relative font-sans">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-11 w-11 rounded-2xl bg-[#0d4d29] text-white flex items-center justify-center shadow-xs shrink-0">
            <Wallet size={20} className="text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-[1000] text-[#0d4d29] uppercase tracking-wider">
                Rupee Wallet
              </h4>
              <span className="bg-emerald-200 text-[#0d4d29] text-[9px] font-[1000] px-1.5 py-0.5 rounded">
                Cashback & Refunds
              </span>
            </div>
            <p className="text-sm font-[1000] text-slate-800 tracking-tight mt-0.5">
              Available: ₹{balance.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          type="button"
          onClick={onToggleWallet}
          aria-pressed={useWallet}
          className={`w-12 h-6 rounded-full transition-all duration-300 relative flex items-center px-1 shrink-0 ${
            useWallet ? "bg-[#0d4d29]" : "bg-slate-300"
          }`}>
          <motion.div
            animate={{ x: useWallet ? 24 : 0 }}
            className="h-4 w-4 rounded-full bg-white shadow-sm"
          />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {useWallet && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">
            <div className="pt-3 border-t border-emerald-200/80 mt-3 space-y-1.5">
              <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-emerald-200 shadow-2xs">
                <span className="text-xs font-bold text-slate-600 uppercase">
                  Wallet Balance Used
                </span>
                <span className="text-sm font-[1000] text-[#0d4d29]">
                  -₹{Number(walletAmountToUse || 0).toFixed(2)}
                </span>
              </div>
              <p className="text-[10px] font-semibold text-slate-500 pl-1">
                ✓ Directly deducted from your final payable amount.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export default CheckoutRupeeWalletSection;
