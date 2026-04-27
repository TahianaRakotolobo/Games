const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
  socketId: String,
  name: { type: String, required: true },
  wordsFound: { type: [String], default: [] },
  score: { type: Number, default: 0 },
  joinedAt: { type: Date, default: Date.now },
  isHost: { type: Boolean, default: false }
});

const WordSchema = new mongoose.Schema({
  word: String,
  foundBy: { type: String, default: null }, // player name
  foundAt: { type: Date, default: null },
  positions: [{ row: Number, col: Number }]
});

const GameSchema = new mongoose.Schema({
  gameCode: { type: String, required: true, unique: true, index: true },
  status: { type: String, enum: ['waiting', 'playing', 'finished'], default: 'waiting' },
  grid: [[String]],
  gridSize: { type: Number, default: 15 },
  words: [WordSchema],
  players: [PlayerSchema],
  winner: { type: String, default: null },
  startedAt: { type: Date },
  finishedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  duration: { type: Number } // in seconds
});

module.exports = mongoose.model('Game', GameSchema);
