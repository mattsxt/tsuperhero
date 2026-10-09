import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import CalendarDays from "lucide-react-native/icons/calendar-days";
import Clock from "lucide-react-native/icons/clock";
import { createElement, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { moduleColors } from "@/components/module-ui";

type Mode = "date" | "time";

const pad = (value: number) => String(value).padStart(2, "0");

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toIsoTime(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function DateTimeField({
  mode,
  value,
  onChange,
  placeholder,
  minimumDate,
  maximumDate,
  style,
}: {
  mode: Mode;
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder: string;
  minimumDate?: Date;
  maximumDate?: Date;
  style?: StyleProp<ViewStyle>;
}) {
  const [iosPickerOpen, setIosPickerOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState(() => value ?? new Date());
  const Icon = mode === "date" ? CalendarDays : Clock;

  if (Platform.OS === "web") {
    return (
      <View style={[styles.field, style]}>
        <Icon color={moduleColors.brandBlue} size={18} strokeWidth={2} />
        {createElement("input", {
          type: mode,
          "aria-label": placeholder,
          min:
            mode === "date" && minimumDate ? toIsoDate(minimumDate) : undefined,
          max:
            mode === "date" && maximumDate ? toIsoDate(maximumDate) : undefined,
          value: value
            ? mode === "date"
              ? toIsoDate(value)
              : toIsoTime(value)
            : "",
          onChange: (event: { target: { value: string } }) => {
            const raw = event.target.value;
            if (!raw) return;
            const next = new Date(value ?? new Date());
            if (mode === "date") {
              const [year, month, day] = raw.split("-").map(Number);
              next.setFullYear(year, month - 1, day);
            } else {
              const [hours, minutes] = raw.split(":").map(Number);
              next.setHours(hours, minutes, 0, 0);
            }
            onChange(next);
          },
          style: styles.webInput,
        })}
      </View>
    );
  }

  const openPicker = () => {
    const initial = value ?? minimumDate ?? new Date();
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        mode,
        value: initial,
        minimumDate: mode === "date" ? minimumDate : undefined,
        maximumDate: mode === "date" ? maximumDate : undefined,
        onValueChange: (_event, date) => onChange(date),
      });
      return;
    }
    setIosDraft(initial);
    setIosPickerOpen(true);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={placeholder}
        onPress={openPicker}
        style={[styles.field, style]}
      >
        <Icon color={moduleColors.brandBlue} size={18} strokeWidth={2} />
        <Text
          style={[styles.value, !value && styles.placeholder]}
          numberOfLines={1}
        >
          {value
            ? mode === "date"
              ? formatDate(value)
              : formatTime(value)
            : placeholder}
        </Text>
      </Pressable>

      {Platform.OS === "ios" && (
        <Modal
          visible={iosPickerOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setIosPickerOpen(false)}
        >
          <Pressable
            style={styles.sheetBackdrop}
            onPress={() => setIosPickerOpen(false)}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Pressable hitSlop={10} onPress={() => setIosPickerOpen(false)}>
                <Text style={styles.sheetCancel}>Cancel</Text>
              </Pressable>
              <Text style={styles.sheetTitle}>{placeholder}</Text>
              <Pressable
                hitSlop={10}
                onPress={() => {
                  onChange(iosDraft);
                  setIosPickerOpen(false);
                }}
              >
                <Text style={styles.sheetDone}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              mode={mode}
              display="spinner"
              value={iosDraft}
              minimumDate={mode === "date" ? minimumDate : undefined}
              maximumDate={mode === "date" ? maximumDate : undefined}
              themeVariant="light"
              textColor={moduleColors.text}
              onValueChange={(_event, date) => setIosDraft(date)}
            />
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: moduleColors.softBlue,
  },
  value: {
    flex: 1,
    color: moduleColors.text,
    fontFamily: "Sora",
    fontSize: 11,
  },
  placeholder: { color: moduleColors.mutedText },
  webInput: {
    flex: 1,
    height: "100%",
    borderWidth: 0,
    backgroundColor: "transparent",
    color: moduleColors.text,
    fontFamily: "Sora",
    fontSize: 11,
  },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.35)" },
  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 32,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e4",
  },
  sheetTitle: {
    color: moduleColors.text,
    fontFamily: "SoraBold",
    fontSize: 14,
  },
  sheetCancel: {
    color: moduleColors.mutedText,
    fontFamily: "Sora",
    fontSize: 14,
  },
  sheetDone: {
    color: moduleColors.headerBlue,
    fontFamily: "SoraBold",
    fontSize: 14,
  },
});
