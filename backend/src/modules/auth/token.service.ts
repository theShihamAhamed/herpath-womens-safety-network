import { createHash, randomBytes } from 'node:crypto';

import { jwtVerify, SignJWT } from 'jose';

import { USER_ROLES, type UserRole } from '../users/user.types.js';

export interface TokenConfiguration {
  accessTokenSecret: string;
  accessTokenTtl: string;
  refreshTokenTtlDays: number;
  jwtIssuer: string;
  jwtAudience: string;
}

export interface VerifiedAccessToken {
  userId: string;
  sessionId: string;
  role: UserRole;
}

function durationToSeconds(duration: string): number {
  const match = duration.match(/^(\d+)([smh])$/);
  if (!match?.[1] || !match[2]) throw new Error('Invalid access-token duration');
  const value = Number(match[1]);
  return value * ({ s: 1, m: 60, h: 3_600 }[match[2]] ?? 0);
}

export class TokenService {
  private readonly secret: Uint8Array;

  public readonly accessTokenExpiresInSeconds: number;

  public constructor(private readonly configuration: TokenConfiguration) {
    this.secret = new TextEncoder().encode(configuration.accessTokenSecret);
    this.accessTokenExpiresInSeconds = durationToSeconds(configuration.accessTokenTtl);
  }

  public async signAccessToken(input: VerifiedAccessToken): Promise<string> {
    return new SignJWT({ role: input.role, sid: input.sessionId })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(input.userId)
      .setIssuer(this.configuration.jwtIssuer)
      .setAudience(this.configuration.jwtAudience)
      .setIssuedAt()
      .setExpirationTime(this.configuration.accessTokenTtl)
      .sign(this.secret);
  }

  public async verifyAccessToken(token: string): Promise<VerifiedAccessToken> {
    const { payload } = await jwtVerify(token, this.secret, {
      algorithms: ['HS256'],
      issuer: this.configuration.jwtIssuer,
      audience: this.configuration.jwtAudience,
    });

    if (
      typeof payload.sub !== 'string' ||
      typeof payload.sid !== 'string' ||
      typeof payload.role !== 'string' ||
      !USER_ROLES.includes(payload.role as UserRole)
    ) {
      throw new Error('Invalid access-token claims');
    }

    return { userId: payload.sub, sessionId: payload.sid, role: payload.role as UserRole };
  }

  public createRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  public hashRefreshToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  public refreshTokenExpiresAt(now = new Date()): Date {
    return new Date(now.getTime() + this.configuration.refreshTokenTtlDays * 86_400_000);
  }
}
