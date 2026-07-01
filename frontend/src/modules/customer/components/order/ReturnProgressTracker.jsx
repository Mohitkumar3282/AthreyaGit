import React from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Truck,
  PackageCheck,
  Wallet,
  XCircle,
  Clock,
  Store,
  ShieldAlert
} from "lucide-react";

// Standard return timeline steps (New format and legacy mappings)
const RETURN_STEPS = [
  { id: "REQUESTED", legacyId: "return_requested", label: "Return Requested", icon: ClipboardCheck },
  { id: "SELLER_APPROVED", legacyId: "return_approved", label: "Seller Approved", icon: CheckCircle2 },
  { id: "PICKUP_SCHEDULED", legacyId: "return_pickup_assigned", label: "Pickup Scheduled", icon: Clock },
  { id: "PICKED_UP", legacyId: "return_in_transit", label: "Item Picked Up", icon: Truck },
  { id: "DELIVERED_TO_SELLER", legacyId: "returned", label: "Delivered to Seller", icon: Store },
  { id: "REFUND_INITIATED", legacyId: "refund_initiated", label: "Refund Initiated", icon: Wallet },
  { id: "REFUND_COMPLETED", legacyId: "refund_completed", label: "Refund Completed", icon: Wallet }
];

// Helper to resolve current status index
function getStatusIndex(currentStatus) {
  const norm = String(currentStatus || "").toUpperCase().trim();
  
  // Legacy status maps
  const legacyMap = {
    "RETURN_REQUESTED": 0,
    "RETURN_APPROVED": 1,
    "RETURN_PICKUP_ASSIGNED": 2,
    "RETURN_IN_TRANSIT": 3,
    "RETURNED": 4,
    "QC_PASSED": 4,
    "QC_FAILED": 4,
    "REFUND_COMPLETED": 6
  };
  if (legacyMap[norm] !== undefined) return legacyMap[norm];

  const index = RETURN_STEPS.findIndex(
    (step) => step.id === norm || step.legacyId.toUpperCase() === norm
  );
  return index !== -1 ? index : 0;
}

const ReturnProgressTracker = ({ returnStatus, history = [] }) => {
  const status = String(returnStatus || "").toUpperCase().trim();
  if (!status || status === "NONE") return null;

  const isRejected = status === "SELLER_REJECTED" || status === "RETURN_REJECTED";
  const isCancelled = status === "CANCELLED";
  const isDisputed = status === "UNDER_DISPUTE";

  const currentIndex = getStatusIndex(status);

  // Custom steps for terminal states
  let steps = [...RETURN_STEPS];
  if (isRejected) {
    steps = [
      { id: "REQUESTED", label: "Return Requested", icon: ClipboardCheck },
      { id: "SELLER_REJECTED", label: "Return Rejected", icon: XCircle }
    ];
  } else if (isCancelled) {
    steps = [
      { id: "REQUESTED", label: "Return Requested", icon: ClipboardCheck },
      { id: "CANCELLED", label: "Cancelled", icon: XCircle }
    ];
  } else if (isDisputed) {
    steps = [
      ...RETURN_STEPS.slice(0, 5),
      { id: "UNDER_DISPUTE", label: "Under Dispute", icon: ShieldAlert }
    ];
  }

  // Format historical timestamps for steps
  const getStepTime = (stepId, index) => {
    if (!history || !history.length) return null;
    const match = history.find(h => String(h.status).toUpperCase() === stepId.toUpperCase());
    if (match && match.changed_at) {
      return new Date(match.changed_at).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    }
    return null;
  };

  return (
    <div className="bg-white rounded-3xl p-5 border border-[#1a6e2e]/20 font-outfit">
      <h4 className="text-sm font-bold text-slate-800 mb-4">Return Progress</h4>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const stepIndex = getStatusIndex(step.id);
          
          const isCompleted = isRejected || isCancelled
            ? true
            : status === "REFUND_COMPLETED" || status === "CLOSED"
              ? true
              : stepIndex < currentIndex;

          const isActive = isRejected
            ? step.id === "SELLER_REJECTED" || step.id === "RETURN_REJECTED"
            : isCancelled
              ? step.id === "CANCELLED"
              : isDisputed
                ? step.id === "UNDER_DISPUTE"
                : index === currentIndex;

          const timeStr = getStepTime(step.id, index);

          return (
            <div
              key={step.id}
              className="relative transition-opacity duration-200">
              <div className="flex items-start gap-4">
                <div
                  className={`relative z-10 h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                    (isRejected && isActive) || (isCancelled && isActive)
                      ? "bg-rose-100 text-rose-600 border border-rose-300"
                      : isCompleted
                        ? "bg-[#1a6e2e] text-white border border-[#1a6e2e]/20"
                        : isActive
                          ? "bg-amber-100 text-amber-700 border border-amber-300 animate-pulse"
                          : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 size={18} />
                  ) : (
                    <Icon size={18} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-bold ${
                      (isRejected && isActive) || (isCancelled && isActive)
                        ? "text-rose-700"
                        : isCompleted
                          ? "text-slate-800"
                          : isActive
                            ? "text-amber-700"
                            : "text-slate-400"
                    }`}
                  >
                    {step.label}
                  </p>
                  {timeStr && (
                    <span className="text-xxs text-slate-400 font-medium block mt-0.5">
                      {timeStr}
                    </span>
                  )}
                </div>
              </div>

              {index < steps.length - 1 && (
                <div className="absolute left-5 top-10 bottom-0 w-0.5 -mb-6">
                  <div
                    className={`h-full w-full ${
                      isCompleted ? "bg-emerald-500" : "bg-slate-200"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </motion.div>
    </div>
  );
};

export default ReturnProgressTracker;
