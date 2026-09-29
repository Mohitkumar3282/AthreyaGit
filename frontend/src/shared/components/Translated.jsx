import React, { useEffect, useState } from "react";
import { useLanguage } from "@core/context/LanguageContext";
import { translateText } from "@core/services/translateApi";

/**
 * Wraps dynamic content (product names, descriptions, shop names — text a
 * seller/admin typed in, not static UI copy) that isn't covered by the
 * static dictionary. Renders the original text immediately, then swaps in
 * the machine-translated version once it resolves; stays as-is in English
 * or if translation fails.
 *
 * <Translated text={product.name} as="h3" className="font-bold" />
 */
const Translated = ({ text, as: Component = "span", ...rest }) => {
  const { language } = useLanguage();
  // Cache of the last resolved translation, tagged with the (text, lang) it
  // belongs to — lets render fall back to the original text whenever `text`
  // changes (e.g. list re-renders with a different item) instead of
  // flashing a stale translation while the new one is in flight.
  const [resolved, setResolved] = useState(null);

  useEffect(() => {
    if (!text || language === "en") return undefined;
    let cancelled = false;
    translateText(text, language).then((value) => {
      if (!cancelled) setResolved({ text, language, value });
    });
    return () => {
      cancelled = true;
    };
  }, [text, language]);

  const display =
    language !== "en" && resolved?.text === text && resolved?.language === language
      ? resolved.value
      : text;

  return <Component {...rest}>{display}</Component>;
};

export default Translated;
