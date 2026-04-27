/**
 * puzzle.js — shared puzzle generation utilities
 * Used by both routes/game.js (HTTP) and server.js (Socket.IO)
 */

const Word = require('../models/Word');

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

function tryPlace(grid, word, size) {
  const directions = [[0,1],[1,0],[1,1],[-1,1],[0,-1],[-1,0],[-1,-1],[1,-1]];
  const dirs = shuffle(directions);
  for (let attempt = 0; attempt < 150; attempt++) {
    const dir = dirs[attempt % dirs.length];
    const startR = Math.floor(Math.random() * size);
    const startC = Math.floor(Math.random() * size);
    const positions = [];
    let fits = true;
    for (let i = 0; i < word.length; i++) {
      const r = startR + dir[0] * i;
      const c = startC + dir[1] * i;
      if (r < 0 || r >= size || c < 0 || c >= size) { fits = false; break; }
      if (grid[r][c] && grid[r][c] !== word[i]) { fits = false; break; }
      positions.push({ row: r, col: c });
    }
    if (fits) {
      positions.forEach((pos, i) => { grid[pos.row][pos.col] = word[i]; });
      return { word, positions, foundBy: null, foundAt: null };
    }
  }
  return null;
}

function buildGrid(wordStrings, size = 15) {
  const grid = Array.from({ length: size }, () => Array(size).fill(''));
  const placedWords = [];
  const sorted = [...wordStrings].sort((a, b) => b.length - a.length);
  for (const word of sorted) {
    if (word.length > size) continue;
    const placed = tryPlace(grid, word, size);
    if (placed) placedWords.push(placed);
  }
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (!grid[r][c]) grid[r][c] = letters[Math.floor(Math.random() * letters.length)];
  return { grid, words: placedWords };
}

/**
 * Fetch `count` random active words from MongoDB and build a puzzle.
 * Falls back to a built-in list if the collection is empty.
 */
async function generatePuzzle({ count = 12, category = null } = {}) {
  const filter = { active: true };
  if (category) filter.category = category;

  const words = await Word.aggregate([
    { $match: filter },
    { $sample: { size: count + 5 } }
  ]);

  let wordStrings;

  if (words.length === 0) {
    console.warn('[puzzle] Word collection is empty — using built-in fallback words.');
    wordStrings = shuffle([
      'PUZZLE','SEARCH','BATTLE','HIDDEN','WORDS','GRID',
      'VICTORY','PLAYER','SCORE','FIND','DIAGONAL','ACROSS',
      'CHALLENGE','ONLINE','REAL','TIME','GAME','WIN'
    ]).slice(0, count);
  } else {
    wordStrings = words.map(w => w.word.toUpperCase()).slice(0, count);
  }

  const { grid, words: placedWords } = buildGrid(wordStrings, 15);
  return { grid, words: placedWords };
}

module.exports = { generatePuzzle, generateCode, shuffle };
