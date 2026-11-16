import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../config/logger.js';
import { AttackCase } from '../models/attackCase.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SEED_FILE = path.resolve(__dirname, '../../seed/attack_cases.json');

/**
 * Idempotently seed or update predefined attack cases from attack_cases.json into MongoDB.
 */
export async function seedAttackCases() {
  if (!fs.existsSync(SEED_FILE)) {
    logger.warn({ seedFile: SEED_FILE }, 'Seed attack cases file not found, skipping seed');
    return { count: 0 };
  }

  const rawData = fs.readFileSync(SEED_FILE, 'utf-8');
  const cases = JSON.parse(rawData);

  const operations = cases.map((c) => ({
    updateOne: {
      filter: { caseId: c.caseId },
      update: {
        $set: {
          ...c,
          source: 'predefined',
          ownerId: null,
          projectId: null,
        },
      },
      upsert: true,
    },
  }));

  const res = await AttackCase.bulkWrite(operations);
  const count = await AttackCase.countDocuments({ source: 'predefined' });
  logger.info(
    { totalPredefined: count, seedFileCases: cases.length },
    'Predefined attack cases seeded successfully',
  );
  return {
    upsertedCount: res.upsertedCount,
    modifiedCount: res.modifiedCount,
    count,
  };
}
