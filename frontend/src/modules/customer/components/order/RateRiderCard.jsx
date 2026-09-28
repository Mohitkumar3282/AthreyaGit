import { useState } from "react";
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { customerApi } from "../../services/customerApi";

/**
 * Shown once per delivered order (until `order.riderRating` is set) so the
 * customer can rate the rider. Feeds the rider's aggregate rating shown in
 * the admin fleet view and the rider's own profile.
 */
const TIP_OPTIONS = [10, 20, 30, 50];

const RateRiderCard = ({ order, onRated }) => {
  const [stars, setStars] = useState(0);
  const [hoverStars, setHoverStars] = useState(0);
  const [comment, setComment] = useState("");
  const [tipAmount, setTipAmount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!stars) {
      toast.error("Please select a star rating");
      return;
    }
    setSubmitting(true);
    try {
      const res = await customerApi.rateRider(order.orderId, { stars, comment, tipAmount });
      if (res.data?.success) {
        toast.success(res.data.message || "Thanks for rating your delivery partner!");
        onRated?.(res.data.result?.riderRating || { stars, comment, ratedAt: new Date().toISOString() });
      } else {
        toast.error(res.data?.message || "Failed to submit rating");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit rating");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl p-4 md:p-5 border-2 border-amber-100/80 shadow-xs space-y-3"
    >
      <div>
        <h3 className="font-[1000] text-slate-800 text-sm md:text-base leading-tight">
          Rate your delivery partner
        </h3>
        <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
          {order.deliveryBoy?.name
            ? `How was your experience with ${order.deliveryBoy.name}?`
            : "How was your delivery experience?"}
        </p>
      </div>

      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setStars(n)}
            onMouseEnter={() => setHoverStars(n)}
            onMouseLeave={() => setHoverStars(0)}
            className="p-0.5 active:scale-90 transition-transform"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
          >
            <Star
              size={28}
              className={
                n <= (hoverStars || stars)
                  ? "fill-amber-400 text-amber-400"
                  : "fill-transparent text-slate-300"
              }
            />
          </button>
        ))}
      </div>

      {stars > 0 && (
        <>
          <div>
            <p className="text-[11px] font-bold text-slate-600 mb-1.5">
              Add a tip for {order.deliveryBoy?.name || "your rider"}? (optional)
            </p>
            <div className="flex items-center gap-1.5">
              {TIP_OPTIONS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setTipAmount((prev) => (prev === amt ? 0 : amt))}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-black border transition-all ${
                    tipAmount === amt
                      ? "bg-amber-400 border-amber-400 text-white"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  ₹{amt}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 500))}
            placeholder="Add a comment (optional)"
            rows={2}
            className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-[#0d4d29] text-white font-black text-xs uppercase tracking-wide rounded-xl py-2.5 disabled:opacity-60 active:scale-95 transition-all"
          >
            {submitting
              ? "Submitting..."
              : tipAmount > 0
                ? `Submit Rating + ₹${tipAmount} Tip`
                : "Submit Rating"}
          </button>
        </>
      )}
    </motion.div>
  );
};

export default RateRiderCard;
