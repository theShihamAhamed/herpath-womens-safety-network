import 'dotenv/config';

import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { loadEnvironment } from '../config/env.js';
import { UserService } from '../modules/users/user.service.js';

async function promoteUser(): Promise<void> {
  const email = process.argv[2];
  if (!email) throw new Error('Usage: npm run user:promote -- <registered-email>');

  const environment = loadEnvironment();
  await connectDatabase(environment.mongodbUri);

  try {
    const user = await new UserService().promoteModerator(email);
    if (!user) throw new Error('No active registered user matched that email');
    process.stdout.write(`Promoted registered user ${user._id.toString()} to MODERATOR.\n`);
  } finally {
    await disconnectDatabase();
  }
}

promoteUser().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Moderator promotion failed'}\n`);
  process.exitCode = 1;
});
