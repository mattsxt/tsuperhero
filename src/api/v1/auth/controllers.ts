import { authRoutes } from "@/api/v1/auth/routes";
import {
  getCodeProblem,
  getEmailProblem,
  getPasswordProblem,
} from "@/api/v1/auth/validation";
import { getErrorMessage } from "@/api/v1/client";
import { signedOutOrOffline } from "@/api/v1/session-route";
import { forgetPushToken } from "@/api/v1/notifications/controllers";
<<<<<<< HEAD
=======
import { cancelActivePickupBeforeSignOut } from "@/api/v1/pickups/controllers";
>>>>>>> origin/mapbox
import {
  getSignedInRoute,
  unsupportedAccountMessage,
} from "@/api/v1/profile/controllers";
import {
  attempt,
  failure,
  success,
  unwrap,
  type Result,
} from "@/api/v1/result";
import { Routes, type AppRoute } from "@/constants/routes";
<<<<<<< HEAD
=======
import { checkOnline } from "@/hooks/use-online";
>>>>>>> origin/mapbox

export {
  codeLength,
  getEmailProblem,
  getPasswordProblem,
} from "@/api/v1/auth/validation";

export async function getStartupRoute(): Promise<AppRoute> {
  try {
    const { session } = await unwrap(authRoutes.getSession());
    if (!session) return Routes.login;
    return (await getSignedInRoute(session.user.id)) ?? Routes.login;
  } catch (error) {
    return signedOutOrOffline(error);
  }
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
    const route = await getSignedInRoute(user.id);
    if (!route) throw new Error(unsupportedAccountMessage);
    return route;
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
<<<<<<< HEAD
  return attempt(async () => {
    await unwrap(authRoutes.updatePassword(password));
=======
  if (!(await checkOnline())) {
    return failure("Connect to the internet to finish creating your account.");
  }
  return attempt(async () => {
    await unwrap(authRoutes.updatePassword(password));
    const cancellation = await cancelActivePickupBeforeSignOut();
    if (!cancellation.ok) throw new Error(cancellation.error);
>>>>>>> origin/mapbox
    await forgetPushToken();
    const { error } = await authRoutes.signOut();
    if (error) throw error;
  });
}

export async function logout(): Promise<Result> {
<<<<<<< HEAD
  return attempt(async () => {
=======
  if (!(await checkOnline())) {
    return failure("Connect to the internet before signing out.");
  }
  return attempt(async () => {
    const cancellation = await cancelActivePickupBeforeSignOut();
    if (!cancellation.ok) throw new Error(cancellation.error);
>>>>>>> origin/mapbox
    await forgetPushToken();
    const { error } = await authRoutes.signOut();
    if (error) throw error;
  });
}

export type PasswordForm = { current: string; next: string; confirm: string };
export type PasswordFormField = keyof PasswordForm;
export type PasswordFormErrors = Partial<Record<PasswordFormField, string>>;

export async function changePassword(
  form: PasswordForm,
): Promise<Result & { fieldErrors?: PasswordFormErrors }> {
<<<<<<< HEAD
=======
  if (!(await checkOnline())) {
    return failure("Connect to the internet to change your password.");
  }
>>>>>>> origin/mapbox
  const fieldErrors: PasswordFormErrors = {};
  if (!form.current) fieldErrors.current = "Enter your current password.";
  const problem = getPasswordProblem(form.next);
  if (problem) fieldErrors.next = problem;
  else if (form.next === form.current) {
    fieldErrors.next = "New password must be different from your current one.";
  }
  if (form.confirm !== form.next)
    fieldErrors.confirm = "Passwords don't match.";

  if (Object.keys(fieldErrors).length > 0) {
    return { ...failure("Please check the form."), fieldErrors };
  }

  try {
    const { session } = await unwrap(authRoutes.getSession());
    const email = session?.user.email;
    if (!email) return failure("Your session has expired. Sign in again.");

    const { error } = await authRoutes.signInWithPassword(email, form.current);
    if (error?.code === "invalid_credentials") {
      const message = "Current password is incorrect.";
      return { ...failure(message), fieldErrors: { current: message } };
    }
    if (error) throw error;

    await unwrap(authRoutes.updatePassword(form.next));
    return success(undefined);
  } catch (error) {
    return failure(getErrorMessage(error));
  }
}
