import axiosInstance from "@core/api/axios";

// Client for POST /translate/batch (backend wraps google-translate-api-x).
// Coalesces same-tick translateText() calls into one HTTP request per
// language, and caches results in-memory + localStorage so a string is
// only ever translated once per browser.

const LS_KEY_PREFIX = "athreya_tr_";
const memCache = new Map();
let pendingQueue = new Map(); // lang -> Map(text -> resolve[])
let flushTimer = null;
const FLUSH_DEBOUNCE_MS = 120;

function lsKey(text, lang) {
  return `${LS_KEY_PREFIX}${lang}:${text}`;
}

function readLocalCache(text, lang) {
  try {
    return localStorage.getItem(lsKey(text, lang));
  } catch {
    return null;
  }
}

function writeLocalCache(text, lang, value) {
  try {
    localStorage.setItem(lsKey(text, lang), value);
  } catch {
    // Storage full / disabled — memory cache still covers this session.
  }
}

async function flushQueue() {
  const queue = pendingQueue;
  pendingQueue = new Map();
  flushTimer = null;

  for (const [lang, textMap] of queue.entries()) {
    const texts = [...textMap.keys()];
    if (!texts.length) continue;

    try {
      const res = await axiosInstance.post("/translate/batch", { texts, targetLang: lang });
      const translations = res?.data?.result?.translations || {};
      texts.forEach((text) => {
        const out = translations[text] || text;
        memCache.set(`${lang}|${text}`, out);
        writeLocalCache(text, lang, out);
        textMap.get(text).forEach((resolve) => resolve(out));
      });
    } catch {
      // Fail open — show original text rather than break the page.
      texts.forEach((text) => {
        textMap.get(text).forEach((resolve) => resolve(text));
      });
    }
  }
}

/**
 * Translate a single string to `lang`. Resolves with the original text for
 * lang === 'en' (no-op), from cache when already known, or via a debounced
 * batch call to the backend otherwise.
 */
export function translateText(text, lang) {
  const clean = String(text || "").trim();
  if (!clean || !lang || lang === "en") return Promise.resolve(clean);

  const key = `${lang}|${clean}`;
  if (memCache.has(key)) return Promise.resolve(memCache.get(key));

  const cached = readLocalCache(clean, lang);
  if (cached) {
    memCache.set(key, cached);
    return Promise.resolve(cached);
  }

  return new Promise((resolve) => {
    if (!pendingQueue.has(lang)) pendingQueue.set(lang, new Map());
    const textMap = pendingQueue.get(lang);
    if (!textMap.has(clean)) textMap.set(clean, []);
    textMap.get(clean).push(resolve);

    if (!flushTimer) {
      flushTimer = setTimeout(flushQueue, FLUSH_DEBOUNCE_MS);
    }
  });
}
