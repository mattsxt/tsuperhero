export const Routes = {
  landing: "/landing",
  login: "/auth/login",
  register: "/auth/register",
  setup: "/auth/setup",
  home: "/explore",
} as const;

export type AppRoute = (typeof Routes)[keyof typeof Routes];
