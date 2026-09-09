import React, { useEffect } from "react";
import { ChevronLeft, Check, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import walletCoinsImg from "@/assets/coins/wallet_coins.jpg";
import { playCoinSound } from "@/utils/soundEffects";

/**
 * CoinsEarnedModal / View
 *
 * Displays the Athreya Coins reward and wallet conversion.
 *
 * Props:
 *   isOpen: boolean
 *   onClose: () => void
 *   coinsEarned: number (e.g. 1000)
 *   rupeeValue: number (e.g. 1.00)
 *   isInline: boolean (if rendered as a standalone card instead of modal)
 */
export const CoinsEarnedModal = ({
  isOpen = true,
  onClose,
  coinsEarned = 1000,
  rupeeValue,
  isInline = false,
}) => {
  const navigate = useNavigate();

  const formattedCoins = Number(coinsEarned || 0);
  const calculatedRupee = Number(
    rupeeValue !== undefined ? rupeeValue : formattedCoins * 0.001,
  ).toFixed(2);

  // Play celebratory sound on modal open
  useEffect(() => {
    if (isOpen) {
      playCoinSound();
    }
  }, [isOpen]);

  const content = (
    <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-emerald-100 flex flex-col font-sans">
      {/* Dark Green Header */}
      <div className="bg-[#0d4d29] text-white px-5 py-4 flex items-center justify-between">
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/15 active:scale-95 transition-all -ml-1 text-white"
          aria-label="Back">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-base font-black tracking-widest uppercase text-white">
          ATHREYA COINS REWARD
        </h2>
        <div className="w-8" />
      </div>

      {/* Main Content */}
      <div className="p-6 md:p-8 flex flex-col items-center text-center space-y-6">
        {/* Coins Earned Header */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 bg-[#fde047]/80 text-amber-950 px-3 py-1 rounded-full text-xs font-[1000] uppercase tracking-wide">
            <span>🎉</span>
            <span>Congratulations!</span>
          </div>
          <div className="text-2xl md:text-3xl font-[1000] text-[#0d592e] tracking-tight pt-1 leading-snug">
            🎉 Congratulations! You earned {formattedCoins.toLocaleString("en-IN")} coins on this order
          </div>
          <p className="text-xs font-bold text-slate-500">
            Added to your Athreya Wallet
          </p>
        </div>

        {/* Conversion & Value Box */}
        <div className="w-full bg-[#f6faf7] border border-emerald-100/80 rounded-2xl p-5 space-y-4">
          <div className="text-xs font-black text-slate-800 tracking-wide uppercase">
            1,000 Athreya Coins = ₹1.00 Rupee
          </div>

          {/* Yellow Coin Badge -> Green Rupee Badge Conversion */}
          <div className="flex items-center justify-center gap-4 pt-1">
            <div className="h-16 w-16 rounded-full bg-[#fcd34d] border-2 border-[#f59e0b] flex flex-col items-center justify-center text-center shadow-md">
              <span className="text-xs font-[1000] text-[#78350f] leading-none">
                {formattedCoins > 99999 ? `${Math.round(formattedCoins / 1000)}k` : formattedCoins.toLocaleString("en-IN")}
              </span>
              <span className="text-[8px] font-black text-[#92400e] tracking-tight uppercase mt-0.5">
                COINS
              </span>
            </div>

            <div className="flex flex-col items-center text-[#0d592e]">
              <span className="text-base font-black mb-0.5">➔</span>
            </div>

            <div className="h-16 w-16 rounded-full bg-[#86efac] border-2 border-[#22c55e] flex flex-col items-center justify-center text-center shadow-md">
              <span className="text-xs font-[1000] text-[#14532d] leading-none">
                ₹{calculatedRupee}
              </span>
              <span className="text-[8px] font-black text-[#166534] tracking-tight uppercase mt-0.5">
                VALUE
              </span>
            </div>
          </div>

          <div className="bg-white py-2 px-3 rounded-xl border border-slate-200/80 shadow-2xs text-xs font-bold text-slate-700">
            1,000 Coins = <span className="text-[#0d592e] font-[1000]">₹1.00 Rupee</span> in your wallet
          </div>
        </div>

        {/* You Earned Bottom Summary Card */}
        <div className="w-full bg-[#edf8f0] border border-[#bbf7d0] rounded-2xl p-5 flex flex-col items-center text-center space-y-1.5 shadow-2xs">
          <div className="h-12 w-12 rounded-full bg-[#0d592e] text-white flex items-center justify-center shadow-sm mb-1">
            <Check size={26} strokeWidth={3.5} />
          </div>
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Total Reward Value
          </p>
          <div className="text-2xl md:text-3xl font-[1000] text-[#0d592e] tracking-tight">
            ₹{calculatedRupee}
          </div>
          <p className="text-xs font-bold text-[#166534]">
            ({formattedCoins.toLocaleString("en-IN")} Athreya Coins Credited)
          </p>
        </div>

        {/* Action Button */}
        <div className="w-full space-y-2 pt-2">
          <button
            onClick={() => {
              if (onClose) onClose();
              navigate("/wallet");
            }}
            className="w-full py-3.5 px-4 bg-[#0d592e] hover:bg-[#12401f] text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-98 flex items-center justify-center gap-2">
            <span>View in Your Wallet</span>
            <ArrowRight size={16} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="w-full py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors">
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (isInline) {
    return content;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="w-full max-w-md">
            {content}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CoinsEarnedModal;
