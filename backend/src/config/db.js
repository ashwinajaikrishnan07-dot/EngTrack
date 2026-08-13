const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Drop stale unique index on issueId (now compound with teamId)
    try {
      await conn.connection.collection('issues').dropIndex('issueId_1');
      console.log('Dropped old issueId_1 unique index');
    } catch (e) {
      // Index may not exist — that's fine
    }
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
