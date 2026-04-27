const express = require('express');
const router = express.Router();
const Game = require('../models/Game');
const { generatePuzzle, generateCode } = require('../utils/puzzle');

// Word Search Battle landing page
router.get('/word-search-battle', (req, res) => {
  res.render('word-search-battle');
});

// Create a new game — picks words randomly from the Word collection
router.post('/word-search-battle/create', async (req, res) => {
  try {
    const { playerName } = req.body;
    if (!playerName || !playerName.trim()) {
      return res.json({ success: false, error: 'Player name is required.' });
    }

    const gameCode = generateCode();
    const { grid, words } = await generatePuzzle();

    if (words.length < 3) {
      return res.json({ success: false, error: 'Not enough words could be placed. Please add more words to the word pool.' });
    }

    const game = new Game({
      gameCode,
      grid,
      words,
      players: [{ name: playerName.trim(), isHost: true }]
    });

    await game.save();
    res.json({ success: true, gameCode, gameId: game._id });
  } catch (err) {
    console.error('[create]', err);
    res.json({ success: false, error: 'Failed to create game. Please try again.' });
  }
});

// Join a game
router.post('/word-search-battle/join', async (req, res) => {
  try {
    const { gameCode, playerName } = req.body;
    if (!playerName || !playerName.trim()) {
      return res.json({ success: false, error: 'Player name is required.' });
    }

    const game = await Game.findOne({ gameCode: gameCode.toUpperCase().trim() });

    if (!game)      return res.json({ success: false, error: 'Game not found. Check the code and try again.' });
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

// Render game room
router.get('/word-search-battle/game/:gameCode', async (req, res) => {
  try {
    const game = await Game.findOne({ gameCode: req.params.gameCode.toUpperCase() });
    if (!game) return res.render('404');
    res.render('game', { gameCode: game.gameCode });
  } catch (err) {
    res.render('404');
  }
});

// API: get full game data
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
