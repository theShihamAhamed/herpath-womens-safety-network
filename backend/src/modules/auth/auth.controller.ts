import type { NextFunction, Request, Response } from 'express';

import { sendSuccess } from '../../common/utils/api-response.js';
import type { LoginInput, RegisterInput } from './auth.validation.js';
import type { AuthService } from './auth.service.js';

export class AuthController {
  public constructor(private readonly auth: AuthService) {}

  public anonymous = async (_request: Request, response: Response, next: NextFunction) => {
    try {
      sendSuccess(response, await this.auth.createAnonymous(), {}, 201);
    } catch (error) {
      next(error);
    }
  };

  public register = async (request: Request, response: Response, next: NextFunction) => {
    try {
      sendSuccess(response, await this.auth.register(request.body as RegisterInput), {}, 201);
    } catch (error) {
      next(error);
    }
  };

  public login = async (request: Request, response: Response, next: NextFunction) => {
    try {
      sendSuccess(response, await this.auth.login(request.body as LoginInput));
    } catch (error) {
      next(error);
    }
  };

  public refresh = async (request: Request, response: Response, next: NextFunction) => {
    try {
      sendSuccess(response, await this.auth.refresh(String(request.body.refreshToken)));
    } catch (error) {
      next(error);
    }
  };

  public logout = async (request: Request, response: Response, next: NextFunction) => {
    try {
      await this.auth.logout(String(request.body.refreshToken));
      sendSuccess(response, { loggedOut: true });
    } catch (error) {
      next(error);
    }
  };

  public me = async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.auth) throw new Error('Authentication context is missing');
      sendSuccess(response, { user: await this.auth.me(request.auth) });
    } catch (error) {
      next(error);
    }
  };
}
