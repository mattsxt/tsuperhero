import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import CalendarDays from "lucide-react-native/icons/calendar-days";
import Check from "lucide-react-native/icons/check";
import Clock from "lucide-react-native/icons/clock";
import Inbox from "lucide-react-native/icons/inbox";
import NotebookPen from "lucide-react-native/icons/notebook-pen";
import Users from "lucide-react-native/icons/users";
import X from "lucide-react-native/icons/x";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { vehicleTypeLabels } from "@/api/v1/transit-routes/controllers";
import { EmptyState } from "@/components/empty-state";
import { MiniToast, type MiniToastMessage } from "@/components/mini-toast";
import { Chip, ModuleHeader, moduleColors } from "@/components/module-ui";
import { StickyHeader, useScrollChrome } from "@/components/scroll-chrome";
import { Routes } from "@/constants/routes";
import {
  getInitials,
  type RentalRequest,
  type RentalStatus,
} from "@/pages/transit/types";

const { brandBlue, softBlue, mutedText, text, error } = moduleColors;
const success = "#1e9e45";

const tabs: { value: RentalStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
];

const emptyMessages: Record<RentalStatus, string> = {
  pending: "Charter requests from commuters will show up here.",
  accepted: "You haven't accepted any requests yet.",
  declined: "You haven't declined any requests.",
};

export default function RentalRequestsScreen() {
  const insets = useSafeAreaInsets();
  const chrome = useScrollChrome();
  const [requests, setRequests] = useState<RentalRequest[]>([]);
  const [tab, setTab] = useState<RentalStatus>("pending");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [toast, setToast] = useState<MiniToastMessage | null>(null);

  const visible = requests.filter((request) => request.status === tab);
  const countOf = (status: RentalStatus) =>
    requests.filter((request) => request.status === status).length;

  const updateStatus = (id: string, status: RentalStatus) => {
    setRequests((current) =>
      current.map((request) =>
        request.id === id ? { ...request, status } : request,
      ),
    );
    setConfirmingId(null);
    const name = requests.find((request) => request.id === id)?.commuter;
    setToast((current) => ({
      id: (current?.id ?? 0) + 1,
      text:
        status === "accepted"
          ? `Accepted ${name}'s request.`
          : `Declined ${name}'s request.`,
    }));
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(Routes.transitHome);
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <Animated.ScrollView
        onScroll={chrome.scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: chrome.headerHeight,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>
          <View style={styles.tabRow}>
            {tabs.map((option) => (
              <Chip
                key={option.value}
                label={`${option.label} (${countOf(option.value)})`}
                selected={tab === option.value}
                onPress={() => {
                  setTab(option.value);
                  setConfirmingId(null);
                }}
                grow
              />
            ))}
          </View>

          {visible.length === 0 ? (
            <EmptyState
              icon={<Inbox color={brandBlue} size={32} strokeWidth={1.8} />}
              message={emptyMessages[tab]}
            />
          ) : (
            <View style={styles.list}>
              {visible.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  confirmingDecline={confirmingId === request.id}
                  onAccept={() => updateStatus(request.id, "accepted")}
                  onDecline={() => setConfirmingId(request.id)}
                  onCancelDecline={() => setConfirmingId(null)}
                  onConfirmDecline={() => updateStatus(request.id, "declined")}
                />
              ))}
            </View>
          )}
        </View>
      </Animated.ScrollView>

      <StickyHeader chrome={chrome}>
        <ModuleHeader
          title="Rental Requests"
          subtitle="Review charter requests from commuters and choose which trips to take."
          icon={<Inbox color="#ffffff" size={44} strokeWidth={1.8} />}
          onBack={goBack}
          collapsed={chrome.collapsed}
        />
      </StickyHeader>
      <MiniToast message={toast} top={insets.top + 12} />
    </View>
  );
}

