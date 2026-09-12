import { z } from 'zod';

const nodeEnvironmentSchema = z.enum(['development', 'test', 'production']);
const logLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);
const accessTokenTtlSchema = z
  .string()
  .trim()
  .regex(/^\d+[smh]$/, 'ACCESS_TOKEN_TTL must be a duration such as 15m');

function durationToSeconds(duration: string): number {
  const match = duration.match(/^(\d+)([smh])$/);
  if (!match?.[1] || !match[2]) return 0;
  return Number(match[1]) * ({ s: 1, m: 60, h: 3_600 }[match[2]] ?? 0);
}

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
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  REPORT_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  REPORT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  FEEDBACK_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  FEEDBACK_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  FLAG_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  FLAG_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  ACCESS_TOKEN_SECRET: z.string().min(32, 'ACCESS_TOKEN_SECRET must contain at least 32 characters'),
  ACCESS_TOKEN_TTL: accessTokenTtlSchema.default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  JWT_ISSUER: z.string().trim().min(1).default('herpath-api'),
  JWT_AUDIENCE: z.string().trim().min(1).default('herpath-mobile'),
}).superRefine((environment, context) => {
  const accessTokenSeconds = durationToSeconds(environment.ACCESS_TOKEN_TTL);
  if (accessTokenSeconds < 60 || accessTokenSeconds > 3_600) {
    context.addIssue({
      code: 'custom',
      path: ['ACCESS_TOKEN_TTL'],
      message: 'ACCESS_TOKEN_TTL must be between 60 seconds and 1 hour',
    });
  }

  if (environment.AUTH_RATE_LIMIT_MAX >= environment.RATE_LIMIT_MAX) {
    context.addIssue({
      code: 'custom',
      path: ['AUTH_RATE_LIMIT_MAX'],
      message: 'AUTH_RATE_LIMIT_MAX must be lower than RATE_LIMIT_MAX',
    });
  }

  if (environment.NODE_ENV === 'production' && environment.ACCESS_TOKEN_SECRET.length < 64) {
    context.addIssue({
      code: 'custom',
      path: ['ACCESS_TOKEN_SECRET'],
      message: 'ACCESS_TOKEN_SECRET must contain at least 64 characters in production',
    });
  }
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
  authRateLimitMax: number;
  reportRateLimitWindowMs: number;
  reportRateLimitMax: number;
  feedbackRateLimitWindowMs: number;
  feedbackRateLimitMax: number;
  flagRateLimitWindowMs: number;
  flagRateLimitMax: number;
  trustProxy: boolean;
  accessTokenSecret: string;
  accessTokenTtl: string;
  refreshTokenTtlDays: number;
  jwtIssuer: string;
  jwtAudience: string;
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
    authRateLimitMax: result.data.AUTH_RATE_LIMIT_MAX,
    reportRateLimitWindowMs: result.data.REPORT_RATE_LIMIT_WINDOW_MS,
    reportRateLimitMax: result.data.REPORT_RATE_LIMIT_MAX,
    feedbackRateLimitWindowMs: result.data.FEEDBACK_RATE_LIMIT_WINDOW_MS,
    feedbackRateLimitMax: result.data.FEEDBACK_RATE_LIMIT_MAX,
    flagRateLimitWindowMs: result.data.FLAG_RATE_LIMIT_WINDOW_MS,
    flagRateLimitMax: result.data.FLAG_RATE_LIMIT_MAX,
    trustProxy: result.data.TRUST_PROXY === 'true',
    accessTokenSecret: result.data.ACCESS_TOKEN_SECRET,
    accessTokenTtl: result.data.ACCESS_TOKEN_TTL,
    refreshTokenTtlDays: result.data.REFRESH_TOKEN_TTL_DAYS,
    jwtIssuer: result.data.JWT_ISSUER,
    jwtAudience: result.data.JWT_AUDIENCE,
  };
}
