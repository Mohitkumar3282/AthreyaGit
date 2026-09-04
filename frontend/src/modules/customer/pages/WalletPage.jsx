import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowDownLeft,
  ChevronLeft,
  Wallet as WalletIcon,
  Gift,
  Plus,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { customerApi } from "../services/customerApi";
import CoinsPromoBanner from "../components/CoinsPromoBanner";
import walletCoinsImg from "@/assets/coins/wallet_coins.jpg";

const formatDate = (d) => {
  if (!d) return "";
  const date = new Date(d);
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today)
    return `Today, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  if (date.toDateString() === yesterday.toDateString())
    return `Yesterday, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const rupees = (value) => Number(value || 0).toFixed(2);

const COIN_TX_LABELS = {
  EARN: "Coins Added",
  REDEEM: "Coins Used",
  REVERSAL: "Coins Returned",
  ADJUSTMENT: "Adjustment",
  EXPIRY: "Coins Expired",
};

const CoinBadge = ({ size = "md" }) => (
  <span
    className={`${
      size === "lg" ? "h-12 w-12 text-xl" : "h-9 w-9 text-sm"
    } rounded-full bg-gradient-to-b from-[#f7d154] to-[#e0a800] text-[#7a5200] flex items-center justify-center font-black shrink-0 shadow-xs`}>
    A
  </span>
);

// One line of coin history matching Screen 3 ("Recent Transactions")
const CoinRow = ({ tx }) => {
  const isCredit = tx.direction === "CREDIT";
  return (
    <div className="px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
            isCredit
              ? "bg-[#0d4d29] text-white"
              : "bg-slate-100 text-slate-600"
          }`}>
          {isCredit ? (
            <Plus size={16} strokeWidth={3.5} />
          ) : (
            <ArrowUpRight size={16} strokeWidth={3} />
          )}
        </div>
        <div className="min-w-0">
          <h4 className="font-[1000] text-slate-800 text-sm">
            {COIN_TX_LABELS[tx.type] || tx.type}
          </h4>
          <p className="text-[11px] font-semibold text-slate-500 truncate">
            {isCredit && tx.savingsBase > 0
              ? `1% of ₹${rupees(tx.savingsBase)} Savings`
              : tx.description || "Loyalty reward"}
            {tx.orderId ? ` (Order #${tx.orderId.slice(-6)})` : ""}
          </p>
          <p className="text-[10px] font-medium text-slate-400 mt-0.5">
            {formatDate(tx.date)}
          </p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div
          className={`text-sm md:text-base font-[1000] ${
            isCredit ? "text-[#0d4d29]" : "text-slate-900"
          }`}>
          {isCredit ? "+" : "-"}
          {Number(tx.coins || 0).toLocaleString("en-IN")} Coins
        </div>
        <div className="text-[11px] font-bold text-slate-500">
          = ₹{rupees(tx.rupeeValue)}
        </div>
      </div>
    </div>
  );
};

