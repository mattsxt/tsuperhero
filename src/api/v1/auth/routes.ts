import { getSupabaseClient } from "@/api/v1/client";

const auth = () => getSupabaseClient().auth;

export const authRoutes = {
  signInWithPassword: (email: string, password: string) =>
    auth().signInWithPassword({ email, password }),

  sendEmailOtp: (email: string) =>
    auth().signInWithOtp({ email, options: { shouldCreateUser: true } }),

  verifyEmailOtp: (email: string, token: string) =>
    auth().verifyOtp({ email, token, type: "email" }),

  updatePassword: (password: string) => auth().updateUser({ password }),

  updateEmail: (email: string) => auth().updateUser({ email }),

  signOut: () => auth().signOut(),

  getSession: () => auth().getSession(),
};
