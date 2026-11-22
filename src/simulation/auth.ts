import { db } from "@/simulation/db";

export type MockUser = { id: string; email: string };
export type MockSession = {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  expires_in: number;
  expires_at: number;
  user: MockUser;
};
type AuthEvent = "SIGNED_IN" | "SIGNED_OUT" | "USER_UPDATED";
type AuthListener = (event: AuthEvent, session: MockSession | null) => void;
type AuthError = { message: string; code: string };

export const DEMO_PASSWORD = "demo1234";
const DEMO_CODE = "123456";

let session: MockSession | null = null;
const listeners = new Set<AuthListener>();
const passwords = new Map<string, string>();

const buildSession = (id: string, email: string): MockSession => ({
  access_token: `sim-${id}`,
  refresh_token: `sim-refresh-${id}`,
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id, email },
});

const notify = (event: AuthEvent) => {
  const current = session;
  for (const fn of [...listeners]) fn(event, current);
};

const findUser = (email: string) =>
  db.tables.user.find(
    (u) => String(u.user_email).toLowerCase() === email.trim().toLowerCase(),
  );

export const currentUserId = (): string | null => session?.user.id ?? null;

export const getSessionValue = (): MockSession | null => session;

export const signInAs = (id: string, email: string): MockSession => {
  session = buildSession(id, email);
  notify("SIGNED_IN");
  return session;
};

export const signInWithPassword = (
  email: string,
  password: string,
): { session: MockSession } | { error: AuthError } => {
  const user = findUser(email);
  const expected = user
    ? (passwords.get(String(user.user_id)) ?? DEMO_PASSWORD)
    : null;
  if (!user || password !== expected) {
    return {
      error: { message: "Invalid login credentials", code: "invalid_credentials" },
    };
  }
  return { session: signInAs(String(user.user_id), String(user.user_email)) };
};

export const verifyCode = (
  email: string,
  token: string,
): { session: MockSession } | { error: AuthError } => {
  if (token !== DEMO_CODE) {
    return {
      error: { message: "Token has expired or is invalid", code: "otp_expired" },
    };
  }
  let user = findUser(email);
  if (!user) {
    user = {
      user_id: db.id(),
      user_email: email.trim(),
      user_type: "commuter",
    };
    db.tables.user.push(user);
    db.emit({ table: "user", type: "INSERT", row: user });
  }
  return { session: signInAs(String(user.user_id), String(user.user_email)) };
};

export const updateCurrentUser = (attrs: {
  password?: string;
  email?: string;
}): { user: MockUser } | { error: AuthError } => {
  if (!session) {
    return {
      error: { message: "Auth session missing!", code: "session_not_found" },
    };
  }
  const user = db.tables.user.find((u) => u.user_id === session!.user.id);
  if (attrs.password) passwords.set(session.user.id, attrs.password);
  if (attrs.email && user) {
    user.user_email = attrs.email;
    session = { ...session, user: { ...session.user, email: attrs.email } };
  }
  notify("USER_UPDATED");
  return { user: session.user };
};

export const signOutAll = (): void => {
  if (!session) return;
  session = null;
  notify("SIGNED_OUT");
};

export const resetPasswords = (): void => {
  passwords.clear();
};

export const onAuthChange = (fn: AuthListener): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
