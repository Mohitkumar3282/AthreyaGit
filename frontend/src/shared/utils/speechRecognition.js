const SPEECH_RECOGNITION_LOCALES = {
  en: "en-IN",
  hi: "hi-IN",
  ta: "ta-IN",
  te: "te-IN",
  ml: "ml-IN",
  kn: "kn-IN",
  mr: "mr-IN",
  bn: "bn-IN",
  gu: "gu-IN",
  pa: "pa-IN",
  or: "or-IN",
  as: "as-IN",
  ur: "ur-IN",
};

export function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function getSpeechRecognitionLocale(language) {
  return SPEECH_RECOGNITION_LOCALES[language] || "en-IN";
}
