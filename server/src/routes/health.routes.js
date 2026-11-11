import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

/**
 * GET /api/health — public liveness endpoint.
 */
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ragshield-server',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

export default router;

