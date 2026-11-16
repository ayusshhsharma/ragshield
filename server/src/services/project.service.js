import { Document } from '../models/document.model.js';
import { Project } from '../models/project.model.js';
import { createAiClient } from './aiClient.js';

export async function listProjects(userId) {
  const projects = await Project.find({ ownerId: userId }).sort({ createdAt: -1 });
  return projects.map((p) => p.toJSON());
}

export async function createProject(userId, { name, description }) {
  const project = await Project.create({
    ownerId: userId,
    name,
    description: description || '',
  });
  return project.toJSON();
}

export async function updateProject(project, { name, description }) {
  if (name !== undefined) {
    project.name = name;
  }
  if (description !== undefined) {
    project.description = description;
  }
  await project.save();
  return project.toJSON();
}

export async function deleteProject(project) {
  try {
    const aiClient = createAiClient();
    await aiClient.delete(`/internal/rag/projects/${project._id.toString()}`);
  } catch {
    // Vector collection may not exist yet or AI service is offline
  }

  await Document.deleteMany({ projectId: project._id });
  await Project.deleteOne({ _id: project._id });
  return { deleted: true };
}

export async function updateRagConfig(project, ragConfigData) {
  project.ragConfig = {
    ...project.ragConfig.toObject(),
    ...ragConfigData,
  };
  await project.save();
  return project.ragConfig;
}

export async function updateDefenseConfig(project, defenseConfigData) {
  project.defenseConfig = defenseConfigData;
  await project.save();
  return project.defenseConfig;
}
