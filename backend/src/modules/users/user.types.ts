export const ACCOUNT_TYPES = ['ANONYMOUS', 'REGISTERED'] as const;
export const USER_ROLES = ['USER', 'MODERATOR'] as const;
export const USER_STATUSES = ['ACTIVE', 'DISABLED'] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];
export type UserRole = (typeof USER_ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];

export interface SafeUser {
  id: string;
  accountType: AccountType;
  role: UserRole;
  status: UserStatus;
  name?: string;
  email?: string;
  createdAt: string;
}
