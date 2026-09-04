import React, { useState } from "react";
import { Check, Info, Sparkles, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import walletCoinsImg from "@/assets/coins/wallet_coins.jpg";

/**
 * CheckoutCoinsSection — "Athreya Coin Wallet at Checkout"
 *
 * Implements a rich green wallet card for redeeming Athreya Coins at checkout.
 *
 * Props:
 *   balance         – coins the customer holds
 *   settings        – { rupeeValuePerCoin, minRedeemCoins, maxRedeemPercentOfOrder }
 *   maxRedeemable   – server-derived ceiling for THIS order
 *   coinsToRedeem   – the committed request
 *   onChangeCoins   – (coins) => void
 *   isApplied       – boolean toggle state
 *   onToggle        – () => void
 *   appliedCoins    – coins the server accepted
 *   appliedDiscount – rupee value the server accepted
 *   payableAfter    – order total after the redemption
 *   cappedBy        – "BALANCE" | "ORDER_CAP" | "MIN_REDEEM" | null
 */

function formatRupees(value) {
  return Number(value || 0).toFixed(2);
}

const CheckoutCoinsSection = React.memo(function CheckoutCoinsSection({
  balance = 0,
  settings = {},
  maxRedeemable = 0,
  coinsToRedeem = 0,
  onChangeCoins,
  isApplied = false,
  onToggle,
  appliedCoins = 0,
  appliedDiscount = 0,
  payableAfter = 0,
  cappedBy = null,
}) {
  const [draft, setDraft] = useState(null);

  const rupeePerCoin = Number(settings.rupeeValuePerCoin || 0.01);
  const minRedeem = Number(settings.minRedeemCoins || 1);
  const canRedeem = maxRedeemable >= Math.max(1, minRedeem);

  const coinBalanceNumber = Number(balance || 0);
  const rupeeValue = (coinBalanceNumber * rupeePerCoin).toFixed(2);

  if (!coinBalanceNumber || coinBalanceNumber <= 0) {
    return (
      <div className="rounded-3xl bg-[#edf8f0] border border-emerald-200 p-4 flex items-center justify-between gap-3 text-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-[#0d4d29] text-white flex items-center justify-center font-[1000] text-sm shrink-0">
            🪙
          </div>
          <div>
            <h4 className="text-xs font-[1000] text-[#0d4d29] uppercase tracking-wide">
              Athreya Coin Wallet
            </h4>
            <p className="text-[11px] font-semibold text-slate-600">
              100 Coins = ₹1 Rupee · Earn 1% on this order
            </p>
          </div>
        </div>
        <span className="text-[10px] font-black uppercase text-[#0d4d29] bg-white px-2.5 py-1 rounded-lg border border-emerald-200">
          0 Coins
        </span>
      </div>
    );
  }

  const committed = appliedCoins || coinsToRedeem || 0;
  const inputValue = draft === null ? (committed > 0 ? String(committed) : "") : draft;

  const apply = () => {
    const requested = Math.floor(Number(inputValue) || 0);
    if (requested <= 0) return;
    setDraft(null);
    onChangeCoins(Math.min(requested, maxRedeemable));
  };

  return (
    <motion.div className="rounded-3xl bg-gradient-to-r from-[#0d4d29] via-[#125c34] to-[#0a3f22] text-white p-5 border border-emerald-600/30 shadow-md relative overflow-hidden font-sans">
      {/* Background soft glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header Row */}
      <div className="flex items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3 min-w-0">
          {/* 3D Wallet Icon */}
          <div className="h-12 w-12 rounded-2xl overflow-hidden bg-emerald-950/40 p-1 border border-amber-400/30 shadow-sm shrink-0">
            <img
              src={walletCoinsImg}
              alt="Athreya Coin Wallet"
              className="h-full w-full object-cover rounded-xl"
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-[1000] uppercase tracking-wider text-white">
                Athreya Coin Wallet
              </span>
              <span className="bg-[#fcd34d] text-[#0d4d29] text-[9px] font-[1000] px-1.5 py-0.5 rounded">
                100 = ₹1
              </span>
            </div>
            <div className="text-sm font-[1000] text-[#fcd34d] tracking-tight mt-0.5">
              {coinBalanceNumber.toLocaleString("en-IN")} Coins (= ₹{rupeeValue})
            </div>
          </div>
        </div>

        {/* Toggle Button */}
        <button
          type="button"
          onClick={onToggle}
          disabled={!canRedeem}
          aria-pressed={isApplied}
          className={`w-12 h-6 rounded-full transition-all duration-300 relative flex items-center px-1 shrink-0 ${
            isApplied && canRedeem ? "bg-[#fcd34d]" : "bg-emerald-950/60 border border-emerald-700/50"
          }`}>
          <motion.div
            animate={{ x: isApplied && canRedeem ? 24 : 0 }}
            className={`h-4 w-4 rounded-full shadow-sm ${
              isApplied && canRedeem ? "bg-[#0d4d29]" : "bg-white"
            }`}
          />
        </button>
      </div>

      {!canRedeem && (
        <p className="mt-3 flex items-start gap-1.5 text-[11px] font-semibold text-emerald-200">
          <Info size={13} className="mt-0.5 shrink-0" />
          {balance < minRedeem
            ? `Collect ${minRedeem - balance} more coins to start redeeming.`
            : "This order is too small to redeem coins on. They stay in your wallet."}
        </p>
      )}

      {/* Expandable Coin Input & Breakdown */}
      <AnimatePresence initial={false}>
        {isApplied && canRedeem && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden relative z-10">
            <div className="pt-4 mt-4 border-t border-white/15 space-y-3">
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={maxRedeemable}
                  value={inputValue}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      apply();
                    }
                  }}
                  placeholder={`Coins up to ${maxRedeemable}`}
                  aria-label="Athreya Coins to redeem"
                  className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 text-sm font-bold focus:ring-2 focus:ring-[#fcd34d] focus:outline-none shadow-inner"
                />
                <button
                  type="button"
                  onClick={apply}
                  className="h-10 px-5 rounded-xl bg-[#fcd34d] hover:bg-[#fbbf24] text-[#0d4d29] text-xs font-[1000] uppercase tracking-wider shadow-sm active:scale-95 transition-all">
                  Apply
                </button>
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setDraft(null);
                    onChangeCoins(maxRedeemable);
                  }}
                  className="text-[11px] font-[1000] uppercase tracking-wider text-[#fcd34d] hover:underline">
                  Use max ({maxRedeemable.toLocaleString("en-IN")} coins)
                </button>
                <span className="text-[10px] font-semibold text-emerald-200">
                  Worth ₹{formatRupees(maxRedeemable * rupeePerCoin)}
                </span>
              </div>

              {/* Applied Confirmation Box */}
              {appliedCoins > 0 && (
                <div className="rounded-2xl bg-white/10 border border-white/20 p-3 space-y-1.5 backdrop-blur-xs">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-white/90 uppercase">
                      Discount Applied
                    </span>
                    <span className="font-[1000] text-[#fcd34d] text-sm">
                      -₹{formatRupees(appliedDiscount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-white/90 uppercase">
                      New Payable Amount
                    </span>
                    <span className="font-[1000] text-white text-sm">
                      ₹{formatRupees(payableAfter)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 pt-1 text-[10px] font-semibold text-emerald-200 border-t border-white/10">
                    <span>✓</span>
                    <span>
                      {appliedCoins.toLocaleString("en-IN")} coins applied
                      {cappedBy === "BALANCE" && " (Full balance)"}
                      {cappedBy === "ORDER_CAP" && " (Maximum allowed for this order)"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export default CheckoutCoinsSection;
