import React, { useEffect, memo } from "react";
import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";
import confetti from "canvas-confetti";

const ThankYouAnimation = memo(({ isThankYouStage }) => {

    useEffect(() => {
        // Trigger confetti explosion on mount!
        const duration = 2.5 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

        function randomInRange(min, max) {
            return Math.random() * (max - min) + min;
        }

        const interval = setInterval(function() {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            // since particles fall down, animate a bit higher than random
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="relative w-full rounded-2xl overflow-hidden border border-[#0d4f1c] bg-gradient-to-br from-[#021f0b] via-[#042A0F] to-[#011407] shadow-xl p-6 min-h-[175px] flex items-center justify-center text-center">
            
            <AnimatePresence mode="wait">
                {!isThankYouStage ? (
                    // Stage 6: Order Delivered
                    <motion.div
                        key="delivered"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="flex flex-col items-center gap-2"
                    >
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: [0, 1.2, 1] }}
                            transition={{ duration: 0.6, ease: "backOut" }}
                            className="text-[#A3E635]"
                        >
                            <CheckCircle size={56} className="stroke-[2.5]" />
                        </motion.div>
                        <h2 className="text-lg md:text-2xl font-black text-white mt-1">Order Delivered Successfully</h2>
                        <span className="text-[10px] bg-green-900/50 text-[#A3E635] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                            OTP Verified
                        </span>
                    </motion.div>
                ) : (
                    // Stage 7: Thank You Screen
                    <motion.div
                        key="thankyou"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="flex flex-col items-center gap-1.5"
                    >
                        <motion.span
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="text-4xl"
                        >
                            🙏
                        </motion.span>
                        <h2 className="text-xl md:text-3xl font-black text-[#A3E635] mt-1">Thank You!</h2>
                        <p className="text-[11px] md:text-sm text-slate-200 font-bold max-w-sm">
                            Thank you for ordering with Athreya Delivery. Hope you enjoy your meal!
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});

ThankYouAnimation.displayName = "ThankYouAnimation";

// Wrap AnimatePresence here inside imports if we use it, wait, we used AnimatePresence but forgot to import it!
// Let's import AnimatePresence from framer-motion in the code.
import { AnimatePresence } from "framer-motion";

export default ThankYouAnimation;
