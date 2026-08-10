import * as argon2 from 'argon2';

const HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export class PasswordService {
  private readonly dummyHash = argon2.hash('HerPath timing equalization value', HASH_OPTIONS);

  public async hash(password: string): Promise<string> {
    return argon2.hash(password, HASH_OPTIONS);
  }

  public async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  public async verifyDummy(password: string): Promise<void> {
    await this.verify(await this.dummyHash, password);
  }
}
