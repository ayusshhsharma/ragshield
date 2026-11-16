import * as attackCaseService from '../services/attackCase.service.js';
import { getOwnedProject } from '../utils/getOwnedProject.js';
import {
  customAttackCaseSchema,
  libraryQuerySchema,
} from '../validators/attackCase.validator.js';

export async function getLibrary(req, res) {
  const validatedQuery = libraryQuerySchema.parse(req.query);
  const cases = await attackCaseService.getLibrary(req.user.id, validatedQuery);
  res.status(200).json({ cases });
}

export async function createCustom(req, res) {
  const project = await getOwnedProject(req);
  const validated = customAttackCaseSchema.parse(req.body);
  const created = await attackCaseService.createCustomCase(
    req.user.id,
    project,
    validated,
  );
  res.status(201).json({ case: created });
}

export async function deleteCustom(req, res) {
  const project = await getOwnedProject(req);
  await attackCaseService.deleteCustomCase(
    req.user.id,
    project,
    req.params.caseId,
  );
  res.status(204).end();
}
