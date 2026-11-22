export type MobileUserType = "commuter" | "transit_personnel";

export type ProfileRow = {
  profile_id: string;
  user_id: string;
  user_type: MobileUserType | "admin";
  first_name: string;
  last_name: string;
  birth_date: string;
  contact_number: string;
  profile_picture: string | null;
};

export type ProfileChanges = Partial<
  Pick<ProfileRow, "birth_date" | "contact_number" | "profile_picture">
>;
