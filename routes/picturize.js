const express = require('express');
const router  = express.Router();
const PicturizeGame = require('../models/PicturizeGame');
const Word    = require('../models/Word');

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Landing page
router.get('/picturize', (req, res) => res.render('picturize'));

// Game room
router.get('/picturize/game/:gameCode', async (req, res) => {
  try {
    const game = await PicturizeGame.findOne({ gameCode: req.params.gameCode.toUpperCase() });
    if (!game) return res.render('404');
    res.render('picturize-game', { gameCode: game.gameCode });
  } catch { res.render('404'); }
});

// Create game
router.post('/picturize/create', async (req, res) => {
  try {
    const { playerName, totalRounds } = req.body;
    if (!playerName?.trim()) return res.json({ success: false, error: 'Player name is required.' });
    const gameCode = generateCode();
    const game = new PicturizeGame({
      gameCode,
      totalRounds: parseInt(totalRounds) || 3,
      players: [{ name: playerName.trim(), isHost: true }]
    });
    await game.save();
    res.json({ success: true, gameCode });
  } catch (err) {
    console.error('[picturize create]', err);
    res.json({ success: false, error: 'Failed to create game.' });
  }
});

// Join game
router.post('/picturize/join', async (req, res) => {
  try {
    const { gameCode, playerName } = req.body;
    if (!playerName?.trim()) return res.json({ success: false, error: 'Player name is required.' });
    const game = await PicturizeGame.findOne({ gameCode: gameCode.toUpperCase().trim() });
    if (!game)                      return res.json({ success: false, error: 'Game not found.' });
    if (game.status === 'finished') return res.json({ success: false, error: 'This game has already ended.' });
    if (game.players.find(p => p.name.toLowerCase() === playerName.trim().toLowerCase()))
      return res.json({ success: false, error: 'That name is already taken.' });
    game.players.push({ name: playerName.trim(), isHost: false });
    await game.save();
    res.json({ success: true, gameCode: game.gameCode });
  } catch (err) {
    console.error('[picturize join]', err);
    res.json({ success: false, error: 'Failed to join game.' });
  }
});

module.exports = router;
