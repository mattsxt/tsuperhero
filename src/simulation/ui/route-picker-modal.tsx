import RouteIcon from "lucide-react-native/icons/route";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { palette } from "@/constants/colors";
import type { DemoRoute } from "@/simulation/engine";

const navy = palette.header;
const card = "#d6ecf8";

export function RoutePickerModal({
  visible,
  routes,
  onPick,
  onCancel,
}: {
  visible: boolean;
  routes: DemoRoute[];
  onPick: (routeId: string) => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={styles.root}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Choose your route</Text>
          </View>
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {routes.map((route) => (
              <Pressable
                key={route.routeId}
                accessibilityRole="button"
                accessibilityLabel={`Operate on ${route.name}`}
                onPress={() => onPick(route.routeId)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <RouteIcon color={navy} size={20} />
                <View style={styles.rowText}>
                  <Text style={styles.rowName}>{route.name}</Text>
                  <Text style={styles.rowCode}>{route.code}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={onCancel}
              style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
            >
              <Text style={styles.cancelText}>CANCEL</Text>
            </Pressable>
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
    padding: 24,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  card: { overflow: "hidden", maxHeight: "85%", borderRadius: 20, backgroundColor: card },
  header: { paddingVertical: 14, alignItems: "center", backgroundColor: navy },
  title: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 18 },
  list: { flexGrow: 0 },
  listContent: { gap: 8, paddingTop: 14, paddingHorizontal: 16 },
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },
  rowText: { flex: 1 },
  rowName: { color: "#111827", fontFamily: "SoraBold", fontSize: 14 },
  rowCode: { marginTop: 2, color: "#4b5563", fontFamily: "Sora", fontSize: 12 },
  footer: { paddingTop: 14, paddingBottom: 16, paddingHorizontal: 16 },
  cancel: {
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: navy,
    backgroundColor: "#ffffff",
  },
  cancelText: { color: navy, fontFamily: "SoraBold", fontSize: 16 },
  pressed: { opacity: 0.7 },
});
