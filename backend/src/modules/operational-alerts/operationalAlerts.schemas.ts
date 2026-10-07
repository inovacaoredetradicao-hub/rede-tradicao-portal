import { z } from 'zod';

export const frequencySchema = z.enum(['unica', 'diario', 'quinzenal', 'mensal']);

export const createRuleSchema = z.object({
  productId: z.string().min(1),
  barcode: z.string().min(1),
  productName: z.string().min(1),
  unitId: z.string().min(1),
  unitName: z.string().min(1),
  frequency: frequencySchema,
  executionDeadlineMinutes: z.number().int().positive(),
  isActive: z.boolean(),
  startDate: z.string().min(1),
  endDate: z.string().nullable().optional(),
  responsibleUserId: z.string().nullable().optional(),
  responsibleUserName: z.string().nullable().optional(),
  groupId: z.string().uuid().nullable().optional(),
});

export const updateRuleSchema = createRuleSchema.partial();

export const completeAlertSchema = z.object({
  auditSessionId: z.string().min(1),
});
