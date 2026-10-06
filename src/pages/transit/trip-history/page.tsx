import { StatusBar } from "expo-status-bar";
import Clock from "lucide-react-native/icons/clock";
import Route from "lucide-react-native/icons/route";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/empty-state";
import { ModuleHeader, moduleColors } from "@/components/module-ui";
import { StickyHeader, useScrollChrome } from "@/components/scroll-chrome";
import { Routes } from "@/constants/routes";
import { goBackOr } from "@/utils/navigation";

const { brandBlue } = moduleColors;

export default function TripHistoryScreen() {
  const insets = useSafeAreaInsets();
  const chrome = useScrollChrome();

  const goBack = () => goBackOr(Routes.transitHome);

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
          <EmptyState
            icon={<Route color={brandBlue} size={32} strokeWidth={1.8} />}
            message="Trips you complete will show up here."
            style={styles.centered}
          />
        </View>
      </Animated.ScrollView>

      <StickyHeader chrome={chrome}>
        <ModuleHeader
          title="Trip History"
          subtitle="Look back on your completed trips, passengers served and time on the road."
          icon={<Clock color="#ffffff" size={44} strokeWidth={1.8} />}
          onBack={goBack}
          collapsed={chrome.collapsed}
        />
      </StickyHeader>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  body: { flex: 1, paddingHorizontal: 12, paddingTop: 18 },
  centered: { flex: 1, justifyContent: "center" },
});
