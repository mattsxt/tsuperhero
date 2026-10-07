import { Image } from "expo-image";
import MapPin from "lucide-react-native/icons/map-pin";
import Users from "lucide-react-native/icons/users";
import { useEffect, useMemo, useState } from "react";
import {
  AppState,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { markNotificationsRead } from "@/api/v1/notifications/controllers";
import {
  loadShareInvites,
  respondToShareInvite,
  type ShareInvite,
} from "@/api/v1/pickups/controllers";
import { LoadingLogo } from "@/components/LoadingLogo";
import { ModuleButton, moduleColors } from "@/components/module-ui";
import { useNotifications } from "@/hooks/use-notifications";

const { brandBlue, mutedText, softBlue, text, error } = moduleColors;

const passengerLabel = (count: number) =>
  `${count} ${count === 1 ? "passenger" : "passengers"}`;

export function ShareInviteModal() {
  const { notifications } = useNotifications();
  const [invites, setInvites] = useState<ShareInvite[]>([]);
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [problem, setProblem] = useState("");

  const shareNotifications = useMemo(
    () => notifications.filter((item) => item.type === "pickup_shared"),
    [notifications],
  );
  const shareKey = shareNotifications.map((item) => item.id).join(",");

  const refresh = () =>
    loadShareInvites().then((result) => {
      if (result.ok) setInvites(result.data);
    });

  useEffect(() => {
    if (!shareKey) return;
    let active = true;
    const load = () =>
      loadShareInvites().then((result) => {
        if (active && result.ok) setInvites(result.data);
      });
    load();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") load();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [shareKey]);

  const invite = shareKey ? invites[0] : undefined;
  if (!invite) return null;

  const respond = async (accept: boolean) => {
    if (busy) return;
    setBusy(accept ? "accept" : "decline");
    setProblem("");
    const result = await respondToShareInvite(invite.requestId, accept);
    setBusy(null);
    if (!result.ok) {
      setProblem(result.error);
      refresh();
      return;
    }
    markNotificationsRead(
      shareNotifications
        .filter((item) => item.data.request_id === invite.requestId)
        .map((item) => item.id),
    );
    setInvites((current) =>
      current.filter((item) => item.requestId !== invite.requestId),
    );
  };

  const { from } = invite;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => undefined}
    >
      <View style={styles.root}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>SHARE A RIDE REQUEST</Text>
          <View style={styles.sender}>
            <View style={styles.avatar}>
              {from.picture ? (
                <Image
                  source={{ uri: from.picture }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              ) : (
                <Text style={styles.avatarText}>{from.initials}</Text>
              )}
            </View>
            <Text style={styles.title}>
              {from.name} wants to share a ride with you
            </Text>
          </View>

          <View style={styles.detail}>
            <MapPin color={brandBlue} size={16} strokeWidth={2} />
            <Text style={styles.detailText} numberOfLines={2}>
              Pickup at {invite.pickupName}
            </Text>
          </View>
          <View style={styles.detail}>
            <Users color={brandBlue} size={16} strokeWidth={2} />
            <Text style={styles.detailText}>
              {passengerLabel(invite.passengers)}
              {invite.status === "accepted" ? " · Driver on the way" : ""}
            </Text>
          </View>

          <Text style={styles.helper}>
            If you decline, the pickup will be for{" "}
            {passengerLabel(Math.max(1, invite.passengers - 1))}.
          </Text>

          {!!problem && <Text style={styles.problem}>{problem}</Text>}

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={!!busy}
              onPress={() => respond(false)}
              style={({ pressed }) => [
                styles.decline,
                (pressed || !!busy) && styles.pressed,
              ]}
            >
              {busy === "decline" ? (
                <LoadingLogo size={18} />
              ) : (
                <Text style={styles.declineText}>Decline</Text>
              )}
            </Pressable>
            <ModuleButton
              label={busy === "accept" ? "Accepting..." : "Accept"}
              disabled={!!busy}
              onPress={() => respond(true)}
              style={styles.accept}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  card: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#ffffff",
  },
  eyebrow: { color: mutedText, fontFamily: "SoraBold", fontSize: 8 },
  sender: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
    marginBottom: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 22,
    backgroundColor: softBlue,
  },
  avatarText: { color: brandBlue, fontFamily: "SoraBold", fontSize: 16 },
  title: {
    flex: 1,
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 15,
  },
  detail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  detailText: { flex: 1, color: text, fontFamily: "Sora", fontSize: 11 },
  helper: {
    marginTop: 8,
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 10,
    lineHeight: 15,
  },
  problem: {
    marginTop: 10,
    color: error,
    fontFamily: "Sora",
    fontSize: 10,
    lineHeight: 15,
  },
  actions: { flexDirection: "row", gap: 10, marginTop: 18 },
  decline: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: brandBlue,
    borderRadius: 12,
  },
  declineText: { color: brandBlue, fontFamily: "SoraBold", fontSize: 13 },
  accept: { flex: 1 },
  pressed: { opacity: 0.8 },
});
