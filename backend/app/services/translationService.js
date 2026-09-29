import translate from "google-translate-api-x";
import crypto from "crypto";
import TranslationCache from "../models/translationCache.js";

// Per-process fast path on top of the Mongo cache — avoids a DB round-trip
// for strings this instance has already resolved since boot.
const mem = new Map();

function cacheKey(text, targetLang) {
  return crypto.createHash("sha1").update(`${targetLang}|${text}`).digest("hex");
}

/**
 * Translate a batch of strings to targetLang, using the mem cache, then the
 * Mongo cache, and only falling through to google-translate-api-x (an
 * unofficial, keyless, rate-limitable endpoint) for genuinely new strings.
 *
 * Returns a { originalText: translatedText } map. On any translation
 * failure, the original text is returned for the affected strings — the
 * caller (UI) should never break just because translation is unavailable.
 */
export async function translateBatch(texts, targetLang) {
  const lang = String(targetLang || "te").trim().toLowerCase();
  const uniqueTexts = [...new Set((texts || []).map((t) => String(t ?? "").trim()).filter(Boolean))];
  if (!uniqueTexts.length) return {};

  // Same-language passthrough — no point round-tripping to Google for it.
  if (lang === "en") {
    return Object.fromEntries(uniqueTexts.map((t) => [t, t]));
  }

  const result = {};
  const toFetch = [];

  for (const text of uniqueTexts) {
    const key = cacheKey(text, lang);
    if (mem.has(key)) {
      result[text] = mem.get(key);
    } else {
      toFetch.push({ text, key });
    }
  }

  if (toFetch.length) {
    let dbHits = [];
    try {
      dbHits = await TranslationCache.find({ key: { $in: toFetch.map((f) => f.key) } }).lean();
    } catch (e) {
      console.warn("TranslationCache lookup failed:", e.message);
    }
    const dbHitByKey = new Map(dbHits.map((d) => [d.key, d.translatedText]));

    const stillMissing = [];
    for (const f of toFetch) {
      const hit = dbHitByKey.get(f.key);
      if (hit != null) {
        result[f.text] = hit;
        mem.set(f.key, hit);
      } else {
        stillMissing.push(f);
      }
    }

    if (stillMissing.length) {
      try {
        // Batch endpoint — one round trip for the whole miss-list, and far
        // less likely to be rate-limited than the single-translate endpoint.
        const translated = await translate(
          stillMissing.map((f) => f.text),
          { to: lang },
        );
        const docs = [];
        stillMissing.forEach((f, i) => {
          const out = translated?.[i]?.text || f.text;
          result[f.text] = out;
          mem.set(f.key, out);
          docs.push({ key: f.key, sourceText: f.text, targetLang: lang, translatedText: out });
        });

        // Persist without blocking the response on Mongo write latency.
        TranslationCache.bulkWrite(
          docs.map((d) => ({
            updateOne: {
              filter: { key: d.key },
              update: { $setOnInsert: d },
              upsert: true,
            },
          })),
          { ordered: false },
        ).catch((e) => console.warn("TranslationCache bulkWrite failed:", e.message));
      } catch (e) {
        console.error("google-translate-api-x translate failed:", e.message);
        // Fail open: show the original text rather than break the page.
        stillMissing.forEach((f) => {
          result[f.text] = f.text;
        });
      }
    }
  }

  return result;
}

export async function translateOne(text, targetLang) {
  const map = await translateBatch([text], targetLang);
  return map[String(text ?? "").trim()] ?? text;
}
