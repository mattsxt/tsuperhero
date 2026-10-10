import { getSupabaseClient } from "@/api/v1/client";

const userTable = () => getSupabaseClient().from("user");
const commuterTable = () => getSupabaseClient().from("commuter");
const requestTable = () => getSupabaseClient().from("request");
const pickupTable = () => getSupabaseClient().from("pickup");

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
        "request_id, request_status, device_latitude, device_longitude, pickup(pickup_id, pickup_destination, number_of_passengers, requested_vehicle_type)",
      )
      .eq("commuter_id", commuterId)
      .eq("request_type", "Pickup")
      .in("request_status", ["pending", "accepted"])
      .order("request_date", { ascending: false })
      .limit(1)
      .maybeSingle(),

  createRequest: (commuterId: string, lat: number, lng: number) =>
    requestTable()
      .insert({
        commuter_id: commuterId,
        request_type: "Pickup",
        device_latitude: lat,
        device_longitude: lng,
      })
      .select("request_id, request_status")
      .single(),

  createPickup: (
    requestId: string,
    destination: string,
    passengers: number,
    requestedVehicleType: "Jeepney" | "Tricycle",
  ) =>
    pickupTable().insert({
      request_id: requestId,
      pickup_destination: destination,
      pickup_date: new Date().toISOString(),
      number_of_passengers: passengers,
      requested_vehicle_type: requestedVehicleType,
    }),

  deletePickup: (requestId: string) =>
    pickupTable().delete().eq("request_id", requestId),

  deleteRequest: (requestId: string) =>
    requestTable().delete().eq("request_id", requestId),

  findMyDriver: () => getSupabaseClient().rpc("get_my_pickup_driver"),

  findMyBookings: () => getSupabaseClient().rpc("get_my_bookings"),

  findMyTripHistory: () => getSupabaseClient().rpc("get_my_trip_history"),

  searchCommuters: (query: string) =>
    getSupabaseClient().rpc("search_commuters", { p_query: query }),

  addCompanions: (requestId: string, userIds: string[]) =>
    getSupabaseClient().rpc("add_pickup_companions", {
      p_request_id: requestId,
      p_user_ids: userIds,
    }),

  findShareInvites: () => getSupabaseClient().rpc("get_my_share_invites"),

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
