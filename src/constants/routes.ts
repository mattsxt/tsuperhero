export const Routes = {
  landing: "/landing",
  login: "/auth/login",
  register: "/auth/register",
  setup: "/auth/setup",
  commuterHome: "/commuter/home",
  commuterPickup: "/commuter/pickup",
  commuterRental: "/commuter/rental",
  commuterRoutes: "/commuter/routes",
  transitHome: "/transit/home",
  notifications: "/notifications",
  profile: "/profile",
  profileEdit: "/profile/edit",
  profileSecurity: "/profile/security",
} as const;

export type AppRoute = (typeof Routes)[keyof typeof Routes];
