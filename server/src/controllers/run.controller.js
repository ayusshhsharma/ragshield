import * as runService from '../services/run.service.js';
import { getOwnedProject } from '../utils/getOwnedProject.js';
import {
  createExperimentSchema,
  createRunSchema,
  paginationQuerySchema,
  resultsQuerySchema,
} from '../validators/run.validator.js';

export async function createRun(req, res) {
  const project = await getOwnedProject(req);
  const validated = createRunSchema.parse(req.body);
  const run = await runService.startRun({
    project,
    user: req.user,
    options: validated,
  });
  res.status(202).json({ runId: run.id });
}

export async function listProjectRuns(req, res) {
  const project = await getOwnedProject(req);
  const pagination = paginationQuerySchema.parse(req.query);
  const data = await runService.listProjectRuns(
    project._id,
    req.user.id,
    pagination,
  );
  res.status(200).json(data);
}

export async function getRun(req, res) {
  const run = await runService.getRun(req.params.id, req.user.id);
  res.status(200).json({ run });
}

export async function getRunResults(req, res) {
  const query = resultsQuerySchema.parse(req.query);
  const data = await runService.getRunResults(
    req.params.id,
    req.user.id,
    query,
  );
  res.status(200).json(data);
}

export async function cancelRun(req, res) {
  const run = await runService.cancelRun(req.params.id, req.user.id);
  res.status(200).json({ run });
}

export async function getRunReport(req, res) {
  const report = await runService.getRunReport(req.params.id, req.user.id);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="ragshield-run-${req.params.id}.json"`,
  );
  res.status(200).send(JSON.stringify(report, null, 2));
}

export async function createExperiment(req, res) {
  const project = await getOwnedProject(req);
  const validated = createExperimentSchema.parse(req.body);
  const result = await runService.startExperiment({
    project,
    user: req.user,
    options: validated,
  });
  res.status(202).json(result);
}

export async function getExperiment(req, res) {
  const result = await runService.getExperiment(req.params.id, req.user.id);
  res.status(200).json(result);
}
