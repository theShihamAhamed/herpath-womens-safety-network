import { UserModel, type UserDocument } from './user.model.js';
import type { UserRole } from './user.types.js';

export class UserRepository {
  public async createAnonymous(): Promise<UserDocument> {
    return UserModel.create({ accountType: 'ANONYMOUS' });
  }

  public async createRegistered(input: {
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<UserDocument> {
    return UserModel.create({ accountType: 'REGISTERED', ...input });
  }

  public async findById(id: string): Promise<UserDocument | null> {
    return UserModel.findById(id).exec();
  }

  public async findRegisteredByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return UserModel.findOne({ accountType: 'REGISTERED', email })
      .select('+passwordHash')
      .exec();
  }

  public async setRegisteredRole(email: string, role: UserRole): Promise<UserDocument | null> {
    return UserModel.findOneAndUpdate(
      { accountType: 'REGISTERED', email, status: 'ACTIVE' },
      { $set: { role } },
      { new: true },
    ).exec();
  }
}
