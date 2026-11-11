import app from './app.js';
import { connectDB, disconnectDB } from './src/config/db.js';
import { env } from './src/config/env.js';
import { logger } from './src/config/logger.js';

let server;

async function start() {
  await connectDB(env.MONGO_URI);

  server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'RAGShield server listening');
  });
}

async function shutdown(signal) {
  logger.info({ signal }, 'Shutting down server');
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await disconnectDB();
  process.exit(0);
}

process.on('SIGINT', () => {
  shutdown('SIGINT').catch((err) => {
    logger.error({ err }, 'Error during SIGINT shutdown');
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM').catch((err) => {
    logger.error({ err }, 'Error during SIGTERM shutdown');
    process.exit(1);
  });
});

start().catch((err) => {
  logger.error({ err: { name: err?.name, message: err?.message } }, 'Failed to start server');
  process.exit(1);
});

