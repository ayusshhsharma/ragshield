import mongoose from 'mongoose';
import { AttackResult } from '../models/attackResult.model.js';
import { Experiment } from '../models/experiment.model.js';
import { TestRun } from '../models/testRun.model.js';
import { AppError } from '../utils/AppError.js';
import {
  computeExperimentComparison,
  createTestRun,
  executeExperiment,
  executeRun,
} from './runner.service.js';

export async function startRun({ project, user, options }) {
  const run = await createTestRun({ project, user, options });
  setImmediate(() => {
    executeRun(run._id).catch(() => {});
  });
  return run.toJSON();
}

export async function listProjectRuns(projectId, userId, { page = 1, limit = 50 } = {}) {
  const skip = (page - 1) * limit;
  const filter = { projectId, ownerId: userId };

  const [items, total] = await Promise.all([
    TestRun.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    TestRun.countDocuments(filter),
  ]);

  return {
    items: items.map((r) => r.toJSON()),
    total,
    page,
    limit,
  };
}

export async function getRun(runId, userId) {
  if (!runId || !mongoose.Types.ObjectId.isValid(runId)) {
    throw new AppError(404, 'NOT_FOUND', 'Run not found.');
  }

  const run = await TestRun.findOne({ _id: runId, ownerId: userId });
  if (!run) {
    throw new AppError(404, 'NOT_FOUND', 'Run not found.');
  }

  return run.toJSON();
}

export async function getRunResults(runId, userId, { outcome, category, page = 1, limit = 50 } = {}) {
  if (!runId || !mongoose.Types.ObjectId.isValid(runId)) {
    throw new AppError(404, 'NOT_FOUND', 'Run not found.');
  }

  const run = await TestRun.findOne({ _id: runId, ownerId: userId });
  if (!run) {
    throw new AppError(404, 'NOT_FOUND', 'Run not found.');
  }

  const filter = { runId: run._id };
  if (outcome) {
    filter.outcome = outcome;
  }
  if (category) {
    filter.category = category;
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    AttackResult.find(filter)
      .sort({ caseId: 1, repeatIndex: 1 })
      .skip(skip)
      .limit(limit),
    AttackResult.countDocuments(filter),
  ]);

  return {
    items: items.map((r) => r.toJSON()),
    total,
    page,
    limit,
  };
}

export async function cancelRun(runId, userId) {
  if (!runId || !mongoose.Types.ObjectId.isValid(runId)) {
    throw new AppError(404, 'NOT_FOUND', 'Run not found.');
  }

  const run = await TestRun.findOne({ _id: runId, ownerId: userId });
  if (!run) {
    throw new AppError(404, 'NOT_FOUND', 'Run not found.');
  }

  if (['completed', 'failed', 'cancelled'].includes(run.status)) {
    throw new AppError(
      409,
      'RUN_NOT_CANCELLABLE',
      `Cannot cancel a run with status "${run.status}".`,
    );
  }

  run.cancelRequested = true;
  if (run.status === 'queued') {
    run.status = 'cancelled';
    run.finishedAt = new Date();
  }
  await run.save();

  return run.toJSON();
}

export async function getRunReport(runId, userId) {
  if (!runId || !mongoose.Types.ObjectId.isValid(runId)) {
    throw new AppError(404, 'NOT_FOUND', 'Run not found.');
  }

  const run = await TestRun.findOne({ _id: runId, ownerId: userId });
  if (!run) {
    throw new AppError(404, 'NOT_FOUND', 'Run not found.');
  }

  const results = await AttackResult.find({ runId: run._id }).sort({
    caseId: 1,
    repeatIndex: 1,
  });

  return {
    runId: run._id.toString(),
    projectId: run.projectId.toString(),
    mode: run.mode,
    status: run.status,
    llm: run.llm,
    repeats: run.repeats,
    ragConfigSnapshot: run.ragConfigSnapshot,
    defenseConfigSnapshot: run.defenseConfigSnapshot,
    metrics: run.metrics,
    results: results.map((r) => r.toJSON()),
    limitations: [
      'Evaluation is based on deterministic heuristic and keyword matching.',
      'Mock provider behavior is synthetic and does not reflect real model safety boundaries.',
      'Injections are tested at context level; vector retrieval manipulation is not modeled.',
      'Pattern-based defenses may have bypasses via alternative encodings or paraphrasing.',
    ],
    generatedAt: new Date().toISOString(),
  };
}

export async function startExperiment({ project, user, options }) {
  const exp = await Experiment.create({
    projectId: project._id,
    ownerId: user.id,
    status: 'queued',
  });

  // 1. Create baseline run
  const baselineRun = await createTestRun({
    project,
    user,
    options: { ...options, mode: 'baseline' },
    experimentId: exp._id,
  });

  // 2. Create protected run with identical caseIds and repeats
  const protectedRun = await createTestRun({
    project,
    user,
    options: {
      ...options,
      mode: 'protected',
      caseIds: baselineRun.caseIds,
      repeats: baselineRun.repeats,
    },
    experimentId: exp._id,
  });

  exp.baselineRunId = baselineRun._id;
  exp.protectedRunId = protectedRun._id;
  await exp.save();

  setImmediate(() => {
    executeExperiment(exp._id).catch(() => {});
  });

  return {
    experimentId: exp._id.toString(),
    baselineRunId: baselineRun._id.toString(),
    protectedRunId: protectedRun._id.toString(),
  };
}

export async function getExperiment(experimentId, userId) {
  if (!experimentId || !mongoose.Types.ObjectId.isValid(experimentId)) {
    throw new AppError(404, 'NOT_FOUND', 'Experiment not found.');
  }

  const exp = await Experiment.findOne({ _id: experimentId, ownerId: userId });
  if (!exp) {
    throw new AppError(404, 'NOT_FOUND', 'Experiment not found.');
  }

  const [baselineRun, protectedRun] = await Promise.all([
    exp.baselineRunId ? TestRun.findById(exp.baselineRunId) : null,
    exp.protectedRunId ? TestRun.findById(exp.protectedRunId) : null,
  ]);

  const comparison = computeExperimentComparison(
    baselineRun?.metrics,
    protectedRun?.metrics,
  );

  return {
    experiment: exp.toJSON(),
    baselineRun: baselineRun ? baselineRun.toJSON() : null,
    protectedRun: protectedRun ? protectedRun.toJSON() : null,
    comparison,
  };
}
