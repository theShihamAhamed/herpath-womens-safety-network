import mongoose from 'mongoose';

export type DatabaseStatus = 'connected' | 'disconnected';

export async function connectDatabase(uri: string): Promise<void> {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
  });
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export function getDatabaseStatus(): DatabaseStatus {
  return mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
}
