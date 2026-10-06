import 'dotenv/config';

import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { loadEnvironment } from '../config/env.js';
import { ensureJourneyIndexes } from '../modules/journeys/journey-index.service.js';
import { reconcileJourneys } from '../modules/journeys/journey-reconciliation.service.js';

type ReconciliationMode = '--dry-run' | '--apply';

function parseMode(value: string | undefined): ReconciliationMode {
  if (value === undefined || value === '--dry-run') return '--dry-run';
  if (value === '--apply') return '--apply';
  throw new Error('Usage: npm run journey:lifecycle:reconcile -- [--dry-run|--apply]');
}

async function run(): Promise<void> {
  const mode = parseMode(process.argv[2]);
  const environment = loadEnvironment();
  await connectDatabase(environment.mongodbUri);

  try {
    const result = await reconcileJourneys({ apply: mode === '--apply' });
    if (mode === '--apply') await ensureJourneyIndexes();
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await disconnectDatabase();
  }
}

run().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Journey reconciliation failed'}\n`,
  );
  process.exitCode = 1;
});
