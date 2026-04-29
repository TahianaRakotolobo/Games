const mongoose = require('mongoose');

/**
 * WordPool — fill this collection with words for the puzzles.
 *
 * Fields:
 *   word     : the word in UPPERCASE (required, unique)
 *   category : optional tag, e.g. "animals", "science"   (default: "general")
 *   active   : set false to hide a word without deleting it  (default: true)
 *
 * The collection name is pinned to "words" explicitly so Mongoose
 * pluralization can never cause a mismatch with what Atlas shows.
 */
const WordSchema = new mongoose.Schema(
  {
    word:     { type: String, required: true, unique: true, trim: true },
    category: { type: String, default: 'general', trim: true },
    active:   { type: Boolean, default: true },
    addedAt:  { type: Date,    default: Date.now }
  },
  { collection: 'words' }   // ← explicit collection name
);

WordSchema.index({ active: 1, category: 1 });

module.exports = mongoose.model('Word', WordSchema);
