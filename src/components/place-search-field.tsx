import LocateFixed from "lucide-react-native/icons/locate-fixed";
import MapPin from "lucide-react-native/icons/map-pin";
import X from "lucide-react-native/icons/x";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import {
  createPlacesSession,
  getCurrentPlace,
  minPlaceQueryLength,
  resolvePlace,
  searchPlaces,
  type Place,
  type PlaceSuggestion,
} from "@/api/v1/places/controllers";
import { moduleColors, SoftField } from "@/components/module-ui";
import { LoadingLogo } from "@/components/LoadingLogo";

const { brandBlue, error: errorRed, mutedText, softBlue, text } = moduleColors;

const maxSuggestions = 6;

function placeLabel(place: Place) {
  const address = place.address.trim();
  if (!address || place.name.includes(address)) return place.name;
  if (address.includes(place.name)) return address;
  return `${place.name}, ${address}`;
}
const searchDelayMs = 300;

export function PlaceSearchField({
  value,
  onChange,
  placeholder,
  icon,
  allowCurrentLocation = false,
  onProblem,
}: {
  value: Place | null;
  onChange: (place: Place | null) => void;
  placeholder: string;
  icon: ReactNode;
  allowCurrentLocation?: boolean;
  onProblem?: (message: string) => void;
}) {
  const session = useRef(createPlacesSession());
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [query, setQuery] = useState(value ? placeLabel(value) : "");
  const [shownId, setShownId] = useState(value?.id ?? null);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searchError, setSearchError] = useState("");

  if (value && value.id !== shownId) {
    setShownId(value.id);
    setQuery(placeLabel(value));
  }

  useEffect(() => {
    if (!open) return;
    let active = true;
    const delay = query.trim().length < minPlaceQueryLength ? 0 : searchDelayMs;
    const timer = setTimeout(async () => {
      const result = await searchPlaces(query, session.current);
      if (!active) return;
      setSuggestions(result.suggestions.slice(0, maxSuggestions));
      setSearchError(result.error ?? "");
      setSearching(false);
    }, delay);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, open]);

  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    [],
  );

  const choose = (place: Place) => {
    setShownId(place.id);
    setQuery(placeLabel(place));
    setOpen(false);
    onChange(place);
    session.current = createPlacesSession();
  };

  const selectSuggestion = async (suggestion: PlaceSuggestion) => {
    Keyboard.dismiss();
    setOpen(false);
    setQuery(suggestion.name);
    setBusy(true);
    const result = await resolvePlace(suggestion, session.current);
    setBusy(false);
    if (!result.ok) {
      onProblem?.(result.error);
      return;
    }
    choose(result.data);
  };

  const useCurrentLocation = async () => {
    Keyboard.dismiss();
    setOpen(false);
    setBusy(true);
    const result = await getCurrentPlace();
    setBusy(false);
    if (!result.ok) {
      onProblem?.(result.error);
      return;
    }
    choose(result.data);
  };

  const clear = () => {
    setShownId(null);
    setQuery("");
    setSuggestions([]);
    onChange(null);
  };

  return (
    <View>
      <SoftField
        value={query}
        onChangeText={(next) => {
          setQuery(next);
          setOpen(true);
          setSearching(true);
          if (value) {
            setShownId(null);
            onChange(null);
          }
        }}
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          setOpen(true);
          setSearching(true);
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 200);
        }}
        placeholder={placeholder}
        autoCorrect={false}
        icon={icon}
        trailing={
          <View style={styles.trailing}>
            {busy ? (
              <LoadingLogo color={brandBlue} size={18} />
            ) : (
              query.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Clear ${placeholder.toLowerCase()}`}
                  hitSlop={8}
                  onPress={clear}
                >
                  <X color={mutedText} size={18} strokeWidth={2} />
                </Pressable>
              )
            )}
            {allowCurrentLocation && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Use my current location"
                disabled={busy}
                hitSlop={8}
                onPress={useCurrentLocation}
              >
                <LocateFixed color={brandBlue} size={20} strokeWidth={2} />
              </Pressable>
            )}
          </View>
        }
      />

      {open && (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(100)}
          style={styles.dropdown}
        >
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion.id}
              accessibilityRole="button"
              accessibilityLabel={`${suggestion.name}, ${suggestion.address}`}
              onPress={() => selectSuggestion(suggestion)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowIcon}>
                <MapPin color={brandBlue} size={15} strokeWidth={2} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {suggestion.name}
                </Text>
                {!!suggestion.address && (
                  <Text style={styles.rowSubtitle} numberOfLines={1}>
                    {suggestion.address}
                  </Text>
                )}
              </View>
            </Pressable>
          ))}

          {searching ? (
            <View style={styles.status}>
              <LoadingLogo color={brandBlue} size={18} />
              <Text style={styles.statusText}>Searching places...</Text>
            </View>
          ) : suggestions.length === 0 ? (
            <Text style={styles.statusText}>
              {query.trim().length < minPlaceQueryLength
                ? "Type at least 2 letters to search places."
                : "No places found."}
            </Text>
          ) : null}

          {!searching && !!searchError && (
            <Text style={[styles.statusText, styles.errorText]}>
              Google place search is unavailable.
            </Text>
          )}
          {suggestions.length > 0 && (
            <Text style={styles.attribution}>Powered by Google</Text>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  trailing: { flexDirection: "row", alignItems: "center", gap: 12 },
  dropdown: {
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: softBlue,
    backgroundColor: "#ffffff",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  rowIcon: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: softBlue,
  },
  rowText: { flex: 1 },
  rowTitle: { color: text, fontFamily: "SoraBold", fontSize: 11 },
  rowSubtitle: {
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 9,
    marginTop: 1,
  },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  statusText: {
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 10,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  errorText: { color: errorRed },
  attribution: {
    alignSelf: "flex-end",
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 8,
    marginTop: 2,
    marginRight: 4,
  },
});
