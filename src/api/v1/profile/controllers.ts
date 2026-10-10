import { authRoutes } from "@/api/v1/auth/routes";
import { getEmailProblem } from "@/api/v1/auth/validation";
import { profileRoutes } from "@/api/v1/profile/routes";
import type {
  MobileUserType,
  ProfileChanges,
  ProfileRow,
} from "@/api/v1/profile/types";
import { unwrapCached } from "@/api/v1/cache";
import { attempt, failure, unwrap, type Result } from "@/api/v1/result";
import { signedOutOrOffline } from "@/api/v1/session-route";
import { Routes, type AppRoute } from "@/constants/routes";
import { checkOnline } from "@/hooks/use-online";

export type UserType = MobileUserType;

const mobileUserTypes: readonly string[] = [
  "commuter",
  "transit_personnel",
] satisfies UserType[];

export const unsupportedAccountMessage =
  "Only commuter and transit personnel accounts can sign in to the app.";

function isMobileUserType(userType: string): userType is UserType {
  return mobileUserTypes.includes(userType);
}

function getHomeRoute(userType: UserType) {
  return userType === "commuter" ? Routes.commuterHome : Routes.transitHome;
}

let signedInProfile: {
  userId: string;
  profile: Pick<ProfileRow, "user_type" | "first_name"> | null;
} | null = null;

export function peekHomeName(userType: UserType): string | null {
  const profile = signedInProfile?.profile;
  return profile?.user_type === userType ? profile.first_name : null;
}

export function peekSetupUserId(): string | null {
  return signedInProfile && !signedInProfile.profile
    ? signedInProfile.userId
    : null;
}

export async function getSignedInRoute(
  userId: string,
): Promise<AppRoute | null> {
  if (signedInProfileSummary?.userId !== userId) {
    signedInProfileSummary = null;
  }
  const profile = await unwrapCached(
    `profile:${userId}`,
    profileRoutes.findProfile(userId),
  );
  signedInProfile = { userId, profile };
  if (!profile) return Routes.setup;
  if (!isMobileUserType(profile.user_type)) {
    await authRoutes.signOut();
    return null;
  }
  return getHomeRoute(profile.user_type);
}

export async function loadHome(
  userType: UserType,
): Promise<{ firstName: string } | { redirect: AppRoute }> {
  try {
    const { session } = await unwrap(authRoutes.getSession());
    if (!session) return { redirect: Routes.login };

    const profile = await unwrapCached(
      `profile:${session.user.id}`,
      profileRoutes.findProfile(session.user.id),
    );
    if (!profile) return { redirect: Routes.setup };
    if (!isMobileUserType(profile.user_type)) {
      await authRoutes.signOut();
      return { redirect: Routes.login };
    }
    if (profile.user_type !== userType) {
      return { redirect: getHomeRoute(profile.user_type) };
    }

    return { firstName: profile.first_name };
  } catch (error) {
    return { redirect: signedOutOrOffline(error) };
  }
}

export async function checkSetupAccess(): Promise<
  { userId: string } | { redirect: AppRoute }
> {
  try {
    const { session } = await unwrap(authRoutes.getSession());
    if (!session) return { redirect: Routes.login };

    const route = await getSignedInRoute(session.user.id);
    if (route !== Routes.setup) return { redirect: route ?? Routes.login };

    return { userId: session.user.id };
  } catch (error) {
    return { redirect: signedOutOrOffline(error) };
  }
}

export async function loadHomeRoute(): Promise<
  { homeRoute: AppRoute } | { redirect: AppRoute }
> {
  try {
    const { session } = await unwrap(authRoutes.getSession());
    if (!session) return { redirect: Routes.login };

    const route = await getSignedInRoute(session.user.id);
    if (!route) return { redirect: Routes.login };
    if (route === Routes.setup) return { redirect: route };

    return { homeRoute: route };
  } catch (error) {
    return { redirect: signedOutOrOffline(error) };
  }
}

