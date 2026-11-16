import { Router } from 'express';
import * as attackController from '../controllers/attackCase.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(asyncHandler(requireAuth));

router.get('/library', asyncHandler(attackController.getLibrary));

export default router;
