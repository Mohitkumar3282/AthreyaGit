import React, { useCallback, useEffect, useState } from "react";
import { CloudRain, Zap, Target, Trophy, Coffee } from "lucide-react";
import { toast } from "sonner";
import { deliveryApi } from "../services/deliveryApi";

const fmtLeft = (until) => {
  const ms = Math.max(new Date(until).getTime() - Date.now(), 0);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, "0")}`;
};

/**
 * Live incentives + breaks. Rules come from the admin panel via
 * GET /delivery/incentives, refetched every minute, so admin edits show here
 * without an app update.
 */
const IncentivesCard = ({ isOnline }) => {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await deliveryApi.getIncentives();
      if (res.data?.success) setData(res.data.result);
    } catch {
      /* card is optional - stay hidden on failure */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!data?.breakUntil) return undefined;
    const t = setInterval(() => {
      tick((n) => n + 1);
      if (new Date(data.breakUntil) <= new Date()) load();
    }, 1000);
    return () => clearInterval(t);
  }, [data?.breakUntil, load]);

  if (!data) return null;
  const { config, today, week, peakNow, rainActive, breakUntil } = data;
  const onBreak = breakUntil && new Date(breakUntil) > new Date();

  const startBreak = async (minutes) => {
    try {
      setBusy(true);
      await deliveryApi.startBreak(minutes);
      toast.success(`Break started for ${minutes} min`);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Could not start break");
    } finally {
      setBusy(false);
    }
  };
  const endBreak = async () => {
    try {
      setBusy(true);
      await deliveryApi.endBreak();
      await load();
    } finally {
      setBusy(false);
    }
  };

  const next = today.nextTier;
  const tierPct = next ? Math.min((today.delivered / next.orders) * 100, 100) : 100;
  const wb = config.weeklyBonus;

  return (
    <div className="px-6 mb-4 space-y-3">
      {(peakNow || rainActive) && (
        <div className="flex flex-wrap gap-2">
          {peakNow && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-800 px-3 py-1.5 text-[11px] font-black">
              <Zap size={13} /> Peak hour: +₹{peakNow.bonus} per delivery
            </span>
          )}
          {rainActive && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 text-sky-800 px-3 py-1.5 text-[11px] font-black">
              <CloudRain size={13} /> Rain bonus: +₹{config.rain.bonusPerDelivery} per delivery
            </span>
          )}
        </div>
      )}

      {config.dailyTargets.enabled && config.dailyTargets.tiers.length > 0 && (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-1.5 text-xs font-black text-gray-800">
              <Target size={14} className="text-emerald-600" /> Today's target
            </span>
            <span className="text-[11px] font-bold text-gray-500">{today.delivered} orders</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${tierPct}%` }} />
          </div>
          <p className="mt-2 text-[11px] font-semibold text-gray-500">
            {next
              ? `${next.orders - today.delivered} more for ₹${next.bonus} bonus`
              : `Top target reached - ₹${today.reachedTier?.bonus} earned`}
          </p>
          <p className="mt-1 text-[10px] text-gray-400">
            {config.dailyTargets.tiers.map((t) => `${t.orders}+ = ₹${t.bonus}`).join(" · ")}
          </p>
        </div>
      )}

      {wb.enabled && (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <Trophy size={18} className="text-amber-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-black text-gray-800">Weekly bonus ₹{wb.bonus}</p>
            <p className="text-[11px] font-semibold text-gray-500">
              {week.delivered}/{wb.minOrders} orders · rating {week.rating.toFixed(1)} (need {wb.minRating}+)
            </p>
          </div>
        </div>
      )}

      {config.breaks.enabled && config.breaks.durations.length > 0 && (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
          <p className="flex items-center gap-1.5 text-xs font-black text-gray-800 mb-2">
            <Coffee size={14} className="text-orange-500" /> Take a break
          </p>
          {onBreak ? (
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-orange-600">On break · {fmtLeft(breakUntil)} left</span>
              <button disabled={busy} onClick={endBreak} className="rounded-xl bg-gray-900 text-white text-[11px] font-black px-4 py-2">
                End break
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              {config.breaks.durations.map((m) => (
                <button
                  key={m}
                  disabled={busy || !isOnline}
                  onClick={() => startBreak(m)}
                  className="flex-1 rounded-xl border border-gray-200 bg-gray-50 text-[11px] font-black text-gray-700 py-2 disabled:opacity-50"
                >
                  {m} min
                </button>
              ))}
            </div>
          )}
          <p className="mt-2 text-[10px] text-gray-400">No orders and no penalties during a break.</p>
        </div>
      )}
    </div>
  );
};

export default IncentivesCard;
