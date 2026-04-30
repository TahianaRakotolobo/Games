const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');
const connectDB          = require('./config/db');
const Game               = require('./models/Game');
const PicturizeGame      = require('./models/PicturizeGame');
const Word               = require('./models/Word');
const { generatePuzzle, generateCode } = require('./utils/puzzle');
const { isGuessCorrect }               = require('./utils/translate');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', require('./routes/index'));
app.use('/games', require('./routes/game'));
app.use('/games', require('./routes/picturize'));

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  WORD SEARCH BATTLE  —  Socket.IO  (/wordsearch)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const wsNamespace = io.of('/wordsearch');

wsNamespace.on('connection', (socket) => {
  socket.on('joinRoom', async ({ gameCode, playerName }) => {
    socket.join(gameCode);
    const game = await Game.findOne({ gameCode });
    if (!game) return;
    const player = game.players.find(p => p.name === playerName);
    if (player) { player.socketId = socket.id; await game.save(); }
    socket.emit('gameState', buildWSState(game));
    socket.to(gameCode).emit('playerJoined', {
      playerName,
      players: game.players.map(p => ({ name: p.name, score: p.score, isHost: p.isHost }))
    });
  });

  socket.on('startGame', async ({ gameCode, playerName }) => {
    const game = await Game.findOne({ gameCode });
    if (!game) return;
    const player = game.players.find(p => p.name === playerName);
    if (!player || !player.isHost || game.status !== 'waiting') return;
    game.status = 'playing'; game.startedAt = new Date();
    await game.save();
    wsNamespace.to(gameCode).emit('gameStarted', buildWSState(game));
  });

  socket.on('wordFound', async ({ gameCode, playerName, word, positions }) => {
    const game = await Game.findOne({ gameCode });
    if (!game || game.status !== 'playing') return;
    const wordEntry = game.words.find(w => w.word === word && !w.foundBy);
    if (!wordEntry) return;
    wordEntry.foundBy = playerName; wordEntry.foundAt = new Date();
    const player = game.players.find(p => p.name === playerName);
    if (player) { player.wordsFound.push(word); player.score += 1; }
    const allFound = game.words.every(w => w.foundBy);
    if (allFound) {
      game.status = 'finished'; game.finishedAt = new Date();
      game.duration = Math.floor((game.finishedAt - game.startedAt) / 1000);
      let maxScore = -1, winner = null;
      game.players.forEach(p => { if (p.score > maxScore) { maxScore = p.score; winner = p.name; } });
      game.winner = winner;
    }
    await game.save();
    wsNamespace.to(gameCode).emit('wordClaimed', {
      word, playerName, positions: wordEntry.positions,
      players: game.players.map(p => ({ name: p.name, score: p.score, wordsFound: p.wordsFound })),
      gameOver: game.status === 'finished', winner: game.winner,
      finalScores: game.status === 'finished' ? game.players.map(p => ({ name: p.name, score: p.score })) : null
    });
  });

  socket.on('playAgain', async ({ gameCode, playerName }) => {
    const oldGame = await Game.findOne({ gameCode });
    if (!oldGame) return;
    const player = oldGame.players.find(p => p.name === playerName);
    if (!player || !player.isHost) return;
    const newCode = generateCode();
    const { grid, words } = await generatePuzzle();
    const newGame = new Game({
      gameCode: newCode, grid, words,
      players: oldGame.players.map(p => ({ name: p.name, isHost: p.isHost, score: 0, wordsFound: [] }))
    });
    await newGame.save();
    wsNamespace.to(gameCode).emit('newGameReady', { newGameCode: newCode });
  });
});

