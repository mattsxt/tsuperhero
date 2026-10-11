import TriangleAlert from "lucide-react-native/icons/triangle-alert";
import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { moduleColors } from "@/components/module-ui";
import { palette } from "@/constants/colors";

const { brandBlue, headerBlue, mutedText } = moduleColors;
const dangerRed = palette.danger;

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = "Keep",
  destructive = false,
  icon,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  icon?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => undefined}
    >
      <View style={styles.backdrop}>
        <View accessibilityRole="alert" style={styles.card}>
          <View style={styles.header}>
            <View style={styles.badge}>
              {icon ?? (
                <TriangleAlert color="#ffffff" size={22} strokeWidth={2.2} />
              )}
            </View>
            <Text style={styles.title}>{title}</Text>
          </View>

          <View style={styles.body}>
            <Text style={styles.message}>{message}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: destructive ? dangerRed : brandBlue },
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.confirmText}>
                {confirmLabel.toUpperCase()}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={({ pressed }) => [
                styles.button,
                styles.cancel,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.cancelText}>{cancelLabel.toUpperCase()}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(10, 22, 52, 0.55)",
  },
  card: {
    width: "100%",
    maxWidth: 380,
    alignSelf: "center",
    overflow: "hidden",
    borderRadius: 24,
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 18,
    backgroundColor: headerBlue,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  badge: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
  title: {
    flex: 1,
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 17,
    lineHeight: 22,
  },
  body: { gap: 10, padding: 18, paddingTop: 16 },
  message: {
    marginBottom: 6,
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 11,
    lineHeight: 17,
  },
  button: {
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  cancel: { borderWidth: 1.5, borderColor: brandBlue },
  confirmText: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 13,
    letterSpacing: 1,
  },
  cancelText: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 13,
    letterSpacing: 1,
  },
  pressed: { opacity: 0.8 },
});
