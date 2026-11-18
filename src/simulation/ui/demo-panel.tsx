import { useEffect, useRef, useState } from "react";
import {
  Animated as NativeAnimated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { Image as ExpoImage } from "expo-image";
import ChevronsLeft from "lucide-react-native/icons/chevrons-left";
import ChevronsRight from "lucide-react-native/icons/chevrons-right";
import Pause from "lucide-react-native/icons/pause";
import Play from "lucide-react-native/icons/play";
import Settings from "lucide-react-native/icons/settings";
import { router, usePathname } from "expo-router";

import { Routes } from "@/constants/routes";
import { generateRideAsCompanion, generateRideAsHost } from "@/simulation/demo-rides";
import { initialsOf } from "@/utils/initials";

import { moduleColors } from "@/components/module-ui";
import { palette } from "@/constants/colors";
import { currentUserId } from "@/simulation/auth";
import { db } from "@/simulation/db";
import * as engine from "@/simulation/engine";
import {
  hasBusyCompanions,
  markCompanionBusy,
  resetAllCompanionBusy,
} from "@/simulation/companion-busy";
import { generateNotification } from "@/simulation/notifications-sim";
import {
  acceptMyRentalNow,
  completeAcceptedRentalNow,
  hasCompletedRentalJobs,
  rateCompletedRentalNow,
  postRentalRequestNow,
} from "@/simulation/rentals-sim";
import {
  myVehicleType,
  resetDemo,
  switchRole,
  switchVehicleType,
  type DemoVehicleType,
} from "@/simulation/ui/actions";
import { actionsFor, type PanelAction } from "@/simulation/ui/panel-actions";
import { GenerateVehicleModal } from "@/simulation/ui/vehicle-settings";
import {
  clearGeneratedVehicles,
  generatedVehicleCount,
} from "@/simulation/generated-vehicles";

const size = 56;
const toggleHeight = 20;
const toggleGap = 6;
const handleWidth = 26;
const handleHeight = 52;
const faint = "#f3f4f6";
const faintOpacity = 0.3;
const faintBackground = "rgba(209, 213, 219, 0.6)";
const openMs = 260;
const closeMs = 220;
const speeds: engine.Speed[] = [1, 4, 10];

const hasActiveTrip = () => {
  const id = currentUserId();
  const personnel = db.tables.transit_personnel.find((x) => x.user_id === id);
  const driver = db.tables.driver.find(
    (d) => d.personnel_id === personnel?.personnel_id && d.vehicle_id,
  );
  return db.tables.trip.some(
    (t) => t.vehicle_id === driver?.vehicle_id && t.trip_status === "active",
  );
};

const isDriver = () => {
  const id = currentUserId();
  return db.tables.user.some(
    (u) => u.user_id === id && u.user_type === "transit_personnel",
  );
};

export function DemoPanel() {
  const pathname = usePathname();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const x = useSharedValue(width - size - 4);
  const y = useSharedValue(height / 2 - size / 2);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [side, setSide] = useState<"left" | "right">("right");
  const progress = useSharedValue(0);
  const sheetHeight = useSharedValue(480);
  const [driver, setDriver] = useState(false);
  const [vehicleType, setVehicleType] = useState<DemoVehicleType | null>(null);
  const [speed, setSpeed] = useState<engine.Speed>(engine.getSpeed());
  const [notice, setNotice] = useState("");
  const [invites, setInvites] = useState<engine.CompanionInvite[]>([]);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [tripActive, setTripActive] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [paused, setPaused] = useState(engine.isPaused());
  useEffect(
    () =>
      engine.subscribe((state) => {
        setSpeed(state.speed);
        setPaused(state.paused);
      }),
    [],
  );
  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    const refresh = () => setInvites(engine.pendingCompanionInvites());
    refresh();
    return db.subscribe(refresh);
  }, [open]);

  const show = (text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 3000);
  };

  const openSheet = () => {
    setDriver(isDriver());
    setVehicleType(myVehicleType());
    setGeneratedCount(generatedVehicleCount());
    setTripActive(hasActiveTrip());
    setSpeed(engine.getSpeed());
    setNotice("");
    setOpen(true);
    progress.value = withTiming(1, {
      duration: openMs,
      easing: Easing.out(Easing.cubic),
    });
  };

  const closeSheet = () => {
    progress.value = withTiming(
      0,
      { duration: closeMs, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) scheduleOnRN(setOpen, false);
      },
    );
  };

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * sheetHeight.value }],
  }));

  const minY = insets.top + 8;
  const maxY = height - size - toggleGap - toggleHeight - insets.bottom - 8;
  const maxX = width - size - 4;

  const pan = Gesture.Pan()
    .minDistance(6)
    .onStart(() => {
      startX.value = x.value;
      startY.value = y.value;
    })
    .onUpdate((e) => {
      x.value = Math.min(maxX, Math.max(4, startX.value + e.translationX));
      y.value = Math.min(maxY, Math.max(minY, startY.value + e.translationY));
    })
    .onEnd(() => {
      scheduleOnRN(setSide, x.value + size / 2 > width / 2 ? "right" : "left");
    });
  const tap = Gesture.Tap().onEnd((_e, ok) => {
    if (ok) scheduleOnRN(openSheet);
  });
  const gesture = Gesture.Exclusive(pan, tap);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));
  const handleStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value + (size - handleHeight) / 2 }],
  }));
  const HideIcon = side === "right" ? ChevronsRight : ChevronsLeft;
  const ShowIcon = side === "right" ? ChevronsLeft : ChevronsRight;

  const chooseSpeed = (next: engine.Speed) => {
    engine.setSpeed(next);
    setSpeed(next);
  };

  const arrive = () => {
    if (engine.arriveNow()) {
      closeSheet();
    } else {
      show("Nothing moving");
    }
  };

  const sendRequest = () => {
    if (engine.sendPickupRequest()) {
      show("Request sent");
    } else {
      show(engine.sendPickupRequestReason() ?? "Can't send yet");
    }
  };

  const runAction = (action: PanelAction) => {
    if (action === "arriveNow") return arrive();
    if (action === "sendPickupRequest") return sendRequest();
    if (action === "acceptMyRental") {
      const count = acceptMyRentalNow();
      show(count ? `Rental accepted${count === 1 ? "" : ` · ${count} units`}` : "No open rental");
      return;
    }
    if (action === "postRentalRequest") {
      const id = postRentalRequestNow();
      show(id ? "Rental posted" : "Can't post rental");
      return;
    }
    if (action === "completeAcceptedRental") {
      const completed = completeAcceptedRentalNow();
      show(completed ? "Rental completed" : "No rental to complete");
      return;
    }
    if (action === "generateRatings") {
      const score = rateCompletedRentalNow();
      show(score ? `${score}★ rating received` : "All jobs rated");
      return;
    }
    if (action === "generateRideAsHost" || action === "generateRideAsCompanion") {
      const result =
        action === "generateRideAsHost" ? generateRideAsHost() : generateRideAsCompanion();
      show(result.message);
      if (!result.ok) return;
      closeSheet();
      if (pathname !== Routes.commuterPickup) router.push(Routes.commuterPickup);
      return;
    }
    const result = generateNotification();
    show(result.ok ? `Sent: ${result.type.replaceAll("_", " ")}` : "Nothing to notify");
  };

  const canPause = !driver && pathname === Routes.commuterPickup;
  const canPauseTrip = driver && pathname === Routes.transitStartTrip && tripActive;
  const togglePause = () => (paused ? engine.resume() : engine.pause());
  const onRoutes = !driver && pathname === Routes.commuterRoutes;

  const visibleActions = actionsFor(pathname, driver ? "driver" : "commuter", hasActiveTrip());
  if (!driver && pathname === Routes.commuterPickup) {
    const companion = !!engine.sharedRideId();
    const host = !!engine.hostedPickupId();
    if (!companion) visibleActions.push("generateRideAsHost");
    if (!host) visibleActions.push("generateRideAsCompanion");
  }
  if (!driver && pathname === Routes.commuterPickup) visibleActions.push("arriveNow");
  if (driver && pathname === Routes.transitRentalRequests && hasCompletedRentalJobs())
    visibleActions.push("generateRatings");

  return (
    <>
      {hidden ? (
        <Animated.View
          style={[
            styles.handle,
            side === "right" ? styles.handleRight : styles.handleLeft,
            handleStyle,
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show controls"
            hitSlop={8}
            onPress={() => setHidden(false)}
            style={styles.handleButton}
          >
            <ShowIcon color={faint} size={18} strokeWidth={2.6} />
          </Pressable>
        </Animated.View>
      ) : (
        <Animated.View style={[styles.fabWrap, buttonStyle]}>
          <GestureDetector gesture={gesture}>
            <View
              accessible
              accessibilityRole="button"
              accessibilityLabel="Open controls"
              accessibilityActions={[{ name: "activate" }]}
              onAccessibilityAction={openSheet}
              style={styles.fab}
            >
              <Settings color="#ffffff" size={26} strokeWidth={2.2} />
            </View>
          </GestureDetector>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hide controls"
            hitSlop={8}
            onPress={() => setHidden(true)}
            style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
          >
            <HideIcon color={faint} size={14} strokeWidth={2.6} />
          </Pressable>
        </Animated.View>
      )}

      <Modal
        visible={open}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeSheet}
      >
        <View style={styles.root}>
          <Animated.View style={[styles.backdrop, backdropStyle]}>
            <Pressable
              accessibilityLabel="Close controls"
              style={StyleSheet.absoluteFill}
              onPress={closeSheet}
            />
          </Animated.View>
          <Animated.View
            onLayout={(event) => {
              sheetHeight.value = event.nativeEvent.layout.height;
            }}
            style={[
              styles.sheet,
              { maxHeight: height - insets.top - 16 },
              sheetStyle,
            ]}
          >
            <ScrollView
              bounces={false}
              contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + 18 }]}
            >
              <View style={styles.titleRow}>
                <Text style={styles.title}>CONTROLS</Text>
                {vehicleType && <VehicleBadge type={vehicleType} />}
              </View>

              <Text style={styles.label}>SPEED</Text>
              <View style={styles.speedRow}>
                {speeds.map((value) => {
                  const active = value === speed;
                  return (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`Speed ${value} times`}
                      onPress={() => chooseSpeed(value)}
                      style={[styles.speed, active && styles.speedActive]}
                    >
                      <Text
                        style={[
                          styles.speedText,
                          active && styles.speedTextActive,
                        ]}
                      >
                        {value}×
                      </Text>
                    </Pressable>
                  );
                })}
                {canPause && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={paused ? "Resume" : "Pause"}
                    accessibilityState={{ selected: paused }}
                    onPress={togglePause}
                    style={[styles.speed, styles.pauseButton, paused && styles.pauseActive]}
                  >
                    {paused ? (
                      <Play color="#ffffff" size={22} strokeWidth={2.6} fill="#ffffff" />
                    ) : (
                      <Pause color={palette.brand} size={22} strokeWidth={2.6} fill={palette.brand} />
                    )}
                  </Pressable>
                )}
              </View>
              {paused && canPause && <Text style={styles.pausedNote}>PAUSED</Text>}

              {canPauseTrip && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={paused ? "Resume the trip" : "Pause the trip"}
                  accessibilityState={{ selected: paused }}
                  onPress={togglePause}
                  style={({ pressed }) => [
                    styles.tripPause,
                    paused && styles.tripPauseActive,
                    pressed && styles.pressed,
                  ]}
                >
                  {paused ? (
                    <Play color="#ffffff" size={18} strokeWidth={2.6} fill="#ffffff" />
                  ) : (
                    <Pause color={palette.brand} size={18} strokeWidth={2.6} fill={palette.brand} />
                  )}
                  <Text style={[styles.tripPauseText, paused && styles.tripPauseTextActive]}>
                    {paused ? "RESUME TRIP" : "PAUSE TRIP"}
                  </Text>
                </Pressable>
              )}
              {paused && canPauseTrip && (
                <Text style={styles.pausedNote}>TRIP PAUSED · THE VEHICLE IS STOPPED</Text>
              )}

              {onRoutes && (
                <ActionButton
                  label="GENERATE A VEHICLE"
                  onPress={() => {
                    closeSheet();
                    setGenerateOpen(true);
                  }}
                />
              )}
              {onRoutes && generatedCount > 0 && (
                <ActionButton
                  label={`CLEAR GENERATED VEHICLES (${generatedCount})`}
                  onPress={() => {
                    const count = clearGeneratedVehicles();
                    setGeneratedCount(0);
                    show(`Cleared ${count} generated vehicle${count === 1 ? "" : "s"}`);
                  }}
                />
              )}

              {visibleActions.map((action) => (
                <ActionButton key={action} label={actionLabels[action]} onPress={() => runAction(action)} />
              ))}

              {hasBusyCompanions() && (
                <ActionButton
                  label="CLEAR ALL BUSY"
                  onPress={() => {
                    const count = resetAllCompanionBusy();
                    show(`Cleared ${count} busy`);
                  }}
                />
              )}

              {invites.length > 0 && (
                <View style={styles.invites}>
                  <Text style={styles.label}>COMPANION INVITES</Text>
                  {invites.map((invite) => (
                    <View key={invite.key} style={styles.inviteCard}>
                      <View style={styles.inviteRow}>
                        <View style={styles.avatar}>
                          {invite.avatar ? (
                            <Image source={{ uri: invite.avatar }} style={styles.avatarImage} />
                          ) : (
                            <Text style={styles.avatarText}>{initialsOf(invite.name)}</Text>
                          )}
                        </View>
                        <View style={styles.inviteNameWrap}>
                          <Text style={styles.inviteName}>{invite.name}</Text>
                          {invite.busy && <Text style={styles.busyStatus}>CURRENTLY BUSY</Text>}
                        </View>
                        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!invite.busy }} accessibilityLabel={invite.busy ? `${invite.name} is busy` : `Accept ${invite.name}`} disabled={!!invite.busy} onPress={() => {
                          if (!engine.answerCompanionInvite(invite.key, true)) show("Companion busy");
                        }} style={[styles.inviteButton, !!invite.busy && styles.disabledButton]}>
                          <Text style={styles.inviteButtonText}>ACCEPT</Text>
                        </Pressable>
                        <Pressable accessibilityRole="button" accessibilityLabel={`Decline ${invite.name}`} onPress={() => engine.answerCompanionInvite(invite.key, false)} style={[styles.inviteButton, styles.declineButton]}>
                          <Text style={styles.inviteButtonText}>DECLINE</Text>
                        </Pressable>
                      </View>
                      {invite.hosted && pathname === Routes.commuterPickup && (
                      <View style={styles.busyActionRow}>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Mark ${invite.name} as busy`}
                            accessibilityState={{ disabled: !!invite.busy }}
                            disabled={!!invite.busy}
                            onPress={() => {
                              const marked = markCompanionBusy(invite.requestId, invite.commuterId);
                              show(marked ? `${invite.name.split(" ")[0]} is busy` : "Already busy");
                            }}
                            style={[styles.busyButton, !!invite.busy && styles.disabledButton]}
                          >
                            <Text style={styles.busyButtonText}>MARK AS BUSY</Text>
                        </Pressable>
                      </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
              {driver && (pathname === Routes.transitHome || pathname === Routes.profileVehicles) && (
                <ActionButton
                  label="SWITCH VEHICLE TYPE"
                  onPress={() => {
                    const result = switchVehicleType(pathname);
                    show(result.message);
                    if (result.ok) {
                      setVehicleType(myVehicleType());
                      closeSheet();
                    }
                  }}
                />
              )}
              <ActionButton
                label="SWITCH ROLE"
                onPress={() => {
                  closeSheet();
                  void switchRole().then((error) => {
                    if (error) show("Can't switch role");
                  });
                }}
              />
              <ActionButton
                label="RESET"
                danger
                onPress={() => {
                  closeSheet();
                  resetDemo();
                }}
              />

              <Pressable
                accessibilityRole="button"
                onPress={closeSheet}
                style={styles.close}
              >
                <Text style={styles.closeText}>CLOSE</Text>
              </Pressable>
            </ScrollView>
          </Animated.View>
          {!!notice && <DemoToast key={notice} text={notice} top={insets.top + 12} />}
        </View>
      </Modal>
      {!!notice && !open && <DemoToast key={notice} text={notice} top={insets.top + 12} />}
      <GenerateVehicleModal
        visible={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onDone={show}
      />
    </>
  );
}

const actionLabels: Record<PanelAction, string> = {
  arriveNow: "ARRIVE NOW",
  sendPickupRequest: "SEND A PICKUP REQUEST",
  acceptMyRental: "DRIVER ACCEPTS MY RENTAL",
  postRentalRequest: "POST A RENTAL REQUEST",
  completeAcceptedRental: "COMPLETE ACCEPTED RENTAL",
  generateNotification: "GENERATE A NOTIFICATION",
  generateRideAsHost: "GENERATE A RIDE · HOST",
  generateRideAsCompanion: "GENERATE A RIDE · COMPANION",
  generateRatings: "GENERATE RATINGS",
};

const vehicleBadges = {
  Jeepney: { code: "JPY", name: "Jeepney", logo: require("@/assets/images/jeepney.svg") },
  Tricycle: { code: "TRC", name: "Tricycle", logo: require("@/assets/images/tricycle.svg") },
};

function VehicleBadge({ type }: { type: DemoVehicleType }) {
  const { code, name, logo } = vehicleBadges[type];
  return (
    <View accessible accessibilityLabel={`Operating a ${name}`} style={styles.vehicleBadge}>
      <ExpoImage source={logo} style={styles.vehicleBadgeLogo} tintColor="#111827" contentFit="contain" />
      <Text style={styles.vehicleBadgeText}>{code}</Text>
    </View>
  );
}

function DemoToast({ text, top }: { text: string; top: number }) {
  const [shown] = useState(() => new NativeAnimated.Value(0));
  useEffect(() => {
    const fade = NativeAnimated.timing(shown, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    });
    fade.start();
    return () => fade.stop();
  }, [shown]);
  return (
    <View pointerEvents="none" style={[styles.toastLane, { top }]}>
      <NativeAnimated.View
        accessibilityLiveRegion="polite"
        style={[
          styles.toast,
          {
            opacity: shown,
            transform: [
              { translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) },
            ],
          },
        ]}
      >
        <Text style={styles.toastText} numberOfLines={2}>
          {text}
        </Text>
      </NativeAnimated.View>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        danger && styles.actionDanger,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fabWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 2000,
    width: size,
    alignItems: "center",
    gap: toggleGap,
  },
  fab: {
    elevation: 12,
    width: size,
    height: size,
    borderRadius: size / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.header,
    shadowColor: "#0a1634",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  toggle: {
    width: 34,
    height: toggleHeight,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: toggleHeight / 2,
    backgroundColor: faintBackground,
    opacity: faintOpacity,
  },
  handle: {
    position: "absolute",
    top: 0,
    zIndex: 2000,
    width: handleWidth,
    height: handleHeight,
    backgroundColor: faintBackground,
    opacity: faintOpacity,
  },
  handleRight: {
    right: 0,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  handleLeft: {
    left: 0,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  handleButton: { flex: 1, alignItems: "center", justifyContent: "center" },
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 10,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  vehicleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: "#e8eefc",
    borderWidth: 1,
    borderColor: "#c7d4f5",
  },
  vehicleBadgeText: { color: palette.brand, fontFamily: "SoraBold", fontSize: 11 },
  vehicleBadgeLogo: { width: 16, height: 16 },
  title: {
    color: moduleColors.text,
    fontFamily: "SoraBold",
    fontSize: 16,
    textAlign: "center",
  },
  label: {
    color: moduleColors.mutedText,
    fontFamily: "SoraBold",
    fontSize: 11,
  },
  speedRow: { flexDirection: "row", gap: 10 },
  speed: {
    flex: 1,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: palette.brand,
    backgroundColor: "#ffffff",
  },
  speedActive: { backgroundColor: palette.brand },
  speedText: { color: palette.brand, fontFamily: "SoraBold", fontSize: 15 },
  speedTextActive: { color: "#ffffff" },
  pauseButton: { flex: 0, width: 64 },
  pauseActive: { backgroundColor: palette.warning, borderColor: palette.warning },
  tripPause: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: palette.brand,
    backgroundColor: "#ffffff",
  },
  tripPauseActive: { backgroundColor: palette.warning, borderColor: palette.warning },
  tripPauseText: { color: palette.brand, fontFamily: "SoraBold", fontSize: 13, letterSpacing: 0.5 },
  tripPauseTextActive: { color: "#ffffff" },
  pausedNote: {
    color: palette.warning,
    fontFamily: "SoraBold",
    fontSize: 11,
    textAlign: "center",
  },
  action: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: palette.brand,
  },
  actionDanger: { backgroundColor: palette.danger },
  pressed: { opacity: 0.75 },
  actionText: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 13 },
  toastLane: {
    position: "absolute",
    left: 72,
    right: 72,
    alignItems: "center",
    zIndex: 3000,
    elevation: 30,
  },
  toast: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(17, 24, 39, 0.92)",
    elevation: 8,
  },
  toastText: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },
  close: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    color: moduleColors.mutedText,
    fontFamily: "SoraBold",
    fontSize: 12,
  },
  invites: { gap: 8, paddingTop: 4 },
  inviteRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 6 },
  inviteCard: { gap: 4, paddingBottom: 6 },
  inviteNameWrap: { flex: 1, gap: 2 },
  inviteName: { color: moduleColors.text, fontFamily: "Sora", fontSize: 12 },
  busyStatus: { color: palette.warning, fontFamily: "SoraBold", fontSize: 8 },
  busyActionRow: { flexDirection: "row", gap: 6, paddingLeft: 40 },
  busyButton: { flex: 1, minHeight: 36, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderRadius: 8, backgroundColor: "#eef2ff" },
  busyButtonText: { color: palette.brand, fontFamily: "SoraBold", fontSize: 8 },
  avatar: { width: 34, height: 34, overflow: "hidden", borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#eef2ff" },
  avatarImage: { width: "100%", height: "100%" },
  avatarText: { color: palette.brand, fontFamily: "SoraBold", fontSize: 11 },
  inviteButton: { minHeight: 40, justifyContent: "center", paddingHorizontal: 10, borderRadius: 8, backgroundColor: palette.brand },
  declineButton: { backgroundColor: palette.danger },
  disabledButton: { opacity: 0.45 },
  inviteButtonText: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 10 },
});
