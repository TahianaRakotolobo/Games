/**
 * puzzle.js — word fetching + grid generation
 *
 * Words are pulled randomly from the `words` MongoDB collection.
 * If the collection is empty a built-in fallback list is used so
 * the app still works before you seed the database.
 */

const Word = require('../models/Word');

// ── utilities ─────────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ── grid placement ────────────────────────────────────────────────────────────

function tryPlace(grid, word, size) {
  const directions = [[0,1],[1,0],[1,1],[-1,1],[0,-1],[-1,0],[-1,-1],[1,-1]];
  const dirs = shuffle(directions);
  for (let attempt = 0; attempt < 150; attempt++) {
    const dir    = dirs[attempt % dirs.length];
    const startR = Math.floor(Math.random() * size);
    const startC = Math.floor(Math.random() * size);
    const positions = [];
    let fits = true;
    for (let i = 0; i < word.length; i++) {
      const r = startR + dir[0] * i;
      const c = startC + dir[1] * i;
      if (r < 0 || r >= size || c < 0 || c >= size) { fits = false; break; }
      if (grid[r][c] && grid[r][c] !== word[i])      { fits = false; break; }
      positions.push({ row: r, col: c });
    }
    if (fits) {
      positions.forEach((pos, i) => { grid[pos.row][pos.col] = word[i]; });
      return { word, positions, foundBy: null, foundAt: null };
    }
  }
  return null; // could not place this word
}

function buildGrid(wordStrings, size = 15) {
  const grid = Array.from({ length: size }, () => Array(size).fill(''));
  const placedWords = [];
  // Place longest words first — easier when the grid is still empty
  const sorted = [...wordStrings].sort((a, b) => b.length - a.length);
  for (const word of sorted) {
    if (word.length > size) {
      console.warn('[puzzle] Skipping word too long for grid:', word);
      continue;
    }
    const placed = tryPlace(grid, word, size);
    if (placed) placedWords.push(placed);
    else console.warn('[puzzle] Could not place word:', word);
  }
  // Fill remaining cells with random letters
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (!grid[r][c]) grid[r][c] = letters[Math.floor(Math.random() * letters.length)];
  return { grid, words: placedWords };
}

// ── main export ───────────────────────────────────────────────────────────────

/**
 * generatePuzzle({ count, category })
 *
 * Fetches `count` random active words from the `words` MongoDB collection,
 * builds a 15×15 grid, and returns { grid, words, source }.
 *
 * `source` is either 'database' or 'fallback' — useful for logging.
 */
async function generatePuzzle({ count = 12, category = null } = {}) {
  const filter = { active: true };
  if (category) filter.category = category;

  let wordStrings;
  let source;

  try {
    // Fetch a few extra so we still hit `count` even if some fail to place
    const docs = await Word.aggregate([
      { $match: filter },
      { $sample: { size: count + 8 } }
    ]);

    if (docs.length > 0) {
      wordStrings = docs.map(d => d.word.toUpperCase()).slice(0, count);
      source = 'database';
      console.log('[puzzle] Using ' + wordStrings.length + ' words from MongoDB:', wordStrings.join(', '));
    } else {
      throw new Error('empty');
    }
  } catch (err) {
    // Collection is empty or query failed — use built-in fallback
    console.warn('[puzzle] Word collection empty or unavailable — using fallback list.');
    wordStrings = shuffle([
      'PUZZLE','SEARCH','BATTLE','HIDDEN','WORDS','GRID',
      'VICTORY','PLAYER','SCORE','FIND','DIAGONAL','ACROSS',
      'CHALLENGE','ONLINE','REAL','TIME','GAME','WIN'
    ]).slice(0, count);
    source = 'fallback';
  }

  const { grid, words: placedWords } = buildGrid(wordStrings, 15);
  return { grid, words: placedWords, source };
}

module.exports = { generatePuzzle, generateCode, shuffle };
