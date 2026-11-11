import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  api,
  clearStoredToken,
  getStoredToken,
  setStoredToken,
  setUnauthorizedHandler,
  TOKEN_STORAGE_KEY,
} from '../services/api.js';

describe('services/api interceptors', () => {
  beforeEach(() => {
    clearStoredToken();
    setUnauthorizedHandler(null);
  });

  afterEach(() => {
    clearStoredToken();
    setUnauthorizedHandler(null);
    vi.restoreAllMocks();
  });

  it('attaches Bearer token from localStorage to outgoing requests', async () => {
    setStoredToken('jwt-token-123');
    const requestHandler = api.interceptors.request.handlers[0].fulfilled;

    const config = await requestHandler({ headers: {} });
    expect(config.headers.Authorization).toBe('Bearer jwt-token-123');
  });

  it('omits Authorization header when no token is stored', async () => {
    const requestHandler = api.interceptors.request.handlers[0].fulfilled;

    const config = await requestHandler({ headers: {} });
    expect(config.headers.Authorization).toBeUndefined();
  });

  it('clears stored token and invokes unauthorized handler on 401 response', async () => {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, 'expired-jwt');
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);

    const responseRejected = api.interceptors.response.handlers[0].rejected;
    const error = { response: { status: 401 } };

    await expect(responseRejected(error)).rejects.toBe(error);
    expect(getStoredToken()).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
