import crypto from 'node:crypto';
import { AttackCase } from '../models/attackCase.model.js';
import { AppError } from '../utils/AppError.js';

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function getLibrary(userId, { category, language, q } = {}) {
  const query = {
    $or: [{ source: 'predefined' }, { ownerId: userId }],
  };

  if (category) {
    query.category = category;
  }

  if (language) {
    query.language = language;
  }

  if (q && q.trim()) {
    const searchRegex = new RegExp(escapeRegex(q.trim()), 'i');
    query.$and = [
      {
        $or: [
          { name: searchRegex },
          { description: searchRegex },
          { caseId: searchRegex },
        ],
      },
    ];
  }

  const cases = await AttackCase.find(query).sort({ caseId: 1 });
  return cases.map((c) => c.toJSON());
}

export async function createCustomCase(userId, project, caseData) {
  const customId = `CU-${crypto.randomUUID().slice(0, 8)}`;

  const created = await AttackCase.create({
    ...caseData,
    caseId: customId,
    source: 'custom',
    ownerId: userId,
    projectId: project._id,
  });

  return created.toJSON();
}

export async function deleteCustomCase(userId, project, caseId) {
  const attackCase = await AttackCase.findOne({
    caseId,
    projectId: project._id,
    ownerId: userId,
    source: 'custom',
  });

  if (!attackCase) {
    throw new AppError(404, 'NOT_FOUND', 'Custom attack case not found.');
  }

  await AttackCase.deleteOne({ _id: attackCase._id });
  return { deleted: true };
}
