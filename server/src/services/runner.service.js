import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AttackCase } from '../models/attackCase.model.js';
import { AttackResult } from '../models/attackResult.model.js';
import { Experiment } from '../models/experiment.model.js';
import { TestRun } from '../models/testRun.model.js';
import { AppError } from '../utils/AppError.js';
import { AI_TIMEOUTS, createAiClient } from './aiClient.js';

export const ALL_DISABLED_DEFENSES = Object.freeze({
  inputScanner: { enabled: false, threshold: 0.5 },
  documentScanner: { enabled: false, threshold: 0.5 },
  instructionIsolation: { enabled: false },
  outputValidator: { enabled: false },
});

export async function recoverStaleRuns() {
  const runResult = await TestRun.updateMany(
    { status: { $in: ['queued', 'running'] } },
    {
      $set: {
        status: 'failed',
        failureReason: 'server restarted',
        finishedAt: new Date(),
      },
    },
  );

  const expResult = await Experiment.updateMany(
    { status: { $in: ['queued', 'running'] } },
    {
      $set: {
        status: 'failed',
      },
    },
  );

  if (runResult.modifiedCount > 0 || expResult.modifiedCount > 0) {
    logger.info(
      {
        recoveredRuns: runResult.modifiedCount,
        recoveredExperiments: expResult.modifiedCount,
      },
      'Recovered stale queued/running runs on startup',
    );
  }
}

export function computeExperimentComparison(baselineMetrics, protectedMetrics) {
  const b = baselineMetrics?.metrics || baselineMetrics;
  const p = protectedMetrics?.metrics || protectedMetrics;

  if (!b || !p) {
    return null;
  }

  const bAsr = b.asr?.mean ?? 0;
  const pAsr = p.asr?.mean ?? 0;
  const asrDelta = Number((pAsr - bAsr).toFixed(2));

  const bBlock = b.blockingRate ?? 0;
  const pBlock = p.blockingRate ?? 0;
  const blockingRateDelta = Number((pBlock - bBlock).toFixed(2));

  const bFpr = b.benign?.fpr ?? 0;
  const pFpr = p.benign?.fpr ?? 0;
  const fprDelta = Number((pFpr - bFpr).toFixed(2));

  const bBenignSuccess = b.benign?.successRate ?? 0;
  const pBenignSuccess = p.benign?.successRate ?? 0;
  const benignSuccessRateDelta = Number((pBenignSuccess - bBenignSuccess).toFixed(2));

  const bLatency = b.latency?.avgMs ?? 0;
  const pLatency = p.latency?.avgMs ?? 0;
  const defenseOverheadMs = Number((pLatency - bLatency).toFixed(2));

  const perCategory = {};
  const allCategories = new Set([
    ...Object.keys(b.perCategory || {}),
    ...Object.keys(p.perCategory || {}),
  ]);

  for (const cat of allCategories) {
    const bCatAsr = b.perCategory?.[cat]?.asr ?? 0;
    const pCatAsr = p.perCategory?.[cat]?.asr ?? 0;
    perCategory[cat] = {
      baseline: bCatAsr,
      protected: pCatAsr,
      delta: Number((pCatAsr - bCatAsr).toFixed(2)),
    };
  }

  return {
    asr: { baseline: bAsr, protected: pAsr, delta: asrDelta },
    blockingRate: { baseline: bBlock, protected: pBlock, delta: blockingRateDelta },
    fpr: { baseline: bFpr, protected: pFpr, delta: fprDelta },
    benignSuccessRate: {
      baseline: bBenignSuccess,
      protected: pBenignSuccess,
      delta: benignSuccessRateDelta,
    },
    avgLatency: {
      baseline: bLatency,
      protected: pLatency,
      delta: defenseOverheadMs,
    },
    defenseOverheadMs,
    deltaAsr: asrDelta,
    deltaBlockingRate: blockingRateDelta,
    deltaFpr: fprDelta,
    deltaBenignSuccessRate: benignSuccessRateDelta,
    perCategory,
  };
}

