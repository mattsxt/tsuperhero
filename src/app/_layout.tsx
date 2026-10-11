import "../../global.css";

import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { HeroUINativeProvider } from "heroui-native";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { BoardedModal } from "@/components/boarded-modal";
import { NotificationSync } from "@/components/notification-sync";
import { OfflineBanner } from "@/components/offline-banner";
import { RideUpdateModal } from "@/components/ride-update-modal";
import { ShareInviteModal } from "@/components/share-invite-modal";
import { UnfinishedTripPrompt } from "@/components/unfinished-trip-prompt";
import { AppFonts } from "@/constants/fonts";

SplashScreen.preventAutoHideAsync();

const tabScreenOptions = {
  gestureEnabled: false,
  animation: "fade" as const,
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts(AppFonts);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <HeroUINativeProvider>
          <ThemeProvider
            value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
          >
            <AnimatedSplashOverlay />
            <NotificationSync />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="landing/index" />
              <Stack.Screen
                name="offline/index"
                options={{ gestureEnabled: false }}
              />
              <Stack.Screen name="auth/login/index" />
              <Stack.Screen name="auth/register/index" />
              <Stack.Screen
                name="auth/setup/index"
                options={{ gestureEnabled: false }}
              />
              <Stack.Screen
                name="commuter/home/index"
                options={tabScreenOptions}
              />
              <Stack.Screen
                name="transit/home/index"
                options={tabScreenOptions}
              />
              <Stack.Screen
                name="notifications/index"
                options={tabScreenOptions}
              />
              <Stack.Screen name="profile/index" options={tabScreenOptions} />
              <Stack.Screen name="profile/edit/index" />
              <Stack.Screen name="profile/security/index" />
              <Stack.Screen name="profile/help/index" />
              <Stack.Screen name="profile/vehicles/index" />
              <Stack.Screen name="commuter/pickup/index" />
              <Stack.Screen name="commuter/rental/index" />
              <Stack.Screen name="commuter/routes/index" />
              <Stack.Screen
                name="transit/start-trip/index"
                options={{ gestureEnabled: false }}
              />
              <Stack.Screen name="transit/rental-requests/index" />
              <Stack.Screen name="transit/trip-history/index" />
              <Stack.Screen name="commuter/bookings/index" />
            </Stack>
            <OfflineBanner />
            <ShareInviteModal />
            <RideUpdateModal />
            <BoardedModal />
            <UnfinishedTripPrompt />
          </ThemeProvider>
        </HeroUINativeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
