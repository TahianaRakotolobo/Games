const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const connectDB = require('./config/db');
const Game = require('./models/Game');
const { generatePuzzle, generateCode } = require('./utils/puzzle');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

connectDB();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', require('./routes/index'));
app.use('/games', require('./routes/game'));

// ── Socket.IO ─────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinRoom', async ({ gameCode, playerName }) => {
    socket.join(gameCode);
    const game = await Game.findOne({ gameCode });
    if (!game) return;

    const player = game.players.find(p => p.name === playerName);
    if (player) { player.socketId = socket.id; await game.save(); }

    socket.emit('gameState', buildGameState(game));
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

    game.status = 'playing';
    game.startedAt = new Date();
    await game.save();

    io.to(gameCode).emit('gameStarted', buildGameState(game));
  });

  socket.on('wordFound', async ({ gameCode, playerName, word, positions }) => {
    const game = await Game.findOne({ gameCode });
    if (!game || game.status !== 'playing') return;

    const wordEntry = game.words.find(w => w.word === word && !w.foundBy);
    if (!wordEntry) return;

    wordEntry.foundBy = playerName;
    wordEntry.foundAt = new Date();

    const player = game.players.find(p => p.name === playerName);
    if (player) { player.wordsFound.push(word); player.score += 1; }

    const allFound = game.words.every(w => w.foundBy);
    if (allFound) {
      game.status = 'finished';
      game.finishedAt = new Date();
      game.duration = Math.floor((game.finishedAt - game.startedAt) / 1000);
      let maxScore = -1, winner = null;
      game.players.forEach(p => { if (p.score > maxScore) { maxScore = p.score; winner = p.name; } });
      game.winner = winner;
    }

    await game.save();

    io.to(gameCode).emit('wordClaimed', {
      word,
      playerName,
      positions: wordEntry.positions,
      players: game.players.map(p => ({ name: p.name, score: p.score, wordsFound: p.wordsFound })),
      gameOver: game.status === 'finished',
      winner: game.winner,
      finalScores: game.status === 'finished' ? game.players.map(p => ({ name: p.name, score: p.score })) : null
    });
  });

  socket.on('playAgain', async ({ gameCode, playerName }) => {
    const oldGame = await Game.findOne({ gameCode });
    if (!oldGame) return;
    const player = oldGame.players.find(p => p.name === playerName);
    if (!player || !player.isHost) return;

    // Pick a fresh set of words from the DB for the new round
    const newCode = generateCode();
    const { grid, words } = await generatePuzzle();

    const newGame = new Game({
      gameCode: newCode,
      grid,
      words,
      players: oldGame.players.map(p => ({
        name: p.name,
        isHost: p.isHost,
        socketId: p.socketId,
        score: 0,
        wordsFound: []
      }))
    });

    await newGame.save();
    io.to(gameCode).emit('newGameReady', { newGameCode: newCode });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// ── helpers ───────────────────────────────────────────────────────────────────

function buildGameState(game) {
  return {
    gameCode: game.gameCode,
    status: game.status,
    grid: game.grid,
    words: game.words.map(w => ({
      word: w.word,
      foundBy: w.foundBy,
      positions: w.foundBy ? w.positions : []
    })),
    players: game.players.map(p => ({ name: p.name, score: p.score, isHost: p.isHost, wordsFound: p.wordsFound })),
    winner: game.winner,
    startedAt: game.startedAt
  };
}

// ── start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
