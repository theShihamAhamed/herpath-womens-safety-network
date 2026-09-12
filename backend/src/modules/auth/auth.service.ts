import { AppError } from '../../common/errors/app-error.js';
import type { AuthenticationContext } from '../../common/types/auth.js';
import type { UserDocument } from '../users/user.model.js';
import { UserService } from '../users/user.service.js';
import type { SafeUser } from '../users/user.types.js';
import type { LoginInput, RegisterInput } from './auth.validation.js';
import { PasswordService } from './password.service.js';
import { SessionRepository } from './session.repository.js';
import { TokenService, type TokenConfiguration } from './token.service.js';

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: SafeUser;
}

function invalidCredentials(): AppError {
  return new AppError({
    statusCode: 401,
    code: 'INVALID_CREDENTIALS',
    message: 'Email or password is incorrect',
  });
}

function invalidRefreshToken(): AppError {
  return new AppError({
    statusCode: 401,
    code: 'INVALID_REFRESH_TOKEN',
    message: 'Refresh token is invalid or expired',
  });
}

export class AuthService {
  public constructor(
    private readonly users: UserService,
    private readonly sessions: SessionRepository,
    private readonly tokens: TokenService,
    private readonly passwords: PasswordService,
  ) {}

  private async createSession(user: UserDocument): Promise<AuthTokensResponse> {
    const refreshToken = this.tokens.createRefreshToken();
    const session = await this.sessions.create({
      userId: user._id.toString(),
      refreshTokenHash: this.tokens.hashRefreshToken(refreshToken),
      expiresAt: this.tokens.refreshTokenExpiresAt(),
    });

    try {
      const accessToken = await this.tokens.signAccessToken({
        userId: user._id.toString(),
        role: user.role,
        sessionId: session._id.toString(),
      });

      return {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: this.tokens.accessTokenExpiresInSeconds,
        user: this.users.toSafeUser(user),
      };
    } catch (error) {
      await this.sessions.revokeById(session._id.toString(), 'LOGOUT');
      throw error;
    }
  }

  public async createAnonymous(): Promise<AuthTokensResponse> {
    return this.createSession(await this.users.createAnonymous());
  }

  public async register(input: RegisterInput): Promise<AuthTokensResponse> {
    const passwordHash = await this.passwords.hash(input.password);
    const user = await this.users.createRegistered({ ...input, passwordHash });
    return this.createSession(user);
  }

  public async login(input: LoginInput): Promise<AuthTokensResponse> {
    const user = await this.users.findForLogin(input.email);

    if (!user?.passwordHash) {
      await this.passwords.verifyDummy(input.password);
      throw invalidCredentials();
    }

    const passwordMatches = await this.passwords.verify(user.passwordHash, input.password);
    if (!passwordMatches || user.status !== 'ACTIVE') throw invalidCredentials();

    return this.createSession(user);
  }

  public async refresh(rawRefreshToken: string): Promise<AuthTokensResponse> {
    const tokenHash = this.tokens.hashRefreshToken(rawRefreshToken);
    const currentSession = await this.sessions.findByRefreshTokenHash(tokenHash);

    if (!currentSession) throw invalidRefreshToken();

    if (currentSession.revokedAt) {
      if (currentSession.revokeReason === 'ROTATED') {
        await this.sessions.revokeAllActiveForUser(
          currentSession.userId.toString(),
          'REUSE_DETECTED',
        );
      }
      throw invalidRefreshToken();
    }

    if (currentSession.expiresAt.getTime() <= Date.now()) {
      await this.sessions.revokeById(currentSession._id.toString(), 'LOGOUT');
      throw invalidRefreshToken();
    }

    const user = await this.users.findById(currentSession.userId.toString());
    if (!user || user.status !== 'ACTIVE') {
      await this.sessions.revokeAllActiveForUser(
        currentSession.userId.toString(),
        'ACCOUNT_DISABLED',
      );
      throw invalidRefreshToken();
    }

    const replacementRefreshToken = this.tokens.createRefreshToken();
    const replacement = await this.sessions.create({
      userId: user._id.toString(),
      refreshTokenHash: this.tokens.hashRefreshToken(replacementRefreshToken),
      expiresAt: this.tokens.refreshTokenExpiresAt(),
    });

    try {
      const accessToken = await this.tokens.signAccessToken({
        userId: user._id.toString(),
        role: user.role,
        sessionId: replacement._id.toString(),
      });
      const rotated = await this.sessions.rotateIfActive(
        currentSession._id.toString(),
        replacement._id.toString(),
      );

      if (!rotated) {
        await this.sessions.revokeById(replacement._id.toString(), 'REUSE_DETECTED');
        await this.sessions.revokeAllActiveForUser(user._id.toString(), 'REUSE_DETECTED');
        throw invalidRefreshToken();
      }

      return {
        accessToken,
        refreshToken: replacementRefreshToken,
        tokenType: 'Bearer',
        expiresIn: this.tokens.accessTokenExpiresInSeconds,
        user: this.users.toSafeUser(user),
      };
    } catch (error) {
      await this.sessions.revokeById(replacement._id.toString(), 'REUSE_DETECTED');
      throw error;
    }
  }

  public async logout(rawRefreshToken: string): Promise<void> {
    await this.sessions.revokeByRefreshTokenHash(
      this.tokens.hashRefreshToken(rawRefreshToken),
      'LOGOUT',
    );
  }

  public async authenticateAccessToken(token: string): Promise<AuthenticationContext> {
    const claims = await this.tokens.verifyAccessToken(token);
    const [session, user] = await Promise.all([
      this.sessions.findActiveById(claims.sessionId),
      this.users.findById(claims.userId),
    ]);

    if (
      !session ||
      !user ||
      user.status !== 'ACTIVE' ||
      session.userId.toString() !== user._id.toString() ||
      user.role !== claims.role
    ) {
      throw new Error('Access token is no longer authorized');
    }

    return claims;
  }

  public async me(context: AuthenticationContext): Promise<SafeUser> {
    const user = await this.users.findById(context.userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new AppError({
        statusCode: 401,
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required',
      });
    }
    return this.users.toSafeUser(user);
  }
}

export function createAuthService(configuration: TokenConfiguration): AuthService {
  return new AuthService(
    new UserService(),
    new SessionRepository(),
    new TokenService(configuration),
    new PasswordService(),
  );
}
