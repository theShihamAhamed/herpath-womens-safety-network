import { z } from 'zod';

const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const password = z.string().min(4).max(128);
const refreshToken = z.string().min(64).max(256);

export const anonymousBodySchema = z.preprocess(
  (body) => (body === undefined ? {} : body),
  z.object({}).strict(),
);

export const registerBodySchema = z
  .object({
    name: z.string().trim().min(2).max(100).transform((value) => value.replace(/\s+/g, ' ')),
    email,
    password,
  })
  .strict();

export const loginBodySchema = z.object({ email, password }).strict();
export const refreshBodySchema = z.object({ refreshToken }).strict();
export const logoutBodySchema = refreshBodySchema;

export type RegisterInput = z.infer<typeof registerBodySchema>;
export type LoginInput = z.infer<typeof loginBodySchema>;
