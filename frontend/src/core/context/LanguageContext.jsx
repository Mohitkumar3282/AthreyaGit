import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { DEFAULT_LANGUAGE, DICTIONARY } from "../i18n/dictionary";

const STORAGE_KEY = "athreya_language";
const LanguageContext = createContext(undefined);

function readStoredLanguage() {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

/**
 * App-wide English/Telugu toggle, shared by all four frontends (customer,
 * rider, seller, admin — one SPA build). Static UI text comes from
 * DICTIONARY via t(); dynamic content (product names, descriptions, etc.)
 * goes through <Translated /> + the backend translate API instead.
 */
export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(readStoredLanguage);

  const setLanguage = useCallback((lang) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Non-fatal — the toggle still works for this page load.
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "en" ? "te" : "en");
  }, [language, setLanguage]);

  const t = useCallback(
    (key, fallback) => {
      const dict = DICTIONARY[language] || DICTIONARY.en;
      return dict[key] ?? DICTIONARY.en[key] ?? fallback ?? key;
    },
    [language],
  );

  const value = useMemo(
    () => ({ language, setLanguage, toggleLanguage, t, isEnglish: language === "en" }),
    [language, setLanguage, toggleLanguage, t],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
};
