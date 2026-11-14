import handleResponse from "../utils/helper.js";
import { translateBatch } from "../services/translationService.js";

const MAX_TEXTS_PER_REQUEST = 100;
const MAX_TEXT_LENGTH = 2000;
const SUPPORTED_LANGUAGES = new Set(["en", "hi", "ta", "te", "ml", "kn", "mr", "bn", "gu", "pa", "or", "as", "ur"]);

/**
 * POST /translate/batch
 * Body: { texts: string[], targetLang: string }
 *
 * Used by all four frontends (customer/rider/seller/admin) to translate
 * dynamic content (product names, descriptions, shop names) that isn't
 * covered by the static UI dictionary. Public — no auth — since the
 * customer app calls this before login too; protected by rate limiting
 * instead.
 */
export const translateBatchController = async (req, res) => {
  try {
    const { texts, targetLang, sourceLang = "en" } = req.body || {};

    if (!Array.isArray(texts) || !texts.length) {
      return handleResponse(res, 400, "texts array is required");
    }
    if (texts.length > MAX_TEXTS_PER_REQUEST) {
      return handleResponse(res, 400, `Max ${MAX_TEXTS_PER_REQUEST} texts per request`);
    }
    if (texts.some((t) => typeof t !== "string" || t.length > MAX_TEXT_LENGTH)) {
      return handleResponse(res, 400, `Each text must be a string under ${MAX_TEXT_LENGTH} characters`);
    }
    if (!targetLang || typeof targetLang !== "string") {
      return handleResponse(res, 400, "targetLang is required");
    }
    const target = targetLang.trim().toLowerCase();
    const source = typeof sourceLang === "string" ? sourceLang.trim().toLowerCase() : "";
    if (!SUPPORTED_LANGUAGES.has(target) || !SUPPORTED_LANGUAGES.has(source)) {
      return handleResponse(res, 400, "Unsupported source or target language");
    }

    const translations = await translateBatch(texts, target, source);
    return handleResponse(res, 200, "Translated", { translations, targetLang: target, sourceLang: source });
  } catch (e) {
    console.error("translateBatchController error:", e);
    return handleResponse(res, 500, "Translation failed");
  }
};
