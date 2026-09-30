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
  transitStartTrip: "/transit/start-trip",
  transitRentalRequests: "/transit/rental-requests",
  transitTripHistory: "/transit/trip-history",
  notifications: "/notifications",
  profile: "/profile",
  profileEdit: "/profile/edit",
  profileSecurity: "/profile/security",
  profileVehicles: "/profile/vehicles",
} as const;

export type AppRoute = (typeof Routes)[keyof typeof Routes];
