import { ZodError } from 'zod';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/AppError.js';

function formatErrorBody(code, message, details = {}) {
  return { error: { code, message, details } };
}

/**
 * Central Express error middleware.
 * Always responds with: { error: { code, message, details } }.
 */
export function errorHandler(err, req, res, _next) {
  const log = req.log || logger;

  if (err instanceof AppError) {
    return res
      .status(err.statusCode)
      .json(formatErrorBody(err.code, err.message, err.details));
  }

  if (err instanceof ZodError || err?.name === 'ZodError') {
    const issues = (err.issues || []).map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    return res
      .status(400)
      .json(formatErrorBody('VALIDATION_ERROR', 'Request validation failed.', { issues }));
  }

  if (err?.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json(
        formatErrorBody(
          'FILE_TOO_LARGE',
          'Uploaded file exceeds the maximum allowed size.',
          err.field ? { field: err.field } : {},
        ),
      );
    }
    return res.status(400).json(
      formatErrorBody('VALIDATION_ERROR', err.message || 'File upload error.', {
        code: err.code,
      }),
    );
  }

  if (err?.name === 'CastError') {
    return res
      .status(404)
      .json(formatErrorBody('NOT_FOUND', 'Resource not found.'));
  }

  if (err?.name === 'ValidationError') {
    return res
      .status(400)
      .json(formatErrorBody('VALIDATION_ERROR', err.message || 'Validation failed.'));
  }

  if (err?.type === 'entity.parse.failed') {
    return res
      .status(400)
      .json(formatErrorBody('VALIDATION_ERROR', 'Malformed JSON request body.'));
  }

  if (err?.name === 'JsonWebTokenError' || err?.name === 'TokenExpiredError') {
    return res
      .status(401)
      .json(formatErrorBody('UNAUTHENTICATED', 'Invalid or expired authentication token.'));
  }

  log.error({ err: { name: err?.name, message: err?.message, stack: err?.stack } }, 'Unhandled error');

  return res
    .status(500)
    .json(formatErrorBody('INTERNAL_ERROR', 'An unexpected error occurred.'));
}

