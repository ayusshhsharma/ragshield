import mongoose from 'mongoose';
import { Document } from '../models/document.model.js';
import { AppError } from '../utils/AppError.js';
import { validateUploadFile } from '../utils/fileValidation.js';
import { AI_TIMEOUTS, createAiClient } from './aiClient.js';

export async function listDocuments(projectId) {
  const docs = await Document.find({ projectId }).sort({ createdAt: -1 });
  return docs.map((d) => d.toJSON());
}

export async function uploadDocument(project, file) {
  const { sanitisedFilename, mimeType, sizeBytes } = validateUploadFile(file);

  const doc = await Document.create({
    projectId: project._id,
    ownerId: project.ownerId,
    filename: sanitisedFilename,
    mimeType,
    sizeBytes,
    status: 'processing',
  });

  const formData = new FormData();
  formData.append(
    'file',
    new Blob([file.buffer], { type: mimeType || 'application/octet-stream' }),
    sanitisedFilename,
  );
  formData.append('projectId', project._id.toString());
  formData.append('documentId', doc._id.toString());
  formData.append('chunkSize', String(project.ragConfig?.chunkSize ?? 500));
  formData.append('chunkOverlap', String(project.ragConfig?.chunkOverlap ?? 80));

  const aiClient = createAiClient();
  let ingestResult;
  try {
    const res = await aiClient.post('/internal/rag/ingest', formData, {
      timeout: AI_TIMEOUTS.INGEST,
    });
    ingestResult = res.data;
  } catch (err) {
    doc.status = 'failed';
    doc.error = err.message || 'AI service ingest failed.';
    await doc.save();

    // Clean up partial vectors in ChromaDB if any
    try {
      await aiClient.delete(
        `/internal/rag/documents/${project._id.toString()}/${doc._id.toString()}`,
      );
    } catch {
      // Swallowed: vector cleanup failure shouldn't mask original ingest failure
    }

    throw err;
  }

  doc.status = 'ready';
  doc.chunkCount = ingestResult.chunkCount;
  doc.charCount = ingestResult.charCount;
  await doc.save();

  return doc.toJSON();
}

export async function loadDemoKb(project) {
  if (project.demoKbLoaded) {
    throw new AppError(
      409,
      'DEMO_KB_ALREADY_LOADED',
      'Demo knowledge base is already loaded for this project.',
    );
  }

  const aiClient = createAiClient();
  const res = await aiClient.post(
    '/internal/rag/ingest-demo',
    {
      projectId: project._id.toString(),
      chunkSize: project.ragConfig?.chunkSize ?? 500,
      chunkOverlap: project.ragConfig?.chunkOverlap ?? 80,
    },
    {
      timeout: AI_TIMEOUTS.INGEST,
    },
  );

  const demoDocs = res.data?.documents || [];
  const createdDocs = [];

  for (const item of demoDocs) {
    const doc = await Document.create({
      _id: item.documentId,
      projectId: project._id,
      ownerId: project.ownerId,
      filename: item.name,
      mimeType: 'text/plain',
      status: 'ready',
      chunkCount: item.chunkCount,
      charCount: item.charCount,
      isDemo: true,
    });
    createdDocs.push(doc.toJSON());
  }

  project.demoKbLoaded = true;
  await project.save();

  return createdDocs;
}

export async function deleteDocument(project, docId) {
  if (!docId || !mongoose.Types.ObjectId.isValid(docId)) {
    throw new AppError(404, 'NOT_FOUND', 'Document not found.');
  }

  const doc = await Document.findOne({
    _id: docId,
    projectId: project._id,
    ownerId: project.ownerId,
  });

  if (!doc) {
    throw new AppError(404, 'NOT_FOUND', 'Document not found.');
  }

  const aiClient = createAiClient();
  try {
    await aiClient.delete(
      `/internal/rag/documents/${project._id.toString()}/${doc._id.toString()}`,
    );
  } catch {
    doc.status = 'failed';
    doc.error = 'Vector deletion failed in AI service.';
    await doc.save();
    throw new AppError(
      502,
      'AI_SERVICE_UNAVAILABLE',
      'Failed to delete document vectors from AI service.',
    );
  }

  await Document.deleteOne({ _id: doc._id });
  return { deleted: true };
}
