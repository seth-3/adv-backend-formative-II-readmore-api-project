const mongoose = require('mongoose');

const connectDB = async (uri) => {
  if (!uri) {
    throw new Error('MONGO_URI is not set. Add it to your .env file.');
  }
  await mongoose.connect(uri);
  console.log(`MongoDB connected: ${mongoose.connection.host}`);
};

module.exports = connectDB;
