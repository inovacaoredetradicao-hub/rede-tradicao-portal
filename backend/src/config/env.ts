import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  PORTAL_FRONTEND_URL: z.string().default('http://localhost:3000'),
  SCHEDULER_ENABLED: z
    .string()
    .transform((value) => value !== 'false')
    .default('true'),
  SCHEDULER_INTERVAL_MS: z.coerce.number().default(60000),
  OPERATIONAL_ALERT_HOUR: z.preprocess(
    (value) => (value === '' || value === undefined ? undefined : value),
    z.coerce.number().int().min(0).max(23).optional(),
  ),
  OPERATIONAL_ALERT_MINUTE: z.preprocess(
    (value) => (value === '' || value === undefined ? undefined : value),
    z.coerce.number().int().min(0).max(59).optional(),
  ),
});

export const env = envSchema.parse(process.env);
