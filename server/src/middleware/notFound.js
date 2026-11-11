import { AppError } from '../utils/AppError.js';

/**
 * Catch-all middleware for unmatched routes.
 */
export function notFoundHandler(req, _res, next) {
  next(
    new AppError(404, 'NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`),
  );
}

