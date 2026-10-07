import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import WifiOff from "lucide-react-native/icons/wifi-off";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getStartupRoute } from "@/api/v1/auth/controllers";
import { BrandLogo } from "@/components/brand-logo";
import { LoadingLogo } from "@/components/LoadingLogo";
import { Routes } from "@/constants/routes";
import { checkOnline, useOnline } from "@/hooks/use-online";

const headerBlue = "#1034A6";
const brandBlue = "#193caf";

export default function OfflineScreen() {
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const [checking, setChecking] = useState(false);
  const [stillOffline, setStillOffline] = useState(false);

  const retry = useCallback(async () => {
    setChecking(true);
    setStillOffline(false);
    const connected = await checkOnline();
    if (!connected) {
      setChecking(false);
      setStillOffline(true);
      return;
    }
    const route = await getStartupRoute();
    setChecking(false);
    if (route === Routes.offline) {
      setStillOffline(true);
      return;
    }
    router.replace(route);
  }, []);

  useEffect(() => {
    if (!online) return;
    let active = true;
    getStartupRoute().then((route) => {
      if (active && route !== Routes.offline) router.replace(route);
    });
    return () => {
      active = false;
    };
  }, [online]);

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <StatusBar style="light" />
      <View style={styles.brand}>
        <BrandLogo size={44} />
        <Text style={styles.wordmark}>Tsuperhero</Text>
      </View>

      <Animated.View entering={FadeIn.duration(300)} style={styles.card}>
        <View style={styles.iconRing}>
          <WifiOff color={headerBlue} size={34} strokeWidth={2} />
        </View>
        <Text style={styles.title}>You&apos;re offline</Text>
        <Text style={styles.body}>
          Tsuperhero needs to connect once to load your account, routes and
          waiting areas onto this phone. After that, they stay available even
          without signal.
        </Text>
        <Text style={styles.hint}>
          Turn on mobile data or Wi-Fi. We&apos;ll continue automatically as
          soon as you&apos;re connected.
        </Text>
        {stillOffline && (
          <Text style={styles.warning}>Still no connection. Try again.</Text>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Try connecting again"
          accessibilityState={{ busy: checking }}
          disabled={checking}
          onPress={retry}
          style={({ pressed }) => [
            styles.button,
            (pressed || checking) && styles.pressed,
          ]}
        >
          {checking ? (
            <LoadingLogo color="#ffffff" size={22} />
          ) : (
            <>
              <RefreshCw color="#ffffff" size={16} strokeWidth={2.4} />
              <Text style={styles.buttonText}>TRY AGAIN</Text>
            </>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 20,
    backgroundColor: headerBlue,
  },
  brand: { alignItems: "center", gap: 6 },
  wordmark: {
    color: "#ffffff",
    fontFamily: "WDXLLubrifontSC",
    fontSize: 30,
    lineHeight: 36,
  },
  card: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 22,
    borderRadius: 24,
    backgroundColor: "#ffffff",
  },
  iconRing: {
    width: 76,
    height: 76,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 38,
    backgroundColor: "#e3ecfb",
  },
  title: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 20,
    marginTop: 16,
  },
  body: {
    color: "#111111",
    fontFamily: "Sora",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 8,
    textAlign: "center",
  },
  hint: {
    color: "#6b6b6b",
    fontFamily: "Sora",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 10,
    textAlign: "center",
  },
  warning: {
    color: "#c2410c",
    fontFamily: "SoraBold",
    fontSize: 10,
    marginTop: 12,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "stretch",
    height: 50,
    marginTop: 20,
    borderRadius: 14,
    backgroundColor: brandBlue,
  },
  buttonText: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 14,
    letterSpacing: 1,
  },
  pressed: { opacity: 0.7 },
});
