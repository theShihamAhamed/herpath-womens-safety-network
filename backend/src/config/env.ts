import { z } from 'zod';

const nodeEnvironmentSchema = z.enum(['development', 'test', 'production']);
const logLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);

const rawEnvironmentSchema = z.object({
  NODE_ENV: nodeEnvironmentSchema.default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  MONGODB_URI: z
    .string()
    .trim()
    .min(1, 'MONGODB_URI is required')
    .refine(
      (value) => value.startsWith('mongodb://') || value.startsWith('mongodb+srv://'),
      'MONGODB_URI must use the mongodb:// or mongodb+srv:// scheme',
    ),
  CORS_ORIGINS: z.string().trim().min(1).default('http://localhost:8081'),
  LOG_LEVEL: logLevelSchema.default('info'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(200),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
});

export type NodeEnvironment = z.infer<typeof nodeEnvironmentSchema>;
export type LogLevel = z.infer<typeof logLevelSchema>;

export interface Environment {
  nodeEnv: NodeEnvironment;
  port: number;
  mongodbUri: string;
  corsOrigins: string[];
  logLevel: LogLevel;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  trustProxy: boolean;
}

export class EnvironmentValidationError extends Error {
  public constructor(public readonly issues: string[]) {
    super(`Environment validation failed: ${issues.join('; ')}`);
    this.name = 'EnvironmentValidationError';
  }
}

export function loadEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  const result = rawEnvironmentSchema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const field = issue.path.join('.') || 'environment';
      return `${field}: ${issue.message}`;
    });

    throw new EnvironmentValidationError(issues);
  }

  const corsOrigins = result.data.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (corsOrigins.length === 0) {
    throw new EnvironmentValidationError(['CORS_ORIGINS: at least one origin is required']);
  }

  return {
    nodeEnv: result.data.NODE_ENV,
    port: result.data.PORT,
    mongodbUri: result.data.MONGODB_URI,
    corsOrigins,
    logLevel: result.data.LOG_LEVEL,
    rateLimitWindowMs: result.data.RATE_LIMIT_WINDOW_MS,
    rateLimitMax: result.data.RATE_LIMIT_MAX,
    trustProxy: result.data.TRUST_PROXY === 'true',
  };
}
