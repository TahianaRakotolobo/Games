const mongoose = require('mongoose');

const connectDB = async () => {
  let uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/wordsearchbattle';

  // Inject the database name into the URI if it is missing.
  // Atlas URIs look like: ...mongodb.net/?appName=...
  // We need them to look like: ...mongodb.net/wordsearchbattle?appName=...
  if (uri.includes('mongodb.net') && !uri.match(/mongodb\.net\/[^?]/)) {
    uri = uri.replace('mongodb.net/', 'mongodb.net/wordsearchbattle');
  }

  await mongoose.connect(uri, { dbName: 'wordsearchbattle' });

  console.log('MongoDB Connected: ' + mongoose.connection.host);
  console.log('Using database:    ' + mongoose.connection.name);
};

module.exports = connectDB;
