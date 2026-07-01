import React, { useEffect, useState } from "react";
import { sellerApi } from "../services/sellerApi";
import { useToast } from "@shared/components/ui/Toast";
import { Loader2, X, MapPin, Phone, Star, Check, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import Button from "@shared/components/ui/Button";

const AssignDeliveryBoy = ({ returnRequest, cancellationRequest, type = "return", onClose, onAssigned }) => {
    const { showToast } = useToast();
    const [riders, setRiders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRiderId, setSelectedRiderId] = useState(null);
    const [assigning, setAssigning] = useState(false);

    const isCancellation = type === "cancellation";
    const requestItem = isCancellation ? cancellationRequest : returnRequest;
    const requestId = requestItem?._id || requestItem?.id;
    const isReassign = !!requestItem?.delivery_boy_id;

    const fetchAvailableRiders = async () => {
        try {
            setLoading(true);
            const res = isCancellation
                ? await sellerApi.getAvailableCancellationDeliveryBoys({ cancellation_request_id: requestId })
                : await sellerApi.getAvailableDeliveryBoys({ return_request_id: requestId });
            const data = res.data.result || res.data;
            setRiders(data.delivery_boys || []);
        } catch (error) {
            console.error("Failed to fetch available riders:", error);
            showToast("Failed to load available delivery partners", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (requestId) {
            fetchAvailableRiders();
        }
    }, [requestId]);

    const handleAssign = async () => {
        if (!selectedRiderId) return;
        try {
            setAssigning(true);
            if (isReassign) {
                if (isCancellation) {
                    await sellerApi.reassignCancellationDeliveryBoy(requestId, { delivery_boy_id: selectedRiderId });
                } else {
                    await sellerApi.reassignDeliveryBoy(requestId, { delivery_boy_id: selectedRiderId });
                }
                showToast("Rider reassigned successfully", "success");
            } else {
                if (isCancellation) {
                    await sellerApi.assignCancellationDeliveryBoy(requestId, { delivery_boy_id: selectedRiderId });
                } else {
                    await sellerApi.assignDeliveryBoy(requestId, { delivery_boy_id: selectedRiderId });
                }
                showToast("Rider assigned successfully", "success");
            }
            if (onAssigned) onAssigned();
        } catch (error) {
            console.error("Failed to assign rider:", error);
            showToast(
                error.response?.data?.message || "Failed to assign rider",
                "error"
            );
        } finally {
            setAssigning(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                onClick={onClose}
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-md relative z-10 bg-white rounded-3xl shadow-2xl p-6 space-y-4 flex flex-col max-h-[90vh]"
            >
                <div className="flex items-center justify-between shrink-0">
                    <div>
                        <h3 className="text-lg font-black text-slate-900">
                            {isReassign ? "Reassign Delivery Partner" : "Assign Delivery Partner"}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">
                            Select an available delivery partner to pick up the return.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto min-h-[250px] pr-1 space-y-3">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-48">
                            <Loader2 className="h-8 w-8 text-primary animate-spin" />
                            <p className="text-xs text-slate-500 font-bold mt-2 uppercase tracking-wider">
                                Finding Nearby Riders...
                            </p>
                        </div>
                    ) : riders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-slate-100 rounded-2xl p-4">
                            <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
                            <p className="text-sm font-bold text-slate-800">No available partners</p>
                            <p className="text-xs text-slate-500 text-center mt-1">
                                All nearby delivery partners are currently busy or offline. Please try again in a few minutes.
                            </p>
                        </div>
                    ) : (
                        riders.map((rider) => {
                            const isSelected = selectedRiderId === rider.id;
                            return (
                                <div
                                    key={rider.id}
                                    onClick={() => setSelectedRiderId(rider.id)}
                                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between gap-3 ${
                                        isSelected
                                            ? "border-primary bg-primary/5 shadow-md shadow-primary/5"
                                            : "border-slate-100 hover:border-slate-200 bg-white"
                                    }`}
                                >
                                    <div className="min-w-0">
                                        <h4 className="font-bold text-slate-900 text-sm truncate">
                                            {rider.name}
                                        </h4>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 font-medium">
                                            <span className="flex items-center gap-0.5 text-amber-600 font-bold">
                                                <Star className="h-3.5 w-3.5 fill-current" />
                                                {rider.rating?.toFixed(1) || "5.0"}
                                            </span>
                                            <span className="flex items-center gap-0.5 text-slate-600">
                                                <MapPin className="h-3.5 w-3.5" />
                                                {rider.distance_km} km away
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 font-semibold mt-1 flex items-center gap-1.5">
                                            <Phone className="h-3.5 w-3.5 text-slate-400" />
                                            {rider.phone}
                                        </p>
                                    </div>
                                    <div
                                        className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
                                            isSelected
                                                ? "border-primary bg-primary text-white"
                                                : "border-slate-200 bg-white"
                                        }`}
                                    >
                                        {isSelected && <Check className="h-3.5 w-3.5 font-bold" />}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100 shrink-0">
                    <Button
                        variant="outline"
                        className="flex-1 font-bold"
                        onClick={onClose}
                        disabled={assigning}
                    >
                        Cancel
                    </Button>
                    <Button
                        className="flex-1 font-bold bg-slate-900"
                        onClick={handleAssign}
                        isLoading={assigning}
                        disabled={!selectedRiderId || assigning}
                    >
                        {isReassign ? "Confirm Reassign" : "Confirm Assignment"}
                    </Button>
                </div>
            </motion.div>
        </div>
    );
};

export default AssignDeliveryBoy;
