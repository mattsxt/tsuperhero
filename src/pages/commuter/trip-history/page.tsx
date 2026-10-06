import { StatusBar } from "expo-status-bar";
import Clock from "lucide-react-native/icons/clock";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ModuleHeader } from "@/components/module-ui";
import { StickyHeader, useScrollChrome } from "@/components/scroll-chrome";
import { Routes } from "@/constants/routes";
import { TripHistory } from "@/pages/commuter/home/trip-history";
import { goBackOr } from "@/utils/navigation";

export default function CommuterTripHistoryScreen() {
  const insets = useSafeAreaInsets();
  const chrome = useScrollChrome();

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <Animated.ScrollView
        onScroll={chrome.scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: chrome.headerHeight,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>
          <TripHistory />
        </View>
      </Animated.ScrollView>

      <StickyHeader chrome={chrome}>
        <ModuleHeader
          title="Trip History"
          subtitle="Every ride you've taken with a driver you were matched with."
          icon={<Clock color="#ffffff" size={44} strokeWidth={1.8} />}
          onBack={() => goBackOr(Routes.commuterHome)}
          collapsed={chrome.collapsed}
        />
      </StickyHeader>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  body: { flex: 1, paddingHorizontal: 12, paddingTop: 18 },
});
