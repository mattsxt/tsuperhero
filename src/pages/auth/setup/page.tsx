import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import Calendar1 from "lucide-react-native/icons/calendar-1";
import ChevronDown from "lucide-react-native/icons/chevron-down";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import { createElement, useEffect, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  checkSetupAccess,
  contactLength,
  contactLengthMessage,
  genderOptions,
  getContactProblem,
  getNameProblem,
  submitProfile,
  toIsoDate,
  type Gender,
  type ProfileFormErrors,
  type ProfileFormField,
} from "@/api/v1/profile/controllers";
import { BrandHeader } from "@/components/brand-header";
import { MiniToast, type MiniToastMessage } from "@/components/mini-toast";
import { Routes } from "@/constants/routes";

const backgroundBlue = "#1034A6";
const accentBlue = "#29A9E1";
const errorRed = "#ffb4ab";
const contentWidth = 320;

export default function SetupScreen() {
  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState("");
  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthdate, setBirthdate] = useState<Date | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [genderOpen, setGenderOpen] = useState(false);
  const [contact, setContact] = useState("");
  const [errors, setErrors] = useState<ProfileFormErrors>({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<MiniToastMessage | null>(null);

  const showToast = (text: string) =>
    setToast((current) => ({ id: (current?.id ?? 0) + 1, text }));

  useEffect(() => {
    let active = true;

    const checkAccess = async () => {
      const access = await checkSetupAccess();
      if ("redirect" in access) {
        router.replace(access.redirect as Parameters<typeof router.replace>[0]);
        return;
      }
      if (active) {
        setUserId(access.userId);
        setChecking(false);
      }
    };

    checkAccess();
    return () => {
      active = false;
    };
  }, []);

  const canGoBack = step >= 2 && step <= 3;
  const goBack = () => {
    setGenderOpen(false);
    setStep((currentStep) => Math.max(currentStep - 1, 1));
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (canGoBack) {
          setGenderOpen(false);
          setStep((currentStep) => Math.max(currentStep - 1, 1));
        }
        return true;
      },
    );
    return () => subscription.remove();
  }, [canGoBack]);

  const clearError = (field: ProfileFormField) => {
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
  };

  const saveProfile = async () => {
    if (saving) return;

    setSaving(true);
    setSaveError("");
    const result = await submitProfile(userId, {
      firstName,
      lastName,
      birthdate,
      gender,
      contact,
    });
    setSaving(false);

    setErrors(result.ok ? {} : (result.fieldErrors ?? {}));
    if (!result.ok) {
      if (!result.fieldErrors) setSaveError(result.error);
      return;
    }
    setStep(4);
  };

  if (checking) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {canGoBack && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go to previous step"
              hitSlop={12}
              onPress={goBack}
              style={styles.backButton}
            >
              <ChevronLeft color="#ffffff" size={28} strokeWidth={2.5} />
            </Pressable>
          )}

          <BrandHeader variant="hero" />

          <View style={styles.stepArea}>
            {step === 1 && (
              <>
                <Text style={styles.message}>
                  It seems that this is your first time accessing the app!
                </Text>
                <PrimaryButton label="YES" onPress={() => setStep(2)} />
              </>
            )}

            {step === 2 && (
              <>
                <Text style={styles.message}>
                  Perfect, now is the time to set up your profile!
                </Text>
                <PrimaryButton label="CONTINUE" onPress={() => setStep(3)} />
              </>
            )}

            {step === 3 && (
              <View style={styles.form}>
                <Text style={styles.formHeading}>Set up your profile</Text>

                <View style={styles.row}>
                  <FormField label="FIRST NAME" error={errors.firstName}>
                    <TextInput
                      value={firstName}
                      onChangeText={(value) => {
                        const problem = getNameProblem(value);
                        if (problem) return showToast(problem);
                        setFirstName(value);
                        clearError("firstName");
                      }}
                      placeholder="Juan"
                      placeholderTextColor="#9a9a9a"
                      autoComplete="given-name"
                      style={styles.input}
                    />
                  </FormField>
                  <FormField label="LAST NAME" error={errors.lastName}>
                    <TextInput
                      value={lastName}
                      onChangeText={(value) => {
                        const problem = getNameProblem(value);
                        if (problem) return showToast(problem);
                        setLastName(value);
                        clearError("lastName");
                      }}
                      placeholder="dela Cruz"
                      placeholderTextColor="#9a9a9a"
                      autoComplete="family-name"
                      style={styles.input}
                    />
                  </FormField>
                </View>

                <View style={[styles.row, styles.rowAboveDropdown]}>
                  <FormField label="BIRTHDATE" error={errors.birthdate}>
                    <BirthdateField
                      value={birthdate}
                      onChange={(date) => {
                        setBirthdate(date);
                        clearError("birthdate");
                      }}
                    />
                  </FormField>
                  <FormField label="GENDER" error={errors.gender}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Select gender"
                      onPress={() => setGenderOpen((open) => !open)}
                      style={styles.inputWithIcon}
                    >
                      <Text
                        style={[
                          styles.selectText,
                          !gender && styles.placeholderText,
                        ]}
                        numberOfLines={1}
                      >
                        {genderOptions.find((option) => option.value === gender)
                          ?.label ?? "Select"}
                      </Text>
                      <ChevronDown color="#111111" size={15} />
                    </Pressable>
                    {genderOpen && (
                      <View style={styles.dropdown}>
                        {genderOptions.map((option) => (
                          <Pressable
                            key={option.value}
                            onPress={() => {
                              setGender(option.value);
                              setGenderOpen(false);
                              clearError("gender");
                            }}
                            style={[
                              styles.dropdownOption,
                              option.value === gender &&
                                styles.dropdownOptionSelected,
                            ]}
                          >
                            <Text style={styles.selectText}>
                              {option.label}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </FormField>
                </View>

                <FormField label="CONTACT NUMBER" error={errors.contact}>
                  <View style={styles.inputWithIcon}>
                    <Text style={styles.contactPrefix}>+63</Text>
                    <TextInput
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
                      placeholderTextColor="#9a9a9a"
                      keyboardType="number-pad"
                      autoComplete="tel"
                      maxLength={contactLength}
                      style={styles.flexInput}
                    />
                  </View>
                </FormField>

                {!!saveError && (
                  <Text style={styles.saveError}>{saveError}</Text>
                )}

                <PrimaryButton
                  label={saving ? "SAVING..." : "CONTINUE"}
                  disabled={saving}
                  onPress={saveProfile}
                />
              </View>
            )}

            {step === 4 && (
              <>
                <Text style={styles.message}>
                  Alright!{"\n"}Everything is now set up.{"\n"}Let’s get
                  started!
                </Text>
                <PrimaryButton
                  label="LET'S GO!"
                  onPress={() => router.replace(Routes.commuterHome)}
                />
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <MiniToast message={toast} top={12} />
    </SafeAreaView>
  );
}

const minimumBirthdate = new Date(1900, 0, 1);
const defaultBirthdate = new Date(2000, 0, 1);

const pad = (value: number) => String(value).padStart(2, "0");

function formatDisplayDate(date: Date) {
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()}`;
}

function BirthdateField({
  value,
  onChange,
}: {
  value: Date | null;
  onChange: (date: Date) => void;
}) {
  const [iosPickerOpen, setIosPickerOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState(defaultBirthdate);

  if (Platform.OS === "web") {
    return (
      <View style={styles.inputWithIcon}>
        {createElement("input", {
          type: "date",
          "aria-label": "Birthdate",
          min: toIsoDate(minimumBirthdate),
          max: toIsoDate(new Date()),
          value: value ? toIsoDate(value) : "",
          onChange: (event: { target: { value: string } }) => {
            const [year, month, day] = event.target.value
              .split("-")
              .map(Number);
            if (year && month && day) onChange(new Date(year, month - 1, day));
          },
          style: styles.webDateInput,
        })}
      </View>
    );
  }

  const openPicker = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        mode: "date",
        value: value ?? defaultBirthdate,
        minimumDate: minimumBirthdate,
        maximumDate: new Date(),
        onValueChange: (_event, date) => onChange(date),
      });
      return;
    }
    setIosDraft(value ?? defaultBirthdate);
    setIosPickerOpen(true);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Select birthdate"
        onPress={openPicker}
        style={styles.inputWithIcon}
      >
        <Text
          style={[styles.selectText, !value && styles.placeholderText]}
          numberOfLines={1}
        >
          {value ? formatDisplayDate(value) : "MM/DD/YYYY"}
        </Text>
        <Calendar1 color="#111111" size={15} />
      </Pressable>

      {Platform.OS === "ios" && (
        <Modal
          visible={iosPickerOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setIosPickerOpen(false)}
        >
          <Pressable
            style={styles.sheetBackdrop}
            onPress={() => setIosPickerOpen(false)}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Pressable hitSlop={10} onPress={() => setIosPickerOpen(false)}>
                <Text style={styles.sheetCancel}>Cancel</Text>
              </Pressable>
              <Text style={styles.sheetTitle}>Birthdate</Text>
              <Pressable
                hitSlop={10}
                onPress={() => {
                  onChange(iosDraft);
                  setIosPickerOpen(false);
                }}
              >
                <Text style={styles.sheetDone}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              mode="date"
              display="spinner"
              value={iosDraft}
              minimumDate={minimumBirthdate}
              maximumDate={new Date()}
              themeVariant="light"
              textColor="#111111"
              onValueChange={(_event, date) => setIosDraft(date)}
            />
          </View>
        </Modal>
      )}
    </>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.primaryButton, disabled && styles.buttonDisabled]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function FormField({
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
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {!!error && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: backgroundBlue,
  },
  safeArea: { flex: 1, backgroundColor: backgroundBlue },
  container: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 32,
  },
  stepArea: {
    width: contentWidth,
    alignItems: "center",
    marginTop: 64,
  },
  message: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 18,
    lineHeight: 25,
    textAlign: "center",
    marginTop: 30,
    marginBottom: 32,
  },
  primaryButton: {
    width: contentWidth,
    height: 35,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: accentBlue,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 9,
  },
  buttonDisabled: { opacity: 0.6 },
  backButton: { position: "absolute", top: 8, left: 16, zIndex: 1 },
  form: { width: contentWidth, gap: 12 },
  formHeading: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 18,
    textAlign: "center",
    marginBottom: 12,
  },
  row: { flexDirection: "row", gap: 50 },
  rowAboveDropdown: { zIndex: 10 },
  field: { flex: 1, gap: 5 },
  fieldLabel: {
    color: "#ffffff",
    fontFamily: "Sora",
    fontSize: 9,
  },
  fieldError: {
    color: errorRed,
    fontFamily: "Sora",
    fontSize: 8,
  },
  input: {
    height: 35,
    paddingHorizontal: 10,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    color: "#111111",
    fontFamily: "Sora",
    fontSize: 12,
  },
  inputWithIcon: {
    height: 35,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    backgroundColor: "#ffffff",
    borderRadius: 8,
  },
  flexInput: {
    flex: 1,
    height: "100%",
    color: "#111111",
    fontFamily: "Sora",
    fontSize: 12,
  },
  contactPrefix: {
    color: "#111111",
    fontFamily: "Sora",
    fontSize: 12,
    marginRight: 4,
  },
  selectText: {
    flex: 1,
    color: "#111111",
    fontFamily: "Sora",
    fontSize: 12,
  },
  placeholderText: { color: "#9a9a9a" },
  dropdown: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    paddingVertical: 4,
    elevation: 6,
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  dropdownOption: { paddingHorizontal: 10, paddingVertical: 9 },
  dropdownOptionSelected: { backgroundColor: "#e3f3fb" },
  webDateInput: {
    flex: 1,
    height: "100%",
    borderWidth: 0,
    backgroundColor: "transparent",
    color: "#111111",
    fontFamily: "Sora",
    fontSize: 12,
  },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.35)" },
  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 32,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e4",
  },
  sheetTitle: { color: "#111111", fontFamily: "SoraBold", fontSize: 14 },
  sheetCancel: { color: "#6b6b6b", fontFamily: "Sora", fontSize: 14 },
  sheetDone: { color: backgroundBlue, fontFamily: "SoraBold", fontSize: 14 },
  saveError: {
    color: errorRed,
    fontFamily: "Sora",
    fontSize: 9,
    textAlign: "center",
  },
});
