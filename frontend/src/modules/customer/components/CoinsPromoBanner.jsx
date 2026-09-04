import React from "react";
import { ShoppingBag, Star, ArrowRight, ShoppingCart, Sparkles, Check } from "lucide-react";
import piggyBankImg from "@/assets/coins/piggy_bank.jpg";
import walletCoinsImg from "@/assets/coins/wallet_coins.jpg";
import deliveryBagImg from "@/assets/coins/delivery_bag.jpg";

/**
 * CoinsPromoBanner
 *
 * Props:
 *   variant: 'full' | 'compact' | 'footer' | 'checkout'
 */
export const CoinsPromoBanner = ({ variant = "full", className = "" }) => {
  if (variant === "footer") {
    return (
      <div className={`w-full rounded-2xl bg-[#0a3f22] text-white p-3 md:p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-md ${className}`}>
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="bg-[#12401f] text-[#f7d154] text-[11px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl border border-[#f7d154]/30 shadow-sm">
            HOW IT WORKS
          </span>
        </div>

        {/* Steps Flow */}
        <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 text-xs font-bold text-white/90">
          <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg">
            <span className="text-emerald-400">🛍️</span> You Place an Order
          </div>
          <ArrowRight size={14} className="text-emerald-300" />
          <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg">
            <span className="text-amber-300">🐷</span> You Save Money
          </div>
          <ArrowRight size={14} className="text-emerald-300" />
          <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg">
            <span className="text-yellow-300">⭐</span> You Earn Coins (1% of Savings)
          </div>
          <ArrowRight size={14} className="text-emerald-300" />
          <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg">
            <span className="text-amber-400">🪙</span> 100 Coins = ₹1 Rupee
          </div>
          <ArrowRight size={14} className="text-emerald-300" />
          <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg">
            <span className="text-emerald-300">🛒</span> Use on Next Order
          </div>
        </div>

        {/* Highlight badge */}
        <div className="shrink-0 bg-gradient-to-r from-[#0d592e] to-[#12401f] border border-[#f7d154]/40 rounded-xl px-3.5 py-2 text-center md:text-right shadow-sm">
          <div className="flex items-center justify-center md:justify-end gap-1.5">
            <span className="h-5 w-5 rounded-full bg-[#f7d154] text-[#0a3f22] flex items-center justify-center text-xs font-black">
              ★
            </span>
            <span className="text-[11px] font-black uppercase tracking-wider text-white">
              MORE YOU SAVE, MORE YOU EARN!
            </span>
          </div>
          <p className="text-xs font-black text-[#f7d154] tracking-tight mt-0.5">
            100 COINS = ₹1 RUPEE
          </p>
        </div>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={`w-full rounded-2xl bg-gradient-to-r from-[#0d4d29] via-[#125c34] to-[#0a3f22] text-white p-3.5 md:p-4 shadow-sm border border-emerald-600/30 ${className}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-xl overflow-hidden bg-emerald-950/40 p-1 border border-amber-400/40 shrink-0 shadow-xs">
              <img
                src={walletCoinsImg}
                alt="Coins"
                className="h-full w-full object-cover rounded-lg"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center flex-wrap gap-1.5">
                <h4 className="text-xs md:text-sm font-[1000] text-white tracking-wide uppercase">
                  EARN COINS, SAVE MONEY!
                </h4>
                <span className="bg-[#fcd34d] text-[#0d4d29] text-[9px] md:text-[10px] font-[1000] px-1.5 py-0.5 rounded shadow-2xs">
                  100 = ₹1
                </span>
              </div>
              <p className="text-[11px] font-semibold text-emerald-100 mt-0.5 leading-snug">
                1% of your total order savings credited as coins to your wallet.
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-1 text-[11px] font-[1000] uppercase tracking-wider text-[#fcd34d] shrink-0 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
            <span>Use on next order</span>
            <ArrowRight size={12} />
          </div>
        </div>
      </div>
    );
  }

  // Full variant (Hero Header Banner matching the top of the reference image)
  return (
    <div className={`w-full rounded-3xl bg-white border border-emerald-100 shadow-sm overflow-hidden ${className}`}>
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-[#0a3f22] via-[#0d592e] to-[#0a3f22] text-white p-5 md:p-6 relative overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-amber-400/15 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <div className="inline-flex items-center gap-2 bg-white/15 px-3 py-1 rounded-full text-xs font-bold text-emerald-200 mb-2">
              <Sparkles size={13} className="text-amber-300" />
              <span>Athreya Loyalty Rewards</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-[1000] text-white tracking-tight uppercase">
              EARN COINS, SAVE MONEY!
            </h2>
            <div className="inline-block mt-1 px-3 py-1 bg-[#f7d154] text-[#0a3f22] text-sm md:text-base font-black rounded-lg shadow-sm">
              100 COINS = ₹1 RUPEE
            </div>
            <p className="text-xs md:text-sm font-semibold text-emerald-100 mt-2">
              Save More, Earn Coins, Use on Next Order
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-3">
            <div className="h-20 w-20 md:h-24 md:w-24 rounded-2xl overflow-hidden bg-emerald-950/40 p-1 border border-amber-400/30 shadow-lg">
              <img
                src={walletCoinsImg}
                alt="Athreya Wallet Coins"
                className="h-full w-full object-cover rounded-xl"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4-Step Flowchart */}
      <div className="p-4 md:p-6 bg-[#fbfdfb]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-stretch">
          {/* Step 1 */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col items-center text-center relative group hover:border-emerald-200 transition-all">
            <span className="text-[11px] font-black uppercase text-slate-700 tracking-wider mb-2">
              YOU SAVE
            </span>
            <div className="h-14 w-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-3 relative">
              <ShoppingBag size={24} className="text-[#0d592e]" />
              <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-[#0d592e] text-white flex items-center justify-center">
                <Check size={11} strokeWidth={3} />
              </div>
            </div>
            <p className="text-xs font-semibold text-slate-600">
              You save money on every order
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col items-center text-center relative group hover:border-emerald-200 transition-all">
            <span className="text-[11px] font-black uppercase text-slate-700 tracking-wider mb-2">
              YOU EARN COINS
            </span>
            <div className="h-14 w-14 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-b from-[#f7d154] to-[#e0a800] text-[#7a5200] flex items-center justify-center shadow-inner">
                <Star size={20} className="fill-[#7a5200] text-[#7a5200]" />
              </div>
            </div>
            <p className="text-xs font-semibold text-slate-600">
              1% of your savings credited as coins
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col items-center text-center relative group hover:border-emerald-200 transition-all">
            <span className="text-[11px] font-black uppercase text-slate-700 tracking-wider mb-2">
              100 COINS = ₹1 RUPEE
            </span>
            <div className="h-14 w-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-3 gap-1">
              <span className="h-8 w-8 rounded-full bg-[#f7d154] text-[#7a5200] text-[10px] font-black flex items-center justify-center shadow-sm">
                100
              </span>
              <span className="text-xs font-black text-slate-400">=</span>
              <span className="h-8 w-8 rounded-full bg-[#0d592e] text-white text-[11px] font-black flex items-center justify-center shadow-sm">
                ₹1
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-600">
              100 Coins is equal to 1 Rupee in your wallet
            </p>
          </div>

          {/* Step 4 */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col items-center text-center relative group hover:border-emerald-200 transition-all">
            <span className="text-[11px] font-black uppercase text-slate-700 tracking-wider mb-2">
              USE ON NEXT ORDER
            </span>
            <div className="h-14 w-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-3 relative">
              <ShoppingCart size={24} className="text-[#0d592e]" />
              <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                <Check size={11} strokeWidth={3} />
              </div>
            </div>
            <p className="text-xs font-semibold text-slate-600">
              Use your coins balance to get discount
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoinsPromoBanner;
