import { router } from "expo-router";
import Eye from "lucide-react-native/icons/eye";
import EyeOff from "lucide-react-native/icons/eye-off";
import { useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Reanimated from "react-native-reanimated";

import { login } from "@/api/v1/auth/controllers";
import {
  AuthScreen,
  authSpacingTransition,
  useKeyboardVisible,
} from "@/components/auth-screen";
import { BrandHeader } from "@/components/brand-header";
import { Routes } from "@/constants/routes";

const brandBlue = "#193caf";

export default function LoginScreen() {
  const [emailLoginVisible, setEmailLoginVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [formProgress] = useState(() => new Animated.Value(0));
  const keyboardVisible = useKeyboardVisible();

  const showEmailLogin = () => {
    setEmailLoginVisible(true);
    Animated.timing(formProgress, {
      toValue: 1,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  const signIn = async () => {
    setLoggingIn(true);
    setLoginError("");
    const result = await login(email, password);
    setLoggingIn(false);

    if (!result.ok) {
      setLoginError(result.error);
      return;
    }
    router.replace(result.data as Parameters<typeof router.replace>[0]);
  };

  const formHeight = formProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 143],
  });
  const formOpacity = formProgress.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0, 1],
  });
  const introOpacity = formProgress.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [1, 0, 0],
  });

  return (
    <AuthScreen compact={keyboardVisible}>
      <BrandHeader variant="badge" compact={keyboardVisible} />

      <Reanimated.Text
        style={[
          styles.title,
          keyboardVisible && styles.titleCompact,
          authSpacingTransition,
        ]}
      >
        SIGN IN
      </Reanimated.Text>

      <Animated.View
        style={[
          styles.formReveal,
          { height: formHeight, opacity: formOpacity },
        ]}
      >
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email address"
            placeholderTextColor="#929292"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            style={styles.input}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>PASSWORD</Text>
          <View style={styles.passwordInputWrap}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#929292"
              autoComplete="password"
              secureTextEntry={!passwordVisible}
              style={styles.passwordInput}
            />
            <Pressable
              accessibilityLabel={
                passwordVisible ? "Hide password" : "Show password"
              }
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => setPasswordVisible((visible) => !visible)}
              style={styles.eyeButton}
            >
              {passwordVisible ? (
                <Eye color={brandBlue} size={17} />
              ) : (
                <EyeOff color={brandBlue} size={17} />
              )}
            </Pressable>
          </View>
        </View>
      </Animated.View>

      {!!loginError && <Text style={styles.errorText}>{loginError}</Text>}

      {!emailLoginVisible ? (
        <Animated.View style={{ opacity: introOpacity }}>
          <Pressable style={styles.primaryButton} onPress={showEmailLogin}>
            <Text style={styles.primaryButtonText}>CONTINUE WITH EMAIL</Text>
          </Pressable>
        </Animated.View>
      ) : (
        <Pressable
          style={[styles.primaryButton, loggingIn && styles.buttonDisabled]}
          disabled={loggingIn}
          onPress={signIn}
        >
          <Text style={styles.primaryButtonText}>
            {loggingIn ? "LOGGING IN..." : "LOGIN"}
          </Text>
        </Pressable>
      )}

      <Divider label="OR" />

      <Pressable
        style={styles.primaryButton}
        onPress={() => router.push(Routes.register)}
      >
        <Text style={styles.primaryButtonText}>SIGN UP NOW</Text>
      </Pressable>
    </AuthScreen>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>{label}</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: "#050505",
    fontFamily: "SoraBold",
    fontSize: 17,
    fontWeight: "400",
    lineHeight: 24,
    marginTop: 43,
    marginBottom: 32,
  },
  titleCompact: { marginTop: 14, marginBottom: 16 },
  primaryButton: {
    width: 320,
    height: 35,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: brandBlue,
    borderRadius: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  errorText: {
    width: 320,
    color: "#d93025",
    fontFamily: "Sora",
    fontSize: 8,
    marginTop: -4,
    marginBottom: 8,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 9,
    fontWeight: "400",
  },
  divider: {
    width: 320,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 11,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e4e4e4",
  },
  dividerText: {
    color: "#d4d4d4",
    fontFamily: "Sora",
    fontSize: 8,
  },
  formReveal: {
    width: 320,
    overflow: "hidden",
    justifyContent: "flex-start",
    gap: 9,
  },
  fieldGroup: {
    gap: 4,
  },
  fieldLabel: {
    color: "#111111",
    fontFamily: "SoraBold",
    fontSize: 8,
  },
  input: {
    width: 320,
    height: 38,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: brandBlue,
    borderRadius: 9,
    color: "#111111",
    fontFamily: "Sora",
    fontSize: 10,
  },
  passwordInputWrap: {
    width: 320,
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: brandBlue,
    borderRadius: 9,
  },
  passwordInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 12,
    color: "#111111",
    fontFamily: "Sora",
    fontSize: 10,
  },
  eyeButton: {
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
});
