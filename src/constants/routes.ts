export const Routes = {
  landing: "/landing",
  login: "/auth/login",
  register: "/auth/register",
  setup: "/auth/setup",
  commuterHome: "/commuter/home",
  commuterPickup: "/commuter/pickup",
  commuterRental: "/commuter/rental",
  transitHome: "/explore",
  profile: "/profile",
} as const;

export type AppRoute = (typeof Routes)[keyof typeof Routes];
