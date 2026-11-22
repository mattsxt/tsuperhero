import { Platform, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function useStatusBarTop() {
  const insets = useSafeAreaInsets();
  const androidBar =
    Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0;
  return Math.max(insets.top, androidBar);
}
