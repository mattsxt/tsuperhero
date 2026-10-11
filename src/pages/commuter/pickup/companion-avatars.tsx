import { Image } from "expo-image";
import UserRound from "lucide-react-native/icons/user-round";
import { StyleSheet, Text, View } from "react-native";

import type { Rider } from "@/api/v1/pickups/controllers";
import { Popover } from "@/components/popover";
import { palette } from "@/constants/colors";

const avatarSize = 32;
const overlap = 10;
const collapseFrom = 5;
const shownWhenCollapsed = 3;

const statusLabel = (rider: Rider) =>
  rider.arrived ? "At the pickup point" : "On the way";

export function CompanionAvatars({ companions }: { companions: Rider[] }) {
  if (companions.length === 0) return null;

  const collapsed = companions.length >= collapseFrom;
  const visible = collapsed
    ? companions.slice(0, shownWhenCollapsed)
    : companions;
  const hidden = collapsed ? companions.slice(shownWhenCollapsed) : [];

  return (
    <View style={styles.pill} accessibilityRole="list">
      <View style={styles.group}>
        {visible.map((rider, index) => (
          <View
            key={rider.userId}
            style={[styles.slot, index > 0 && styles.overlapped]}
          >
            <Popover
              heading={rider.name}
              variant="tooltip"
              body={statusLabel(rider)}
              accessibilityLabel={`${rider.name}, ${statusLabel(rider).toLowerCase()}`}
              triggerStyle={styles.avatar}
            >
              <Text style={styles.initials}>{rider.initials}</Text>
              {!!rider.picture && (
                <Image
                  source={{ uri: rider.picture }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              )}
            </Popover>
            <View
              pointerEvents="none"
              style={[
                styles.statusDot,
                {
                  backgroundColor: rider.arrived ? palette.success : "#f59e0b",
                },
              ]}
            />
          </View>
        ))}

        {collapsed && (
          <>
            <View style={[styles.slot, styles.overlapped]}>
              <View style={[styles.avatar, styles.placeholder]}>
                <UserRound color={palette.navy} size={15} strokeWidth={2.2} />
              </View>
            </View>
            <View style={[styles.slot, styles.overlapped]}>
              <Popover
                heading={`${hidden.length} more companions`}
                variant="tooltip"
                body={hidden
                  .map(
                    (rider) =>
                      `${rider.name} · ${rider.arrived ? "at the pickup point" : "on the way"}`,
                  )
                  .join("\n")}
                accessibilityLabel={`${hidden.length} more companions`}
                triggerStyle={[styles.avatar, styles.count]}
              >
                <Text style={styles.countText}>+{hidden.length}</Text>
              </Popover>
            </View>
          </>
        )}
      </View>
      <Text style={styles.label}>Riding with you</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 10,
    marginTop: 14,
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.7)",
    borderRadius: 999,
    backgroundColor: "#ffffff",
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  group: { flexDirection: "row", alignItems: "center" },
  slot: { width: avatarSize, height: avatarSize },
  overlapped: { marginLeft: -overlap },
  avatar: {
    width: avatarSize,
    height: avatarSize,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#ffffff",
    borderRadius: avatarSize / 2,
    backgroundColor: "#dbe7fb",
  },
  initials: { color: palette.navy, fontFamily: "SoraBold", fontSize: 11 },
  placeholder: { backgroundColor: "#eef1f6" },
  count: { backgroundColor: "#eef1f6" },
  countText: { color: palette.navy, fontFamily: "SoraBold", fontSize: 11 },
  statusDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 10,
    height: 10,
    borderWidth: 2,
    borderColor: "#ffffff",
    borderRadius: 5,
  },
  label: { color: palette.navy, fontFamily: "SoraBold", fontSize: 12 },
});
