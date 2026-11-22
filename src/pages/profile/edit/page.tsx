import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useNavigation } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Camera from "lucide-react-native/icons/camera";
import Lock from "lucide-react-native/icons/lock";
import Mail from "lucide-react-native/icons/mail";
import Phone from "lucide-react-native/icons/phone";
import UserRoundPen from "lucide-react-native/icons/user-round-pen";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  contactLength,
  contactLengthMessage,
  getContactProblem,
  loadEditableProfile,
  saveProfileChanges,
  toIsoDate,
  type EditableProfile,
  type PictureUpload,
  type ProfileEditErrors,
  type ProfileEditField,
} from "@/api/v1/profile/controllers";
import { ConfirmModal } from "@/components/confirm-modal";
import { DateTimeField } from "@/components/date-time-field";
import { LoadingLogo } from "@/components/LoadingLogo";
import { MiniToast, type MiniToastMessage } from "@/components/mini-toast";
import {
  FieldLabel,
  ModuleButton,
  ModuleHeader,
  moduleColors,
  SoftField,
} from "@/components/module-ui";
import { StickyHeader, useScrollChrome } from "@/components/scroll-chrome";
import { Routes } from "@/constants/routes";
import { useOnline } from "@/hooks/use-online";
import { goBackOr } from "@/utils/navigation";
import {
  ErrorAlert,
  ErrorOutline,
  firstFieldError,
} from "@/components/error-alert";

const { brandBlue, error: errorRed, mutedText, text } = moduleColors;
const fieldOrder = ["email", "contact", "birthDate"] as const;
const fieldTitles = {
  email: "Email address",
  contact: "Contact number",
  birthDate: "Birth date",
};

