import { getSupabaseClient } from "@/api/v1/client";

const userTable = () => getSupabaseClient().from("user");
const commuterTable = () => getSupabaseClient().from("commuter");
const requestTable = () => getSupabaseClient().from("request");

export const pickupRoutes = {
  findCommuter: (userId: string) =>
    commuterTable().select("commuter_id").eq("user_id", userId).maybeSingle(),

  createUser: (userId: string, email: string) =>
    userTable().upsert(
      { user_id: userId, user_email: email, user_type: "commuter" },
      { onConflict: "user_id", ignoreDuplicates: true },
    ),

  createCommuter: (userId: string) =>
    commuterTable().insert({ user_id: userId }).select("commuter_id").single(),

  findActiveRequest: (commuterId: string) =>
    requestTable()
      .select(
        "*, pickup(pickup_id, pickup_destination, number_of_passengers, requested_vehicle_type)",
      )
      .eq("commuter_id", commuterId)
      .eq("request_type", "Pickup")
      .eq("is_draft", false)
      .in("request_status", ["pending", "accepted"])
      .order("request_date", { ascending: false })
      .limit(1)
      .maybeSingle(),

  savePickupDraft: (
    requestId: string | null,
    latitude: number,
    longitude: number,
    destination: string,
    passengers: number,
    vehicleType: "Jeepney" | "Tricycle",
  ) =>
    getSupabaseClient().rpc("save_pickup_draft", {
      p_request_id: requestId,
      p_latitude: latitude,
      p_longitude: longitude,
      p_destination: destination,
      p_passengers: passengers,
      p_vehicle_type: vehicleType,
    }),

  findMyPickupDraft: () => getSupabaseClient().rpc("get_my_pickup_draft"),

  findPickupCompanionStatuses: (requestId: string) =>
    getSupabaseClient().rpc("get_pickup_companion_statuses", {
      p_request_id: requestId,
    }),

  publishPickupDraft: (requestId: string) =>
    getSupabaseClient().rpc("publish_pickup_draft", {
      p_request_id: requestId,
    }),

  removePickupCompanion: (requestId: string, userId: string) =>
    getSupabaseClient().rpc("remove_pickup_companion", {
      p_request_id: requestId,
      p_user_id: userId,
    }),

  deleteRequest: (requestId: string) =>
    requestTable().delete().eq("request_id", requestId),

  findMyDriver: () => getSupabaseClient().rpc("get_my_pickup_driver"),

  findMyBookings: () => getSupabaseClient().rpc("get_my_bookings"),

  findMyTripHistory: () => getSupabaseClient().rpc("get_my_trip_history"),

  searchCommuters: (query: string) =>
    getSupabaseClient().rpc("search_available_commuters", { p_query: query }),

  addCompanions: (requestId: string, userIds: string[]) =>
    getSupabaseClient().rpc("add_pickup_companions", {
      p_request_id: requestId,
      p_user_ids: userIds,
    }),

  addCompanion: (requestId: string, userId: string) =>
    getSupabaseClient().rpc("add_pickup_companions", {
      p_request_id: requestId,
      p_user_ids: [userId],
    }),

  findShareInvites: () => getSupabaseClient().rpc("get_my_share_invites"),

  markPickupArrived: (requestId: string, latitude: number, longitude: number) =>
    getSupabaseClient().rpc("mark_pickup_arrived", {
      p_request_id: requestId,
      p_latitude: latitude,
      p_longitude: longitude,
    }),

  markPickupAway: (requestId: string, latitude: number, longitude: number) =>
    getSupabaseClient().rpc("mark_pickup_away", {
      p_request_id: requestId,
      p_latitude: latitude,
      p_longitude: longitude,
    }),

  updateCompanionPresence: (
    requestId: string,
    latitude: number,
    longitude: number,
  ) =>
    getSupabaseClient().rpc("update_companion_presence", {
      p_request_id: requestId,
      p_latitude: latitude,
      p_longitude: longitude,
    }),

  findMySharedRide: () => getSupabaseClient().rpc("get_my_shared_ride"),

  leaveSharedRide: (requestId: string) =>
    getSupabaseClient().rpc("leave_shared_ride", { p_request_id: requestId }),

  respondToShareInvite: (requestId: string, accept: boolean) =>
    getSupabaseClient().rpc("respond_to_share_invite", {
      p_request_id: requestId,
      p_accept: accept,
    }),

  findRequestStatus: (requestId: string) =>
    requestTable()
      .select("request_status")
      .eq("request_id", requestId)
      .maybeSingle(),
};
