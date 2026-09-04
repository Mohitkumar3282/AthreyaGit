import React from "react";
import { Plus, Minus, Heart } from "lucide-react";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";

/**
 * CheckoutCartSummary — "ITEMS ORDERED"
 *
 * Implements the exact Items Ordered table layout from the reference image with columns:
 *   Item | M.R.P. | Our Price | You Save
 *
 * Props:
 *   cart              – array of cart items
 *   onUpdateQuantity  – (id, delta, variantSku) => void
 *   onRemoveFromCart  – (id, variantSku) => void
 *   onMoveToWishlist  – (item) => void
 *   showAll           – boolean
 *   onToggleShowAll   – () => void
 */
const CheckoutCartSummary = React.memo(function CheckoutCartSummary({
  cart,
  onUpdateQuantity,
  onRemoveFromCart,
  onMoveToWishlist,
}) {
  const totalItemsCount = cart.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);

  return (
    <div className="bg-white rounded-3xl p-4 sm:p-5 border border-emerald-100 shadow-xs space-y-3 font-sans">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="font-[1000] text-slate-800 text-sm md:text-base tracking-wider uppercase">
          ITEMS ORDERED
        </h3>
        <span className="text-xs font-[1000] text-[#0d4d29] bg-[#edf8f0] px-2.5 py-1 rounded-full border border-emerald-200">
          {totalItemsCount} {totalItemsCount === 1 ? "Item" : "Items"}
        </span>
      </div>

      {/* Table Column Headers */}
      <div className="grid grid-cols-12 gap-1.5 sm:gap-2 text-[10px] md:text-[11px] font-[1000] uppercase tracking-wider text-slate-500 px-1 sm:px-2 border-b border-slate-100 pb-2">
        <div className="col-span-5 md:col-span-6">Item</div>
        <div className="col-span-2 text-right">M.R.P.</div>
        <div className="col-span-3 md:col-span-2 text-right">Our Price</div>
        <div className="col-span-2 text-right text-[#0d4d29]">You Save</div>
      </div>

      {/* Items Rows */}
      <div className="divide-y divide-slate-100">
        {cart.map((item) => {
          const qty = Math.max(1, Number(item.quantity || 1));
          const rawMrp = Number(item.price || item.mrp || 0);
          const rawSale = Number(item.salePrice || item.price || 0);

          const unitMrp = rawMrp > 0 ? rawMrp : rawSale;
          const unitPrice = (rawSale > 0 && rawSale < unitMrp) ? rawSale : unitMrp;
          const unitSaving = Math.max(0, unitMrp - unitPrice);

          const totalMrp = (unitMrp * qty).toFixed(2);
          const totalPrice = (unitPrice * qty).toFixed(2);
          const totalSaving = (unitSaving * qty).toFixed(2);

          return (
            <div
              key={`${item.id}::${String(item.variantSku || "").trim()}`}
              className="grid grid-cols-12 gap-1.5 sm:gap-2 items-center py-3 px-1 sm:px-2 hover:bg-slate-50/70 transition-colors rounded-xl">
              {/* Item Column (Image + Title + Controls) */}
              <div className="col-span-5 md:col-span-6 flex items-center gap-2 sm:gap-2.5 min-w-0">
                <div className="h-11 w-11 sm:h-14 sm:w-14 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/60 shrink-0">
                  <img
                    src={applyCloudinaryTransform(item.image)}
                    alt={item.name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-slate-800 text-xs sm:text-sm truncate">
                    {item.name}
                  </h4>
                  {(item.unit || item.variantName || item.variantSku) && (
                    <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 truncate">
                      {item.unit || item.variantName || item.variantSku}
                    </p>
                  )}

                  {/* Quantity adjustment & wishlist */}
                  <div className="flex items-center gap-2 mt-1">
                    <div className="inline-flex items-center gap-1 sm:gap-1.5 bg-slate-100 border border-slate-200 rounded-lg px-1.5 py-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          item.quantity > 1
                            ? onUpdateQuantity(item.id, -1, item.variantSku)
                            : onRemoveFromCart(item.id, item.variantSku)
                        }
                        className="text-slate-600 hover:text-rose-600 p-0.5 transition-colors"
                        aria-label="Decrease quantity">
                        <Minus size={11} strokeWidth={3} />
                      </button>
                      <span className="text-[11px] font-black text-slate-800 min-w-[14px] text-center">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.id, 1, item.variantSku)}
                        className="text-slate-600 hover:text-[#0d4d29] p-0.5 transition-colors"
                        aria-label="Increase quantity">
                        <Plus size={11} strokeWidth={3} />
                      </button>
                    </div>

                    {onMoveToWishlist && (
                      <button
                        type="button"
                        onClick={() => onMoveToWishlist(item)}
                        className="text-[10px] text-slate-400 hover:text-rose-500 font-semibold transition-colors hidden sm:inline"
                        title="Move to wishlist">
                        <Heart size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* M.R.P. Column */}
              <div className="col-span-2 text-right">
                <span className="text-[11px] sm:text-sm font-semibold text-slate-400 line-through">
                  ₹{totalMrp}
                </span>
              </div>

              {/* Our Price Column */}
              <div className="col-span-3 md:col-span-2 text-right">
                <span className="text-xs sm:text-sm font-[1000] text-slate-900">
                  ₹{totalPrice}
                </span>
              </div>

              {/* You Save Column */}
              <div className="col-span-2 text-right">
                <span className="text-[11px] sm:text-sm font-[1000] text-[#0d4d29]">
                  {Number(totalSaving) > 0 ? `₹${totalSaving}` : "—"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default CheckoutCartSummary;
