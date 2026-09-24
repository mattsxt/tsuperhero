import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useColorScheme } from "react-native";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { AppFonts } from "@/constants/fonts";

SplashScreen.preventAutoHideAsync();

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
        <Stack.Screen name="explore" />
      </Stack>
    </ThemeProvider>
  );
}
