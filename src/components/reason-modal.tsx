import CircleAlert from "lucide-react-native/icons/circle-alert";
import Info from "lucide-react-native/icons/info";
import OctagonPause from "lucide-react-native/icons/octagon-pause";
import Timer from "lucide-react-native/icons/timer";
import { useRef, useState, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  cancelReasons,
  maxCancelDetailsLength,
  reasonProblem,
  type CancelActor,
} from "@/api/v1/rentals/drop-policy";
import { LoadingLogo } from "@/components/LoadingLogo";
import { moduleColors } from "@/components/module-ui";
import { palette } from "@/constants/colors";

const { brandBlue, headerBlue, mutedText, softBlue, text } = moduleColors;
const line = "#e5eaf3";

export type ReasonNotice = {
  tone: "info" | "warning" | "danger";
  text: string;
};

const noticeTones = {
  info: { background: softBlue, color: brandBlue, Icon: Info },
  warning: { background: palette.warningSoft, color: palette.warning, Icon: Timer },
  danger: {
    background: palette.dangerSoft,
    color: palette.dangerText,
    Icon: OctagonPause,
  },
} as const;

export function ReasonModal({
  visible,
  actor,
  title,
  subtitle,
  message,
  notice,
  privacyNote,
  confirmLabel,
  cancelLabel,
  icon,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  actor: CancelActor;
  title: string;
  subtitle?: string;
  message: string;
  notice?: ReasonNotice | null;
  privacyNote: string;
  confirmLabel: string;
  cancelLabel: string;
  icon: ReactNode;
  onConfirm: (reason: string, details: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const detailsRef = useRef<TextInput>(null);

  const reasons = cancelReasons[actor];
  const needsDetails = reason === "other";
  const problem = reasonProblem(actor, reason, details);
  const ready = !problem;

  const pick = (code: string) => {
    setReason(code);
    setError("");
    if (code === "other") requestAnimationFrame(() => detailsRef.current?.focus());
  };

  const reset = () => {
    setReason(null);
    setDetails("");
    setError("");
  };

  const cancel = () => {
    if (busy) return;
    reset();
    onCancel();
  };

  const confirm = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    const failed = await onConfirm(reason!, details);
    setBusy(false);
    if (failed) setError(failed);
    else reset();
  };

  const tone = notice ? noticeTones[notice.tone] : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={cancel}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.badge}>{icon}</View>
            <View style={styles.flex}>
              <Text style={styles.title}>{title}</Text>
              {!!subtitle && (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {subtitle}
                </Text>
              )}
            </View>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.message}>{message}</Text>

            {notice && tone && (
              <View
                accessibilityRole="text"
                style={[styles.notice, { backgroundColor: tone.background }]}
              >
                <tone.Icon color={tone.color} size={16} strokeWidth={2.2} />
                <Text style={[styles.noticeText, { color: tone.color }]}>
                  {notice.text}
                </Text>
              </View>
            )}

            <Text style={styles.section}>REASON</Text>
            <View accessibilityRole="radiogroup" style={styles.reasons}>
              {reasons.map((option) => {
                const selected = option.code === reason;
                return (
                  <Pressable
                    key={option.code}
                    accessibilityRole="radio"
                    accessibilityLabel={option.label}
                    accessibilityHint={option.hint}
                    accessibilityState={{ checked: selected, disabled: busy }}
                    disabled={busy}
                    onPress={() => pick(option.code)}
                    style={({ pressed }) => [
                      styles.reason,
                      selected && styles.reasonSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={[styles.radio, selected && styles.radioOn]}>
                      {selected && <View style={styles.radioDot} />}
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.reasonLabel}>{option.label}</Text>
                      <Text style={styles.reasonHint}>{option.hint}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.detailsHead}>
              <Text style={styles.section}>
                {needsDetails ? "DETAILS" : "DETAILS (OPTIONAL)"}
              </Text>
              <Text
                style={[
                  styles.counter,
                  details.length >= maxCancelDetailsLength && styles.counterFull,
                ]}
              >
                {details.length}/{maxCancelDetailsLength}
              </Text>
            </View>
            <TextInput
              ref={detailsRef}
              value={details}
              onChangeText={(value) => {
                setDetails(value);
                setError("");
              }}
              editable={!busy}
              placeholder={
                needsDetails
                  ? "Tell us what happened"
                  : actor === "driver"
                    ? "Anything your cooperative should know"
                    : "Anything the driver's cooperative should know"
              }
              placeholderTextColor="#9a9a9a"
              multiline
              maxLength={maxCancelDetailsLength}
              accessibilityLabel={
                needsDetails ? "Details, required" : "Details, optional"
              }
              style={styles.input}
            />
            <Text style={styles.privacy}>{privacyNote}</Text>
          </ScrollView>

          <View style={styles.footer}>
            {!!error && (
              <View accessibilityRole="alert" style={styles.error}>
                <CircleAlert
                  color={palette.danger}
                  size={15}
                  strokeWidth={2.2}
                />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !ready || busy, busy }}
              accessibilityHint={problem ?? undefined}
              disabled={!ready || busy}
              onPress={confirm}
              style={({ pressed }) => [
                styles.button,
                styles.confirm,
                !ready && styles.confirmIdle,
                pressed && styles.pressed,
              ]}
            >
              {busy ? (
                <LoadingLogo color="#ffffff" size={22} />
              ) : (
                <Text style={styles.confirmText}>
                  {confirmLabel.toUpperCase()}
                </Text>
              )}
            </Pressable>
            {!ready && !busy && (
              <Text style={styles.hint}>
                {reason ? "Add details to continue." : "Choose a reason to continue."}
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={cancel}
              style={({ pressed }) => [
                styles.button,
                styles.cancel,
                (pressed || busy) && styles.pressed,
              ]}
            >
              <Text style={styles.cancelText}>{cancelLabel.toUpperCase()}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    maxWidth: 400,
    maxHeight: "90%",
    alignSelf: "center",
    overflow: "hidden",
    borderRadius: 24,
    backgroundColor: "#ffffff",
  },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 18,
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
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 17,
    lineHeight: 22,
  },
  subtitle: {
    marginTop: 2,
    color: palette.cyan,
    fontFamily: "Sora",
    fontSize: 11,
  },
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { gap: 10, padding: 18, paddingBottom: 12 },
  message: { color: mutedText, fontFamily: "Sora", fontSize: 11, lineHeight: 17 },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 10,
  },
  noticeText: { flex: 1, fontFamily: "Sora", fontSize: 11, lineHeight: 16 },
  section: {
    marginTop: 4,
    color: mutedText,
    fontFamily: "SoraBold",
    fontSize: 10,
    letterSpacing: 0.6,
  },
  reasons: { gap: 6 },
  reason: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: line,
    borderRadius: 12,
  },
  reasonSelected: { borderColor: brandBlue, backgroundColor: softBlue },
  radio: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#b8c3d6",
    borderRadius: 10,
  },
  radioOn: { borderColor: brandBlue },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: brandBlue,
  },
  reasonLabel: { color: text, fontFamily: "SoraBold", fontSize: 12 },
  reasonHint: {
    marginTop: 1,
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 10,
    lineHeight: 14,
  },
  detailsHead: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  counter: { color: mutedText, fontFamily: "Sora", fontSize: 10 },
  counterFull: { color: palette.danger },
  input: {
    minHeight: 76,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: 12,
    backgroundColor: softBlue,
    color: text,
    fontFamily: "Sora",
    fontSize: 12,
    lineHeight: 17,
    textAlignVertical: "top",
  },
  privacy: { color: mutedText, fontFamily: "Sora", fontSize: 10, lineHeight: 15 },
  footer: {
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: line,
  },
  error: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  errorText: {
    flex: 1,
    color: palette.danger,
    fontFamily: "SoraBold",
    fontSize: 11,
    lineHeight: 16,
  },
  button: {
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  confirm: { backgroundColor: palette.danger },
  confirmIdle: { opacity: 0.4 },
  confirmText: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 13,
    letterSpacing: 1,
  },
  hint: {
    marginTop: -2,
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 10,
    textAlign: "center",
  },
  cancel: { borderWidth: 1.5, borderColor: brandBlue },
  cancelText: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 13,
    letterSpacing: 1,
  },
  pressed: { opacity: 0.8 },
});