const minimumBirthDate = new Date(1900, 0, 1);

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const chrome = useScrollChrome();
  const [profile, setProfile] = useState<EditableProfile | null>(null);
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [picture, setPicture] = useState<PictureUpload | null>(null);
  const [errors, setErrors] = useState<ProfileEditErrors>({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<MiniToastMessage | null>(null);
  const navigation = useNavigation();
  const [discardOpen, setDiscardOpen] = useState(false);
  const pendingLeave = useRef<(() => void) | null>(null);
  const dirty = useRef(false);
  const leaving = useRef(false);

  const showToast = (message: string) =>
    setToast((current) => ({ id: (current?.id ?? 0) + 1, text: message }));

  useEffect(() => {
    let active = true;

    const load = async () => {
      const result = await loadEditableProfile();
      if ("redirect" in result) {
        router.replace(result.redirect);
        return;
      }
      if (!active) return;
      setProfile(result);
      setEmail(result.email);
      setContact(result.contact);
      setBirthDate(result.birthDate);
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const hasChanges =
    !!profile &&
    (!!picture ||
      email.trim() !== profile.email ||
      contact !== profile.contact ||
      (!!birthDate && toIsoDate(birthDate) !== toIsoDate(profile.birthDate)));

  useEffect(() => {
    dirty.current = hasChanges && !saving;
  }, [hasChanges, saving]);

  useEffect(
    () =>
      navigation.addListener("beforeRemove", (event) => {
        if (!dirty.current || leaving.current) return;
        event.preventDefault();
        pendingLeave.current = () => navigation.dispatch(event.data.action);
        setDiscardOpen(true);
      }),
    [navigation],
  );

  const goBack = () => goBackOr(Routes.profile);
  const leaveAfterSave = () => {
    leaving.current = true;
    goBack();
  };

  const clearError = (field: ProfileEditField) => {
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
  };

  const pickPicture = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled) return;
    const [asset] = result.assets;
    setPicture({ uri: asset.uri, mimeType: asset.mimeType });
  };

  if (!profile) {
    return (
      <View style={styles.loadingScreen}>
        <LoadingLogo color={brandBlue} />
      </View>
    );
  }

  const save = async () => {
    if (saving) return;

    setSaving(true);
    setSaveError("");
    const result = await saveProfileChanges(profile, {
      email,
      contact,
      birthDate,
      picture,
    });
    setSaving(false);

    setErrors(result.ok ? {} : (result.fieldErrors ?? {}));
    if (!result.ok) {
      if (!result.fieldErrors) setSaveError(result.error);
      return;
    }

    if (result.data.emailPending) {
      Alert.alert(
        "Confirm your new email",
        `We sent a confirmation link to ${email.trim()}. Your email will change once you open it.`,
        [{ text: "OK", onPress: leaveAfterSave }],
      );
      return;
    }
    leaveAfterSave();
  };

  const pictureUri = picture?.uri ?? profile.pictureUrl;

  const errorField = firstFieldError(errors, fieldOrder);
  const alertTitle = errorField ? fieldTitles[errorField] : "Profile";
  const alertMessage = errorField ? errors[errorField] : saveError;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <KeyboardAwareScrollView
        bottomOffset={24}
        onScroll={chrome.scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: chrome.headerHeight,
          paddingBottom: 16,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
      >
        <View style={styles.body}>
          <View style={styles.identity}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change profile picture"
              onPress={pickPicture}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <View style={styles.avatar}>
                {pictureUri ? (
                  <Image
                    source={{ uri: pictureUri }}
                    style={styles.avatarImage}
                    contentFit="cover"
                  />
                ) : (
                  <Text style={styles.avatarText}>{profile.initials}</Text>
                )}
              </View>
              <View style={styles.cameraBadge}>
                <Camera color="#ffffff" size={14} strokeWidth={2} />
              </View>
            </Pressable>
            <View style={styles.identityText}>
              <Text style={styles.name} numberOfLines={2}>
                {[profile.firstName, profile.lastName].filter(Boolean).join(" ")}
              </Text>
              <View style={styles.lockedRow}>
                <Lock color={mutedText} size={12} strokeWidth={2} />
                <Text style={styles.lockedHint}>
                  Your name can&apos;t be changed
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={pickPicture}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Text style={styles.changePhoto}>Change photo</Text>
              </Pressable>
            </View>
          </View>

          <Field label="Email Address" error={errors.email}>
            <SoftField
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                clearError("email");
              }}
              placeholder="Email address"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              icon={<Mail color={brandBlue} size={18} strokeWidth={2} />}
            />
            {!!profile.pendingEmail && (
              <Text style={styles.pendingHint}>
                Waiting for you to confirm {profile.pendingEmail}.
              </Text>
            )}
          </Field>

          <Field label="Contact Number" error={errors.contact}>
            <SoftField
              value={contact}
              onChangeText={(value) => {
                const problem = getContactProblem(value);
                if (problem) return showToast(problem);
                setContact(value);
                clearError("contact");
              }}
              onKeyPress={({ nativeEvent }) => {
                if (
                  contact.length === contactLength &&
                  /^\d$/.test(nativeEvent.key)
                ) {
                  showToast(contactLengthMessage);
                }
              }}
              placeholder="9123456789"
              keyboardType="number-pad"
              autoComplete="tel"
              maxLength={contactLength}
              icon={
                <View style={styles.contactIcon}>
                  <Phone color={brandBlue} size={18} strokeWidth={2} />
                  <Text style={styles.contactPrefix}>+63</Text>
                </View>
              }
            />
          </Field>

          <Field label="Birth Date" error={errors.birthDate}>
            <DateTimeField
              mode="date"
              value={birthDate}
              onChange={(date) => {
                setBirthDate(date);
                clearError("birthDate");
              }}
              placeholder="Birth date"
              minimumDate={minimumBirthDate}
              maximumDate={new Date()}
            />
          </Field>

          {!online && (
            <Text style={styles.offlineHint}>
              Connect to the internet before changing your profile.
            </Text>
          )}

          {!!alertMessage && (
            <ErrorAlert
              title={alertTitle}
              message={alertMessage}
              style={styles.saveError}
            />
          )}
        </View>
      </KeyboardAwareScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <ModuleButton
          label={saving ? "SAVING..." : "SAVE CHANGES"}
          disabled={saving || !hasChanges || !online}
          onPress={save}
          style={styles.saveButton}
        />
      </View>
      <StickyHeader chrome={chrome}>
        <ModuleHeader
          title="Edit Profile"
          subtitle="Update your photo and contact details."
          icon={<UserRoundPen color="#ffffff" size={44} strokeWidth={1.8} />}
          onBack={goBack}
          collapsed={chrome.collapsed}
        />
      </StickyHeader>
      <MiniToast message={toast} top={insets.top + 12} />
      <ConfirmModal
        visible={discardOpen}
        destructive
        title="Discard changes?"
        message="You have unsaved changes to your profile. If you leave now, they'll be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onCancel={() => {
          pendingLeave.current = null;
          setDiscardOpen(false);
        }}
        onConfirm={() => {
          setDiscardOpen(false);
          leaving.current = true;
          const leave = pendingLeave.current;
          pendingLeave.current = null;
          leave?.();
        }}
      />
    </View>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <FieldLabel invalid={!!error}>{label}</FieldLabel>
      <ErrorOutline invalid={!!error} color={errorRed}>
        {children}
      </ErrorOutline>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  screen: { flex: 1, backgroundColor: "#ffffff" },
  body: { paddingHorizontal: 16, paddingTop: 16 },
  pressed: { opacity: 0.8 },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#f5f8ff",
  },
  avatar: {
    width: 76,
    height: 76,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 38,
    borderWidth: 3,
    borderColor: brandBlue,
    backgroundColor: "#d4ecf9",
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarText: { color: text, fontFamily: "SoraBold", fontSize: 24 },
  cameraBadge: {
    position: "absolute",
    right: -2,
    bottom: 0,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: brandBlue,
  },
  identityText: { flex: 1, gap: 4 },
  name: { color: text, fontFamily: "SoraBold", fontSize: 17 },
  lockedRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  lockedHint: { color: mutedText, fontFamily: "Sora", fontSize: 11 },
  changePhoto: {
    marginTop: 2,
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 12,
  },
  field: { flex: 1, marginTop: 14 },
  pendingHint: {
    color: brandBlue,
    fontFamily: "Sora",
    fontSize: 10,
    marginTop: 6,
  },
  contactIcon: { flexDirection: "row", alignItems: "center", gap: 10 },
  contactPrefix: { color: text, fontFamily: "Sora", fontSize: 11 },
  saveError: { marginTop: 14 },
  footer: {
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  offlineHint: {
    color: "#6b6b6b",
    fontFamily: "Sora",
    fontSize: 10,
    textAlign: "center",
    marginTop: 12,
  },
  saveButton: { marginTop: 0 },
});
