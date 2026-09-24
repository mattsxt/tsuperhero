export type ProfileRow = {
  id: string;
  user_type: "commuter" | "transit_personnel";
  first_name: string;
  last_name: string;
  birthdate: string;
  gender: "male" | "female" | "prefer_not_to_say";
  contact_number: string;
};
