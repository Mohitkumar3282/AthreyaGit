import React from "react";
import { Wallet, Check } from "lucide-react";
import { motion } from "framer-motion";

/**
 * CheckoutPaymentSelector
 *
 * Props:
 *   paymentMethods  – array of { id, label, icon, sublabel }
 *   selectedPayment – string id of the currently selected method
 *   onSelectPayment – (id) => void
 *   useWallet       – boolean
 *   onToggleWallet  – () => void
 *   walletBalance   – number
 *   walletAmountToUse – number
 */
const CheckoutPaymentSelector = React.memo(function CheckoutPaymentSelector({
  paymentMethods,
  selectedPayment,
  onSelectPayment,
}) {
  return (
    <div className="space-y-4">
      {/* Payment Method */}
      <motion.div className="bg-white rounded-3xl p-5 border border-emerald-100 shadow-xs">
        <h3 className="font-[1000] text-slate-800 mb-4 uppercase text-sm tracking-wider">
          Payment Method
        </h3>
        <div className="space-y-2.5">
          {paymentMethods.map((method) => {
            const Icon = method.icon;
            const isSelected = selectedPayment === method.id;
            return (
              <button
                key={method.id}
                type="button"
                onClick={() => onSelectPayment(method.id)}
                className={`w-full p-3.5 rounded-2xl border-2 transition-all flex items-center gap-3 text-left ${
                  isSelected
                    ? "border-[#0d4d29] bg-emerald-50/50"
                    : "border-slate-100 bg-white hover:border-emerald-200"
                }`}>
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isSelected ? "bg-[#0d4d29] text-white" : "bg-slate-100 text-slate-600"
                  }`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1">
                  <p
                    className={`font-[1000] text-sm ${
                      isSelected ? "text-[#0d4d29]" : "text-slate-800"
                    }`}>
                    {method.label}
                  </p>
                  <p className="text-xs text-slate-500 font-medium">{method.sublabel}</p>
                </div>
                <div
                  className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    isSelected ? "border-[#0d4d29] bg-[#0d4d29] text-white" : "border-slate-300"
                  }`}>
                  {isSelected && <Check size={12} strokeWidth={4} />}
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
});

export default CheckoutPaymentSelector;