function buildWSState(game) {
  return {
    gameCode: game.gameCode, status: game.status, grid: game.grid,
    words: game.words.map(w => ({ word: w.word, foundBy: w.foundBy || null, positions: w.positions || [] })),
    players: game.players.map(p => ({ name: p.name, score: p.score, isHost: p.isHost, wordsFound: p.wordsFound })),
    winner: game.winner, startedAt: game.startedAt
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  PICTURIZE  —  Socket.IO  (/picturize)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const pNamespace  = io.of('/picturize');
const roundTimers = {};

pNamespace.on('connection', (socket) => {

  // ── join room ──────────────────────────────
  socket.on('joinRoom', async ({ gameCode, playerName }) => {
    socket.join(gameCode);
    const game = await PicturizeGame.findOne({ gameCode });
    if (!game) return;
    const player = game.players.find(p => p.name === playerName);
    if (player) { player.socketId = socket.id; await game.save(); }
    socket.emit('gameState', buildPState(game));
    socket.to(gameCode).emit('playerJoined', {
      playerName,
      players: game.players.map(p => ({ name: p.name, score: p.score, isHost: p.isHost }))
    });
  });

  // ── host starts game ───────────────────────
  socket.on('startGame', async ({ gameCode, playerName }) => {
    const game = await PicturizeGame.findOne({ gameCode });
    if (!game) return;
    const me = game.players.find(p => p.name === playerName);
    if (!me || !me.isHost || game.status !== 'waiting') return;
    if (game.players.length < 2) {
      socket.emit('gameError', { message: 'You need at least 2 players to start.' });
      return;
    }
    game.startedAt = new Date();
    await startNextRound(game);
  });

  // ── drawer picks a word ────────────────────
  socket.on('wordChosen', async ({ gameCode, playerName, word, category }) => {
    const game = await PicturizeGame.findOne({ gameCode });
    if (!game || game.status !== 'choosing') return;
    const round = game.rounds[game.currentRound - 1];
    if (!round || round.drawerName !== playerName) return;

    round.word      = word.toUpperCase();
    round.category  = category;
    round.startedAt = new Date();
    game.status     = 'drawing';
    await game.save();

    const blanks = '_  '.repeat(word.length).trim();
    pNamespace.to(gameCode).emit('roundStarted', {
      drawerName: playerName, category, blanks,
      wordLength: word.length, timeLimit: round.timeLimit,
      roundNumber: game.currentRound, totalRounds: game.totalRounds
    });
    // Tell only the drawer the real word
    const drawerSock = findSocket(pNamespace, gameCode, game, playerName);
    if (drawerSock) drawerSock.emit('drawerWord', { word: round.word });

    clearTimeout(roundTimers[gameCode]);
    roundTimers[gameCode] = setTimeout(() => endRound(gameCode, false), 40 * 1000);
  });

  // ── canvas drawing ─────────────────────────
  socket.on('draw',        ({ gameCode, data }) => socket.to(gameCode).emit('draw', data));
  socket.on('clearCanvas', ({ gameCode })       => socket.to(gameCode).emit('clearCanvas'));

  // ── guess (supports French → English translation) ──
  socket.on('guess', async ({ gameCode, playerName, guess }) => {
    const game = await PicturizeGame.findOne({ gameCode });
    if (!game || game.status !== 'drawing') return;
    const round = game.rounds[game.currentRound - 1];
    if (!round || round.drawerName === playerName) return;
    if (round.guessedBy.find(g => g.playerName === playerName)) return;

    // 1. Direct match first (instant, no API call)
    // 2. If no direct match: translate + synonym check
    const rawMatch = guess.trim().toLowerCase() === round.word.toLowerCase();
    let correct      = rawMatch;
    let translatedTo = null;

    if (!rawMatch) {
      const result = await isGuessCorrect(guess, round.word);
      correct      = result.correct;
      translatedTo = result.translatedTo;
    }

    if (correct) {
      const elapsed = (Date.now() - new Date(round.startedAt).getTime()) / 1000;
      const points  = Math.max(10, Math.round(100 * (1 - elapsed / round.timeLimit)));

      round.guessedBy.push({ playerName, guessedAt: new Date(), pointsAwarded: points });

      const guesser = game.players.find(p => p.name === playerName);
      if (guesser) guesser.score += points;

      const drawer = game.players.find(p => p.name === round.drawerName);
      if (drawer) drawer.score += Math.round(points * 0.5);

      await game.save();

      pNamespace.to(gameCode).emit('correctGuess', {
        playerName, points,
        originalGuess: guess,
        translatedTo,
        players: game.players.map(p => ({ name: p.name, score: p.score }))
      });

      const guessers = game.players.filter(p => p.name !== round.drawerName);
      if (round.guessedBy.length >= guessers.length) {
        clearTimeout(roundTimers[gameCode]);
        await endRound(gameCode, true);
      }
    } else {
      pNamespace.to(gameCode).emit('wrongGuess', {
        playerName, guess,
        translatedTo
      });
    }
  });

  // ── host skips round ───────────────────────
  socket.on('skipRound', async ({ gameCode, playerName }) => {
    const game = await PicturizeGame.findOne({ gameCode });
    if (!game) return;
    const me = game.players.find(p => p.name === playerName);
    if (!me || !me.isHost) return;
    clearTimeout(roundTimers[gameCode]);
    await endRound(gameCode, false);
  });

  // ── play again ─────────────────────────────
  socket.on('playAgain', async ({ gameCode, playerName }) => {
    const oldGame = await PicturizeGame.findOne({ gameCode });
    if (!oldGame) return;
    const me = oldGame.players.find(p => p.name === playerName);
    if (!me || !me.isHost) return;
    const newCode = generateCode();
    const newGame = new PicturizeGame({
      gameCode: newCode, totalRounds: oldGame.totalRounds,
      players: oldGame.players.map(p => ({ name: p.name, isHost: p.isHost, score: 0 }))
    });
    await newGame.save();
    pNamespace.to(gameCode).emit('newGameReady', { newGameCode: newCode });
  });

  socket.on('disconnect', () => {});
});

// ── helpers ────────────────────────────────────────────────────────────────────

function findSocket(ns, gameCode, game, playerName) {
  const player = game.players.find(p => p.name === playerName);
  if (!player?.socketId) return null;
  return ns.sockets.get(player.socketId) || null;
}

async function startNextRound(game) {
  const drawerIndex = game.currentRound % game.players.length;
  const drawer      = game.players[drawerIndex];
  game.currentRound += 1;
  game.status = 'choosing';

  const words = await Word.aggregate([{ $match: { active: true } }, { $sample: { size: 3 } }]);
  const choices = words.length >= 3
    ? words.map(w => ({ word: w.word.toUpperCase(), category: w.category }))
    : [{ word:'ELEPHANT',category:'animals' },{ word:'VOLCANO',category:'science' },{ word:'GUITAR',category:'music' }];

  game.rounds.push({
    roundNumber: game.currentRound, drawerName: drawer.name,
    word: '', category: '', timeLimit: 40, startedAt: new Date()
  });
  await game.save();

  pNamespace.to(game.gameCode).emit('choosingPhase', {
    drawerName: drawer.name, roundNumber: game.currentRound,
    totalRounds: game.totalRounds,
    players: game.players.map(p => ({ name: p.name, score: p.score, isHost: p.isHost }))
  });

  const drawerSock = findSocket(pNamespace, game.gameCode, game, drawer.name);
  if (drawerSock) {
    drawerSock.emit('wordChoices', { choices });
  } else {
    pNamespace.to(game.gameCode).emit('wordChoices', { choices, forDrawer: drawer.name });
  }

  // Auto-pick if drawer idles for 20 s
  clearTimeout(roundTimers[game.gameCode + '_choose']);
  roundTimers[game.gameCode + '_choose'] = setTimeout(async () => {
    const g = await PicturizeGame.findOne({ gameCode: game.gameCode });
    if (!g || g.status !== 'choosing') return;
    const round = g.rounds[g.currentRound - 1];
    if (round && !round.word) {
      round.word = choices[0].word; round.category = choices[0].category;
      round.startedAt = new Date(); g.status = 'drawing';
      await g.save();
      const blanks = '_  '.repeat(choices[0].word.length).trim();
      pNamespace.to(g.gameCode).emit('roundStarted', {
        drawerName: drawer.name, category: choices[0].category, blanks,
        wordLength: choices[0].word.length, timeLimit: 80,
        roundNumber: g.currentRound, totalRounds: g.totalRounds
      });
      const ds = findSocket(pNamespace, g.gameCode, g, drawer.name);
      if (ds) ds.emit('drawerWord', { word: choices[0].word });
      roundTimers[g.gameCode] = setTimeout(() => endRound(g.gameCode, false), 40000);
    }
  }, 20000);
}

async function endRound(gameCode, allGuessed) {
  const game = await PicturizeGame.findOne({ gameCode });
  if (!game || game.status === 'finished' || game.status === 'waiting') return;
  const round = game.rounds[game.currentRound - 1];
  if (round) round.endedAt = new Date();
  game.status = 'roundEnd';
  await game.save();

  pNamespace.to(gameCode).emit('roundEnded', {
    word: round?.word || '', allGuessed,
    players: game.players.map(p => ({ name: p.name, score: p.score })),
    roundNumber: game.currentRound, totalRounds: game.totalRounds
  });

  setTimeout(async () => {
    const g = await PicturizeGame.findOne({ gameCode });
    if (!g) return;
    if (g.currentRound >= g.totalRounds) {
      g.status = 'finished'; g.finishedAt = new Date();
      let maxScore = -1, winner = null;
      g.players.forEach(p => { if (p.score > maxScore) { maxScore = p.score; winner = p.name; } });
      g.winner = winner; await g.save();
      pNamespace.to(gameCode).emit('gameOver', {
        winner, players: g.players.map(p => ({ name: p.name, score: p.score }))
      });
    } else {
      await startNextRound(g);
    }
  }, 4000);
}

function buildPState(game) {
  return {
    gameCode: game.gameCode, status: game.status,
    players: game.players.map(p => ({ name: p.name, score: p.score, isHost: p.isHost })),
    currentRound: game.currentRound, totalRounds: game.totalRounds, winner: game.winner
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  START
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PORT = process.env.PORT || 3000;
connectDB()
  .then(() => server.listen(PORT, () => console.log('Server running on http://localhost:' + PORT)))
  .catch(err => { console.error('MongoDB failed:', err.message); process.exit(1); });
