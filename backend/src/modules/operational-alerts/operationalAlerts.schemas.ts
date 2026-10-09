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

// Edicao de um lote inteiro (classificacao ou varios produtos): so os campos comuns ao
// lote. Produto e filial nao mudam por aqui.
export const updateRulesBatchSchema = z.object({
  ruleIds: z.array(z.string().uuid()).min(1).max(50000),
  changes: createRuleSchema
    .pick({
      frequency: true,
      executionDeadlineMinutes: true,
      isActive: true,
      startDate: true,
      endDate: true,
      responsibleUserId: true,
      responsibleUserName: true,
    })
    .partial(),
});

// Disparo com varios produtos/usuarios (ex.: classificacao inteira) chega numa requisicao so.
export const createRulesBatchSchema = z.object({
  rules: z.array(createRuleSchema).min(1).max(50000),
});

export const completeAlertSchema = z.object({
  auditSessionId: z.string().min(1),
});
