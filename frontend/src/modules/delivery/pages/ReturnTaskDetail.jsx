import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { deliveryApi } from "../services/deliveryApi";
import { toast } from "sonner";
import { Loader2, ArrowLeft, MapPin, Phone, CheckCircle2, Camera, Upload, ShieldCheck, ShoppingBag } from "lucide-react";
import Card from "@/shared/components/ui/Card";
import Button from "@/shared/components/ui/Button";

const ReturnTaskDetail = () => {
    const { returnRequestId } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [task, setTask] = useState(null);
    const [loading, setLoading] = useState(true);
    const [otpCode, setOtpCode] = useState("");
    const [verifyingOtp, setVerifyingOtp] = useState(false);
    const [otpVerified, setOtpVerified] = useState(false);
    const [pickupImage, setPickupImage] = useState(null);
    const [pickupImagePreview, setPickupImagePreview] = useState(null);
    const [submittingPickup, setSubmittingPickup] = useState(false);
    const [delivering, setDelivering] = useState(false);
    const [requestingOtp, setRequestingOtp] = useState(false);

    const type = searchParams.get("type") || "return";
    const isCancellation = type === "cancellation";

    const fetchTaskDetail = async () => {
        try {
            setLoading(true);
            const res = isCancellation
                ? await deliveryApi.getCancellationTaskDetail(returnRequestId)
                : await deliveryApi.getReturnTaskDetail(returnRequestId);
            setTask(res.data.result || res.data);
        } catch (error) {
            console.error("Failed to fetch return task details", error);
            toast.error("Failed to load task details");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (returnRequestId) {
            fetchTaskDetail();
        }
    }, [returnRequestId]);

    const handleVerifyPickupOtp = async () => {
        if (!otpCode || otpCode.length !== 4) {
            toast.error("Please enter a valid 4-digit OTP");
            return;
        }
        try {
            setVerifyingOtp(true);
            const orderId = task.order_id?.orderId || task.order_id;
            if (isCancellation) {
                await deliveryApi.verifyCancellationOtp(orderId, { code: otpCode });
                toast.success("Cancellation pickup OTP verified successfully!");
                setOtpCode("");
                fetchTaskDetail();
            } else {
                await deliveryApi.verifyReturnOtp(orderId, { code: otpCode });
                setOtpVerified(true);
                setOtpCode("");
                toast.success("Pickup OTP verified successfully! Now upload proof to complete pickup.");
            }
        } catch (error) {
            console.error("OTP verification failed", error);
            toast.error(error.response?.data?.message || "Invalid OTP code");
        } finally {
            setVerifyingOtp(false);
        }
    };

    const handleRequestOtp = async () => {
        try {
            setRequestingOtp(true);
            const orderId = task.order_id?.orderId || task.order_id;
            if (isCancellation) {
                await deliveryApi.requestCancellationOtp(orderId, {});
            } else {
                await deliveryApi.requestReturnOtp(orderId, {});
            }
            toast.success("OTP sent to customer successfully!");
        } catch (error) {
            console.error("Failed to request OTP", error);
            toast.error(error.response?.data?.message || "Failed to request OTP");
        } finally {
            setRequestingOtp(false);
        }
    };

    const handleRequestDropOtp = async () => {
        try {
            setRequestingOtp(true);
            const orderId = task.order_id?.orderId || task.order_id;
            if (isCancellation) {
                await deliveryApi.requestCancellationDropOtp(orderId, {});
            } else {
                await deliveryApi.requestReturnDropOtp(orderId, {});
            }
            toast.success("OTP sent to seller successfully!");
        } catch (error) {
            console.error("Failed to request drop OTP", error);
            toast.error(error.response?.data?.message || "Failed to request drop OTP");
        } finally {
            setRequestingOtp(false);
        }
    };

    const handleImageSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPickupImage(file);
        setPickupImagePreview(URL.createObjectURL(file));
    };

    const handleConfirmPickup = async () => {
        if (!pickupImage) {
            toast.error("Please select or capture a pickup proof image");
            return;
        }
        try {
            setSubmittingPickup(true);
            const formData = new FormData();
            formData.append("pickup_image", pickupImage);
            await deliveryApi.markReturnPickedUp(returnRequestId, formData);
            toast.success("Task marked as picked up!");
            if (pickupImagePreview) {
                URL.revokeObjectURL(pickupImagePreview);
            }
            setPickupImage(null);
            setPickupImagePreview(null);
            setOtpVerified(false);
            fetchTaskDetail();
        } catch (error) {
            console.error("Failed to confirm pickup", error);
            toast.error(error.response?.data?.message || "Failed to confirm pickup");
        } finally {
            setSubmittingPickup(false);
        }
    };

    const handleVerifyDropOtp = async () => {
        if (!otpCode || otpCode.length !== 4) {
            toast.error("Please enter a valid 4-digit OTP");
            return;
        }
        try {
            setVerifyingOtp(true);
            const orderId = task.order_id?.orderId || task.order_id;
            if (isCancellation) {
                await deliveryApi.verifyCancellationDropOtp(orderId, { code: otpCode });
                toast.success("Cancellation drop OTP verified and finalized successfully!");
                setOtpCode("");
                fetchTaskDetail();
            } else {
                await deliveryApi.verifyReturnDropOtp(orderId, { code: otpCode });
                setOtpVerified(true);
                toast.success("Drop OTP verified! Delivering package to seller...");
                
                // Immediately call delivered-to-seller upon drop OTP validation
                setDelivering(true);
                await deliveryApi.markReturnDeliveredToSeller(returnRequestId);
                toast.success("Return task completed successfully!");
                setOtpCode("");
                setOtpVerified(false);
                fetchTaskDetail();
            }
        } catch (error) {
            console.error("Drop OTP verification failed", error);
            toast.error(error.response?.data?.message || "Invalid OTP code");
        } finally {
            setVerifyingOtp(false);
            setDelivering(false);
        }
    };

    const handleOpenInMaps = (lat, lng) => {
        if (lat && lng) {
            window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, "_blank");
        } else {
            window.open("https://maps.google.com", "_blank");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    if (!task) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-6">
                <p className="text-sm font-bold text-slate-800">{isCancellation ? "Cancellation" : "Return"} task not found</p>
                <Button className="mt-4 bg-slate-900" onClick={() => navigate("/delivery/return-tasks")}>
                    Back to tasks
                </Button>
            </div>
        );
    }

    const order = task.order_id || {};
    const customer = task.customer_id || {};
    const seller = order.seller || {};

    return (
        <div className="bg-slate-50 min-h-screen pb-24 font-sans">
            {/* Header */}
            <div className="bg-white sticky top-0 z-30 px-4 py-3 flex items-center justify-between border-b border-slate-100">
                <button onClick={() => navigate("/delivery/return-tasks")} className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors">
                    <ArrowLeft size={24} className="text-slate-800" />
                </button>
                <div className="flex-1 text-center">
                    <h1 className="text-base font-bold text-slate-800">Task Details</h1>
                    <p className="text-xs text-slate-500 font-medium">#{order.orderId || "Order"}</p>
                </div>
                <div className="w-10" />
            </div>

            <div className="px-6 py-4 space-y-4 max-w-md mx-auto">
                {/* Status Card */}
                <Card className="bg-white p-4 border border-slate-100">
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-500 uppercase">Status</span>
                        <span className="text-xs font-black bg-primary/10 text-primary px-3 py-1 rounded-full uppercase tracking-wider">
                            {task.status}
                        </span>
                    </div>
                </Card>

                {/* Step 1: Customer Pickup */}
                {(task.status === "PICKUP_SCHEDULED") && (
                    <Card className="bg-white p-5 border-2 border-primary/20 shadow-md space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">1</div>
                            <h3 className="font-extrabold text-slate-900 text-sm">Customer Pickup Instructions</h3>
                        </div>

                        <div className="space-y-3 text-xs text-slate-600">
                            <div className="flex items-start gap-2">
                                <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold text-slate-800">Customer Location</p>
                                    <p className="text-slate-500 mt-0.5">{order.address?.address || "Address N/A"}</p>
                                    <button 
                                        onClick={() => handleOpenInMaps(order.address?.location?.lat, order.address?.location?.lng)}
                                        className="text-primary font-bold mt-1.5 flex items-center gap-1 hover:underline"
                                    >
                                        📍 Get Directions
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                                <div>
                                    <p className="font-bold text-slate-800">Contact Customer</p>
                                    <a href={`tel:${customer.phone}`} className="text-slate-500 font-semibold">{customer.name || "Customer"} • {customer.phone}</a>
                                </div>
                            </div>
                        </div>

                        {/* OTP Verification and Pickup Proof */}
                        <div className="border-t border-slate-100 pt-4 space-y-4">
                            {!otpVerified ? (
                                <div className="space-y-3">
                                    <Button
                                        className="w-full bg-primary font-bold text-white mb-2"
                                        onClick={handleRequestOtp}
                                        isLoading={requestingOtp}
                                    >
                                        Send OTP to Customer
                                    </Button>
                                    <label className="text-xs font-bold text-slate-600 block">Enter Pickup OTP from Customer</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            maxLength={4}
                                            placeholder="4-digit OTP"
                                            value={otpCode}
                                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                                            className="flex-1 border-2 border-slate-200 rounded-xl px-4 py-2 text-center text-lg font-black tracking-widest outline-none focus:border-primary"
                                        />
                                        <Button
                                            className="bg-slate-900 px-6 font-bold"
                                            onClick={handleVerifyPickupOtp}
                                            isLoading={verifyingOtp}
                                            disabled={otpCode.length !== 4 || verifyingOtp}
                                        >
                                            Verify
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                                        <ShieldCheck size={18} />
                                        <span className="text-xs font-bold">OTP Verified! Capture return proof photo:</span>
                                    </div>

                                    <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                                        {pickupImagePreview ? (
                                            <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                                                <img src={pickupImagePreview} alt="Proof preview" className="w-full h-full object-cover" />
                                                <button 
                                                    onClick={() => { setPickupImage(null); setPickupImagePreview(null); }}
                                                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center cursor-pointer text-white"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ) : (
                                            <label className="flex flex-col items-center gap-1.5 cursor-pointer hover:text-primary transition-colors">
                                                <Camera className="h-8 w-8 text-slate-400" />
                                                <span className="text-xs font-bold text-slate-600">Capture Proof Photo</span>
                                                <input type="file" accept="image/*" capture="environment" onChange={handleImageSelect} className="hidden" />
                                            </label>
                                        )}
                                    </div>

                                    <Button
                                        className="w-full bg-slate-900 font-bold"
                                        onClick={handleConfirmPickup}
                                        isLoading={submittingPickup}
                                        disabled={!pickupImage || submittingPickup}
                                    >
                                        Confirm Pickup
                                    </Button>
                                </div>
                            )}
                        </div>
                    </Card>
                )}

                {/* Step 2: Return to Store */}
                {task.status === "PICKED_UP" && (
                    <Card className="bg-white p-5 border-2 border-primary/20 shadow-md space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">2</div>
                            <h3 className="font-extrabold text-slate-900 text-sm">Return Package to Store</h3>
                        </div>

                        <div className="space-y-3 text-xs text-slate-600">
                            <div className="flex items-start gap-2">
                                <ShoppingBag className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold text-slate-800">Seller Store Location</p>
                                    <p className="text-slate-900 font-bold mt-0.5">{seller.shopName || "Store"}</p>
                                    <p className="text-slate-500 mt-0.5">{seller.address || "Seller address N/A"}</p>
                                    {seller.location?.coordinates && (
                                        <button 
                                            onClick={() => handleOpenInMaps(seller.location.coordinates[1], seller.location.coordinates[0])}
                                            className="text-primary font-bold mt-1.5 flex items-center gap-1 hover:underline"
                                        >
                                            📍 Get Directions
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-slate-100 pt-4 space-y-4">
                            <div className="space-y-3">
                                <Button
                                    className="w-full bg-primary font-bold text-white mb-2"
                                    onClick={handleRequestDropOtp}
                                    isLoading={requestingOtp}
                                >
                                    Send OTP to Seller
                                </Button>
                                <label className="text-xs font-bold text-slate-600 block">Enter Drop OTP from Seller Store</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        maxLength={4}
                                        placeholder="4-digit OTP"
                                        value={otpCode}
                                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                                        className="flex-1 border-2 border-slate-200 rounded-xl px-4 py-2 text-center text-lg font-black tracking-widest outline-none focus:border-primary"
                                    />
                                    <Button
                                        className="bg-slate-900 px-6 font-bold"
                                        onClick={handleVerifyDropOtp}
                                        isLoading={verifyingOtp || delivering}
                                        disabled={otpCode.length !== 4 || verifyingOtp || delivering}
                                    >
                                        Verify & Drop
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Step 3: Completed */}
                {(task.status === "DELIVERED_TO_SELLER" || task.status === "CANCELLED") && (
                    <Card className="bg-emerald-50 p-6 border border-emerald-200 text-center space-y-3">
                        <div className="flex justify-center">
                            <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                        </div>
                        <h3 className="font-extrabold text-emerald-950 text-base">{isCancellation ? "Cancellation" : "Return"} Pickup Completed</h3>
                        <p className="text-xs text-emerald-800">
                            The package has been successfully delivered back to the seller store, and the transaction is complete.
                        </p>
                        <Button
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl mt-2 active:scale-95 transition-transform"
                            onClick={() => navigate("/delivery/return-tasks")}
                        >
                            Back to Return Tasks
                        </Button>
                    </Card>
                )}
            </div>
        </div>
    );
};

export default ReturnTaskDetail;
