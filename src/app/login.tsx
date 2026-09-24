import { useFonts } from "expo-font";
import { router } from "expo-router";
import Eye from "lucide-react-native/icons/eye";
import EyeOff from "lucide-react-native/icons/eye-off";
import { useRef, useState } from "react";
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

export default function LoginScreen() {
  const [emailLoginVisible, setEmailLoginVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const formProgress = useRef(new Animated.Value(0)).current;
  const [fontsLoaded] = useFonts({
    Sora: require("../../assets/fonts/Sora.ttf"),
    SoraBold: require("../../assets/fonts/Sora-Bold.ttf"),
    WDXLLubrifontSC: require("../../assets/fonts/WDXLLubrifontSC.ttf"),
  });

  if (!fontsLoaded) {
    return <View style={styles.loadingScreen} />;
  }

  const showEmailLogin = () => {
    setEmailLoginVisible(true);
    Animated.timing(formProgress, {
      toValue: 1,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
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

        <Text style={styles.title}>SIGN IN</Text>

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

        {!emailLoginVisible ? (
          <Animated.View style={{ opacity: introOpacity }}>
            <Pressable style={styles.primaryButton} onPress={showEmailLogin}>
              <Text style={styles.primaryButtonText}>CONTINUE WITH EMAIL</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <Pressable style={styles.primaryButton} onPress={() => {}}>
            <Text style={styles.primaryButtonText}>LOGIN</Text>
          </Pressable>
        )}

        <Divider label="OR" />

        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push("/register")}
        >
          <Text style={styles.primaryButtonText}>SIGN UP NOW</Text>
        </Pressable>

        <Text style={styles.partnerText}>
          Want to become a TsuperHero partner?{" "}
          <Text style={styles.partnerLink}>Apply now</Text>!
        </Text>
      </View>
    </SafeAreaView>
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
  loadingScreen: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  brandArea: {
    alignItems: "center",
  },
  logo: {
    width: 78,
    height: 78,
  },
  logoBackground: {
    width: 104,
    height: 104,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1034A6",
    borderRadius: 24,
  },
  wordmark: {
    color: brandBlue,
    fontFamily: "WDXLLubrifontSC",
    fontSize: 43,
    lineHeight: 49,
    marginTop: 14,
  },
  title: {
    color: "#050505",
    fontFamily: "SoraBold",
    fontSize: 17,
    fontWeight: "400",
    lineHeight: 24,
    marginTop: 43,
    marginBottom: 32,
  },
  primaryButton: {
    width: 320,
    height: 35,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: brandBlue,
    borderRadius: 10,
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
  noAccountText: {
    color: "#d4d4d4",
    fontFamily: "Sora",
    fontSize: 8,
    marginTop: 7,
    marginBottom: 11,
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
  partnerText: {
    color: "#111111",
    fontFamily: "Sora",
    fontSize: 7,
    marginTop: 10,
    textAlign: "center",
    width: 320,
  },
  partnerLink: {
    color: brandBlue,
    fontFamily: "SoraBold",
    textDecorationLine: "underline",
  },
});
