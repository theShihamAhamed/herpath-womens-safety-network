import pino, { type Logger } from 'pino';

import type { LogLevel, NodeEnvironment } from './env.js';

const redactedPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  "res.headers['set-cookie']",
  'req.body.location',
  'req.body.privateLocation',
  'req.body.journeyPoints',
  'req.body.points',
  'req.body.password',
  'req.body.accessToken',
  'req.body.refreshToken',
  'passwordHash',
  'refreshTokenHash',
  '*.passwordHash',
  '*.refreshTokenHash',
  '*.accessToken',
  '*.refreshToken',
  'ACCESS_TOKEN_SECRET',
  '*.ACCESS_TOKEN_SECRET',
  'mongodbUri',
  'MONGODB_URI',
  '*.mongodbUri',
  '*.MONGODB_URI',
];

export function createLogger(nodeEnv: NodeEnvironment, level: LogLevel): Logger {
  const options = {
    level,
    base: {
      service: 'herpath-backend',
      environment: nodeEnv,
    },
    redact: {
      paths: redactedPaths,
      censor: '[REDACTED]',
    },
  };

  if (nodeEnv === 'development') {
    return pino({
      ...options,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          singleLine: true,
          translateTime: 'SYS:standard',
        },
      },
    });
  }

  return pino(options);
}