export type ProfileSummary = {
  fullName: string;
  initials: string;
  email: string;
  contactNumber: string;
  pictureUrl: string | null;
  userType: UserType;
  userTypeLabel: string;
  homeRoute: AppRoute;
};

let signedInProfileSummary: { userId: string; summary: ProfileSummary } | null =
  null;

export function peekProfileSummary(): ProfileSummary | null {
  return signedInProfileSummary?.userId === signedInProfile?.userId
    ? signedInProfileSummary.summary
    : null;
}

export function peekSignedInHomeRoute(): AppRoute | null {
  const userType = signedInProfile?.profile?.user_type;
  return userType && isMobileUserType(userType) ? getHomeRoute(userType) : null;
}

const userTypeLabels: Record<UserType, string> = {
  commuter: "COMMUTER",
  transit_personnel: "TRANSIT PERSONNEL",
};

function getInitials(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase())
    .slice(0, 3)
    .join("");
}

function formatContactNumber(value: string) {
  const match = /^\+63(\d{3})(\d{3})(\d{4})$/.exec(value);
  return match ? `+63 ${match[1]} ${match[2]} ${match[3]}` : value;
}

function getPictureUrl(path: string | null) {
  return path ? profileRoutes.getPictureUrl(path) : null;
}

type ProfileDetails = Omit<
  ProfileRow,
  "profile_id" | "user_id" | "user_type"
> & {
  user_type: UserType;
};

async function loadSignedInProfile(): Promise<
  | {
      user: NonNullable<
        Awaited<ReturnType<typeof authRoutes.getSession>>["data"]["session"]
      >["user"];
      profile: ProfileDetails;
    }
  | { redirect: AppRoute }
> {
  const { session } = await unwrap(authRoutes.getSession());
  if (!session) return { redirect: Routes.login };

  const profile = await unwrapCached(
    `profile-details:${session.user.id}`,
    profileRoutes.findProfileDetails(session.user.id),
  );
  if (!profile) return { redirect: Routes.setup };
  const { user_type: userType } = profile;
  if (signedInProfileSummary?.userId !== session.user.id) {
    signedInProfileSummary = null;
  }
  signedInProfile = {
    userId: session.user.id,
    profile: { user_type: userType, first_name: profile.first_name },
  };
  if (!isMobileUserType(userType)) {
    await authRoutes.signOut();
    return { redirect: Routes.login };
  }

  return { user: session.user, profile: { ...profile, user_type: userType } };
}

export async function loadProfileSummary(): Promise<
  ProfileSummary | { redirect: AppRoute }
