import 'dotenv/config';

import type { Server } from 'node:http';

import pino from 'pino';

import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { EnvironmentValidationError, loadEnvironment } from './config/env.js';
import { createLogger } from './config/logger.js';

const bootstrapLogger = pino({
  base: { service: 'herpath-backend' },
  level: 'info',
});

async function closeHttpServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function startServer(): Promise<void> {
  let server: Server | undefined;

  try {
    const environment = loadEnvironment();
    const logger = createLogger(environment.nodeEnv, environment.logLevel);

    await connectDatabase(environment.mongodbUri);

    const app = createApp({
      config: environment,
      logger,
    });

    server = app.listen(environment.port, () => {
      logger.info({ port: environment.port }, 'HerPath API listening');
    });

    let shuttingDown = false;

    const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
      if (shuttingDown) {
        return;
      }

      shuttingDown = true;
      logger.info({ signal }, 'Graceful shutdown started');

      const forceExitTimer = setTimeout(() => {
        logger.error('Graceful shutdown timed out');
        process.exit(1);
      }, 10_000);
      forceExitTimer.unref();

      try {
        if (server) {
          await closeHttpServer(server);
        }
        await disconnectDatabase();
        clearTimeout(forceExitTimer);
        logger.info('Graceful shutdown completed');
        process.exitCode = 0;
      } catch (error) {
        clearTimeout(forceExitTimer);
        logger.error(
          { errorType: error instanceof Error ? error.name : 'UnknownError' },
          'Graceful shutdown failed',
        );
        process.exitCode = 1;
      }
    };

    process.once('SIGINT', () => void shutdown('SIGINT'));
    process.once('SIGTERM', () => void shutdown('SIGTERM'));
  } catch (error) {
    if (server) {
      await closeHttpServer(server).catch(() => undefined);
    }
    await disconnectDatabase().catch(() => undefined);

    if (error instanceof EnvironmentValidationError) {
      bootstrapLogger.error({ issues: error.issues }, 'Backend environment is invalid');
    } else {
      bootstrapLogger.error(
        { errorType: error instanceof Error ? error.name : 'UnknownError' },
        'Backend startup failed',
      );
    }

    process.exitCode = 1;
  }
}

void startServer();
