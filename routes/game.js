const express = require('express');
const router  = express.Router();
const Game    = require('../models/Game');
const Word    = require('../models/Word');
const { generatePuzzle, generateCode } = require('../utils/puzzle');

// ── pages ─────────────────────────────────────────────────────────────────────

router.get('/word-search-battle', (req, res) => {
  res.render('word-search-battle');
});

router.get('/word-search-battle/game/:gameCode', async (req, res) => {
  try {
    const game = await Game.findOne({ gameCode: req.params.gameCode.toUpperCase() });
    if (!game) return res.render('404');
    res.render('game', { gameCode: game.gameCode });
  } catch (err) {
    res.render('404');
  }
});

// ── game actions ──────────────────────────────────────────────────────────────

// Create a new game — words come from the Word collection in MongoDB
router.post('/word-search-battle/create', async (req, res) => {
  try {
    const { playerName } = req.body;
    if (!playerName || !playerName.trim()) {
      return res.json({ success: false, error: 'Player name is required.' });
    }

    const gameCode = generateCode();
    const { grid, words, source } = await generatePuzzle();

    if (words.length < 3) {
      return res.json({ success: false, error: 'Not enough words could be placed. Please add more words to the word pool.' });
    }

    const game = new Game({
      gameCode, grid, words,
      players: [{ name: playerName.trim(), isHost: true }]
    });

    await game.save();
    res.json({ success: true, gameCode, gameId: game._id, wordSource: source });
  } catch (err) {
    console.error('[create]', err);
    res.json({ success: false, error: 'Failed to create game. Please try again.' });
  }
});

// Join an existing game
router.post('/word-search-battle/join', async (req, res) => {
  try {
    const { gameCode, playerName } = req.body;
    if (!playerName || !playerName.trim()) {
      return res.json({ success: false, error: 'Player name is required.' });
    }

    const game = await Game.findOne({ gameCode: gameCode.toUpperCase().trim() });
    if (!game)                     return res.json({ success: false, error: 'Game not found. Check the code and try again.' });
    if (game.status === 'finished') return res.json({ success: false, error: 'This game has already ended.' });
    if (game.players.find(p => p.name.toLowerCase() === playerName.trim().toLowerCase())) {
      return res.json({ success: false, error: 'That name is already taken in this game.' });
    }

    game.players.push({ name: playerName.trim(), isHost: false });
    await game.save();
    res.json({ success: true, gameCode: game.gameCode, gameId: game._id });
  } catch (err) {
    console.error('[join]', err);
    res.json({ success: false, error: 'Failed to join game. Please try again.' });
  }
});

// ── word pool API ─────────────────────────────────────────────────────────────

// GET  /games/api/words          — list all words
router.get('/api/words', async (req, res) => {
  try {
    const words = await Word.find({}).sort({ word: 1 });
    res.json({ success: true, count: words.length, words });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// POST /games/api/words          — bulk-add words
// Body: [{ "word": "ELEPHANT", "category": "animals" }, ...]
router.post('/api/words', async (req, res) => {
  try {
    const entries = req.body;
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.json({ success: false, error: 'Send a JSON array of { word, category } objects.' });
    }
    const added = [];
    for (const e of entries) {
      if (!e.word) continue;
      await Word.findOneAndUpdate(
        { word: e.word.toUpperCase().trim() },
        { word: e.word.toUpperCase().trim(), category: e.category || 'general', active: true },
        { upsert: true, new: true }
      ).catch(() => {});
      added.push(e.word.toUpperCase().trim());
    }
    res.json({ success: true, added: added.length, words: added });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ── game data API ─────────────────────────────────────────────────────────────

router.get('/api/game/:gameCode', async (req, res) => {
  try {
    const game = await Game.findOne({ gameCode: req.params.gameCode.toUpperCase() });
    if (!game) return res.json({ success: false, error: 'Not found' });
    res.json({ success: true, game });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

module.exports = router;
