import { z } from 'zod';

export const querySchema = z.object({
  query: z.string().trim().min(1, 'Query is required.'),
  useProjectDefenses: z.boolean().default(true),
});
