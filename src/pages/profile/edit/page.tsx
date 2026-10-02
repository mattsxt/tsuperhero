import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Camera from "lucide-react-native/icons/camera";
import Lock from "lucide-react-native/icons/lock";
import Mail from "lucide-react-native/icons/mail";
import Phone from "lucide-react-native/icons/phone";
import UserRoundPen from "lucide-react-native/icons/user-round-pen";
import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated from "react-native-reanimated";
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
import { DateTimeField } from "@/components/date-time-field";
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
import { goBackOr } from "@/utils/navigation";

const { brandBlue, error: errorRed, mutedText, text } = moduleColors;

const minimumBirthDate = new Date(1900, 0, 1);

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
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

  const goBack = () => goBackOr(Routes.profile);

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
        <ActivityIndicator color={brandBlue} />
      </View>
    );
  }

  const hasChanges =
    !!picture ||
    email.trim() !== profile.email ||
    contact !== profile.contact ||
    (!!birthDate && toIsoDate(birthDate) !== toIsoDate(profile.birthDate));

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
        [{ text: "OK", onPress: goBack }],
      );
      return;
    }
    goBack();
  };

  const pictureUri = picture?.uri ?? profile.pictureUrl;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Animated.ScrollView
          onScroll={chrome.scrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingTop: chrome.headerHeight,
            paddingBottom: insets.bottom + 24,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.body}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change profile picture"
              onPress={pickPicture}
              style={({ pressed }) => [
                styles.avatarButton,
                pressed && styles.pressed,
              ]}
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
                <Camera color="#ffffff" size={16} strokeWidth={2} />
              </View>
            </Pressable>
            <Text style={styles.avatarHint}>Tap to change your picture</Text>

            <View style={styles.row}>
              <Field label="First Name">
                <LockedField value={profile.firstName} />
              </Field>
              <Field label="Last Name">
                <LockedField value={profile.lastName} />
              </Field>
            </View>
            <Text style={styles.lockedHint}>
              Your name can&apos;t be changed.
            </Text>

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

            {!!saveError && <Text style={styles.saveError}>{saveError}</Text>}

            <ModuleButton
              label={saving ? "SAVING..." : "SAVE CHANGES"}
              disabled={saving || !hasChanges}
              onPress={save}
              style={styles.saveButton}
            />
          </View>
        </Animated.ScrollView>
      </KeyboardAvoidingView>
      <StickyHeader chrome={chrome}>
        <ModuleHeader
          title="Edit Profile"
          subtitle="Update your profile picture and personal information."
          icon={<UserRoundPen color="#ffffff" size={44} strokeWidth={1.8} />}
          onBack={goBack}
          collapsed={chrome.collapsed}
        />
      </StickyHeader>
      <MiniToast message={toast} top={insets.top + 12} />
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
      <FieldLabel>{label}</FieldLabel>
      {children}
      {!!error && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );
}

function LockedField({ value }: { value: string }) {
  return (
    <SoftField
      value={value}
      editable={false}
      accessibilityState={{ disabled: true }}
      trailing={<Lock color={mutedText} size={14} strokeWidth={2} />}
      style={styles.lockedField}
      inputStyle={styles.lockedInput}
    />
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
  body: { paddingHorizontal: 16, paddingTop: 22 },
  pressed: { opacity: 0.8 },
  avatarButton: { alignSelf: "center" },
  avatar: {
    width: 104,
    height: 104,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 52,
    borderWidth: 3,
    borderColor: brandBlue,
    backgroundColor: "#d4ecf9",
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarText: { color: text, fontFamily: "SoraBold", fontSize: 30 },
  cameraBadge: {
    position: "absolute",
    right: 0,
    bottom: 2,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: brandBlue,
  },
  avatarHint: {
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 10,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 8,
  },
  row: { flexDirection: "row", gap: 12 },
  field: { flex: 1, marginTop: 16 },
  lockedField: { backgroundColor: "#eeeeee" },
  lockedInput: { color: mutedText },
  lockedHint: {
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 9,
    marginTop: 6,
  },
  pendingHint: {
    color: brandBlue,
    fontFamily: "Sora",
    fontSize: 9,
    marginTop: 6,
  },
  contactIcon: { flexDirection: "row", alignItems: "center", gap: 10 },
  contactPrefix: { color: text, fontFamily: "Sora", fontSize: 11 },
  fieldError: {
    color: errorRed,
    fontFamily: "Sora",
    fontSize: 9,
    marginTop: 6,
  },
  saveError: {
    color: errorRed,
    fontFamily: "Sora",
    fontSize: 10,
    textAlign: "center",
    marginTop: 18,
  },
  saveButton: { marginTop: 28 },
});
