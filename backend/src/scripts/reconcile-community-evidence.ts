import 'dotenv/config';

import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { loadEnvironment } from '../config/env.js';
import { createCommunityVerificationService } from '../modules/community-verification/community-verification.service.js';

type ReconciliationMode = '--dry-run' | '--apply';

function parseMode(value: string | undefined): ReconciliationMode {
  if (value === '--dry-run' || value === '--apply') return value;
  throw new Error('Usage: npm run community:evidence:reconcile -- --dry-run|--apply');
}

async function run(): Promise<void> {
  const mode = parseMode(process.argv[2]);
  const environment = loadEnvironment();
  await connectDatabase(environment.mongodbUri);

  try {
    const service = createCommunityVerificationService({
      windowMs: environment.feedbackRateLimitWindowMs,
      max: environment.feedbackRateLimitMax,
    });
    const result = await service.reconcileDueEvidence(new Date(), 500, mode === '--apply');
    process.stdout.write(
      `${JSON.stringify({ mode, ...result })}\n`,
    );
  } finally {
    await disconnectDatabase();
  }
}

run().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Community evidence reconciliation failed'}\n`,
  );
  process.exitCode = 1;
});