export async function createTestRun({ project, user, options, experimentId = null }) {
  if (!project.demoKbLoaded) {
    throw new AppError(
      409,
      'DEMO_KB_REQUIRED',
      'Demo knowledge base must be loaded before running attacks.',
    );
  }

  if (options.mode === 'protected') {
    const defenseConfig = project.defenseConfig?.toObject
      ? project.defenseConfig.toObject()
      : project.defenseConfig || {};
    const anyDefenseEnabled = Object.values(defenseConfig).some(
      (d) => d && d.enabled === true,
    );
    if (!anyDefenseEnabled) {
      throw new AppError(
        400,
        'NO_DEFENSES_ENABLED',
        'Protected run requires at least one defense enabled in project settings.',
      );
    }
  }

  // Find candidate cases
  const caseQuery = {
    $or: [{ source: 'predefined' }, { ownerId: user.id }],
  };

  if (options.caseIds && options.caseIds.length > 0) {
    caseQuery.caseId = { $in: options.caseIds };
  } else {
    if (options.categories && options.categories.length > 0) {
      caseQuery.category = { $in: options.categories };
    }
    if (options.includeBenign === false) {
      caseQuery.category = caseQuery.category
        ? { $in: options.categories.filter((c) => c !== 'BENIGN') }
        : { $ne: 'BENIGN' };
    }
  }

  const selectedCases = await AttackCase.find(caseQuery).sort({ caseId: 1 });
  if (selectedCases.length === 0) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'No attack cases matched the specified criteria.',
    );
  }

  const caseIds = selectedCases.map((c) => c.caseId);
  const repeats = options.repeats || env.DEFAULT_REPEATS || 3;
  const total = caseIds.length * repeats;

  const ragConfigSnapshot = project.ragConfig?.toObject
    ? project.ragConfig.toObject()
    : { ...project.ragConfig };

  const defenseConfigSnapshot =
    options.mode === 'baseline'
      ? { ...ALL_DISABLED_DEFENSES }
      : project.defenseConfig?.toObject
        ? project.defenseConfig.toObject()
        : { ...project.defenseConfig };

  // Fetch LLM provider details from /internal/health
  let llm = { provider: 'mock', model: 'mock', temperature: 0.2 };
  try {
    const aiClient = createAiClient();
    const health = await aiClient.get('/internal/health');
    if (health.data) {
      llm = {
        provider: health.data.provider || 'mock',
        model: health.data.model || 'mock',
        temperature: 0.2,
      };
    }
  } catch {
    // Fallback to default mock
  }

  const run = await TestRun.create({
    projectId: project._id,
    ownerId: user.id,
    experimentId,
    mode: options.mode,
    status: 'queued',
    caseIds,
    repeats,
    includeBenign: options.includeBenign ?? true,
    ragConfigSnapshot,
    defenseConfigSnapshot,
    llm,
    progress: { total, completed: 0, errors: 0 },
  });

  return run;
}

async function runSingleCase(run, attackCase, repeatIndex) {
  const aiClient = createAiClient();
  let caseResult;

  try {
    const res = await aiClient.post(
      '/internal/attacks/run-case',
      {
        projectId: run.projectId.toString(),
        case: attackCase.toJSON ? attackCase.toJSON() : attackCase,
        ragConfig: run.ragConfigSnapshot,
        defenseConfig: run.defenseConfigSnapshot,
        repeatIndex,
      },
      {
        timeout: AI_TIMEOUTS.RUN_CASE,
      },
    );
    caseResult = res.data;
  } catch (err) {
    caseResult = {
      caseId: attackCase.caseId,
      category: attackCase.category,
      isBenign: attackCase.isBenign,
      repeatIndex,
      outcome: 'error',
      response: '',
      retrievedChunks: [],
      defensesTriggered: [],
      blocked: false,
      blockedBy: null,
      successConditionMatchedRaw: false,
      benignAcceptable: null,
      ambiguous: false,
      providerBlocked: false,
      latencyMs: 0,
      defenseLatencyMs: 0,
      error: err.message || 'AI service request failed',
      timestamp: new Date().toISOString(),
    };
  }

  await AttackResult.create({
    ...caseResult,
    runId: run._id,
    projectId: run.projectId,
    ownerId: run.ownerId,
    caseSnapshot: {
      name: attackCase.name || '',
      technique: attackCase.technique || '',
      severity: attackCase.severity || '',
      expectedBehavior: attackCase.expectedBehavior || '',
      userQuery: attackCase.userQuery || '',
    },
  });

  const inc = { 'progress.completed': 1 };
  if (caseResult.outcome === 'error') {
    inc['progress.errors'] = 1;
  }
  await TestRun.updateOne({ _id: run._id }, { $inc: inc });
}

