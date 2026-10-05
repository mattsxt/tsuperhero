import { getSupabaseClient } from "@/api/v1/client";
import type { ProfileChanges, ProfileRow } from "@/api/v1/profile/types";

const profileTable = () => getSupabaseClient().from("profile");
const pictureBucket = () =>
  getSupabaseClient().storage.from("profile-pictures");

export const profileRoutes = {
  findProfile: (userId: string) =>
    profileTable()
      .select("user_type, first_name")
      .eq("user_id", userId)
      .maybeSingle(),

  findProfileDetails: (userId: string) =>
    profileTable()
      .select(
        "user_type, first_name, last_name, birth_date, contact_number, profile_picture",
      )
      .eq("user_id", userId)
      .maybeSingle(),

  upsertProfile: (
    profile: Omit<ProfileRow, "profile_id" | "profile_picture">,
  ) =>
    profileTable().upsert(profile, { onConflict: "user_id" }),

  updateProfile: (userId: string, changes: ProfileChanges) =>
    profileTable().update(changes).eq("user_id", userId),

  uploadPicture: (path: string, body: ArrayBuffer, contentType: string) =>
    pictureBucket().upload(path, body, { contentType }),

  removePicture: (path: string) => pictureBucket().remove([path]),

  getPictureUrl: (path: string) =>
    pictureBucket().getPublicUrl(path).data.publicUrl,
};
