const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSignIn(input: { email: string; password: string }): string | null {
  if (!EMAIL_PATTERN.test(input.email.trim())) return 'Enter a valid email address.';
  if (input.password.length < 4 || input.password.length > 128) {
    return 'Password must contain 4 to 128 characters.';
  }
  return null;
}

export function validateSignUp(input: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}): string | null {
  const nameLength = input.name.trim().length;
  if (nameLength < 2 || nameLength > 100) return 'Name must contain 2 to 100 characters.';

  const signInError = validateSignIn(input);
  if (signInError) return signInError;
  if (input.password !== input.confirmPassword) return 'Passwords do not match.';
  return null;
}
