import { BlurTargetView } from "expo-blur";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import CircleUserRound from "lucide-react-native/icons/circle-user-round";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import FileText from "lucide-react-native/icons/file-text";
import LogOut from "lucide-react-native/icons/log-out";
import ShieldCog from "lucide-react-native/icons/shield-cog";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { logout } from "@/api/v1/auth/controllers";
import {
  loadProfileSummary,
<<<<<<< HEAD
  type ProfileSummary,
} from "@/api/v1/profile/controllers";
import { BottomNav, bottomNavHeight } from "@/components/bottom-nav";
import { LoadingLogo } from "@/components/LoadingLogo";
=======
  peekProfileSummary,
  peekSignedInHomeRoute,
  type ProfileSummary,
} from "@/api/v1/profile/controllers";
import { BottomNav, bottomNavHeight } from "@/components/bottom-nav";
>>>>>>> origin/mapbox
import {
  ExpandedOnly,
  headerLayoutTransition,
  headerLogoTransition,
  headerTitleTransition,
  StickyHeader,
  useScrollChrome,
} from "@/components/scroll-chrome";
import { LoadingScreen, signOutMessages } from "@/components/LoadingScreen";
import { Routes } from "@/constants/routes";
<<<<<<< HEAD
=======
import { useOnline } from "@/hooks/use-online";
>>>>>>> origin/mapbox

const brandBlue = "#193caf";
const headerBlue = "#1034A6";
const cardEdgeBlue = "#1a2f8f";
const iconBackground = "#d4ecf9";
const dangerRed = "#a31818";
const signOutMinMs = 1200;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const chrome = useScrollChrome();
  const blurTarget = useRef<View | null>(null);
<<<<<<< HEAD
  const [summary, setSummary] = useState<ProfileSummary | null>(null);
  const [signingOut, setSigningOut] = useState(false);
=======
  const [summary, setSummary] = useState<ProfileSummary | null>(
    peekProfileSummary,
  );
  const [signingOut, setSigningOut] = useState(false);
  const online = useOnline();
>>>>>>> origin/mapbox

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
    const [result] = await Promise.all([
      logout(),
      new Promise((resolve) => setTimeout(resolve, signOutMinMs)),
    ]);

    if (!result.ok) {
      setSigningOut(false);
      Alert.alert("Couldn't sign out", result.error);
      return;
    }
    router.replace(Routes.login);
  };

  if (signingOut) return <LoadingScreen messages={signOutMessages} />;

<<<<<<< HEAD
  if (!summary) {
    return (
      <View style={styles.loadingScreen}>
        <LoadingLogo color={brandBlue} />
      </View>
    );
  }
=======
  const homeRoute = summary?.homeRoute ?? peekSignedInHomeRoute();
>>>>>>> origin/mapbox

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
<<<<<<< HEAD
              accessibilityLabel={`Edit profile of ${summary.fullName}`}
=======
              accessibilityLabel={
                summary ? `Edit profile of ${summary.fullName}` : "Edit profile"
              }
              disabled={!summary || !online}