export async function executeRun(runId) {
  const run = await TestRun.findOneAndUpdate(
    { _id: runId, status: 'queued' },
    { $set: { status: 'running', startedAt: new Date() } },
    { returnDocument: 'after' },
  );

  if (!run) {
    let current = await TestRun.findById(runId);
    while (current && (current.status === 'queued' || current.status === 'running')) {
      await new Promise((r) => setTimeout(r, 50));
      current = await TestRun.findById(runId);
    }
    return current;
  }

  const caseDocs = await AttackCase.find({ caseId: { $in: run.caseIds } });
  const caseMap = new Map(caseDocs.map((c) => [c.caseId, c]));
  const orderedCases = run.caseIds.map((id) => caseMap.get(id)).filter(Boolean);

  const tasks = [];
  for (let repeat = 1; repeat <= run.repeats; repeat++) {
    for (const c of orderedCases) {
      tasks.push({ caseDoc: c, repeatIndex: repeat });
    }
  }

  const concurrency = env.RUN_CONCURRENCY || 2;
  let taskIndex = 0;
  let isCancelled = false;

  async function worker() {
    while (taskIndex < tasks.length && !isCancelled) {
      const current = tasks[taskIndex++];
      const freshRun = await TestRun.findById(run._id).select('cancelRequested status');
      if (freshRun?.cancelRequested || freshRun?.status === 'cancelled') {
        isCancelled = true;
        break;
      }
      await runSingleCase(run, current.caseDoc, current.repeatIndex);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(tasks.length, 1)) },
    () => worker(),
  );
  await Promise.all(workers);

  const finalRun = await TestRun.findById(run._id);
  finalRun.finishedAt = new Date();

  if (finalRun.cancelRequested) {
    finalRun.status = 'cancelled';
    await finalRun.save();
    return finalRun;
  }

  if (finalRun.progress.total > 0 && finalRun.progress.errors === finalRun.progress.total) {
    finalRun.status = 'failed';
    finalRun.failureReason = 'All test cases resulted in errors.';
    await finalRun.save();
    return finalRun;
  }

  // Aggregate metrics via /internal/evaluation/aggregate
  try {
    const results = await AttackResult.find({ runId: finalRun._id });
    const defensesEnabled = finalRun.mode === 'protected';
    const aiClient = createAiClient();
    const aggRes = await aiClient.post(
      '/internal/evaluation/aggregate',
      {
        results: results.map((r) => r.toJSON()),
        defensesEnabled,
      },
      {
        timeout: AI_TIMEOUTS.DEFAULT,
      },
    );
    finalRun.metrics = aggRes.data;
    finalRun.status = 'completed';
  } catch (err) {
    logger.error({ err }, 'Failed to aggregate metrics for run');
    finalRun.status = 'failed';
    finalRun.failureReason = `Evaluation aggregation failed: ${err.message}`;
  }

  await finalRun.save();
  return finalRun;
}

export async function executeExperiment(experimentId) {
  const exp = await Experiment.findOneAndUpdate(
    { _id: experimentId, status: 'queued' },
    { $set: { status: 'running' } },
    { returnDocument: 'after' },
  );
  if (!exp) {
    let current = await Experiment.findById(experimentId);
    while (current && (current.status === 'queued' || current.status === 'running')) {
      await new Promise((r) => setTimeout(r, 50));
      current = await Experiment.findById(experimentId);
    }
    return current;
  }

  // 1. Run baseline run sequentially
  const baselineRun = await executeRun(exp.baselineRunId);
  if (baselineRun.status === 'cancelled') {
    exp.status = 'cancelled';
    await exp.save();
    return;
  }
  if (baselineRun.status === 'failed') {
    exp.status = 'failed';
    await exp.save();
    return;
  }

  // 2. Run protected run sequentially
  const protectedRun = await executeRun(exp.protectedRunId);
  if (protectedRun.status === 'cancelled') {
    exp.status = 'cancelled';
    await exp.save();
    return;
  }
  if (protectedRun.status === 'failed') {
    exp.status = 'failed';
    await exp.save();
    return;
  }

  exp.status = 'completed';
  await exp.save();
}