> {
  try {
    const result = await loadSignedInProfile();
    if ("redirect" in result) return result;
    const { user, profile } = result;

    const summary: ProfileSummary = {
      fullName: `${profile.first_name} ${profile.last_name}`,
      initials: getInitials(profile.first_name, profile.last_name),
      email: user.email ?? "",
      contactNumber: formatContactNumber(profile.contact_number),
      pictureUrl: getPictureUrl(profile.profile_picture),
      userType: profile.user_type,
      userTypeLabel: userTypeLabels[profile.user_type],
      homeRoute: getHomeRoute(profile.user_type),
    };
    signedInProfileSummary = { userId: user.id, summary };
    return summary;
  } catch (error) {
    return { redirect: signedOutOrOffline(error) };
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

type ProfileForm = {
  firstName: string;
  lastName: string;
  birthdate: Date | null;
  contact: string;
};

export type ProfileFormField =
  "firstName" | "lastName" | "birthdate" | "contact";

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
  if (form.contact.length !== contactLength) {
    fieldErrors.contact = `Enter ${contactLength} digits.`;
  }

  if (Object.keys(fieldErrors).length > 0 || !form.birthdate) {
    return { ...failure("Please complete the form."), fieldErrors };
  }
  if (!(await checkOnline())) {
    return failure("Connect to the internet to update your profile.");
  }

  const { birthdate, contact } = form;
  return attempt(async () => {
    await unwrap(
      profileRoutes.upsertProfile({
        user_id: userId,
        user_type: "commuter",
        first_name: firstName,
        last_name: lastName,
        birth_date: toIsoDate(birthdate),
        contact_number: `+63${contact}`,
      }),
    );
  });
}

function fromIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export type EditableProfile = {
  userId: string;
  firstName: string;
  lastName: string;
  initials: string;
  email: string;
  pendingEmail: string | null;
  contact: string;
  birthDate: Date;
  picturePath: string | null;
  pictureUrl: string | null;
};

export async function loadEditableProfile(): Promise<
  EditableProfile | { redirect: AppRoute }
> {
  try {
    const result = await loadSignedInProfile();
    if ("redirect" in result) return result;
    const { user, profile } = result;

    return {
      userId: user.id,
      firstName: profile.first_name,
      lastName: profile.last_name,
      initials: getInitials(profile.first_name, profile.last_name),
      email: user.email ?? "",
      pendingEmail: user.new_email ?? null,
      contact: profile.contact_number.replace(/^\+63/, ""),
      birthDate: fromIsoDate(profile.birth_date),
      picturePath: profile.profile_picture,
      pictureUrl: getPictureUrl(profile.profile_picture),
    };
  } catch (error) {
    return { redirect: signedOutOrOffline(error) };
  }
}

export type PictureUpload = { uri: string; mimeType?: string };

type ProfileEditForm = {
  email: string;
  contact: string;
  birthDate: Date | null;
  picture: PictureUpload | null;
};

export type ProfileEditField = "email" | "contact" | "birthDate";

export type ProfileEditErrors = Partial<Record<ProfileEditField, string>>;

async function uploadPicture(userId: string, picture: PictureUpload) {
  const contentType = picture.mimeType ?? "image/jpeg";
  const extension = contentType.split("/")[1] ?? "jpg";
  const path = `${userId}/${Date.now()}.${extension}`;
  const body = await fetch(picture.uri).then((response) =>
    response.arrayBuffer(),
  );
  await unwrap(profileRoutes.uploadPicture(path, body, contentType));
  return path;
}

export async function saveProfileChanges(
  profile: EditableProfile,
  form: ProfileEditForm,
): Promise<
  Result<{ emailPending: boolean }> & { fieldErrors?: ProfileEditErrors }
> {
  const email = form.email.trim();

  const fieldErrors: ProfileEditErrors = {};
  const emailProblem = getEmailProblem(email);
  if (emailProblem) fieldErrors.email = emailProblem;
  if (form.contact.length !== contactLength) {
    fieldErrors.contact = `Enter ${contactLength} digits.`;
  }
  if (!form.birthDate) fieldErrors.birthDate = "Select your birth date.";
  else if (form.birthDate > new Date()) {
    fieldErrors.birthDate = "Birth date can't be in the future.";
  }

  if (Object.keys(fieldErrors).length > 0 || !form.birthDate) {
    return { ...failure("Please check the form."), fieldErrors };
  }
  if (!(await checkOnline())) {
    return failure("Connect to the internet to update your profile.");
  }

  const { birthDate, contact, picture } = form;
  return attempt(async () => {
    const emailPending = email.toLowerCase() !== profile.email.toLowerCase();
    if (emailPending) await unwrap(authRoutes.updateEmail(email));

    const changes: ProfileChanges = {};
    if (contact !== profile.contact) changes.contact_number = `+63${contact}`;
    if (toIsoDate(birthDate) !== toIsoDate(profile.birthDate)) {
      changes.birth_date = toIsoDate(birthDate);
    }
    if (picture) {
      changes.profile_picture = await uploadPicture(profile.userId, picture);
    }

    if (Object.keys(changes).length > 0) {
      try {
        await unwrap(profileRoutes.updateProfile(profile.userId, changes));
      } catch (error) {
        if (changes.profile_picture) {
          await profileRoutes.removePicture(changes.profile_picture);
        }
        throw error;
      }
      if (changes.profile_picture && profile.picturePath) {
        await profileRoutes.removePicture(profile.picturePath);
      }
    }

    return { emailPending };
  });
}
