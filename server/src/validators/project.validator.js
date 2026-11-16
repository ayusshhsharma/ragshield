import { z } from 'zod';
import {
  DEFAULT_DEFENSE_CONFIG,
  DEFAULT_RAG_CONFIG,
  DEFAULT_SYSTEM_PROMPT,
} from '../config/defaults.js';

export const createProjectSchema = z.object({
  name: z
    .string({ required_error: 'Project name is required' })
    .trim()
    .min(2, 'Project name must be at least 2 characters long')
    .max(80, 'Project name must be at most 80 characters long'),
  description: z
    .string()
    .trim()
    .max(500, 'Description must be at most 500 characters long')
    .optional()
    .default(''),
});

export const updateProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Project name must be at least 2 characters long')
      .max(80, 'Project name must be at most 80 characters long')
      .optional(),
    description: z
      .string()
      .trim()
      .max(500, 'Description must be at most 500 characters long')
      .optional(),
  })
  .refine((data) => data.name !== undefined || data.description !== undefined, {
    message: 'At least one field (name or description) must be provided for update.',
  });

export const ragConfigSchema = z
  .object({
    chunkSize: z.coerce
      .number({ required_error: 'chunkSize is required' })
      .int('chunkSize must be an integer')
      .min(100, 'chunkSize must be at least 100')
      .max(2000, 'chunkSize must be at most 2000')
      .default(DEFAULT_RAG_CONFIG.chunkSize),
    chunkOverlap: z.coerce
      .number({ required_error: 'chunkOverlap is required' })
      .int('chunkOverlap must be an integer')
      .min(0, 'chunkOverlap must be at least 0')
      .default(DEFAULT_RAG_CONFIG.chunkOverlap),
    topK: z.coerce
      .number({ required_error: 'topK is required' })
      .int('topK must be an integer')
      .min(1, 'topK must be at least 1')
      .max(10, 'topK must be at most 10')
      .default(DEFAULT_RAG_CONFIG.topK),
    systemPrompt: z
      .string()
      .trim()
      .min(1, 'systemPrompt cannot be empty')
      .max(2000, 'systemPrompt cannot exceed 2000 characters')
      .default(DEFAULT_SYSTEM_PROMPT),
  })
  .refine((data) => data.chunkOverlap <= Math.floor(data.chunkSize / 2), {
    message: 'chunkOverlap cannot exceed chunkSize / 2',
    path: ['chunkOverlap'],
  });

const scannerConfigSchema = z.object({
  enabled: z.boolean({ required_error: 'enabled is required' }),
  threshold: z.coerce
    .number()
    .min(0, 'threshold must be at least 0')
    .max(1, 'threshold must be at most 1')
    .default(0.5),
});

const toggleConfigSchema = z.object({
  enabled: z.boolean({ required_error: 'enabled is required' }),
});

export const defenseConfigSchema = z.object({
  inputScanner: scannerConfigSchema.default(DEFAULT_DEFENSE_CONFIG.inputScanner),
  documentScanner: scannerConfigSchema.default(DEFAULT_DEFENSE_CONFIG.documentScanner),
  instructionIsolation: toggleConfigSchema.default(DEFAULT_DEFENSE_CONFIG.instructionIsolation),
  outputValidator: toggleConfigSchema.default(DEFAULT_DEFENSE_CONFIG.outputValidator),
});
