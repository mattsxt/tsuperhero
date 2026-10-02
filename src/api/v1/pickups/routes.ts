import { getSupabaseClient } from "@/api/v1/client";

const table = (name: string) => getSupabaseClient().from(name);

export const pickupRoutes = {
  findCommuter: (userId: string) =>
    table("commuters")
      .select("commuter_id")
      .eq("user_id", userId)
      .maybeSingle(),

  createUser: (userId: string, email: string) =>
    table("users").upsert(
      { user_id: userId, user_email: email, user_type: "Passenger" },
      { onConflict: "user_id", ignoreDuplicates: true },
    ),

  createCommuter: (userId: string) =>
    table("commuters")
      .insert({ user_id: userId })
      .select("commuter_id")
      .single(),

  findActiveRequest: (commuterId: string) =>
    table("requests")
      .select(
        "request_id, request_status, device_latitude, device_longitude, pickups(pickup_id, pickup_destination, number_of_passengers)",
      )
      .eq("commuter_id", commuterId)
      .eq("request_type", "Pickup")
      .in("request_status", ["pending", "accepted"])
      .order("request_date", { ascending: false })
      .limit(1)
      .maybeSingle(),

  createRequest: (commuterId: string, lat: number, lng: number) =>
    table("requests")
      .insert({
        commuter_id: commuterId,
        request_type: "Pickup",
        device_latitude: lat,
        device_longitude: lng,
      })
      .select("request_id, request_status")
      .single(),

  createPickup: (requestId: string, destination: string, passengers: number) =>
    table("pickups").insert({
      request_id: requestId,
      pickup_destination: destination,
      pickup_date: new Date().toISOString(),
      number_of_passengers: passengers,
    }),

  deletePickup: (requestId: string) =>
    table("pickups").delete().eq("request_id", requestId),

  deleteRequest: (requestId: string) =>
    table("requests").delete().eq("request_id", requestId),
};
