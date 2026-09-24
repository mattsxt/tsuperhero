import { useFonts } from "expo-font";
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
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const brandBlue = "#193caf";
const inputWidth = 320;

const passwordRules = [
  { label: "8 characters minimum", test: (value: string) => value.length >= 8 },
  { label: "1 lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { label: "1 uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { label: "1 number", test: (value: string) => /\d/.test(value) },
];

export default function RegisterScreen() {
  const [fontsLoaded] = useFonts({
    Sora: require("../../assets/fonts/Sora.ttf"),
    SoraBold: require("../../assets/fonts/Sora-Bold.ttf"),
    WDXLLubrifontSC: require("../../assets/fonts/WDXLLubrifontSC.ttf"),
  });
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const continueToNextStep = () => {
    if (step === 1) {
      const normalizedEmail = email.trim();
      if (!normalizedEmail) {
        setEmailError("Email address is required.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        setEmailError("Enter a valid email address.");
        return;
      }
      setEmailError("");
    }

    if (step === 3) {
      const failedRules = passwordRules.filter((rule) => !rule.test(password));
      if (failedRules.length > 0) {
        setPasswordError(
          `Password needs ${failedRules.map((rule) => rule.label.toLowerCase()).join(", ")}.`,
        );
        return;
      }
      setPasswordError("");
    }

    setStep((currentStep) => Math.min(currentStep + 1, 4));
  };
  const goToPreviousStep = () =>
    setStep((currentStep) => Math.max(currentStep - 1, 1));

  if (!fontsLoaded) {
    return <View style={styles.loadingScreen} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.brandArea}>
          <View style={styles.logoBackground}>
            <Image
              source={require("../../assets/images/tsuperhero_icon.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.wordmark}>TsuperHero</Text>
        </View>

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
                  We just sent a 5-digit code to{"\n"}
                  {email || "your email"}, enter it below
                </Text>
                <View style={styles.fieldHeading}>
                  <FieldLabel label="CODE" />
                  <Pressable onPress={() => {}} style={styles.resendButton}>
                    <RefreshCcw color="#171717" size={10} strokeWidth={2} />
                    <Text style={styles.resendText}>RESEND CODE</Text>
                  </Pressable>
                </View>
                <View style={styles.codeRow}>
                  {Array.from({ length: 5 }, (_, index) => (
                    <TextInput
                      key={index}
                      value={code[index] || ""}
                      onChangeText={(value) => {
                        const nextCode = code.split("");
                        nextCode[index] = value.slice(-1);
                        setCode(nextCode.join(""));
                      }}
                      keyboardType="number-pad"
                      maxLength={1}
                      style={styles.codeInput}
                    />
                  ))}
                </View>
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
              style={styles.primaryButton}
              onPress={continueToNextStep}
            >
              <Text style={styles.primaryButtonText}>CONTINUE</Text>
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
      <Text style={styles.accountLink} onPress={() => router.replace("/login")}>
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
        onPress={() => router.replace("/login")}
      >
        <Text style={styles.primaryButtonText}>LOGIN</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, backgroundColor: "#ffffff" },
  safeArea: { flex: 1, backgroundColor: "#ffffff" },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  brandArea: { alignItems: "center" },
  logoBackground: {
    width: 104,
    height: 104,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1034A6",
    borderRadius: 24,
  },
  logo: { width: 78, height: 78 },
  wordmark: {
    color: brandBlue,
    fontFamily: "WDXLLubrifontSC",
    fontSize: 43,
    lineHeight: 49,
    marginTop: 14,
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
  codeRow: { flexDirection: "row", justifyContent: "space-between" },
  codeInput: {
    width: 51,
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
