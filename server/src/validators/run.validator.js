import { z } from 'zod';

export const createRunSchema = z.object({
  mode: z.enum(['baseline', 'protected'], {
    required_error: 'mode must be either "baseline" or "protected"',
  }),
  categories: z.array(z.string().trim()).optional(),
  caseIds: z.array(z.string().trim()).optional(),
  repeats: z.coerce
    .number()
    .int()
    .min(1, 'repeats must be between 1 and 5')
    .max(5, 'repeats must be between 1 and 5')
    .default(3),
  includeBenign: z.boolean().default(true),
});

export const createExperimentSchema = z.object({
  categories: z.array(z.string().trim()).optional(),
  caseIds: z.array(z.string().trim()).optional(),
  repeats: z.coerce
    .number()
    .int()
    .min(1, 'repeats must be between 1 and 5')
    .max(5, 'repeats must be between 1 and 5')
    .default(3),
});

export const resultsQuerySchema = z.object({
  outcome: z
    .enum([
      'attack_succeeded',
      'blocked_by_defense',
      'model_refused_or_safe',
      'benign_answered',
      'error',
    ])
    .optional(),
  category: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
});
