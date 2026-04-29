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
  return null;
}

function buildGrid(wordStrings, size = 15) {
  const grid = Array.from({ length: size }, () => Array(size).fill(''));
  const placedWords = [];
  const sorted = [...wordStrings].sort((a, b) => b.length - a.length);
  for (const word of sorted) {
    if (word.length > size) { console.warn('[puzzle] Skipping (too long):', word); continue; }
    const placed = tryPlace(grid, word, size);
    if (placed) placedWords.push(placed);
    else console.warn('[puzzle] Could not place:', word);
  }
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (!grid[r][c]) grid[r][c] = letters[Math.floor(Math.random() * letters.length)];
  return { grid, words: placedWords };
}

async function generatePuzzle({ count = 12, category = null } = {}) {
  const mongoose = require('mongoose');
  console.log('[puzzle] Querying database:', mongoose.connection.name);
  console.log('[puzzle] Collection: words');

  const filter = { active: true };
  if (category) filter.category = category;

  const total = await Word.countDocuments(filter);
  console.log('[puzzle] Words found in DB:', total);

  let wordStrings, source;

  if (total > 0) {
    const docs = await Word.aggregate([
      { $match: filter },
      { $sample: { size: count + 8 } }
    ]);
    wordStrings = docs.map(d => d.word.toUpperCase()).slice(0, count);
    source = 'database';
    console.log('[puzzle] Using words from DB:', wordStrings.join(', '));
  } else {
    console.warn('[puzzle] ⚠️  No words found — falling back to hardcoded list.');
    console.warn('[puzzle] ⚠️  Make sure your Atlas URI contains "wordsearchbattle" as the database name.');
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
