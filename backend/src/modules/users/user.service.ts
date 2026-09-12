import { AppError } from '../../common/errors/app-error.js';
import type { UserDocument } from './user.model.js';
import { UserRepository } from './user.repository.js';
import type { SafeUser, UserRole } from './user.types.js';

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11_000;
}

export class UserService {
  public constructor(private readonly users = new UserRepository()) {}

  public normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  public async createAnonymous(): Promise<UserDocument> {
    return this.users.createAnonymous();
  }

  public async createRegistered(input: {
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<UserDocument> {
    try {
      return await this.users.createRegistered({
        name: input.name.trim().replace(/\s+/g, ' '),
        email: this.normalizeEmail(input.email),
        passwordHash: input.passwordHash,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new AppError({
          statusCode: 409,
          code: 'EMAIL_ALREADY_REGISTERED',
          message: 'An account with this email already exists',
        });
      }
      throw error;
    }
  }

  public async findById(id: string): Promise<UserDocument | null> {
    return this.users.findById(id);
  }

  public async findForLogin(email: string): Promise<UserDocument | null> {
    return this.users.findRegisteredByEmailWithPassword(this.normalizeEmail(email));
  }

  public async promoteModerator(email: string): Promise<UserDocument | null> {
    return this.users.setRegisteredRole(this.normalizeEmail(email), 'MODERATOR' satisfies UserRole);
  }

  public toSafeUser(user: UserDocument): SafeUser {
    const safeUser: SafeUser = {
      id: user._id.toString(),
      accountType: user.accountType,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
    };

    if (user.accountType === 'REGISTERED') {
      if (user.name) safeUser.name = user.name;
      if (user.email) safeUser.email = user.email;
    }

    return safeUser;
  }
}
