import type { AuthenticationContext } from './auth.js';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticationContext;
    }
  }
}

export {};
