import React, { useEffect, useState } from "react";
import { deliveryApi } from "../services/deliveryApi";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Package, MapPin, CheckCircle, XCircle, ArrowRight, Loader2, Clock } from "lucide-react";
import Card from "@/shared/components/ui/Card";
import Button from "@/shared/components/ui/Button";

const ReturnTasks = () => {
    const navigate = useNavigate();
    const [taskType, setTaskType] = useState("return"); // "return" | "cancellation"
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [clockTick, setClockTick] = useState(Date.now());

    const fetchTasks = async () => {
        try {
            setLoading(true);
            const res = taskType === "cancellation"
                ? await deliveryApi.getMyCancellationTasks()
                : await deliveryApi.getMyReturnTasks();
            const payload = res.data.results || res.data.result || res.data;
            setTasks(Array.isArray(payload) ? payload : []);
        } catch (error) {
            console.error(`Failed to fetch ${taskType} tasks`, error);
            toast.error(`Failed to load ${taskType} tasks`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
        const iv = setInterval(() => setClockTick(Date.now()), 1000);
        return () => clearInterval(iv);
    }, [taskType]);

    const handleAccept = async (id) => {
        try {
            if (taskType === "cancellation") {
                await deliveryApi.acceptCancellationTask(id);
            } else {
                await deliveryApi.acceptReturnTask(id);
            }
            toast.success("Task accepted successfully");
            fetchTasks();
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to accept task");
        }
    };

    const handleDecline = async (id) => {
        try {
            if (taskType === "cancellation") {
                await deliveryApi.declineCancellationTask(id, { reason: "Declined by rider" });
            } else {
                await deliveryApi.declineReturnTask(id, { reason: "Declined by rider" });
            }
            toast.success("Task declined");
            fetchTasks();
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to decline task");
        }
    };

    const isTaskAccepted = (task) => {
        return (task.status_history || []).some(
            (h) => h.changed_by === "delivery_boy" && h.status === "PICKUP_SCHEDULED"
        );
    };

    const getRemainingSeconds = (scheduledAtStr) => {
        if (!scheduledAtStr) return 0;
        const scheduledTime = new Date(scheduledAtStr).getTime();
        const elapsed = clockTick - scheduledTime;
        const remaining = 5 * 60 * 1000 - elapsed; // 5 minutes
        return Math.max(0, Math.floor(remaining / 1000));
    };

    const formatCountdown = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    return (
        <div className="bg-gray-50/50 min-h-screen pb-24 font-sans px-6 pt-12">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-900">
                        {taskType === "cancellation" ? "Cancellation" : "Return"} Tasks
                    </h1>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Manage {taskType === "cancellation" ? "order cancellation" : "return"} pickups assigned to you.
                    </p>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit">
                    <button
                        onClick={() => setTaskType("return")}
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                            taskType === "return"
                                ? "bg-slate-900 text-white shadow-md"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                        }`}
                    >
                        Returns
                    </button>
                    <button
                        onClick={() => setTaskType("cancellation")}
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                            taskType === "cancellation"
                                ? "bg-slate-900 text-white shadow-md"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                        }`}
                    >
                        Cancellations
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                    <p className="text-xs text-slate-500 font-bold mt-3 uppercase tracking-widest">Loading Return Tasks...</p>
                </div>
            ) : tasks.length === 0 ? (
                <div className="bg-white rounded-3xl p-10 text-center border-2 border-dashed border-gray-200 flex flex-col items-center">
                    <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100 opacity-60">
                        <Package size={20} className="text-gray-400" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-800">No Return Tasks</h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-[200px]">You currently have no return pickups assigned to you.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {tasks.map((task) => {
                        const accepted = isTaskAccepted(task) || task.status === "PICKED_UP" || task.status === "DELIVERED_TO_SELLER";
                        const remaining = getRemainingSeconds(task.pickup_scheduled_at);
                        const expired = remaining <= 0;

                        if (!accepted && expired) return null; // Hide if acceptance window expired (auto-decline job will trigger in bg)

                        return (
                            <Card key={task._id} className="p-5 border border-slate-100 hover:shadow-md transition-all relative overflow-hidden bg-white">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <span className="text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-wider mb-2 inline-block">
                                            Return Pickup
                                        </span>
                                        <h4 className="font-extrabold text-slate-900 text-base">
                                            #{task.order_id?.orderId || "Order"}
                                        </h4>
                                    </div>
                                    <div className="text-right">
                                        <span className="block font-black text-brand-600 text-base">₹15.00</span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Earnings</span>
                                    </div>
                                </div>

                                <div className="space-y-2 text-xs text-slate-600 mb-5">
                                    <div className="flex items-start gap-2">
                                        <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-bold text-slate-800">Pickup Location</p>
                                            <p className="text-slate-500 mt-0.5">{task.order_id?.address?.address || "Address not available"}</p>
                                        </div>
                                    </div>
                                </div>

                                {!accepted ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 rounded-xl text-xs font-bold border border-amber-200">
                                            <Clock size={14} className="animate-pulse" />
                                            <span>Acceptance Window: {formatCountdown(remaining)}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                className="flex-1 text-xs font-bold border-rose-200 text-rose-600 hover:bg-rose-50"
                                                onClick={() => handleDecline(task._id)}
                                            >
                                                Decline
                                            </Button>
                                            <Button
                                                className="flex-1 text-xs font-bold bg-slate-900"
                                                onClick={() => handleAccept(task._id)}
                                            >
                                                Accept task
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <Button
                                            className="flex-1 text-xs font-bold bg-slate-900 flex items-center justify-center gap-1"
                                            onClick={() => navigate(`/delivery/return-task-details/${task._id}?type=${taskType}`)}
                                        >
                                            View Details & Execute <ArrowRight size={14} />
                                        </Button>
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ReturnTasks;
