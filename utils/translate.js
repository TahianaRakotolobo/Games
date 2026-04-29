/**
 * translate.js
 * Translates a French guess to English using MyMemory (free, no key needed).
 * Falls back to the original text if translation fails.
 */

async function translateToEnglish(text) {
  try {
    const url = 'https://api.mymemory.translated.net/get?q=' +
      encodeURIComponent(text) + '&langpair=fr|en';

    const res  = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const data = await res.json();

    const translated = data?.responseData?.translatedText;
    if (translated && translated.toLowerCase() !== text.toLowerCase()) {
      console.log('[translate] "' + text + '" → "' + translated + '"');
      return translated.trim();
    }
  } catch (err) {
    console.warn('[translate] Failed:', err.message);
  }
  return text; // fallback: use original
}

module.exports = { translateToEnglish };
