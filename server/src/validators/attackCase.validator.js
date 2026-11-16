import { z } from 'zod';

const injectedChunkSpecSchema = z.object({
  text: z
    .string({ required_error: 'injectedChunk text is required' })
    .min(1, 'injectedChunk text cannot be empty')
    .max(6000, 'injectedChunk text cannot exceed 6000 chars'),
  position: z.enum(['first', 'middle', 'last'], {
    required_error: 'position must be first, middle, or last',
  }),
});

const successConditionSchema = z
  .object({
    type: z.enum(['contains_any', 'regex'], {
      required_error: 'successCondition type must be contains_any or regex',
    }),
    values: z
      .array(
        z
          .string()
          .min(1, 'successCondition value cannot be empty')
          .max(300, 'successCondition value cannot exceed 300 chars'),
      )
      .min(1, 'successCondition values must contain at least 1 item'),
    flags: z.enum(['', 'i', 'im']).default(''),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'regex') {
      for (const val of data.values) {
        try {
          new RegExp(val, data.flags || undefined);
        } catch (err) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Regex failed to compile in JavaScript: ${err.message}`,
            path: ['values'],
          });
        }
      }
    }
  });

export const customAttackCaseSchema = z
  .object({
    category: z.enum(
      [
        'AT-01',
        'AT-02',
        'AT-03',
        'AT-04',
        'AT-05',
        'AT-06',
        'AT-07',
        'AT-08',
        'BENIGN',
      ],
      { required_error: 'category is required' },
    ),
    name: z
      .string({ required_error: 'name is required' })
      .trim()
      .min(3, 'name must be at least 3 characters long')
      .max(100, 'name must be at most 100 characters long'),
    technique: z.enum(
      [
        'direct_request',
        'ignore_previous',
        'roleplay',
        'authority_claim',
        'delimiter_spoof',
        'hidden_comment',
        'buried_in_long_text',
        'translation',
        'transliteration',
        'encoding',
        'format_trick',
        'link_exfil',
        'multi_step',
      ],
      { required_error: 'technique is required' },
    ),
    severity: z.enum(['low', 'medium', 'high', 'critical'], {
      required_error: 'severity is required',
    }),
    language: z.enum(['en', 'hi', 'hinglish'], {
      required_error: 'language is required',
    }),
    description: z
      .string({ required_error: 'description is required' })
      .trim()
      .min(5, 'description must be at least 5 characters long')
      .max(300, 'description must be at most 300 characters long'),
    userQuery: z
      .string({ required_error: 'userQuery is required' })
      .trim()
      .min(1, 'userQuery cannot be empty')
      .max(1000, 'userQuery cannot exceed 1000 chars'),
    injectedChunks: z.array(injectedChunkSpecSchema).max(3).default([]),
    expectedBehavior: z
      .string({ required_error: 'expectedBehavior is required' })
      .trim()
      .min(1, 'expectedBehavior cannot be empty'),
    successCondition: successConditionSchema.nullable().optional(),
    isBenign: z.boolean().default(false),
    expectedKeywords: z.array(z.string().trim().min(1)).default([]),
    owaspRef: z.string().trim().default(''),
  })
  .superRefine((data, ctx) => {
    if (!data.isBenign) {
      if (!data.successCondition) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Attack case must have successCondition (isBenign is false)',
          path: ['successCondition'],
        });
      }
      if (data.expectedKeywords && data.expectedKeywords.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Attack case must have empty expectedKeywords (isBenign is false)',
          path: ['expectedKeywords'],
        });
      }
    } else {
      if (data.successCondition) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Benign case must have successCondition null (isBenign is true)',
          path: ['successCondition'],
        });
      }
      if (!data.expectedKeywords || data.expectedKeywords.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Benign case must have non-empty expectedKeywords (isBenign is true)',
          path: ['expectedKeywords'],
        });
      }
      if (data.category !== 'BENIGN') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Benign case must have category='BENIGN'",
          path: ['category'],
        });
      }
    }
  });

export const libraryQuerySchema = z.object({
  category: z
    .enum([
      'AT-01',
      'AT-02',
      'AT-03',
      'AT-04',
      'AT-05',
      'AT-06',
      'AT-07',
      'AT-08',
      'BENIGN',
    ])
    .optional(),
  language: z.enum(['en', 'hi', 'hinglish']).optional(),
  q: z.string().trim().optional(),
});
