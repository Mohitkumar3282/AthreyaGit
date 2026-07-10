import React, { memo } from "react";
import { Phone, MessageSquare, ChefHat, ShoppingBag, Truck, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

const OrderStatusCard = memo(({ stage, order, eta, dynamicDistance }) => {
    if (!order) return null;

    const sellerName = order.seller?.shopName || "Store";
    const rider = order.deliveryBoy;
    const riderName = rider?.fullName || "Athreya Partner";
    const vehicleNumber = rider?.vehicleNumber || "AP-28-XX-1234";
    const riderPhone = rider?.phone || "";

    // 1. Order Confirmed (Stage 1)
    if (stage === 1) {
        return (
            <div className="flex gap-4 p-4 items-center bg-[#021f0b] border border-[#0d4f1c] rounded-2xl w-full">
                <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 border border-green-500/20 shrink-0">
                    <CheckCircle2 className="w-6 h-6 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                    <span className="text-[10px] bg-green-900/50 text-[#A3E635] px-2 py-0.5 rounded-full font-black uppercase">
                        Order Confirmed
                    </span>
                    <h4 className="text-sm font-black text-white mt-1">Accepting items at {sellerName}</h4>
                    <p className="text-[10px] text-slate-300 font-bold mt-0.5">We're verifying store availability</p>
                </div>
            </div>
        );
    }

    // 2. Preparing Order (Stage 2)
    if (stage === 2) {
        return (
            <div className="flex gap-4 p-4 items-center bg-[#021f0b] border border-[#0d4f1c] rounded-2xl w-full">
                <div className="relative w-12 h-12 bg-orange-500/10 rounded-full flex items-center justify-center text-orange-500 border border-orange-500/20 shrink-0">
                    <ChefHat className="w-6 h-6 animate-bounce" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] bg-orange-950 text-orange-400 px-2 py-0.5 rounded-full font-black uppercase">
                            Preparing Order
                        </span>
                        <div className="flex gap-0.5">
                            <span className="w-1 h-1 bg-[#A3E635] rounded-full animate-ping" />
                            <span className="w-1 h-1 bg-[#A3E635] rounded-full animate-ping delay-100" />
                            <span className="w-1 h-1 bg-[#A3E635] rounded-full animate-ping delay-200" />
                        </div>
                    </div>
                    <h4 className="text-sm font-black text-white mt-1">Chef is preparing your meal</h4>
                    <p className="text-[10px] text-slate-300 font-bold mt-0.5">Food packing & sorting in progress</p>
                </div>
            </div>
        );
    }

    // 3. Ready For Pickup (Stage 3)
    if (stage === 3) {
        return (
            <div className="flex gap-4 p-4 items-center bg-[#021f0b] border border-[#0d4f1c] rounded-2xl w-full">
                <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center text-[#A3E635] border border-[#A3E635]/20 shrink-0">
                    <ShoppingBag className="w-6 h-6 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                    <span className="text-[10px] bg-[#042A0F] text-[#A3E635] px-2 py-0.5 rounded-full font-black uppercase">
                        Ready For Pickup
                    </span>
                    <h4 className="text-sm font-black text-white mt-1">Your order is packed & ready</h4>
                    <p className="text-[10px] text-slate-300 font-bold mt-0.5">Athreya Delivery Partner is arriving shortly</p>
                </div>
            </div>
        );
    }

    // 4. Transit / Out For Delivery / Live map status card (Stage 4 & 5)
    return (
        <div className="bg-[#021f0b] border border-[#0d4f1c] rounded-2xl p-4 w-full flex flex-col gap-3">
            
            {/* Header: Rider details */}
            <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                    <div className="h-11 w-11 rounded-full bg-slate-800 overflow-hidden border-2 border-[#A3E635]/30">
                        <img
                            src={rider?.profileImage || "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100&auto=format&fit=crop&q=60"}
                            alt={riderName}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                                e.target.src = "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100&auto=format&fit=crop&q=60";
                            }}
                        />
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <h4 className="font-black text-white text-xs truncate">{riderName}</h4>
                        <span className="text-[8px] bg-slate-800 text-slate-300 border border-white/10 px-1.5 py-0.5 rounded font-black uppercase">
                            RIDER
                        </span>
                    </div>
                    <p className="text-[9.5px] text-[#A3E635] font-black uppercase tracking-wider mt-0.5">
                        {vehicleNumber}
                    </p>
                </div>

                {/* Call & Chat Buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                    {riderPhone && (
                        <a 
                            href={`tel:${riderPhone}`}
                            className="h-8 w-8 rounded-xl bg-white/5 border border-white/15 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
                        >
                            <Phone size={14} className="text-[#A3E635]" />
                        </a>
                    )}
                    <a 
                        href={`/chat`}
                        className="h-8 w-8 rounded-xl bg-white/5 border border-white/15 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
                    >
                        <MessageSquare size={14} className="text-white" />
                    </a>
                </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-white/10 w-full" />

            {/* ETA details */}
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-[#A3E635]/10 border border-[#A3E635]/20 flex items-center justify-center text-[#A3E635]">
                        <Clock size={16} className="stroke-[3.5]" />
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Estimated Delivery Time</p>
                        <h5 className="text-[14px] font-black text-white leading-none mt-0.5 font-sans">
                            {eta || "10 - 15 mins"}
                        </h5>
                    </div>
                </div>
                {dynamicDistance && (
                    <div className="text-right">
                        <p className="text-[9px] font-black text-[#A3E635] uppercase tracking-wider">Distance Remaining</p>
                        <h5 className="text-[14px] font-black text-white leading-none mt-0.5 font-sans">
                            {dynamicDistance}
                        </h5>
                    </div>
                )}
            </div>
        </div>
    );
});

OrderStatusCard.displayName = "OrderStatusCard";

export default OrderStatusCard;
