import { router } from "expo-router";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import CircleCheck from "lucide-react-native/icons/circle-check";
import Eye from "lucide-react-native/icons/eye";
import EyeOff from "lucide-react-native/icons/eye-off";
import RefreshCcw from "lucide-react-native/icons/refresh-ccw";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  codeLength,
  completeSignUp,
  getEmailProblem,
  getPasswordProblem,
  passwordRules,
  requestSignUpCode,
  verifySignUpCode,
} from "@/api/v1/auth/controllers";
import { BrandHeader } from "@/components/brand-header";
import { Routes } from "@/constants/routes";

const brandBlue = "#193caf";
const inputWidth = 320;

export default function RegisterScreen() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [codeError, setCodeError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const codeInputs = useRef<(TextInput | null)[]>([]);

  const focusCodeInput = (index: number) => {
    codeInputs.current[Math.max(0, Math.min(index, codeLength - 1))]?.focus();
  };

  const resendCode = async () => {
    if (submitting) return;
    setSubmitting(true);
    setCode("");
    const result = await requestSignUpCode(email);
    setCodeError(result.ok ? "" : result.error);
    setSubmitting(false);
  };

  const continueToNextStep = async () => {
    if (submitting) return;

    if (step === 1) {
      const problem = getEmailProblem(email);
      setEmailError(problem ?? "");
      if (problem) return;
    }
    if (step === 3) {
      const problem = getPasswordProblem(password);
      setPasswordError(problem ?? "");
      if (problem) return;
    }

    setSubmitting(true);
    const result =
      step === 1
        ? await requestSignUpCode(email)
        : step === 2
          ? await verifySignUpCode(email, code)
          : await completeSignUp(password);
    setSubmitting(false);

    if (!result.ok) {
      if (step === 1) setEmailError(result.error);
      if (step === 2) setCodeError(result.error);
      if (step === 3) setPasswordError(result.error);
      return;
    }

    if (step === 1) setCode("");
    if (step === 2) setCodeError("");
    setStep((currentStep) => Math.min(currentStep + 1, 4));
  };
  const goToPreviousStep = () =>
    setStep((currentStep) => Math.max(currentStep - 1, 1));

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <BrandHeader variant="badge" />

        {step < 4 && <Text style={styles.heading}>SIGN UP</Text>}

        {step === 4 ? (
          <CompletionState />
        ) : (
          <>
            {step === 1 && (
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Input your email address</Text>
                <StepNavigation step={step} onBack={goToPreviousStep} />
                <FieldLabel label="EMAIL ADDRESS" />
                <TextInput
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    if (emailError) setEmailError("");
                  }}
                  placeholder="Email address"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={[styles.input, emailError && styles.inputError]}
                />
                {!!emailError && (
                  <Text style={styles.errorText}>{emailError}</Text>
                )}
              </View>
            )}

            {step === 2 && (
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Verify your email address</Text>
                <StepNavigation step={step} onBack={goToPreviousStep} />
                <Text style={styles.description}>
                  We just sent a {codeLength}-digit code to{"\n"}
                  {email || "your email"}, enter it below
                </Text>
                <View style={styles.fieldHeading}>
                  <FieldLabel label="CODE" />
                  <Pressable onPress={resendCode} style={styles.resendButton}>
                    <RefreshCcw color="#171717" size={10} strokeWidth={2} />
                    <Text style={styles.resendText}>RESEND CODE</Text>
                  </Pressable>
                </View>
                <View style={styles.codeRow}>
                  {Array.from({ length: codeLength }, (_, index) => (
                    <TextInput
                      key={index}
                      ref={(input) => {
                        codeInputs.current[index] = input;
                      }}
                      value={(code[index] || "").trim()}
                      onChangeText={(value) => {
                        const digits = value.replace(/\D/g, "");
                        const nextCode = code.padEnd(codeLength, " ").split("");
                        if (digits.length > 1) {
                          const pasted = digits.slice(0, codeLength - index);
                          pasted.split("").forEach((digit, offset) => {
                            nextCode[index + offset] = digit;
                          });
                          focusCodeInput(index + pasted.length);
                        } else {
                          nextCode[index] = digits || " ";
                          if (digits) focusCodeInput(index + 1);
                        }
                        setCode(nextCode.join("").trimEnd());
                        if (codeError) setCodeError("");
                      }}
                      onKeyPress={({ nativeEvent }) => {
                        if (
                          nativeEvent.key === "Backspace" &&
                          !code[index]?.trim() &&
                          index > 0
                        ) {
                          const nextCode = code.padEnd(codeLength, " ").split("");
                          nextCode[index - 1] = " ";
                          setCode(nextCode.join("").trimEnd());
                          focusCodeInput(index - 1);
                        }
                      }}
                      selectTextOnFocus
                      autoFocus={index === 0}
                      keyboardType="number-pad"
                      autoComplete="one-time-code"
                      textContentType="oneTimeCode"
                      maxLength={codeLength}
                      style={styles.codeInput}
                    />
                  ))}
                </View>
                {!!codeError && (
                  <Text style={styles.errorText}>{codeError}</Text>
                )}
              </View>
            )}

            {step === 3 && (
              <PasswordStep
                password={password}
                passwordVisible={passwordVisible}
                setPassword={setPassword}
                passwordError={passwordError}
                setPasswordError={setPasswordError}
                setPasswordVisible={setPasswordVisible}
                onBack={goToPreviousStep}
              />
            )}

            <Pressable
              style={[styles.primaryButton, submitting && styles.buttonDisabled]}
              disabled={submitting}
              onPress={continueToNextStep}
            >
              <Text style={styles.primaryButtonText}>
                {submitting ? "PLEASE WAIT..." : "CONTINUE"}
              </Text>
            </Pressable>
            <AccountLink />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function StepIndicator({ step }: { step: number }) {
  const progress = useRef(new Animated.Value(step)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: step,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, step]);

  return (
    <View style={styles.indicator}>
      {[1, 2, 3].map((indicatorStep) => (
        <Animated.View
          key={indicatorStep}
          style={[
            styles.indicatorBar,
            {
              backgroundColor: progress.interpolate({
                inputRange: [indicatorStep - 1, indicatorStep],
                outputRange: ["#dedede", brandBlue],
                extrapolate: "clamp",
              }),
            },
          ]}
        />
      ))}
    </View>
  );
}

