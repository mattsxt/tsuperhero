import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import BusFront from "lucide-react-native/icons/bus-front";
import FileText from "lucide-react-native/icons/file-text";
import Handshake from "lucide-react-native/icons/handshake";
import Lock from "lucide-react-native/icons/lock";
import MapPinned from "lucide-react-native/icons/map-pinned";
import Route from "lucide-react-native/icons/route";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  describeAssignment,
  loadOperatorAssignment,
  type AssignmentDetails,
} from "@/api/v1/operator/controllers";
import { getRouteTerminals } from "@/api/v1/transit-routes/controllers";
import { EmptyState } from "@/components/empty-state";
import {
  ModuleHeader,
  moduleColors,
  SectionTitle,
  vehicleOptions,
} from "@/components/module-ui";
import { StickyHeader, useScrollChrome } from "@/components/scroll-chrome";
import { Routes } from "@/constants/routes";
import { goBackOr } from "@/utils/navigation";

const { brandBlue, softBlue, mutedText, text } = moduleColors;

export default function VehiclesScreen() {
  const insets = useSafeAreaInsets();
  const chrome = useScrollChrome();
  const [details, setDetails] = useState<AssignmentDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    loadOperatorAssignment().then((assignment) => {
      if (!active) return;
      setDetails(assignment ? describeAssignment(assignment) : null);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const goBack = () => goBackOr(Routes.profile);

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
        {loading ? (
          <ActivityIndicator color={brandBlue} style={styles.loading} />
        ) : details ? (
          <AssignmentView details={details} />
        ) : (
          <EmptyState
            icon={<BusFront color={brandBlue} size={32} strokeWidth={1.8} />}
            message="Your cooperative, route and vehicle will show up here once your transport cooperative assigns them."
            style={styles.empty}
          />
        )}
      </Animated.ScrollView>

      <StickyHeader chrome={chrome}>
        <ModuleHeader
          title="Vehicles & Documents"
          subtitle="Your cooperative, assigned route and registered vehicle."
          icon={<FileText color="#ffffff" size={44} strokeWidth={1.8} />}
          onBack={goBack}
          collapsed={chrome.collapsed}
        />
      </StickyHeader>
    </View>
  );
}

function AssignmentView({ details }: { details: AssignmentDetails }) {
  const { assignment, route, area, vehicleLabel } = details;
  const { cooperative, vehicle } = assignment;
  const vehicleIcon = vehicleOptions.find(
    (option) => option.value === vehicle.vehicle_type,
  )?.icon;

  return (
    <View style={styles.body}>
      <View style={styles.notice}>
        <Lock color={brandBlue} size={16} strokeWidth={2} />
        <Text style={styles.noticeText}>
          These details are managed by your transport cooperative and can’t be
          edited here. Contact your cooperative to request changes.
        </Text>
      </View>

      <SectionTitle
        icon={<Handshake color="#ffffff" size={18} strokeWidth={2} />}
        title="Transport Cooperative"
      />
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{cooperative.name}</Text>
      </View>

      {route && (
        <>
          <SectionTitle
            icon={<Route color="#ffffff" size={18} strokeWidth={2} />}
            title="Assigned Route"
          />
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{route.name}</Text>
            <Text style={styles.helper}>
              {vehicleLabel} operators run on one assigned route only.
            </Text>
            <View style={styles.stops}>
              {getRouteTerminals(route.id).map((terminal, index, list) => (
                <View key={terminal.id} style={styles.stopRow}>
                  <View style={styles.stopRail}>
                    <View
                      style={[
                        styles.stopDot,
                        index === list.length - 1 && styles.stopDotEnd,
                      ]}
                    />
                    {index < list.length - 1 && (
                      <View style={styles.stopLine} />
                    )}
                  </View>
                  <View style={styles.stopText}>
                    <Text style={styles.stopName}>{terminal.name}</Text>
                    <Text style={styles.stopCity}>{terminal.city}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </>
      )}

      {area && (
        <>
          <SectionTitle
            icon={<MapPinned color="#ffffff" size={18} strokeWidth={2} />}
            title="Operation Area"
          />
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{area.name}</Text>
            <Text style={styles.helper}>{area.description}</Text>
            <Text style={styles.subLabel}>BARANGAYS COVERED</Text>
            <View style={styles.pills}>
              {area.barangays.map((barangay) => (
                <View key={barangay} style={styles.pill}>
                  <Text style={styles.pillText}>{barangay}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}

      <SectionTitle
        icon={<BusFront color="#ffffff" size={18} strokeWidth={2} />}
        title="Vehicle Information"
      />
      <View style={styles.card}>
        <View style={styles.vehicleTop}>
          {vehicleIcon && (
            <View style={styles.vehicleIconBackdrop}>
              <Image
                source={vehicleIcon}
                style={styles.vehicleIcon}
                tintColor="#000000"
                contentFit="contain"
              />
            </View>
          )}
          <View>
            <Text style={styles.plate}>{vehicle.plate_number}</Text>
            <Text style={styles.helper}>{vehicleLabel}</Text>
          </View>
        </View>
        <InfoRow label="Vehicle Type" value={vehicleLabel} />
        <InfoRow label="Plate Number" value={vehicle.plate_number} />
        <InfoRow
          label="Max Capacity"
          value={`${vehicle.max_capacity} passengers`}
          last
        />
      </View>
    </View>
  );
}

function InfoRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowDivider]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  loading: { marginTop: 48 },
  empty: { marginTop: 24 },
  body: { paddingHorizontal: 12, paddingTop: 18 },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: softBlue,
  },
  noticeText: {
    flex: 1,
    color: text,
    fontFamily: "Sora",
    fontSize: 10,
    lineHeight: 15,
  },
  card: {
    padding: 16,
    borderWidth: 1.5,
    borderColor: brandBlue,
    borderRightWidth: 5,
    borderRightColor: "#1a2f8f",
    borderRadius: 10,
    backgroundColor: "#ffffff",
  },
  cardTitle: { color: brandBlue, fontFamily: "SoraBold", fontSize: 14 },
  helper: {
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 2,
  },
  infoRow: { flexDirection: "row", gap: 12, paddingVertical: 9 },
  infoRowDivider: { borderBottomWidth: 1, borderBottomColor: "#eef1f7" },
  infoLabel: { width: 110, color: mutedText, fontFamily: "Sora", fontSize: 10 },
  infoValue: { flex: 1, color: text, fontFamily: "SoraBold", fontSize: 11 },
  stops: { marginTop: 14 },
  stopRow: { flexDirection: "row", gap: 12 },
  stopRail: { width: 12, alignItems: "center" },
  stopDot: {
    width: 12,
    height: 12,
    marginTop: 2,
    borderRadius: 6,
    backgroundColor: brandBlue,
  },
  stopDotEnd: {
    borderWidth: 2,
    borderColor: brandBlue,
    backgroundColor: "#ffffff",
  },
  stopLine: { flex: 1, width: 2, backgroundColor: brandBlue },
  stopText: { flex: 1, paddingBottom: 14 },
  stopName: { color: text, fontFamily: "SoraBold", fontSize: 11 },
  stopCity: { color: mutedText, fontFamily: "Sora", fontSize: 9, marginTop: 2 },
  subLabel: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 10,
    marginTop: 14,
    marginBottom: 8,
  },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: softBlue,
  },
  pillText: { color: brandBlue, fontFamily: "SoraBold", fontSize: 10 },
  vehicleTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 6,
  },
  vehicleIconBackdrop: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: softBlue,
  },
  vehicleIcon: { width: 36, height: 36 },
  plate: { color: brandBlue, fontFamily: "SoraBold", fontSize: 18 },
});
