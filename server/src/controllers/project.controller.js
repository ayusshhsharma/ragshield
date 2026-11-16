import * as projectService from '../services/project.service.js';
import { getOwnedProject } from '../utils/getOwnedProject.js';
import {
  createProjectSchema,
  defenseConfigSchema,
  ragConfigSchema,
  updateProjectSchema,
} from '../validators/project.validator.js';

export async function list(req, res) {
  const projects = await projectService.listProjects(req.user.id);
  res.status(200).json({ projects });
}

export async function create(req, res) {
  const validated = createProjectSchema.parse(req.body);
  const project = await projectService.createProject(req.user.id, validated);
  res.status(201).json({ project });
}

export async function getById(req, res) {
  const project = await getOwnedProject(req);
  res.status(200).json({ project: project.toJSON() });
}

export async function update(req, res) {
  const validated = updateProjectSchema.parse(req.body);
  const project = await getOwnedProject(req);
  const updated = await projectService.updateProject(project, validated);
  res.status(200).json({ project: updated });
}

export async function remove(req, res) {
  const project = await getOwnedProject(req);
  await projectService.deleteProject(project);
  res.status(204).end();
}

export async function getRagConfig(req, res) {
  const project = await getOwnedProject(req);
  res.status(200).json({ ragConfig: project.ragConfig });
}

export async function updateRagConfig(req, res) {
  const validated = ragConfigSchema.parse(req.body);
  const project = await getOwnedProject(req);
  const ragConfig = await projectService.updateRagConfig(project, validated);
  res.status(200).json({ ragConfig });
}

export async function getDefenses(req, res) {
  const project = await getOwnedProject(req);
  res.status(200).json({ defenseConfig: project.defenseConfig });
}

export async function updateDefenses(req, res) {
  const validated = defenseConfigSchema.parse(req.body);
  const project = await getOwnedProject(req);
  const defenseConfig = await projectService.updateDefenseConfig(project, validated);
  res.status(200).json({ defenseConfig });
}
