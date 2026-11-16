import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/user.model.js';
import { AppError } from '../utils/AppError.js';

const BCRYPT_ROUNDS = 12;

function generateToken(userId) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

export async function registerUser({ name, email, password }) {
  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email address already exists.');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await User.create({
    name,
    email,
    passwordHash,
  });

  const token = generateToken(user._id.toString());
  return {
    token,
    user: user.toJSON(),
  };
}

export async function loginUser({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const token = generateToken(user._id.toString());
  return {
    token,
    user: user.toJSON(),
  };
}

export async function getCurrentUser(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'User no longer exists.');
  }
  return user.toJSON();
}
