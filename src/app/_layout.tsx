import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useColorScheme } from "react-native";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import type { TabTransition } from "@/components/bottom-nav";
import { AppFonts } from "@/constants/fonts";

SplashScreen.preventAutoHideAsync();

const tabScreenOptions = ({
  route,
}: {
  route: { params?: { transition?: TabTransition } };
}) => ({
  gestureEnabled: false,
  animation: "slide_from_right" as const,
  animationTypeForReplace:
    route.params?.transition === "back" ? ("pop" as const) : ("push" as const),
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts(AppFonts);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="landing/index" />
        <Stack.Screen name="auth/login/index" />
        <Stack.Screen name="auth/register/index" />
        <Stack.Screen
          name="auth/setup/index"
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen name="commuter/home/index" options={tabScreenOptions} />
        <Stack.Screen name="profile/index" options={tabScreenOptions} />
        <Stack.Screen name="explore" />
      </Stack>
    </ThemeProvider>
  );
}
