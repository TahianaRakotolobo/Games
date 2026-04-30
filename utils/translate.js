/**
 * translate.js
 *
 * Smart guess matching for Picturize:
 *   1. Direct match (already done in server before calling this)
 *   2. Translate guess → English, check against word
 *   3. Fetch synonyms of the DB word, check if guess or translation matches any
 *   4. Translate the DB word → French, check if guess matches
 *
 * Uses:
 *   - MyMemory  (free, no key) for translation
 *   - Datamuse  (free, no key) for synonyms
 */

const MYMEMORY = 'https://api.mymemory.translated.net/get';
const DATAMUSE = 'https://api.datamuse.com/words';

// ── helpers ───────────────────────────────────────────────────────────────────

async function safeFetch(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    return await res.json();
  } catch (err) {
    console.warn('[translate] fetch failed:', url, err.message);
    return null;
  }
}

/**
 * Translate `text` from `from` language to `to` language.
 * Returns the translated string, or the original on failure.
 */
async function translate(text, from, to) {
  const url = MYMEMORY + '?q=' + encodeURIComponent(text) + '&langpair=' + from + '|' + to;
  const data = await safeFetch(url);
  const result = data?.responseData?.translatedText?.trim();
  if (result && result.toLowerCase() !== text.toLowerCase()) return result;
  return text;
}

/**
 * Fetch synonyms of an English word via Datamuse.
 * Returns an array of lowercase synonym strings.
 */
async function getSynonyms(word) {
  const url = DATAMUSE + '?rel_syn=' + encodeURIComponent(word.toLowerCase()) + '&max=20';
  const data = await safeFetch(url);
  if (!Array.isArray(data)) return [];
  return data.map(d => d.word.toLowerCase());
}

// ── main export ───────────────────────────────────────────────────────────────

/**
 * isGuessCorrect(guess, word)
 *
 * Returns { correct: bool, translatedTo: string|null }
 *
 * Matching order:
 *   1. Direct match                          (guess === word)
 *   2. Translate guess FR→EN, compare        ("avocat" → "lawyer" vs "lawyer")
 *   3. Synonyms of word, compare with guess  ("attorney" synonyms include "lawyer")
 *   4. Synonyms of word, compare with trans  (translation also checked vs synonyms)
 *   5. Translate word EN→FR, compare guess   ("attorney" → "avocat" vs "avocat")
 */
async function isGuessCorrect(guess, word) {
  const g = guess.trim().toLowerCase();
  const w = word.trim().toLowerCase();

  // 1. Direct match (should already be handled in server, but kept as safety)
  if (g === w) return { correct: true, translatedTo: null };

  // 2. Translate guess to English
  const translatedGuess = (await translate(guess, 'fr', 'en')).trim().toLowerCase();
  const wasTranslated   = translatedGuess !== g;

  if (translatedGuess === w) {
    return { correct: true, translatedTo: wasTranslated ? translatedGuess : null };
  }

  // 3 & 4. Fetch synonyms of the DB word, check both raw guess and translated guess
  const synonyms = await getSynonyms(w);
  console.log('[translate] Synonyms of "' + w + '":', synonyms.join(', '));

  if (synonyms.includes(g)) {
    return { correct: true, translatedTo: null };
  }
  if (wasTranslated && synonyms.includes(translatedGuess)) {
    return { correct: true, translatedTo: translatedGuess };
  }

  // 5. Translate DB word to French, compare with raw guess
  const wordInFrench = (await translate(word, 'en', 'fr')).trim().toLowerCase();
  console.log('[translate] "' + w + '" in French: "' + wordInFrench + '"');

  if (g === wordInFrench) {
    return { correct: true, translatedTo: translatedGuess !== g ? translatedGuess : null };
  }

  return { correct: false, translatedTo: wasTranslated ? translatedGuess : null };
}

// Keep simple translateToEnglish for any other use
async function translateToEnglish(text) {
  return translate(text, 'fr', 'en');
}

module.exports = { isGuessCorrect, translateToEnglish };
