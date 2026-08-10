import type { UserRole } from '../../modules/users/user.types.js';

export interface AuthenticationContext {
  userId: string;
  sessionId: string;
  role: UserRole;
}