function StepNavigation({
  step,
  onBack,
}: {
  step: number;
  onBack: () => void;
}) {
  return (
    <View style={styles.stepHeader}>
      {step > 1 ? (
        <Pressable
          accessibilityLabel="Go to previous step"
          hitSlop={12}
          onPress={onBack}
          style={styles.backButton}
        >
          <ChevronLeft color="#050505" size={17} strokeWidth={2.5} />
        </Pressable>
      ) : (
        <View style={styles.backButtonPlaceholder} />
      )}
      <StepIndicator step={step} />
      <View style={styles.backButtonPlaceholder} />
    </View>
  );
}

function PasswordStep({
  password,
  passwordVisible,
  setPassword,
  passwordError,
  setPasswordError,
  setPasswordVisible,
  onBack,
}: {
  password: string;
  passwordVisible: boolean;
  setPassword: (value: string) => void;
  passwordError: string;
  setPasswordError: (value: string) => void;
  setPasswordVisible: (value: boolean) => void;
  onBack: () => void;
}) {
  const passedRules = passwordRules.filter((rule) =>
    rule.test(password),
  ).length;
  const strength =
    password.length === 0
      ? { label: "", barColor: "#dedede", textColor: "#dedede" }
      : passedRules === passwordRules.length
        ? { label: "STRONG", barColor: "#9be89a", textColor: "#0E870E" }
        : passedRules >= 2
          ? { label: "MODERATE", barColor: "#fff0a6", textColor: "#FFC300" }
          : { label: "WEAK", barColor: "#ffc2c2", textColor: "#A61010" };

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Create your password</Text>
      <StepNavigation step={3} onBack={onBack} />
      <FieldLabel label="PASSWORD" />
      <View
        style={[
          styles.passwordInputWrap,
          passwordError && styles.passwordInputWrapError,
        ]}
      >
        <TextInput
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            if (passwordError) setPasswordError("");
          }}
          placeholder="Password"
          secureTextEntry={!passwordVisible}
          style={styles.passwordInput}
        />
        <Pressable
          accessibilityLabel={
            passwordVisible ? "Hide password" : "Show password"
          }
          hitSlop={10}
          onPress={() => setPasswordVisible(!passwordVisible)}
          style={styles.eyeButton}
        >
          {passwordVisible ? (
            <Eye color={brandBlue} size={17} />
          ) : (
            <EyeOff color={brandBlue} size={17} />
          )}
        </Pressable>
      </View>
      {!!passwordError && <Text style={styles.errorText}>{passwordError}</Text>}
      <View
        style={[styles.strengthBar, { backgroundColor: strength.barColor }]}
      />
      <Text style={[styles.strengthText, { color: strength.textColor }]}>
        {strength.label}
      </Text>
      <View style={styles.rules}>
        {passwordRules.map((rule) => {
          const passed = rule.test(password);
          return (
            <View key={rule.label} style={styles.ruleRow}>
              <CircleCheck
                color={passed ? "#ffffff" : "#b7b7b7"}
                size={12}
                fill={passed ? brandBlue : "transparent"}
              />
              <Text style={styles.ruleText}>{rule.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

function AccountLink() {
  return (
    <Text style={styles.accountText}>
      Already have an account?{" "}
      <Text style={styles.accountLink} onPress={() => router.replace(Routes.login)}>
        Sign in here
      </Text>
      .
    </Text>
  );
}

function CompletionState() {
  return (
    <View style={styles.completion}>
      <Text style={styles.completionTitle}>
        You have successfully{"\n"}created an account!
      </Text>
      <Text style={styles.completionSubtitle}>One step left!</Text>
      <Pressable
        style={styles.primaryButton}
        onPress={() => router.replace(Routes.login)}
      >
        <Text style={styles.primaryButtonText}>LOGIN</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#ffffff" },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  heading: {
    color: "#050505",
    fontFamily: "SoraBold",
    fontSize: 21,
    lineHeight: 28,
    marginTop: 18,
  },
  stepHeader: {
    width: inputWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 28,
  },
  backButton: { width: 22, alignItems: "flex-start" },
  backButtonPlaceholder: { width: 22 },
  indicator: { flexDirection: "row", gap: 10 },
  indicatorBar: {
    width: 21,
    height: 4,
    borderRadius: 3,
    backgroundColor: "#dedede",
  },
  stepContent: { width: inputWidth },
  stepTitle: {
    color: "#050505",
    fontFamily: "Sora",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 14,
  },
  description: {
    color: "#171717",
    fontFamily: "Sora",
    fontSize: 9,
    lineHeight: 13,
    textAlign: "center",
    marginBottom: 27,
  },
  fieldHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 7,
  },
  fieldLabel: {
    color: "#090909",
    fontFamily: "Sora",
    fontSize: 9,
    fontWeight: "700",
  },
  resendText: {
    color: "#171717",
    fontFamily: "Sora",
    fontSize: 8,
  },
  resendButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  input: {
    width: inputWidth,
    height: 38,
    borderWidth: 1,
    borderColor: brandBlue,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: "#111111",
    fontFamily: "Sora",
    fontSize: 11,
  },
  inputError: { borderColor: "#d93025" },
  errorText: {
    color: "#d93025",
    fontFamily: "Sora",
    fontSize: 8,
    marginTop: 4,
  },
  codeRow: { flexDirection: "row", gap: 8 },
  codeInput: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderColor: brandBlue,
    borderRadius: 10,
    textAlign: "center",
    color: "#111111",
    fontFamily: "Sora",
    fontSize: 12,
  },
  passwordInputWrap: {
    width: inputWidth,
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: brandBlue,
    borderRadius: 10,
  },
  passwordInputWrapError: { borderColor: "#d93025" },
  passwordInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 12,
    color: "#111111",
    fontFamily: "Sora",
    fontSize: 11,
  },
  eyeButton: { paddingHorizontal: 12 },
  strengthBar: {
    width: inputWidth,
    height: 8,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingHorizontal: 4,
    marginTop: 10,
    borderRadius: 2,
  },
  strengthText: {
    fontFamily: "Sora",
    fontSize: 7,
    fontWeight: "700",
    alignSelf: "flex-end",
    marginTop: 3,
  },
  rules: { gap: 4, marginTop: 10 },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ruleText: { color: "#111111", fontFamily: "Sora", fontSize: 9 },
  primaryButton: {
    width: inputWidth,
    height: 35,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: brandBlue,
    borderRadius: 10,
    marginTop: 28,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 9,
  },
  accountText: {
    color: "#111111",
    fontFamily: "Sora",
    fontSize: 6,
    textAlign: "center",
    marginTop: 10,
  },
  accountLink: {
    color: brandBlue,
    fontFamily: "SoraBold",
    textDecorationLine: "underline",
  },
  completion: { alignItems: "center", width: inputWidth, marginTop: 96 },
  completionTitle: {
    color: "#050505",
    fontFamily: "Sora",
    fontSize: 19,
    fontWeight: "700",
    lineHeight: 25,
    textAlign: "center",
  },
  completionSubtitle: {
    color: "#111111",
    fontFamily: "Sora",
    fontSize: 12,
    marginTop: 14,
  },
});
