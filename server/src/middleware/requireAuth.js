import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/user.model.js';
import { AppError } from '../utils/AppError.js';

export async function requireAuth(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication token required.');
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication token required.');
  }

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication token has expired.');
    }
    throw new AppError(401, 'UNAUTHENTICATED', 'Invalid authentication token.');
  }

  if (!payload.sub) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Invalid authentication token payload.');
  }

  let user;
  try {
    user = await User.findById(payload.sub);
  } catch {
    throw new AppError(401, 'UNAUTHENTICATED', 'Invalid authentication token.');
  }

  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'User no longer exists.');
  }

  req.user = {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
  };

  next();
}
