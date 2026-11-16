import path from 'node:path';
import { AppError } from './AppError.js';

const ALLOWED_EXTENSIONS = new Set(['.txt', '.pdf', '.docx']);

export function sanitiseFilename(rawName) {
  if (!rawName || typeof rawName !== 'string') {
    return 'document.txt';
  }
  const base = path.basename(rawName).trim();
  return base.length > 120 ? base.slice(-120) : base;
}

export function validateUploadFile(file) {
  if (!file || !file.buffer) {
    throw new AppError(400, 'VALIDATION_ERROR', 'No file was uploaded.');
  }

  const sanitisedFilename = sanitiseFilename(file.originalname);
  const ext = path.extname(sanitisedFilename).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new AppError(
      400,
      'FILE_TYPE_NOT_ALLOWED',
      'Only .txt, .pdf, and .docx files are allowed.',
    );
  }

  const buffer = file.buffer;

  if (ext === '.pdf') {
    if (buffer.length < 4 || buffer.subarray(0, 4).toString('utf-8') !== '%PDF') {
      throw new AppError(
        400,
        'FILE_TYPE_NOT_ALLOWED',
        'File content is not a valid PDF document (missing %PDF signature).',
      );
    }
  } else if (ext === '.docx') {
    const isZip =
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04;
    if (!isZip) {
      throw new AppError(
        400,
        'FILE_TYPE_NOT_ALLOWED',
        'File content is not a valid DOCX document (missing PK header).',
      );
    }
  } else if (ext === '.txt') {
    // Reject Windows PE executable ('MZ') or ELF ('\x7fELF') binaries spoofed as txt
    if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
      throw new AppError(
        400,
        'FILE_TYPE_NOT_ALLOWED',
        'File content appears to be a binary executable, not plain text.',
      );
    }
    if (buffer.length >= 4 && buffer[0] === 0x7f && buffer.subarray(1, 4).toString('ascii') === 'ELF') {
      throw new AppError(
        400,
        'FILE_TYPE_NOT_ALLOWED',
        'File content appears to be a binary executable, not plain text.',
      );
    }
    // Reject files containing null bytes
    if (buffer.includes(0x00)) {
      throw new AppError(
        400,
        'FILE_TYPE_NOT_ALLOWED',
        'File content contains binary null bytes and is not valid text.',
      );
    }
    // Validate UTF-8 encoding
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      throw new AppError(
        400,
        'FILE_TYPE_NOT_ALLOWED',
        'File content is not valid UTF-8 plain text.',
      );
    }
  }

  return {
    sanitisedFilename,
    ext,
    mimeType: file.mimetype || 'application/octet-stream',
    sizeBytes: file.size || buffer.length,
  };
}