>>>>>>> origin/mapbox
              onPress={() => router.push(Routes.profileEdit)}
              style={({ pressed }) => [
                styles.card,
                styles.profileCard,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.avatar}>
<<<<<<< HEAD
                {summary.pictureUrl ? (
=======
                {summary?.pictureUrl ? (
>>>>>>> origin/mapbox
                  <Image
                    source={{ uri: summary.pictureUrl }}
                    style={styles.avatarImage}
                    contentFit="cover"
                  />
                ) : (
<<<<<<< HEAD
                  <Text style={styles.avatarText}>{summary.initials}</Text>
=======
                  <Text style={styles.avatarText}>
                    {summary?.initials ?? "…"}
                  </Text>
>>>>>>> origin/mapbox
                )}
              </View>
              <View style={styles.profileText}>
                <Text style={styles.profileName} numberOfLines={1}>
<<<<<<< HEAD
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
=======
                  {summary?.fullName ?? "Loading profile…"}
                </Text>
                <Text style={styles.profileDetail} numberOfLines={1}>
                  {summary?.email ?? ""}
                </Text>
                <Text style={styles.profileDetail}>
                  {summary?.contactNumber ?? ""}
                </Text>
              </View>
              {summary && (
                <View style={styles.userTypeBadge}>
                  <Text style={styles.userTypeText}>
                    {summary.userTypeLabel}
                  </Text>
                </View>
              )}
>>>>>>> origin/mapbox
              <ChevronRight color={brandBlue} size={20} strokeWidth={2.5} />
            </Pressable>

            <Text style={styles.sectionLabel}>Actions</Text>
<<<<<<< HEAD
=======
            {!online && (
              <Text style={styles.offlineNotice}>
                Connect to the internet to edit your profile or sign out.
              </Text>
            )}
>>>>>>> origin/mapbox
            <View style={styles.actions}>
              <ActionRow
                label="Security"
                onPress={() => router.push(Routes.profileSecurity)}
                icon={
                  <ShieldCog color={brandBlue} size={18} strokeWidth={1.8} />
                }
              />
<<<<<<< HEAD
              {summary.userType === "transit_personnel" && (
=======
              {summary?.userType === "transit_personnel" && (
>>>>>>> origin/mapbox
                <ActionRow
                  label="Vehicles & Documents"
                  onPress={() => router.push(Routes.profileVehicles)}
                  icon={
                    <FileText color={brandBlue} size={18} strokeWidth={1.8} />
                  }
                />
              )}
              <ActionRow
                label="Sign out"
                danger
<<<<<<< HEAD
                disabled={signingOut}
=======
                disabled={signingOut || !online}
>>>>>>> origin/mapbox
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
            <View
              style={[
                styles.headerRow,
                chrome.collapsed && styles.headerRowCollapsedIcon,
              ]}
            >
              <View style={styles.headerTextBlock}>
                <Animated.Text
                  style={[
                    styles.title,
                    chrome.collapsed && styles.titleCollapsed,
                    headerTitleTransition,
                  ]}
                >
                  User Profile and Actions
                </Animated.Text>
                <ExpandedOnly collapsed={chrome.collapsed}>
                  <Text style={styles.subtitle}>
                    Manage your own profile and settings
                  </Text>
                </ExpandedOnly>
              </View>
              <Animated.View
                style={[
                  styles.headerIcon,
                  chrome.collapsed && styles.headerIconCollapsed,
                  headerLogoTransition,
                ]}
              >
                <CircleUserRound color="#ffffff" size={40} strokeWidth={1.8} />
              </Animated.View>
            </View>
          </Animated.View>
        </StickyHeader>
      </BlurTargetView>

<<<<<<< HEAD
      <BottomNav
        active="profile"
        homeRoute={summary.homeRoute}
        blurTarget={blurTarget}
        hidden={chrome.navHidden}
      />
=======
      {homeRoute && (
        <BottomNav
          active="profile"
          homeRoute={homeRoute}
          blurTarget={blurTarget}
          hidden={chrome.navHidden}
        />
      )}
>>>>>>> origin/mapbox
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
<<<<<<< HEAD
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
=======
>>>>>>> origin/mapbox
  screen: { flex: 1, backgroundColor: "#ffffff" },
  blurTarget: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    backgroundColor: headerBlue,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerRowCollapsedIcon: { alignItems: "center" },
  headerTextBlock: { flex: 1 },
  headerIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    opacity: 1,
    transform: [{ scale: 1 }],
  },
  headerIconCollapsed: {
    width: 0,
    height: 0,
    opacity: 0,
    transform: [{ scale: 0.4 }],
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
<<<<<<< HEAD
=======
  offlineNotice: {
    color: "#6b6b6b",
    fontFamily: "Sora",
    fontSize: 10,
    marginBottom: 8,
  },
>>>>>>> origin/mapbox
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
