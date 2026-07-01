import React from "react";
import { MARQUEE_MESSAGES } from "../../constants/homeConstants";

const PromoMarquee = () => {
  return (
    <div className="w-full -mt-[2px] md:-mt-[2px] mb-4">
      <div className="relative overflow-hidden border-y border-[#389ecb] bg-[#1a6e2e] ">
        <div className="absolute inset-y-0 left-0 w-10 bg-[#1a6e2e] pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-10 bg-[#1a6e2e] pointer-events-none" />
        <div className="classic-marquee-track flex w-max items-center gap-4 px-3 py-1.5 text-sm font-semibold text-white -translate-y-[5px] md:px-6 md:py-2 md:text-base">
          {[...MARQUEE_MESSAGES, ...MARQUEE_MESSAGES].map((message, idx) => (
            <React.Fragment key={`${message}-${idx}`}>
              <span className="whitespace-nowrap">{message}</span>
              <span className="text-white/60">•</span>
            </React.Fragment>
          ))}
          <span className="whitespace-nowrap">❤️</span>
          <span className="whitespace-nowrap">🎁</span>
        </div>
      </div>
    </div>
  );
};

export default React.memo(PromoMarquee);
