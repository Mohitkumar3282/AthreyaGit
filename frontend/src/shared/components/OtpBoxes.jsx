import React, { useEffect, useRef, useState } from "react";

/**
 * OTP entry drawn as separate boxes but backed by ONE real input.
 *
 * Why: the old version used one <input> per digit and called .focus() on the
 * next one after every keystroke. iOS Safari re-scrolls the page and re-animates
 * the keyboard on every programmatic focus change, so the screen jumped up and
 * down for each digit. With a single input the focus never moves.
 *
 * It also gets iOS "From Messages" OTP autofill (autocomplete="one-time-code"),
 * paste, and Android SMS autofill for free. The input is 16px so iOS never zooms.
 */
const OtpBoxes = ({
  value = "",
  onChange,
  length = 4,
  autoFocus = false,
  boxClassName = "",
  activeBorderColor,
  className = "",
  boxStyle,
}) => {
  const ref = useRef(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const digits = String(value || "").slice(0, length);
  const activeIndex = Math.min(digits.length, length - 1);

  return (
    <div
      className={`relative ${className}`}
      onClick={() => ref.current?.focus({ preventScroll: true })}
    >
      <div className="flex justify-center gap-3">
        {Array.from({ length }).map((_, i) => {
          const isActive = focused && i === activeIndex;
          return (
            <div
              key={i}
              className={boxClassName}
              style={{
                ...(boxStyle || {}),
                ...(isActive && activeBorderColor ? { borderColor: activeBorderColor } : {}),
              }}
            >
              <span className="inline-flex h-full w-full items-center justify-center">
                {digits[i] || ""}
              </span>
            </div>
          );
        })}
      </div>
      <input
        ref={ref}
        type="tel"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={length}
        value={digits}
        aria-label={`${length}-digit code`}
        onChange={(e) => onChange?.(e.target.value.replace(/\D/g, "").slice(0, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // Covers the boxes, invisible. 16px stops iOS from zooming on focus.
        className="absolute inset-0 h-full w-full opacity-0 text-[16px] caret-transparent cursor-text"
        style={{ fontSize: "16px" }}
      />
    </div>
  );
};

export default OtpBoxes;
