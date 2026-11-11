import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import pinoHttp from 'pino-http';

import { env } from './src/config/env.js';
import { logger } from './src/config/logger.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import { notFoundHandler } from './src/middleware/notFound.js';
import healthRoutes from './src/routes/health.routes.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin(requestOrigin, callback) {
      if (!requestOrigin || requestOrigin === env.CLIENT_ORIGIN) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));

if (env.NODE_ENV !== 'test') {
  app.use(pinoHttp({ logger }));
}

const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests, please try again later.',
        details: {},
      },
    });
  },
});

app.use('/api', globalLimiter);
app.use('/api', healthRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;

