import { AttackResult } from '../models/attackResult.model.js';
import { Document } from '../models/document.model.js';
import { Experiment } from '../models/experiment.model.js';
import { TestRun } from '../models/testRun.model.js';
import { computeExperimentComparison } from './runner.service.js';

const STANDARD_CATEGORIES = Object.freeze([
  'AT-01',
  'AT-02',
  'AT-03',
  'AT-04',
  'AT-05',
  'AT-06',
  'AT-07',
  'AT-08',
]);

/**
 * Compute dashboard metrics for a project scoped strictly to the project and owner.
 *
 * @param {object} params
 * @param {object} params.project - Mongoose Project document
 * @param {object} params.user - Current authenticated user
 * @returns {Promise<object>} { totals, latestExperiment, outcomeDistribution, perCategoryAsr }
 */
export async function getProjectDashboard({ project }) {
  const projectId = project._id;
  const ownerId = project.ownerId;

  // 1. Totals
  const [totalRuns, totalExperiments, totalDocuments, totalAttackRuns] = await Promise.all([
    TestRun.countDocuments({ projectId, ownerId }),
    Experiment.countDocuments({ projectId, ownerId }),
    Document.countDocuments({ projectId, ownerId }),
    AttackResult.countDocuments({
      projectId,
      ownerId,
      isBenign: false,
    }),
  ]);

  const totals = {
    runs: totalRuns,
    experiments: totalExperiments,
    attackRuns: totalAttackRuns,
    documents: totalDocuments,
  };

  // 2. Latest completed experiment
  let latestExperiment = null;
  const latestExp = await Experiment.findOne({
    projectId,
    ownerId,
    status: 'completed',
  })
    .sort({ createdAt: -1 })
    .lean();

  if (latestExp) {
    const [baselineRun, protectedRun] = await Promise.all([
      TestRun.findById(latestExp.baselineRunId).lean(),
      TestRun.findById(latestExp.protectedRunId).lean(),
    ]);

    let comparison = null;
    if (baselineRun && protectedRun) {
      comparison = computeExperimentComparison(baselineRun.metrics, protectedRun.metrics);
    }

    latestExperiment = {
      id: latestExp._id.toString(),
      createdAt: latestExp.createdAt ? latestExp.createdAt.toISOString() : null,
      baselineRunId: latestExp.baselineRunId ? latestExp.baselineRunId.toString() : null,
      protectedRunId: latestExp.protectedRunId ? latestExp.protectedRunId.toString() : null,
      baselineAsr: baselineRun?.metrics?.asr?.mean ?? null,
      protectedAsr: protectedRun?.metrics?.asr?.mean ?? null,
      deltaAsr: comparison?.deltaAsr ?? null,
      comparison,
    };
  }

  // 3. Outcome distribution via Mongo aggregation
  const outcomeDistribution = {
    attack_succeeded: 0,
    blocked_by_defense: 0,
    model_refused_or_safe: 0,
    benign_answered: 0,
    error: 0,
  };

  const outcomeAgg = await AttackResult.aggregate([
    {
      $match: {
        projectId,
        ownerId,
      },
    },
    {
      $group: {
        _id: '$outcome',
        count: { $sum: 1 },
      },
    },
  ]);

  for (const entry of outcomeAgg) {
    if (entry._id && typeof outcomeDistribution[entry._id] === 'number') {
      outcomeDistribution[entry._id] = entry.count;
    }
  }

  // 4. Per-category ASR via Mongo aggregation
  const perCategoryAsr = {};
  for (const cat of STANDARD_CATEGORIES) {
    perCategoryAsr[cat] = {
      total: 0,
      succeeded: 0,
      asr: 0,
    };
  }

  const categoryAgg = await AttackResult.aggregate([
    {
      $match: {
        projectId,
        ownerId,
        isBenign: false,
        outcome: { $ne: 'error' },
      },
    },
    {
      $group: {
        _id: '$category',
        total: { $sum: 1 },
        succeeded: {
          $sum: {
            $cond: [{ $eq: ['$outcome', 'attack_succeeded'] }, 1, 0],
          },
        },
      },
    },
  ]);

  for (const entry of categoryAgg) {
    if (entry._id) {
      const total = entry.total || 0;
      const succeeded = entry.succeeded || 0;
      const asr = total > 0 ? Number(((succeeded / total) * 100).toFixed(2)) : 0;
      perCategoryAsr[entry._id] = { total, succeeded, asr };
    }
  }

  return {
    totals,
    latestExperiment,
    outcomeDistribution,
    perCategoryAsr,
  };
}
