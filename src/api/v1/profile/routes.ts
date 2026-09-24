import { getSupabaseClient } from "@/api/v1/client";
import type { ProfileRow } from "@/api/v1/profile/types";

const profiles = () => getSupabaseClient().from("profiles");

export const profileRoutes = {
  findProfileId: (userId: string) =>
    profiles().select("id").eq("id", userId).maybeSingle(),

  upsertProfile: (profile: ProfileRow) => profiles().upsert(profile),
};
