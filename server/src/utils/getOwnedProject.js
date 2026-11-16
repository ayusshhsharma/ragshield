import mongoose from 'mongoose';
import { Project } from '../models/project.model.js';
import { AppError } from './AppError.js';

/**
 * Find a project owned by the authenticated user.
 * Throws 404 NOT_FOUND if the ID is missing/invalid or belongs to another user.
 */
export async function getOwnedProject(req, explicitId) {
  const targetId = explicitId || req.params?.id || req.params?.projectId;

  if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
    throw new AppError(404, 'NOT_FOUND', 'Project not found.');
  }

  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required.');
  }

  const project = await Project.findOne({
    _id: targetId,
    ownerId: userId,
  });

  if (!project) {
    throw new AppError(404, 'NOT_FOUND', 'Project not found.');
  }

  return project;
}
