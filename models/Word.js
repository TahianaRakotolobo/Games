const mongoose = require('mongoose');

/**
 * WordPool — the collection you fill with words for the puzzles.
 *
 * Each document is one word. Fields:
 *   word     : the word in uppercase (required, unique)
 *   category : optional grouping tag  (e.g. "animals", "science", "custom")
 *   active   : set to false to exclude a word without deleting it
 *
 * Example documents:
 *   { word: "ELEPHANT", category: "animals",  active: true }
 *   { word: "VOLCANO",  category: "science",  active: true }
 */
const WordSchema = new mongoose.Schema({
  word:     { type: String, required: true, unique: true, uppercase: true, trim: true },
  category: { type: String, default: 'general', lowercase: true, trim: true },
  active:   { type: Boolean, default: true },
  addedAt:  { type: Date, default: Date.now }
});

WordSchema.index({ active: 1, category: 1 });

module.exports = mongoose.model('Word', WordSchema);
