import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

import {
  ACCOUNT_TYPES,
  USER_ROLES,
  USER_STATUSES,
  type AccountType,
  type UserRole,
  type UserStatus,
} from './user.types.js';

export interface UserDocumentFields {
  _id: Types.ObjectId;
  accountType: AccountType;
  role: UserRole;
  status: UserStatus;
  name?: string;
  email?: string;
  passwordHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<UserDocumentFields>;

const userSchema = new Schema<UserDocumentFields, Model<UserDocumentFields>>(
  {
    accountType: { type: String, enum: ACCOUNT_TYPES, required: true },
    role: { type: String, enum: USER_ROLES, required: true, default: 'USER' },
    status: { type: String, enum: USER_STATUSES, required: true, default: 'ACTIVE' },
    name: { type: String, trim: true, maxlength: 100 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    passwordHash: { type: String, select: false },
  },
  { timestamps: true, versionKey: false },
);

userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { accountType: 'REGISTERED', email: { $type: 'string' } },
  },
);

userSchema.pre('validate', function validateAccountFields() {
  if (this.accountType === 'REGISTERED') {
    if (!this.name || !this.email || !this.passwordHash) {
      this.invalidate('accountType', 'Registered accounts require name, email, and password');
    }
    return;
  }

  if (this.name || this.email || this.passwordHash) {
    this.invalidate('accountType', 'Anonymous accounts cannot contain public identity fields');
  }
});

export const UserModel = model<UserDocumentFields>('User', userSchema);
