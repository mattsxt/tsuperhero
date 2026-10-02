import { getSupabaseClient } from "@/api/v1/client";
import type { ProfileChanges, ProfileRow } from "@/api/v1/profile/types";

const profileTable = () => getSupabaseClient().from("profile");
const pictureBucket = () =>
  getSupabaseClient().storage.from("profile-pictures");

export const profileRoutes = {
  findProfile: (userId: string) =>
    profileTable()
      .select("user_type, first_name")
      .eq("id", userId)
      .maybeSingle(),

  findProfileDetails: (userId: string) =>
    profileTable()
      .select(
        "user_type, first_name, last_name, birth_date, contact_number, profile_picture",
      )
      .eq("id", userId)
      .maybeSingle(),

  upsertProfile: (profile: Omit<ProfileRow, "profile_picture">) =>
    profileTable().upsert(profile),

  updateProfile: (userId: string, changes: ProfileChanges) =>
    profileTable().update(changes).eq("id", userId),

  uploadPicture: (path: string, body: ArrayBuffer, contentType: string) =>
    pictureBucket().upload(path, body, { contentType }),

  removePicture: (path: string) => pictureBucket().remove([path]),

  getPictureUrl: (path: string) =>
    pictureBucket().getPublicUrl(path).data.publicUrl,
};
