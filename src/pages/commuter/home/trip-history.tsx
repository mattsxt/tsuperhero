import IdCard from "lucide-react-native/icons/id-card";
import Route from "lucide-react-native/icons/route";
import UserRound from "lucide-react-native/icons/user-round";
import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { loadTripHistory, type TripRide } from "@/api/v1/pickups/controllers";
import { LoadingLogo } from "@/components/LoadingLogo";
import { EmptyState } from "@/components/empty-state";
import { moduleColors } from "@/components/module-ui";

const { brandBlue, mutedText, softBlue, text } = moduleColors;

function formatRideDate(date: Date | null) {
  if (!date) return "Date unavailable";
  const day = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day} · ${time}`;
}

export function TripHistory({ limit }: { limit?: number }) {
  const [rides, setRides] = useState<TripRide[] | null>(null);

  useEffect(() => {
    let active = true;
    loadTripHistory().then((result) => {
      if (active) setRides(result.ok ? result.data : []);
    });
    return () => {
      active = false;
    };
  }, []);

  if (rides === null) return <LoadingLogo size={28} style={styles.loading} />;

  if (rides.length === 0) {
    return (
      <EmptyState
        icon={<Route color={brandBlue} size={32} strokeWidth={1.8} />}
        message="Your completed trips will appear here."
      />
    );
  }

  return (
    <View style={styles.list}>
      {rides.slice(0, limit).map((ride) => (
        <View key={ride.id} style={styles.card}>
          <View style={styles.top}>
            <Text style={styles.route} numberOfLines={1}>
              {ride.routeName}
            </Text>
            <View style={[styles.badge, ride.onBoard && styles.badgeLive]}>
              <Text
                style={[styles.badgeText, ride.onBoard && styles.badgeTextLive]}
              >
                {ride.onBoard ? "ON BOARD" : "COMPLETED"}
              </Text>
            </View>
          </View>
          <Text style={styles.date}>{formatRideDate(ride.departedAt)}</Text>
          {!!ride.plateNumber && (
            <Detail
              icon={<IdCard color={brandBlue} size={13} strokeWidth={2} />}
            >
              {[ride.plateNumber, ride.vehicleType].filter(Boolean).join(" · ")}
            </Detail>
          )}
          {!!ride.driverName && (
            <Detail
              icon={<UserRound color={brandBlue} size={13} strokeWidth={2} />}
            >
              {ride.driverName}
            </Detail>
          )}
        </View>
      ))}
    </View>
  );
}

function Detail({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.detail}>
      <View style={styles.detailIcon}>{icon}</View>
      <Text style={styles.detailText} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 24 },
  list: { gap: 10, marginTop: 4 },
  card: {
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: brandBlue,
    borderRightWidth: 5,
    borderRightColor: "#1a2f8f",
    borderRadius: 10,
  },
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
  route: { flex: 1, color: brandBlue, fontFamily: "SoraBold", fontSize: 13 },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#dcfce7",
  },
  badgeLive: { backgroundColor: softBlue },
  badgeText: { color: "#15803d", fontFamily: "SoraBold", fontSize: 8 },
  badgeTextLive: { color: brandBlue },
  date: { color: mutedText, fontFamily: "Sora", fontSize: 10 },
  detail: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailIcon: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: softBlue,
  },
  detailText: { flex: 1, color: text, fontFamily: "Sora", fontSize: 10 },
});
