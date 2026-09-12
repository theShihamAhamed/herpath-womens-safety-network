import 'dotenv/config';

import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { loadEnvironment } from '../config/env.js';
import { createModerationIntakeReconciliationService } from '../modules/moderation/moderation-intake-reconciliation.service.js';

type ReconciliationMode = 'dry-run' | 'apply';

function parseMode(args: string[]): ReconciliationMode {
  if (args.length === 1 && args[0] === '--dry-run') return 'dry-run';
  if (args.length === 1 && args[0] === '--apply') return 'apply';
  throw new Error(
    'Usage: npm run reconcile:moderation-intake -- --dry-run | npm run reconcile:moderation-intake -- --apply',
  );
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv.slice(2));
  const environment = loadEnvironment();
  await connectDatabase(environment.mongodbUri);

  try {
    const result = await createModerationIntakeReconciliationService().reconcile({
      apply: mode === 'apply',
    });
    process.stdout.write(
      `${JSON.stringify(
        {
          mode,
          eligibleCount: result.eligibleIncidents.length,
          eligibleIncidents: result.eligibleIncidents,
          queuedCount: result.queuedCount,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await disconnectDatabase();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Moderation intake reconciliation failed'}\n`,
  );
  process.exitCode = 1;
});
