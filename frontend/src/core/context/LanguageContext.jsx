import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LANGUAGE, DICTIONARY, LANGUAGES } from "../i18n/dictionary";
import { translateBatch, translateText } from "../services/translateApi";

const STORAGE_KEY = "athreya_language";
const LanguageContext = createContext(undefined);

function readStoredLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return LANGUAGES.some(({ code }) => code === stored) ? stored : DEFAULT_LANGUAGE;
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
  const [generatedDictionary, setGeneratedDictionary] = useState({});

  const changeLanguage = useCallback((lang) => {
    if (!LANGUAGES.some(({ code }) => code === lang)) return;
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Non-fatal — the toggle still works for this page load.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ur" ? "rtl" : "ltr";
    if (language === DEFAULT_LANGUAGE) {
      setGeneratedDictionary({});
      return undefined;
    }

    let cancelled = false;
    const entries = Object.entries(DICTIONARY.en || {});
    translateBatch(entries.map(([, value]) => value), language).then((translations) => {
      if (cancelled) return;
      setGeneratedDictionary(Object.fromEntries(entries.map(([key, value]) => [
        key,
        translations[value] || value,
      ])));
    });
    return () => { cancelled = true; };
  }, [language]);

  const setLanguage = changeLanguage;

  const toggleLanguage = useCallback(() => {
      setLanguage(language === "en" ? "te" : "en");
  }, [language, setLanguage]);

  const t = useCallback(
    (key, fallback) => {
      const dict = DICTIONARY[language] || {};
      if (dict[key] != null) return dict[key];
      const english = DICTIONARY.en[key] ?? fallback ?? key;
      return generatedDictionary[key] ?? english;
    },
    [language, generatedDictionary],
  );

  const translateCurrentText = useCallback(
    (text, target = language) => translateText(text, target),
    [language],
  );
  const translateCurrentBatch = useCallback(
    (texts, target = language, source = "en") => translateBatch(texts, target, source),
    [language],
  );
  const getCurrentLanguage = useCallback(() => language, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      changeLanguage,
      toggleLanguage,
      t,
      translateText: translateCurrentText,
      translateBatch: translateCurrentBatch,
      getCurrentLanguage,
      isEnglish: language === "en",
    }),
    [language, setLanguage, changeLanguage, toggleLanguage, t, translateCurrentText, translateCurrentBatch, getCurrentLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
};
