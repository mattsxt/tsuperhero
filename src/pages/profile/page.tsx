import { BlurTargetView } from "expo-blur";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import FileText from "lucide-react-native/icons/file-text";
import LogOut from "lucide-react-native/icons/log-out";
import ShieldCog from "lucide-react-native/icons/shield-cog";
import ShieldQuestionMark from "lucide-react-native/icons/shield-question-mark";
import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { logout } from "@/api/v1/auth/controllers";
import {
  loadProfileSummary,
  type ProfileSummary,
} from "@/api/v1/profile/controllers";
import { BottomNav, bottomNavHeight } from "@/components/bottom-nav";
import {
  ExpandedOnly,
  headerLayoutTransition,
  StickyHeader,
  useScrollChrome,
} from "@/components/scroll-chrome";
import { Routes } from "@/constants/routes";

const brandBlue = "#193caf";
const headerBlue = "#1034A6";
const cardEdgeBlue = "#1a2f8f";
const iconBackground = "#d4ecf9";
const dangerRed = "#a31818";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const chrome = useScrollChrome();
  const blurTarget = useRef<View | null>(null);
  const [summary, setSummary] = useState<ProfileSummary | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const load = async () => {
        const result = await loadProfileSummary();
        if ("redirect" in result) {
          router.replace(result.redirect);
          return;
        }
        if (active) setSummary(result);
      };

      load();
      return () => {
        active = false;
      };
    }, []),
  );

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    const result = await logout();
    setSigningOut(false);

    if (!result.ok) {
      Alert.alert("Couldn't sign out", result.error);
      return;
    }
    router.replace(Routes.login);
  };

  if (!summary) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={brandBlue} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <BlurTargetView ref={blurTarget} style={styles.blurTarget}>
        <Animated.ScrollView
          onScroll={chrome.scrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingTop: chrome.headerHeight,
            paddingBottom: insets.bottom + bottomNavHeight,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.body}>
            <Text style={styles.sectionLabel}>Configure your profile</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit profile of ${summary.fullName}`}
              onPress={() => router.push(Routes.profileEdit)}
              style={({ pressed }) => [
                styles.card,
                styles.profileCard,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.avatar}>
                {summary.pictureUrl ? (
                  <Image
                    source={{ uri: summary.pictureUrl }}
                    style={styles.avatarImage}
                    contentFit="cover"
                  />
                ) : (
                  <Text style={styles.avatarText}>{summary.initials}</Text>
                )}
              </View>
              <View style={styles.profileText}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {summary.fullName}
                </Text>
                <Text style={styles.profileDetail} numberOfLines={1}>
                  {summary.email}
                </Text>
                <Text style={styles.profileDetail}>
                  {summary.contactNumber}
                </Text>
              </View>
              <View style={styles.userTypeBadge}>
                <Text style={styles.userTypeText}>{summary.userTypeLabel}</Text>
              </View>
              <ChevronRight color={brandBlue} size={20} strokeWidth={2.5} />
            </Pressable>

            <Text style={styles.sectionLabel}>Actions</Text>
            <View style={styles.actions}>
              <ActionRow
                label="Security"
                onPress={() => router.push(Routes.profileSecurity)}
                icon={
                  <ShieldCog color={brandBlue} size={18} strokeWidth={1.8} />
                }
              />
              {summary.userType === "transit_personnel" ? (
                <ActionRow
                  label="Vehicles & Documents"
                  onPress={() => router.push(Routes.profileVehicles)}
                  icon={
                    <FileText color={brandBlue} size={18} strokeWidth={1.8} />
                  }
                />
              ) : (
                <ActionRow
                  label="Help & Support"
                  icon={
                    <ShieldQuestionMark
                      color={brandBlue}
                      size={18}
                      strokeWidth={1.8}
                    />
                  }
                />
              )}
              <ActionRow
                label={signingOut ? "Signing out..." : "Sign out"}
                danger
                disabled={signingOut}
                onPress={signOut}
                icon={<LogOut color={dangerRed} size={18} strokeWidth={1.8} />}
                trailing={null}
              />
            </View>
          </View>
        </Animated.ScrollView>

        <StickyHeader chrome={chrome}>
          <Animated.View
            layout={headerLayoutTransition}
            style={[
              styles.header,
              chrome.collapsed && styles.headerCollapsed,
              { paddingTop: insets.top + (chrome.collapsed ? 10 : 16) },
            ]}
          >
            <Text
              style={[styles.title, chrome.collapsed && styles.titleCollapsed]}
            >
              User Profile and Actions
            </Text>
            <ExpandedOnly collapsed={chrome.collapsed}>
              <Text style={styles.subtitle}>
                Manage your own profile and settings
              </Text>
            </ExpandedOnly>
          </Animated.View>
        </StickyHeader>
      </BlurTargetView>

      <BottomNav
        active="profile"
        homeRoute={summary.homeRoute}
        blurTarget={blurTarget}
        hidden={chrome.navHidden}
      />
    </View>
  );
}

function ActionRow({
  label,
  icon,
  onPress,
  trailing,
  danger,
  disabled,
}: {
  label: string;
  icon: ReactNode;
  onPress?: () => void;
  trailing?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        styles.actionRow,
        danger && styles.dangerCard,
        (pressed || disabled) && styles.pressed,
      ]}
    >
      <View style={[styles.iconCircle, danger && styles.dangerIconCircle]}>
        {icon}
      </View>
      <Text style={[styles.actionLabel, danger && styles.dangerText]}>
        {label}
      </Text>
      {trailing === undefined ? (
        <ChevronRight color={brandBlue} size={20} strokeWidth={2.5} />
      ) : (
        trailing
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  screen: { flex: 1, backgroundColor: "#ffffff" },
  blurTarget: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    backgroundColor: headerBlue,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerCollapsed: { paddingBottom: 14 },
  title: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 21,
    lineHeight: 28,
  },
  titleCollapsed: { fontSize: 17, lineHeight: 24 },
  subtitle: {
    color: "#ffffff",
    fontFamily: "Sora",
    fontSize: 10,
    marginTop: 4,
  },
  body: { paddingHorizontal: 12 },
  sectionLabel: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 10,
    marginTop: 18,
    marginBottom: 10,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: brandBlue,
    borderRightWidth: 5,
    borderRightColor: cardEdgeBlue,
    borderRadius: 10,
  },
  pressed: { opacity: 0.7 },
  profileCard: {
    minHeight: 84,
    paddingLeft: 18,
    paddingRight: 12,
    paddingVertical: 14,
  },
  avatar: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 23,
    backgroundColor: iconBackground,
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarText: { color: "#111111", fontFamily: "SoraBold", fontSize: 15 },
  profileText: { flex: 1, marginLeft: 12, marginRight: 8 },
  profileName: { color: brandBlue, fontFamily: "SoraBold", fontSize: 16 },
  profileDetail: {
    color: "#111111",
    fontFamily: "Sora",
    fontSize: 8,
    marginTop: 3,
  },
  userTypeBadge: {
    position: "absolute",
    top: 8,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#0f2a5c",
  },
  userTypeText: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 6 },
  actions: { gap: 12 },
  actionRow: { height: 62, paddingLeft: 20, paddingRight: 12 },
  iconCircle: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: iconBackground,
  },
  actionLabel: {
    flex: 1,
    marginLeft: 20,
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 16,
  },
  dangerCard: { borderColor: dangerRed, borderRightColor: "#7a1010" },
  dangerIconCircle: { backgroundColor: "#f7c9c9" },
  dangerText: { color: dangerRed },
});
