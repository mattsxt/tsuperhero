import ChevronRight from "lucide-react-native/icons/chevron-right";
import Flag from "lucide-react-native/icons/flag";
import MapPinned from "lucide-react-native/icons/map-pinned";
import Search from "lucide-react-native/icons/search";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Place } from "@/api/v1/places/controllers";
import type { TransitRoute } from "@/api/v1/transit-routes/controllers";
import { ErrorOutline } from "@/components/error-alert";
import { moduleColors, SectionTitle } from "@/components/module-ui";
import { PlaceSearchField } from "@/components/place-search-field";

import { PinLocationPicker } from "./pin-location-picker";

const { brandBlue, softBlue, error } = moduleColors;

export function DropoffStep({
  value,
  onChange,
  routes,
  invalid,
  disabled,
  onProblem,
}: {
  value: Place | null;
  onChange: (place: Place | null) => void;
  routes: TransitRoute[];
  invalid: boolean;
  disabled?: boolean;
  onProblem: (message: string) => void;
}) {
  const [pinOpen, setPinOpen] = useState(false);

  return (
    <View>
      <SectionTitle
        icon={<Flag color="#ffffff" size={18} strokeWidth={2} />}
        title="Where do you want to be dropped off?"
      />
      <ErrorOutline invalid={invalid} color={error}>
        <PlaceSearchField
          value={value}
          onChange={onChange}
          onProblem={onProblem}
          disabled={disabled}
          placeholder="Search your drop-off point..."
          icon={<Search color={brandBlue} size={20} strokeWidth={2} />}
        />
      </ErrorOutline>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Pin your drop-off point on the map"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setPinOpen(true)}
        style={({ pressed }) => [
          styles.pinOption,
          (pressed || disabled) && styles.pressed,
        ]}
      >
        <View style={styles.pinOptionIcon}>
          <MapPinned color={brandBlue} size={16} strokeWidth={2} />
        </View>
        <Text style={[styles.pinOptionText, styles.flex]}>
          Pin your drop-off point on the map
        </Text>
        <ChevronRight color={brandBlue} size={16} strokeWidth={2.5} />
      </Pressable>
      {pinOpen && (
        <PinLocationPicker
          title="Pin your drop-off point"
          subtitle="Drag the map to place the pin where you want to get off."
          initial={value ? { lat: value.lat, lng: value.lng } : null}
          waitingAreas={[]}
          routes={routes}
          onPick={(next) => {
            setPinOpen(false);
            onChange(next);
          }}
          onClose={() => setPinOpen(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  pinOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: softBlue,
  },
  pinOptionIcon: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: softBlue,
  },
  pinOptionText: { color: brandBlue, fontFamily: "SoraBold", fontSize: 11 },
});
