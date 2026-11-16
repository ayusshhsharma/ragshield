import * as documentService from '../services/document.service.js';
import { getOwnedProject } from '../utils/getOwnedProject.js';

export async function list(req, res) {
  const project = await getOwnedProject(req);
  const documents = await documentService.listDocuments(project._id);
  res.status(200).json({ documents });
}

export async function uploadFile(req, res) {
  const project = await getOwnedProject(req);
  const document = await documentService.uploadDocument(project, req.file);
  res.status(201).json({ document });
}

export async function loadDemo(req, res) {
  const project = await getOwnedProject(req);
  const documents = await documentService.loadDemoKb(project);
  res.status(201).json({ documents });
}

export async function remove(req, res) {
  const project = await getOwnedProject(req);
  await documentService.deleteDocument(project, req.params.docId);
  res.status(204).end();
}
