export type AccountType = 'ANONYMOUS' | 'REGISTERED';
export type UserRole = 'USER' | 'MODERATOR';
export type UserStatus = 'ACTIVE' | 'DISABLED';

export interface AuthActor {
  id: string;
  accountType: AccountType;
  role: UserRole;
  status: UserStatus;
  name?: string;
  email?: string;
  createdAt: string;
}

export interface AuthTokenBundle {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthActor;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface SignUpInput extends SignInInput {
  name: string;
}

export type SessionStatus = 'loading' | 'ready' | 'error';
export type AuthOperation = 'signIn' | 'signUp' | 'logout' | null;