const WalletPage = () => {
  const navigate = useNavigate();
  const [coins, setCoins] = useState(null);
  const [coinTransactions, setCoinTransactions] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [walletTransactions, setWalletTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [coinsRes, coinTxRes, walletRes, walletTxRes] =
        await Promise.allSettled([
          customerApi.getCoins(),
          customerApi.getCoinTransactions({ limit: 30 }),
          customerApi.getWallet(),
          customerApi.getWalletLedger({ limit: 30 }),
        ]);

      if (coinsRes.status === "fulfilled" && coinsRes.value.data?.success) {
        setCoins(coinsRes.value.data.result || null);
      }
      if (coinTxRes.status === "fulfilled" && coinTxRes.value.data?.success) {
        setCoinTransactions(coinTxRes.value.data.result?.items || []);
      }
      if (walletRes.status === "fulfilled" && walletRes.value.data?.success) {
        setWallet(walletRes.value.data.result || null);
      }
      if (walletTxRes.status === "fulfilled" && walletTxRes.value.data?.success) {
        setWalletTransactions(walletTxRes.value.data.result?.items || []);
      }

      setLoading(false);
    };
    fetchData();
  }, []);

  const balance = coins?.balance ?? 0;
  const coinValue = coins?.settings?.rupeeValuePerCoin ?? 0.01;
  const perRupee = coins?.settings?.coinsPerRupeeSaved ?? 1;
  const rupeeBalance = wallet?.balance ?? 0;

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans">
      {/* Dark Green Header matching Screen 3 */}
      <div className="bg-[#0d4d29] text-white sticky top-0 z-30 px-4 py-3.5 flex items-center justify-between shadow-md">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center hover:bg-white/15 active:scale-95 transition-all text-white"
          aria-label="Back">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-base font-[1000] tracking-widest uppercase text-white">
          YOUR WALLET
        </h1>
        <div className="w-10 h-10 flex items-center justify-center text-white/90">
          <WalletIcon size={20} />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 relative z-20 space-y-4">
        {/* Total Balance Card matching Screen 3 */}
        <div className="rounded-3xl bg-gradient-to-r from-[#0d4d29] via-[#125c34] to-[#0a3f22] p-5 md:p-6 text-white shadow-md border border-emerald-600/30 flex items-center justify-between gap-4 relative overflow-hidden">
          {/* Subtle glow */}
          <div className="absolute top-0 right-0 w-36 h-36 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />

          <div className="space-y-1 z-10 min-w-0">
            <p className="text-xs font-bold text-white/80 uppercase tracking-widest">
              Total Balance
            </p>
            <div className="text-3xl md:text-4xl font-[1000] text-[#fcd34d] tracking-tight">
              {loading ? "—" : balance.toLocaleString("en-IN")} COINS
            </div>
            <div className="text-2xl font-[1000] text-white tracking-tight">
              = ₹{rupees(balance * coinValue)}
            </div>
          </div>

          <div className="h-20 w-20 md:h-24 md:w-24 shrink-0 rounded-2xl overflow-hidden bg-emerald-950/40 p-1 border border-amber-400/30 shadow-lg">
            <img
              src={walletCoinsImg}
              alt="Athreya Coins"
              className="h-full w-full object-cover rounded-xl"
            />
          </div>
        </div>

        {/* Wallet Summary Table matching Screen 3 */}
        <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h3 className="text-sm md:text-base font-[1000] text-slate-800 uppercase tracking-wide">
              Wallet Summary
            </h3>
          </div>
          <div className="divide-y divide-slate-100 text-xs md:text-sm">
            <div className="px-5 py-3 flex items-center justify-between">
              <span className="font-semibold text-slate-600">Total Coins</span>
              <span className="font-[1000] text-slate-900">
                {balance.toLocaleString("en-IN")} Coins
              </span>
            </div>
            <div className="px-5 py-3 flex items-center justify-between">
              <span className="font-semibold text-slate-600">Rupee Value</span>
              <span className="font-[1000] text-slate-900">
                ₹{rupees(balance * coinValue)}
              </span>
            </div>
            <div className="px-5 py-3 flex items-center justify-between">
              <span className="font-semibold text-slate-600">Usable Balance</span>
              <span className="font-[1000] text-[#0d4d29]">
                ₹{rupees(balance * coinValue)}
              </span>
            </div>
          </div>
        </div>

        {/* Next Order CTA matching Screen 3 */}
        <div className="rounded-3xl border border-emerald-200 bg-[#edf8f0] p-4 md:p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-white text-[#0d4d29] flex items-center justify-center shadow-2xs shrink-0 border border-emerald-100">
              <Gift size={20} className="text-[#0d4d29]" />
            </div>
            <p className="text-xs md:text-sm font-bold text-slate-800 leading-snug">
              You can use this balance for your next order
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/categories")}
            className="w-full rounded-2xl bg-[#0d4d29] hover:bg-[#0a3f22] py-3.5 text-xs font-[1000] uppercase tracking-widest text-white transition-all shadow-md active:scale-98">
            USE COINS ON NEXT ORDER
          </button>
        </div>

        {/* Recent Transactions matching Screen 3 */}
        <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm md:text-base font-[1000] text-slate-800 uppercase tracking-wide">
              Recent Transactions
            </h3>
            <span className="text-xs font-bold text-[#0d4d29] hover:underline cursor-pointer">
              View All &gt;
            </span>
          </div>

          {loading ? (
            <div className="py-10 flex justify-center text-slate-400 text-xs font-bold">
              Loading transactions…
            </div>
          ) : coinTransactions.length === 0 ? (
            <div className="py-10 flex flex-col items-center justify-center text-center px-6 space-y-1">
              <p className="text-sm font-bold text-slate-700">No coins yet</p>
              <p className="text-xs text-slate-400">
                Save on your next order and your coins will show up here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {coinTransactions.map((tx) => (
                <CoinRow key={tx._id || tx.id} tx={tx} />
              ))}
            </div>
          )}
        </div>

        {/* Rupee Wallet (if active) */}
        {(rupeeBalance > 0 || walletTransactions.length > 0) && (
          <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm md:text-base font-[1000] text-slate-800 uppercase tracking-wide">
                  Cashback & Refund Balance (₹)
                </h3>
                <p className="text-[11px] font-semibold text-slate-500">
                  Direct wallet credit usable at checkout
                </p>
              </div>
              <span className="text-lg font-[1000] text-slate-900">
                ₹{rupees(rupeeBalance)}
              </span>
            </div>

            {walletTransactions.length > 0 && (
              <div className="divide-y divide-slate-100">
                {walletTransactions.map((tx) => (
                  <div
                    key={tx._id}
                    className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                          tx.isCredit
                            ? "bg-[#0d4d29] text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}>
                        {tx.isCredit ? (
                          <ArrowDownLeft size={16} />
                        ) : (
                          <ArrowUpRight size={16} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-800 text-xs md:text-sm">
                          {tx.title}
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          {formatDate(tx.date)}
                          {tx.orderId ? ` · #${tx.orderId.slice(-6)}` : ""}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`text-xs md:text-sm font-[1000] shrink-0 ${
                        tx.isCredit ? "text-[#0d4d29]" : "text-slate-900"
                      }`}>
                      {tx.isCredit ? "+" : "-"}₹{rupees(tx.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* How It Works Explainer Banner matching Reference Bottom */}
        <CoinsPromoBanner variant="footer" className="mt-6" />
      </div>
    </div>
  );
};

export default WalletPage;
