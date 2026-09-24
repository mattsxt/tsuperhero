import { authRoutes } from "@/api/v1/auth/routes";
import { profileRoutes } from "@/api/v1/profile/routes";
import type { ProfileRow } from "@/api/v1/profile/types";
import { attempt, failure, unwrap, type Result } from "@/api/v1/result";
import { Routes, type AppRoute } from "@/constants/routes";

export type UserType = ProfileRow["user_type"];
export type Gender = ProfileRow["gender"];

export const genderOptions: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

export async function getSignedInRoute(userId: string) {
  const profile = await unwrap(profileRoutes.findProfileId(userId));
  return profile ? Routes.home : Routes.setup;
}

export async function checkSetupAccess(): Promise<
  { userId: string } | { redirect: AppRoute }
> {
  try {
    const { session } = await unwrap(authRoutes.getSession());
    if (!session) return { redirect: Routes.login };

    const route = await getSignedInRoute(session.user.id);
    if (route !== Routes.setup) return { redirect: route };

    return { userId: session.user.id };
  } catch {
    return { redirect: Routes.login };
  }
}

export function getNameProblem(value: string) {
  if (/[^A-Za-zÀ-ÖØ-öø-ÿ -]/.test(value)) {
    return "Only letters, spaces and hyphens are allowed.";
  }
  if (/^[ -]/.test(value)) {
    return "Names can't start with a space or hyphen.";
  }
  if (/[ -]{2}/.test(value)) {
    return "Spaces and hyphens can't be next to each other.";
  }
  return null;
}

export const contactLength = 10;
export const contactLengthMessage = `Contact number is limited to ${contactLength} digits.`;

export function getContactProblem(value: string) {
  if (/\D/.test(value)) return "Only numbers are allowed.";
  if (value.length > contactLength) return contactLengthMessage;
  return null;
}

function finalizeName(value: string) {
  return value.replace(/[ -]+$/, "");
}

const pad = (value: number) => String(value).padStart(2, "0");

export function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export type ProfileForm = {
  userType: UserType | null;
  firstName: string;
  lastName: string;
  birthdate: Date | null;
  gender: Gender | null;
  contact: string;
};

export type ProfileFormField =
  | "firstName"
  | "lastName"
  | "birthdate"
  | "gender"
  | "contact";

export type ProfileFormErrors = Partial<Record<ProfileFormField, string>>;

export async function submitProfile(
  userId: string,
  form: ProfileForm,
): Promise<Result<void> & { fieldErrors?: ProfileFormErrors }> {
  const firstName = finalizeName(form.firstName);
  const lastName = finalizeName(form.lastName);

  const fieldErrors: ProfileFormErrors = {};
  if (!firstName) fieldErrors.firstName = "First name is required.";
  if (!lastName) fieldErrors.lastName = "Last name is required.";
  if (!form.birthdate) fieldErrors.birthdate = "Select your birthdate.";
  if (!form.gender) fieldErrors.gender = "Select a gender.";
  if (form.contact.length !== contactLength) {
    fieldErrors.contact = `Enter ${contactLength} digits.`;
  }

  if (
    Object.keys(fieldErrors).length > 0 ||
    !form.userType ||
    !form.birthdate ||
    !form.gender
  ) {
    return { ...failure("Please complete the form."), fieldErrors };
  }

  const { userType, birthdate, gender, contact } = form;
  return attempt(async () => {
    await unwrap(
      profileRoutes.upsertProfile({
        id: userId,
        user_type: userType,
        first_name: firstName,
        last_name: lastName,
        birthdate: toIsoDate(birthdate),
        gender,
        contact_number: `+63${contact}`,
      }),
    );
  });
}
