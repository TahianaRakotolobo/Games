const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
  socketId: String,
  name:     { type: String, required: true },
  score:    { type: Number, default: 0 },
  isHost:   { type: Boolean, default: false },
  joinedAt: { type: Date, default: Date.now }
});

const RoundSchema = new mongoose.Schema({
  roundNumber:  Number,
  drawerName:   String,
  word:         String,
  category:     String,
  guessedBy:    [{ playerName: String, guessedAt: Date, pointsAwarded: Number }],
  startedAt:    Date,
  endedAt:      Date,
  timeLimit:    { type: Number, default: 40 }
});

const PicturizeGameSchema = new mongoose.Schema({
  gameCode:    { type: String, required: true, unique: true, index: true },
  status:      { type: String, enum: ['waiting','choosing','drawing','roundEnd','finished'], default: 'waiting' },
  players:     [PlayerSchema],
  rounds:      [RoundSchema],
  currentRound:{ type: Number, default: 0 },
  totalRounds: { type: Number, default: 3 },
  winner:      { type: String, default: null },
  createdAt:   { type: Date, default: Date.now },
  startedAt:   Date,
  finishedAt:  Date
});

module.exports = mongoose.model('PicturizeGame', PicturizeGameSchema);
