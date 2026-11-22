import { StatusBar } from "expo-status-bar";
import Eye from "lucide-react-native/icons/eye";
import EyeOff from "lucide-react-native/icons/eye-off";
import KeyRound from "lucide-react-native/icons/key-round";
import Lock from "lucide-react-native/icons/lock";
import ShieldCog from "lucide-react-native/icons/shield-cog";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  changePassword,
  type PasswordFormErrors,
  type PasswordFormField,
} from "@/api/v1/auth/controllers";
import {
  FieldLabel,
  ModuleButton,
  ModuleHeader,
  moduleColors,
  SoftField,
} from "@/components/module-ui";
import { PasswordStrength } from "@/components/password-strength";
import { StickyHeader, useScrollChrome } from "@/components/scroll-chrome";
import { Routes } from "@/constants/routes";
import { goBackOr } from "@/utils/navigation";
import {
  ErrorAlert,
  ErrorOutline,
  firstFieldError,
} from "@/components/error-alert";

const { brandBlue, error: errorRed } = moduleColors;
const fieldOrder = ["current", "next", "confirm"] as const;
const fieldTitles = {
  current: "Current password",
  next: "New password",
  confirm: "Confirm new password",
};

export default function SecurityScreen() {
  const insets = useSafeAreaInsets();
  const chrome = useScrollChrome();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<PasswordFormErrors>({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  const goBack = () => goBackOr(Routes.profile);

  const clearError = (field: PasswordFormField) => {
    if (errors[field]) {
      setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }));
    }
  };

  const save = async () => {
    if (saving) return;

    setSaving(true);
    setSaveError("");
    const result = await changePassword({ current, next, confirm });
    setSaving(false);

    setErrors(result.ok ? {} : (result.fieldErrors ?? {}));
    if (!result.ok) {
      if (!result.fieldErrors) setSaveError(result.error);
      return;
    }

    Alert.alert("Password updated", "Your password has been changed.", [
      { text: "OK", onPress: goBack },
    ]);
  };

  const errorField = firstFieldError(errors, fieldOrder);
  const alertTitle = errorField ? fieldTitles[errorField] : "Password";
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
          paddingBottom: insets.bottom + 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>
          <Field label="Current Password" error={errors.current}>
            <PasswordField
              value={current}
              onChangeText={(value) => {
                setCurrent(value);
                clearError("current");
              }}
              placeholder="Current password"
              autoComplete="current-password"
              icon={<Lock color={brandBlue} size={18} strokeWidth={2} />}
            />
          </Field>

          <Field label="New Password" error={errors.next}>
            <PasswordField
              value={next}
              onChangeText={(value) => {
                setNext(value);
                clearError("next");
              }}
              placeholder="New password"
              autoComplete="new-password"
              icon={<KeyRound color={brandBlue} size={18} strokeWidth={2} />}
            />
            <PasswordStrength password={next} />
          </Field>

          <Field label="Confirm New Password" error={errors.confirm}>
            <PasswordField
              value={confirm}
              onChangeText={(value) => {
                setConfirm(value);
                clearError("confirm");
              }}
              placeholder="Re-enter new password"
              autoComplete="new-password"
              icon={<KeyRound color={brandBlue} size={18} strokeWidth={2} />}
            />
          </Field>

          {!!alertMessage && (
            <ErrorAlert
              title={alertTitle}
              message={alertMessage}
              style={styles.saveError}
            />
          )}
          <ModuleButton
            label={saving ? "UPDATING..." : "UPDATE PASSWORD"}
            disabled={saving || !current || !next || !confirm}
            disabledHint={
              !saving
                ? "Fill in your current password, a new password and the confirmation."
                : undefined
            }
            onPress={save}
            style={
              alertMessage ? styles.saveButtonAfterError : styles.saveButton
            }
          />
        </View>
      </KeyboardAwareScrollView>
      <StickyHeader chrome={chrome}>
        <ModuleHeader
          title="Security"
          subtitle="Change your password to keep your account secure."
          icon={<ShieldCog color="#ffffff" size={44} strokeWidth={1.8} />}
          onBack={goBack}
          collapsed={chrome.collapsed}
        />
      </StickyHeader>
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
  children: React.ReactNode;
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

function PasswordField({
  value,
  onChangeText,
  placeholder,
  autoComplete,
  icon,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  autoComplete: "current-password" | "new-password";
  icon: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <SoftField
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      autoComplete={autoComplete}
      autoCapitalize="none"
      autoCorrect={false}
      secureTextEntry={!visible}
      icon={icon}
      trailing={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? "Hide password" : "Show password"}
          hitSlop={10}
          onPress={() => setVisible((shown) => !shown)}
        >
          {visible ? (
            <Eye color={brandBlue} size={18} />
          ) : (
            <EyeOff color={brandBlue} size={18} />
          )}
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: "#ffffff" },
  body: { paddingHorizontal: 16, paddingTop: 8 },
  field: { marginTop: 18 },
  saveError: { marginTop: 28 },
  saveButton: { marginTop: 28 },
  saveButtonAfterError: { marginTop: 12 },
});
