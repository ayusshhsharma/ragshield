/**
 * Wrap an async Express route/middleware handler so rejected promises forward to next().
 */
export function asyncHandler(fn) {
  return function wrappedAsyncHandler(req, res, next) {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };
}

