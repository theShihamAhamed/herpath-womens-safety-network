import 'dotenv/config';

import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { loadEnvironment } from '../config/env.js';
import {
  applyIncidentLifecycleMigration,
  inspectIncidentLifecycleMigration,
  rollbackIncidentLifecycleMigration,
} from '../modules/incidents/incident-lifecycle.migration.js';

type MigrationMode = '--dry-run' | '--apply' | '--rollback';

function migrationMode(arguments_: string[]): MigrationMode {
  const [mode, ...unexpected] = arguments_;
  if (
    unexpected.length > 0 ||
    (mode !== '--dry-run' && mode !== '--apply' && mode !== '--rollback')
  ) {
    throw new Error(
      'Usage: npm run incident:lifecycle:migrate -- --dry-run|--apply|--rollback',
    );
  }
  return mode;
}

async function migrateIncidentLifecycle(): Promise<void> {
  const mode = migrationMode(process.argv.slice(2));
  const environment = loadEnvironment();
  await connectDatabase(environment.mongodbUri);

  try {
    const result =
      mode === '--dry-run'
        ? await inspectIncidentLifecycleMigration()
        : mode === '--apply'
          ? await applyIncidentLifecycleMigration()
          : await rollbackIncidentLifecycleMigration();
    process.stdout.write(`${JSON.stringify({ mode, result }, null, 2)}\n`);
  } finally {
    await disconnectDatabase();
  }
}

migrateIncidentLifecycle().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Incident lifecycle migration failed'}\n`,
  );
  process.exitCode = 1;
});
