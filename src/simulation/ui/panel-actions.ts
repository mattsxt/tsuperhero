export type PanelAction =
  | "arriveNow"
  | "sendPickupRequest"
  | "acceptMyRental"
  | "postRentalRequest"
  | "completeAcceptedRental"
  | "generateNotification"
  | "generateRideAsHost"
  | "generateRideAsCompanion"
  | "generateRatings";

export function actionsFor(
  pathname: string,
  role: "commuter" | "driver",
  tripActive: boolean,
): PanelAction[] {
  if (pathname === "/commuter/rental" && role === "commuter") return ["acceptMyRental"];
  if (pathname === "/transit/start-trip" && role === "driver")
    return tripActive ? ["sendPickupRequest", "arriveNow"] : ["sendPickupRequest"];
  if (pathname === "/transit/rental-requests" && role === "driver")
    return ["postRentalRequest", "completeAcceptedRental"];
  if (pathname === "/notifications") return ["generateNotification"];
  return [];
}
