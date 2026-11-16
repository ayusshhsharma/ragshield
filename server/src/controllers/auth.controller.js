import * as authService from '../services/auth.service.js';
import { loginSchema, registerSchema } from '../validators/auth.validator.js';

export async function register(req, res) {
  const validated = registerSchema.parse(req.body);
  const result = await authService.registerUser(validated);
  res.status(201).json(result);
}

export async function login(req, res) {
  const validated = loginSchema.parse(req.body);
  const result = await authService.loginUser(validated);
  res.status(200).json(result);
}

export async function me(req, res) {
  const user = await authService.getCurrentUser(req.user.id);
  res.status(200).json({ user });
}

export async function logout(_req, res) {
  res.status(204).end();
}
