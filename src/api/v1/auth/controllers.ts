import { authRoutes } from "@/api/v1/auth/routes";
import { getSignedInRoute } from "@/api/v1/profile/controllers";
import { attempt, failure, unwrap, type Result } from "@/api/v1/result";
import type { AppRoute } from "@/constants/routes";

export const codeLength = 6;

export const passwordRules = [
  { label: "8 characters minimum", test: (value: string) => value.length >= 8 },
  { label: "1 lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { label: "1 uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { label: "1 number", test: (value: string) => /\d/.test(value) },
];

export function getEmailProblem(email: string) {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) return "Email address is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return "Enter a valid email address.";
  }
  return null;
}

export function getCodeProblem(code: string) {
  return code.length === codeLength && /^\d+$/.test(code)
    ? null
    : `Enter the ${codeLength}-digit code.`;
}

export function getPasswordProblem(password: string) {
  const failedRules = passwordRules.filter((rule) => !rule.test(password));
  if (failedRules.length === 0) return null;
  return `Password needs ${failedRules.map((rule) => rule.label.toLowerCase()).join(", ")}.`;
}

export async function login(
  email: string,
  password: string,
): Promise<Result<AppRoute>> {
  const normalizedEmail = email.trim();
  if (!normalizedEmail || !password) {
    return failure("Enter your email address and password.");
  }

  return attempt(async () => {
    const { user } = await unwrap(
      authRoutes.signInWithPassword(normalizedEmail, password),
    );
    if (!user) throw new Error("Sign in failed. Please try again.");
    return getSignedInRoute(user.id);
  });
}

export async function requestSignUpCode(email: string): Promise<Result> {
  const problem = getEmailProblem(email);
  if (problem) return failure(problem);
  return attempt(async () => {
    await unwrap(authRoutes.sendEmailOtp(email.trim()));
  });
}

export async function verifySignUpCode(
  email: string,
  code: string,
): Promise<Result> {
  const problem = getCodeProblem(code);
  if (problem) return failure(problem);
  return attempt(async () => {
    await unwrap(authRoutes.verifyEmailOtp(email.trim(), code));
  });
}

export async function completeSignUp(password: string): Promise<Result> {
  const problem = getPasswordProblem(password);
  if (problem) return failure(problem);
  return attempt(async () => {
    await unwrap(authRoutes.updatePassword(password));
    const { error } = await authRoutes.signOut();
    if (error) throw error;
  });
}

export async function logout(): Promise<Result> {
  return attempt(async () => {
    const { error } = await authRoutes.signOut();
    if (error) throw error;
  });
}
