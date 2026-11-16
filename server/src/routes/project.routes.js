import { Router } from 'express';
import * as projectController from '../controllers/project.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(asyncHandler(requireAuth));

router.get('/', asyncHandler(projectController.list));
router.post('/', asyncHandler(projectController.create));

router.get('/:id', asyncHandler(projectController.getById));
router.put('/:id', asyncHandler(projectController.update));
router.delete('/:id', asyncHandler(projectController.remove));

router.get('/:id/rag-config', asyncHandler(projectController.getRagConfig));
router.put('/:id/rag-config', asyncHandler(projectController.updateRagConfig));

router.get('/:id/defenses', asyncHandler(projectController.getDefenses));
router.put('/:id/defenses', asyncHandler(projectController.updateDefenses));

export default router;
