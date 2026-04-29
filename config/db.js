const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/wordsearchbattle';
  await mongoose.connect(uri);
  console.log('MongoDB Connected: ' + mongoose.connection.host);
};

module.exports = connectDB;
