import { Router } from 'express';
import * as runController from '../controllers/run.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const auth = asyncHandler(requireAuth);

// Project-scoped runs and experiments
router.post('/projects/:id/runs', auth, asyncHandler(runController.createRun));
router.get('/projects/:id/runs', auth, asyncHandler(runController.listProjectRuns));
router.post(
  '/projects/:id/experiments',
  auth,
  asyncHandler(runController.createExperiment),
);

// Individual run endpoints
router.get('/runs/:id', auth, asyncHandler(runController.getRun));
router.get('/runs/:id/results', auth, asyncHandler(runController.getRunResults));
router.post('/runs/:id/cancel', auth, asyncHandler(runController.cancelRun));
router.get('/runs/:id/report', auth, asyncHandler(runController.getRunReport));

// Individual experiment endpoints
router.get('/experiments/:id', auth, asyncHandler(runController.getExperiment));

export default router;
