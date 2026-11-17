import { Router } from 'express';
import * as attackController from '../controllers/attackCase.controller.js';
import * as dashboardController from '../controllers/dashboard.controller.js';
import * as playgroundController from '../controllers/playground.controller.js';
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

router.post('/:id/attacks/custom', asyncHandler(attackController.createCustom));
router.delete('/:id/attacks/custom/:caseId', asyncHandler(attackController.deleteCustom));

// Playground query & Dashboard
router.post('/:id/query', asyncHandler(playgroundController.query));
router.get('/:id/dashboard', asyncHandler(dashboardController.getDashboard));

export default router;
