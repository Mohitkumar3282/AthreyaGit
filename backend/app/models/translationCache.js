import mongoose from "mongoose";

/**
 * Persistent cache for machine-translated strings (google-translate-api-x is
 * an unofficial, free, rate-limitable endpoint — every translation we've
 * already paid the round-trip for is kept here forever, keyed by a hash of
 * the source text + target language, so it's never re-fetched).
 */
const translationCacheSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    sourceText: { type: String, required: true },
    targetLang: { type: String, required: true },
    translatedText: { type: String, required: true },
  },
  { timestamps: true },
);

export default mongoose.model("TranslationCache", translationCacheSchema);