function RequestCard({
  request,
  confirmingDecline,
  onAccept,
  onDecline,
  onCancelDecline,
  onConfirmDecline,
}: {
  request: RentalRequest;
  confirmingDecline: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onCancelDecline: () => void;
  onConfirmDecline: () => void;
}) {
  const dates = request.returnDate
    ? `${request.date} – ${request.returnDate}`
    : request.date;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      layout={LinearTransition.duration(200)}
      style={styles.card}
    >
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(request.commuter)}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.name} numberOfLines={1}>
            {request.commuter}
          </Text>
          <Text style={styles.meta}>
            {request.occasion} · {request.tripType} · {request.requestedAgo}
          </Text>
        </View>
        <StatusBadge status={request.status} />
      </View>

      <View style={styles.stops}>
        <View style={styles.timeline}>
          <View style={styles.timelineStart} />
          <View style={styles.timelineLine} />
          <View style={styles.timelineEnd} />
        </View>
        <View style={styles.stopText}>
          <View>
            <Text style={styles.city}>{request.pickup.city}</Text>
            <Text style={styles.place}>{request.pickup.place}</Text>
          </View>
          <View>
            <Text style={styles.city}>{request.destination.city}</Text>
            <Text style={styles.place}>{request.destination.place}</Text>
          </View>
        </View>
      </View>

      <View style={styles.detailGrid}>
        <Detail
          icon={<CalendarDays color={brandBlue} size={14} strokeWidth={2} />}
          text={dates}
        />
        <Detail
          icon={<Clock color={brandBlue} size={14} strokeWidth={2} />}
          text={`Pickup ${request.pickupTime}`}
        />
        <Detail
          icon={<Users color={brandBlue} size={14} strokeWidth={2} />}
          text={`${request.passengers} passengers · ${vehicleTypeLabels[request.vehicle]}`}
        />
      </View>

      {!!request.notes && (
        <View style={styles.notes}>
          <NotebookPen color={brandBlue} size={14} strokeWidth={2} />
          <Text style={styles.notesText}>{request.notes}</Text>
        </View>
      )}


      {request.status === "pending" &&
        (confirmingDecline ? (
          <View style={styles.confirm}>
            <Text style={styles.confirmText}>
              Decline {request.commuter}’s request? This can’t be undone.
            </Text>
            <View style={styles.actions}>
              <ActionButton label="CANCEL" onPress={onCancelDecline} />
              <ActionButton
                label="DECLINE"
                tone="danger"
                onPress={onConfirmDecline}
              />
            </View>
          </View>
        ) : (
          <View style={styles.actions}>
            <ActionButton
              label="DECLINE"
              icon={<X color={error} size={16} strokeWidth={2.5} />}
              tone="dangerOutline"
              onPress={onDecline}
            />
            <ActionButton
              label="ACCEPT"
              icon={<Check color="#ffffff" size={16} strokeWidth={2.5} />}
              tone="primary"
              onPress={onAccept}
            />
          </View>
        ))}
    </Animated.View>
  );
}

function StatusBadge({ status }: { status: RentalStatus }) {
  const look = {
    pending: { label: "New", color: brandBlue },
    accepted: { label: "Accepted", color: success },
    declined: { label: "Declined", color: mutedText },
  }[status];

  return (
    <View style={[styles.badge, { backgroundColor: look.color }]}>
      <Text style={styles.badgeText}>{look.label}</Text>
    </View>
  );
}

function Detail({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <View style={styles.detail}>
      {icon}
      <Text style={styles.detailText}>{text}</Text>
    </View>
  );
}

function ActionButton({
  label,
  icon,
  tone = "outline",
  onPress,
}: {
  label: string;
  icon?: ReactNode;
  tone?: "outline" | "primary" | "danger" | "dangerOutline";
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        tone === "primary" && styles.actionPrimary,
        tone === "danger" && styles.actionDanger,
        tone === "dangerOutline" && styles.actionDangerOutline,
        pressed && styles.pressed,
      ]}
    >
      {icon}
      <Text
        style={[
          styles.actionText,
          (tone === "primary" || tone === "danger") && styles.actionTextLight,
          tone === "dangerOutline" && styles.actionTextDanger,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  body: { paddingHorizontal: 12, paddingTop: 18 },
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  tabRow: { flexDirection: "row", gap: 6 },
  list: { gap: 14, marginTop: 16 },
  card: {
    padding: 14,
    borderWidth: 1.5,
    borderColor: brandBlue,
    borderRightWidth: 5,
    borderRightColor: "#1a2f8f",
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: softBlue,
  },
  avatarText: { color: brandBlue, fontFamily: "SoraBold", fontSize: 13 },
  name: { color: brandBlue, fontFamily: "SoraBold", fontSize: 13 },
  meta: { color: mutedText, fontFamily: "Sora", fontSize: 9, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  badgeText: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 9 },
  stops: { flexDirection: "row", marginTop: 14 },
  timeline: { alignItems: "center", paddingVertical: 4 },
  timelineStart: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: brandBlue,
  },
  timelineLine: { flex: 1, width: 2, backgroundColor: brandBlue },
  timelineEnd: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: brandBlue,
    backgroundColor: "#ffffff",
  },
  stopText: { flex: 1, gap: 12, marginLeft: 12 },
  city: { color: brandBlue, fontFamily: "SoraBold", fontSize: 11 },
  place: { color: mutedText, fontFamily: "Sora", fontSize: 9, marginTop: 2 },
  detailGrid: { gap: 6, marginTop: 14 },
  detail: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailText: { flex: 1, color: text, fontFamily: "Sora", fontSize: 10 },
  notes: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: softBlue,
  },
  notesText: {
    flex: 1,
    color: text,
    fontFamily: "Sora",
    fontSize: 10,
    lineHeight: 15,
  },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  actionButton: {
    flex: 1,
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: brandBlue,
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },
  actionPrimary: { backgroundColor: brandBlue },
  actionDanger: { borderColor: error, backgroundColor: error },
  actionDangerOutline: { borderColor: error },
  actionText: { color: brandBlue, fontFamily: "SoraBold", fontSize: 11 },
  actionTextLight: { color: "#ffffff" },
  actionTextDanger: { color: error },
  confirm: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#fde8e6",
  },
  confirmText: {
    color: error,
    fontFamily: "Sora",
    fontSize: 10,
    lineHeight: 15,
    textAlign: "center",
  },
});
