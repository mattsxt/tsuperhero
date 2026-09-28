export type ProfileRow = {
  id: string;
  user_type: "commuter" | "transit_personnel";
  first_name: string;
  last_name: string;
  birth_date: string;
  gender: "male" | "female" | "prefer_not_to_say";
  contact_number: string;
  profile_picture: string | null;
};

export type ProfileChanges = Partial<
  Pick<ProfileRow, "birth_date" | "contact_number" | "profile_picture">
>;
