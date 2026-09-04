import React from "react";
import { Check, Contact2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * CheckoutAddressSection
 *
 * Props:
 *   currentAddress       – the active delivery address object
 *   savedRecipient       – "order for someone else" recipient object or null
 *   savedAddresses       – array of saved addresses from LocationContext
 *   onSelectAddress      – () => void  — opens the address-selection modal
 *   onEditAddress        – () => void  — opens the edit-address modal
 *   onUseCurrentLocation – () => void  — triggers live-location detection
 *
 * Internal state for the "order for someone else" form is kept here because
 * it is purely presentational; the parent only needs the saved result.
 */
const CheckoutAddressSection = React.memo(function CheckoutAddressSection({
  currentAddress,
  savedRecipient,
  savedAddresses,
  onSelectAddress,
  onEditAddress,
  onUseCurrentLocation,
  // Extra props forwarded from CheckoutPage that the section needs
  isFetchingLocation,
  showRecipientForm,
  onToggleRecipientForm,
  recipientData,
  onRecipientDataChange,
  onSaveRecipient,
  onRemoveRecipient,
  displayName,
  displayPhone,
  displayAddress,
}) {
  return (
    <motion.div className="bg-white rounded-3xl p-5 border border-emerald-100 shadow-xs space-y-4">
      {/* "Order for someone else" toggle */}
      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
        <span className="text-xs text-slate-500 font-bold">
          Ordering for someone else?
        </span>
        <button
          onClick={onToggleRecipientForm}
          className="text-[#0d4d29] text-xs font-[1000] uppercase tracking-wider hover:underline">
          {showRecipientForm
            ? "Close"
            : savedRecipient
              ? "Change details"
              : "Add details"}
        </button>
      </div>

      {/* Saved recipient card */}
      {savedRecipient && !showRecipientForm && (
        <div className="p-4 bg-[#edf8f0] border border-emerald-200 rounded-2xl flex items-start justify-between">
          <div className="flex gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#0d4d29] flex items-center justify-center text-white shrink-0 shadow-2xs">
              <Contact2 size={18} />
            </div>
            <div>
              <p className="text-sm font-[1000] text-slate-800">
                {savedRecipient.name}
              </p>
              <p className="text-xs text-[#0d4d29] font-bold mb-1">
                {savedRecipient.phone}
              </p>
              <p className="text-xs text-slate-600 leading-tight">
                {savedRecipient.completeAddress}
                {savedRecipient.landmark && `, ${savedRecipient.landmark}`}
                {savedRecipient.pincode && ` - ${savedRecipient.pincode}`}
              </p>
            </div>
          </div>
          <button
            onClick={onRemoveRecipient}
            className="text-rose-600 text-xs font-bold hover:underline">
            Remove
          </button>
        </div>
      )}

      {/* Recipient form */}
      <AnimatePresence>
        {showRecipientForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden">
            <div className="bg-[#edf8f0]/60 rounded-2xl p-4 border border-emerald-200 space-y-4">
              <div>
                <h4 className="text-sm font-[1000] text-slate-800 mb-2 uppercase tracking-wide">
                  Enter delivery address details
                </h4>
                <div className="space-y-2.5">
                  <Input
                    placeholder="Enter complete address*"
                    value={recipientData.completeAddress}
                    onChange={(e) =>
                      onRecipientDataChange({ ...recipientData, completeAddress: e.target.value })
                    }
                    className="h-11 rounded-xl bg-white border-emerald-200 focus:ring-[#0d4d29] focus:border-[#0d4d29] text-sm font-medium"
                  />
                  <Input
                    placeholder="Find landmark (optional)"
                    value={recipientData.landmark}
                    onChange={(e) =>
                      onRecipientDataChange({ ...recipientData, landmark: e.target.value })
                    }
                    className="h-11 rounded-xl bg-white border-emerald-200 focus:ring-[#0d4d29] focus:border-[#0d4d29] text-sm font-medium"
                  />
                  <Input
                    placeholder="Enter pin code (optional)"
                    value={recipientData.pincode}
                    onChange={(e) =>
                      onRecipientDataChange({ ...recipientData, pincode: e.target.value })
                    }
                    className="h-11 rounded-xl bg-white border-emerald-200 focus:ring-[#0d4d29] focus:border-[#0d4d29] text-sm font-medium"
                  />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-[1000] text-slate-800 mb-1 uppercase tracking-wide">
                  Enter receiver details
                </h4>
                <p className="text-[10px] text-slate-500 mb-2.5 font-medium">
                  We&apos;ll contact receiver to get the exact delivery address
                </p>
                <div className="space-y-2.5">
                  <Input
                    placeholder="Receiver's name*"
                    value={recipientData.name}
                    onChange={(e) =>
                      onRecipientDataChange({ ...recipientData, name: e.target.value })
                    }
                    className="h-11 rounded-xl bg-white border-emerald-200 focus:ring-[#0d4d29] focus:border-[#0d4d29] text-sm font-medium"
                  />
                  <div className="relative">
                    <Input
                      placeholder="Receiver's phone number*"
                      value={recipientData.phone}
                      onChange={(e) =>
                        onRecipientDataChange({ ...recipientData, phone: e.target.value })
                      }
                      className="h-11 rounded-xl bg-white border-emerald-200 focus:ring-[#0d4d29] focus:border-[#0d4d29] text-sm font-medium pr-10"
                    />
                    <Contact2
                      size={18}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                  </div>
                </div>
              </div>

              <Button
                onClick={onSaveRecipient}
                className="w-full h-11 bg-[#0d4d29] hover:bg-[#0a3f22] text-white font-[1000] uppercase tracking-wider text-xs rounded-xl shadow-sm">
                Save address
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delivery address heading */}
      <div>
        <h3 className="font-[1000] text-slate-800 text-sm md:text-base uppercase tracking-wider">
          Delivery Address
        </h3>
        <p className="text-xs text-slate-500">Select or edit your saved address</p>
      </div>

      {/* Active address card */}
      <div className="border-2 rounded-2xl p-4 relative transition-all border-[#0d4d29] bg-[#edf8f0]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <div className="h-6 w-6 rounded-full bg-[#0d4d29] flex items-center justify-center shadow-2xs">
              <Check size={14} className="text-white stroke-[3.5]" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start gap-2">
              <h4 className="font-[1000] text-slate-900 text-sm">{displayName}</h4>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); onEditAddress(); }}
                  className="text-slate-600 text-xs font-bold hover:underline">
                  Edit
                </button>
                <span className="text-slate-300">|</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onSelectAddress(); }}
                  className="text-[#0d4d29] text-xs font-[1000] uppercase tracking-wide hover:underline">
                  Change
                </button>
              </div>
            </div>
            <p className="text-xs text-[#0d4d29] font-bold mt-0.5">{displayPhone}</p>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{displayAddress}</p>
          </div>
        </div>
      </div>

      {/* Use current location */}
      <button
        type="button"
        onClick={onUseCurrentLocation}
        disabled={isFetchingLocation}
        className="w-full py-2.5 rounded-xl border border-dashed border-emerald-300 bg-white hover:bg-emerald-50/50 text-xs font-[1000] text-[#0d4d29] uppercase tracking-wider transition-colors">
        {isFetchingLocation ? "Detecting live location..." : "📍 Use current live location"}
      </button>

      {/* Confirmation banner */}
      <div className="rounded-2xl border border-emerald-200 bg-[#edf8f0] px-3.5 py-2.5 flex items-center gap-3">
        <div className="h-7 w-7 rounded-full bg-[#0d4d29] flex items-center justify-center shrink-0">
          <Check size={14} className="text-white stroke-[3.5]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-[1000] text-[#0d4d29] uppercase tracking-wide">
            Delivery address confirmed
          </p>
          <p className="text-[11px] font-semibold text-slate-600 truncate">
            We&apos;ll deliver to the address selected above.
          </p>
        </div>
      </div>
    </motion.div>
  );
});

export default CheckoutAddressSection;
