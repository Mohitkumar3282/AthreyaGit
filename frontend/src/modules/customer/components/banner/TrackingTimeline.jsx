import React, { memo } from "react";
import { Check } from "lucide-react";

const STAGES = [
    { label: "Confirmed", labelTe: "ధృవీకరించబడింది", stageNum: 1 },
    { label: "Preparing", labelTe: "తయారువుతోంది", stageNum: 2 },
    { label: "Ready", labelTe: "సిద్ధంగా ఉంది", stageNum: 3 },
    { label: "On The Way", labelTe: "దారిలో ఉంది", stageNum: 5 }, // Stage 4 & 5 represent transit
    { label: "Delivered", labelTe: "డెలివరీ అయింది", stageNum: 6 }
];

const TrackingTimeline = memo(({ currentStage }) => {
    return (
        <div className="w-full bg-[#021f0b] border-b border-[#0d4f1c] px-4 py-3 flex flex-col gap-2">
            
            {/* Timeline Row */}
            <div className="relative flex justify-between items-center w-full mt-2 px-1">
                
                {/* Connecting Track */}
                <div className="absolute top-1/2 left-0 right-0 h-1 bg-white/10 -translate-y-1/2 z-0 rounded-full" />
                
                {/* Active Connecting Track */}
                <div 
                    className="absolute top-1/2 left-0 h-1 bg-[#A3E635] -translate-y-1/2 z-0 transition-all duration-1000 ease-in-out rounded-full"
                    style={{
                        width: `${
                            currentStage >= 6 
                                ? 100 
                                : currentStage === 5 
                                ? 75 
                                : currentStage === 3 
                                ? 50 
                                : currentStage === 2 
                                ? 25 
                                : 0
                        }%`
                    }}
                />

                {/* Nodes */}
                {STAGES.map((s, idx) => {
                    const isCompleted = currentStage > s.stageNum || (s.stageNum === 5 && currentStage >= 4);
                    const isActive = currentStage === s.stageNum || (s.stageNum === 5 && currentStage === 4);
                    const isPending = !isCompleted && !isActive;

                    return (
                        <div key={idx} className="relative z-10 flex flex-col items-center gap-1.5">
                            {/* Circle */}
                            <div 
                                className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                                    isCompleted 
                                        ? "bg-[#A3E635] border-[#A3E635] text-[#042A0F]" 
                                        : isActive 
                                        ? "bg-[#042A0F] border-[#A3E635] text-[#A3E635] shadow-[0_0_8px_rgba(163,230,53,0.6)] scale-110" 
                                        : "bg-[#021f0b] border-white/20 text-white/40"
                                }`}
                            >
                                {isCompleted ? (
                                    <Check size={12} className="stroke-[4]" />
                                ) : (
                                    <span className="text-[10px] font-black">{idx + 1}</span>
                                )}
                            </div>

                            {/* Label */}
                            <div className="flex flex-col items-center leading-none text-center">
                                <span className={`text-[8.5px] font-black uppercase tracking-tight ${
                                    isActive ? "text-[#A3E635]" : isCompleted ? "text-white" : "text-white/40"
                                }`}>
                                    {s.label}
                                </span>
                                <span className={`text-[7.5px] font-semibold mt-0.5 ${
                                    isActive ? "text-[#A3E635]/80" : isCompleted ? "text-slate-300" : "text-white/25"
                                }`}>
                                    {s.labelTe}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

TrackingTimeline.displayName = "TrackingTimeline";

export default TrackingTimeline;
