import React from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  ClipboardCheck,
  Truck,
  XCircle,
  Clock,
  Store,
  CheckCircle,
} from "lucide-react";

// Standard cancellation timeline steps
const CANCELLATION_STEPS = [
  { id: "REQUESTED", label: "Cancellation Requested", icon: ClipboardCheck },
  { id: "SELLER_APPROVED", label: "Approved by Seller", icon: CheckCircle2 },
  { id: "PICKUP_SCHEDULED", label: "Pickup Scheduled", icon: Clock },
  { id: "PICKED_UP", label: "Item Picked Up", icon: Truck },
  { id: "DELIVERED_TO_SELLER", label: "Delivered to Seller", icon: Store },
  { id: "CANCELLED", label: "Order Cancelled", icon: CheckCircle }
];

// Helper to resolve current status index
function getStatusIndex(currentStatus) {
  const norm = String(currentStatus || "").toUpperCase().trim();
  const index = CANCELLATION_STEPS.findIndex((step) => step.id === norm);
  return index !== -1 ? index : 0;
}

const CancellationProgressTracker = ({ status: cancellationStatus, history = [] }) => {
  const status = String(cancellationStatus || "").toUpperCase().trim();
  if (!status || status === "NONE") return null;

  const isRejected = status === "SELLER_REJECTED";
  const isRequestCancelled = status === "CANCELLED" && history.some(h => h.note && h.note.toLowerCase().includes("by customer"));

  const currentIndex = getStatusIndex(status);

  // Custom steps for terminal states
  let steps = [...CANCELLATION_STEPS];
  if (isRejected) {
    steps = [
      { id: "REQUESTED", label: "Cancellation Requested", icon: ClipboardCheck },
      { id: "SELLER_REJECTED", label: "Cancellation Rejected", icon: XCircle }
    ];
  } else if (isRequestCancelled) {
    steps = [
      { id: "REQUESTED", label: "Cancellation Requested", icon: ClipboardCheck },
      { id: "CANCELLED", label: "Request Cancelled", icon: XCircle }
    ];
  }

  // Format historical timestamps for steps
  const getStepTime = (stepId) => {
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
      <h4 className="text-sm font-bold text-slate-800 mb-4">Cancellation Progress</h4>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const stepIndex = getStatusIndex(step.id);
          
          const isCompleted = isRejected || isRequestCancelled
            ? true
            : status === "CANCELLED"
              ? true
              : stepIndex < currentIndex;

          const isActive = isRejected
            ? step.id === "SELLER_REJECTED"
            : isRequestCancelled
              ? step.id === "CANCELLED"
              : index === currentIndex;

          const timeStr = getStepTime(step.id);

          return (
            <div
              key={step.id}
              className="relative transition-opacity duration-200">
              <div className="flex items-start gap-4">
                <div
                  className={`relative z-10 h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                    (isRejected && isActive) || (isRequestCancelled && isActive)
                      ? "bg-rose-100 text-rose-600 border border-rose-300"
                      : isCompleted
                        ? "bg-[#1a6e2e] text-white border border-[#1a6e2e]/20"
                        : isActive
                          ? "bg-amber-100 text-amber-700 border border-amber-300 animate-pulse"
                          : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {isCompleted && !isRejected && !isRequestCancelled ? (
                    <CheckCircle2 size={18} />
                  ) : (
                    <Icon size={18} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-bold ${
                      (isRejected && isActive) || (isRequestCancelled && isActive)
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
                      isCompleted && !isRejected && !isRequestCancelled ? "bg-emerald-500" : "bg-slate-200"
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

export default CancellationProgressTracker;
