import { getSupabaseClient } from "@/api/v1/client";
import type { ProfileRow } from "@/api/v1/profile/types";

const profileTable = () => getSupabaseClient().from("profile");

export const profileRoutes = {
  findProfile: (userId: string) =>
    profileTable()
      .select("user_type, first_name")
      .eq("id", userId)
      .maybeSingle(),

  findProfileDetails: (userId: string) =>
    profileTable()
      .select("user_type, first_name, last_name, contact_number")
      .eq("id", userId)
      .maybeSingle(),

  upsertProfile: (profile: ProfileRow) => profileTable().upsert(profile),
};
