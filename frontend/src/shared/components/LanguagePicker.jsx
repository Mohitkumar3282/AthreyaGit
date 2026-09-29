import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@core/context/LanguageContext";
import { LANGUAGES } from "@core/i18n/dictionary";

/**
 * Language selector: click the trigger to open a dropdown of supported
 * languages, click one to apply it immediately (closes the menu).
 *
 * The menu is portaled to document.body and positioned via the trigger's
 * getBoundingClientRect() rather than CSS `absolute` — several call sites
 * (the customer header, the collapsible mobile header row) sit inside an
 * `overflow-hidden` ancestor for their scroll/collapse animation, which
 * would silently clip an absolutely-positioned dropdown to invisible.
 *
 * <LanguagePicker renderTrigger={({ toggle }) => <button onClick={toggle}>...</button>} />
 */
const LanguagePicker = ({ renderTrigger, align = "right", menuClassName }) => {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const triggerWrapRef = useRef(null);
  const menuRef = useRef(null);

  const computePosition = useCallback(() => {
    const el = triggerWrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 8,
      left: align === "right" ? undefined : rect.left,
      right: align === "right" ? window.innerWidth - rect.right : undefined,
    });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return;
    computePosition();
  }, [open, computePosition]);

  useEffect(() => {
    if (!open) return undefined;

    const onClickOutside = (e) => {
      if (
        triggerWrapRef.current?.contains(e.target) ||
        menuRef.current?.contains(e.target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onReposition = () => computePosition();

    document.addEventListener("mousedown", onClickOutside);
    // Capture phase so scrolling any nested scroll container (not just the
    // window) keeps the menu anchored to the trigger instead of drifting.
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [open, computePosition]);

  const handleSelect = (code) => {
    setLanguage(code);
    setOpen(false);
  };

  return (
    <>
      <div ref={triggerWrapRef} className="inline-flex">
        {renderTrigger({ open, toggle: () => setOpen((o) => !o), language })}
      </div>
      {open && menuPos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{ position: "fixed", top: menuPos.top, left: menuPos.left, right: menuPos.right }}
              className={cn(
                "w-40 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-[100000] overflow-hidden",
                menuClassName,
              )}
            >
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  role="menuitemradio"
                  aria-checked={language === lang.code}
                  onClick={() => handleSelect(lang.code)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-3.5 py-2 text-left text-[13px] font-bold transition-colors",
                    language === lang.code
                      ? "bg-primary/10 text-primary"
                      : "text-gray-700 hover:bg-gray-50",
                  )}
                >
                  <span>{lang.native}</span>
                  {language === lang.code && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
};

export default LanguagePicker;
