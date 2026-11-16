import { Router } from 'express';
import * as documentController from '../controllers/document.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { upload } from '../middleware/upload.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(asyncHandler(requireAuth));

router.get('/:id/documents', asyncHandler(documentController.list));
router.post(
  '/:id/documents',
  upload.single('file'),
  asyncHandler(documentController.uploadFile),
);
router.post('/:id/documents/demo', asyncHandler(documentController.loadDemo));
router.delete('/:id/documents/:docId', asyncHandler(documentController.remove));

export default router;
