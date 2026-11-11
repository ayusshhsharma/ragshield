import mongoose from 'mongoose';
import { logger } from './logger.js';

/**
 * Connect to MongoDB using Mongoose. Never logs credentials inside the URI.
 */
export async function connectDB(mongoUri) {
  if (!mongoUri || !mongoUri.trim()) {
    throw new Error('MONGO_URI must be set before connecting to MongoDB.');
  }

  await mongoose.connect(mongoUri);
  logger.info({ dbName: mongoose.connection.name }, 'Connected to MongoDB');
  return mongoose.connection;
}

/**
 * Close the active Mongoose connection cleanly.
 */
export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
}

