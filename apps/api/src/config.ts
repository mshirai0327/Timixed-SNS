import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8787),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional(),
  APP_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
});

export const config = envSchema.parse(process.env);
