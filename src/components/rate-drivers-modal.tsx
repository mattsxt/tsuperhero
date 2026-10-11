import CircleCheck from "lucide-react-native/icons/circle-check";
import Star from "lucide-react-native/icons/star";
import X from "lucide-react-native/icons/x";
import { useState } from "react";
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
import Animated, { FadeIn, FadeInRight } from "react-native-reanimated";

import { maxFeedbackLength, scoreLabels } from "@/api/v1/ratings/controllers";
import {
  rateRentalDriver,
  unratedDrivers,
  type Rental,
} from "@/api/v1/rentals/controllers";
import { ErrorAlert } from "@/components/error-alert";
import { LoadingLogo } from "@/components/LoadingLogo";
import { StarInput } from "@/components/star-rating";
import { palette } from "@/constants/colors";

const praise = [
  "On time",
  "Safe driving",
  "Friendly",
  "Clean vehicle",
  "Helpful",
];
const issues = [
  "Late",
  "Unsafe driving",
  "Rude",
  "Dirty vehicle",
  "Wrong route",
];

/**
 * Rates each hired driver of a completed rental, one at a time: stars, quick tags that
 * match the score, and an optional comment. Drivers can be skipped and rated later from
 * Bookings.
 */
export function RateDriversModal({
  rental,
  onClose,
}: {
  rental: Rental | null;
  /** \`rated\` is how many drivers were rated in this session. */
  onClose: (rated: number) => void;
}) {
  // The drivers are fixed when the sheet opens; each gets a draft until everything is submitted.
  const [queue] = useState(() => (rental ? unratedDrivers(rental) : []));
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    queue.map(() => ({ score: 0, tags: [], feedback: "" })),
  );
  /** 0..n-1: rating a driver; n: review and submit. */
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState("");
  const [rated, setRated] = useState<number | null>(null);

  if (!rental || queue.length === 0) return null;
  const reviewing = index >= queue.length;
  const done = rated !== null;
  const draft = drafts[Math.min(index, queue.length - 1)];
  const driver = queue[Math.min(index, queue.length - 1)];
  const tagOptions = draft.score >= 4 ? praise : issues;
  const ratedCount = drafts.filter((item) => item.score > 0).length;

  const update = (change: Partial<Draft>) =>
    setDrafts((current) =>
      current.map((item, position) =>
        position === index ? { ...item, ...change } : item,
      ),
    );

  const go = (next: number) => {
    setProblem("");
    setIndex(next);
  };

  const submitAll = async () => {
    if (saving) return;
    setSaving(true);
    setProblem("");
    let sent = 0;
    for (let position = 0; position < queue.length; position += 1) {
      const item = drafts[position];
      const unit = queue[position];
      if (!item.score || !unit.driverId) continue;
      const result = await rateRentalDriver(
        rental.id,
        unit.driverId,
        item.score,
        item.feedback,
        item.tags,
      );
      if (!result.ok) {
        setSaving(false);
        setProblem(`${unit.driverName ?? "A driver"}: ${result.error}`);
        return;
      }
      sent += 1;
      // Sent ones can't be resent; clear them so a retry only sends the rest.
      setDrafts((current) =>
        current.map((draftItem, at) =>
          at === position ? { score: 0, tags: [], feedback: "" } : draftItem,
        ),
      );
    }
    setSaving(false);
    setRated(sent);
  };

  const toggleTag = (tag: string) =>
    update({
      tags: draft.tags.includes(tag)
        ? draft.tags.filter((item) => item !== tag)
        : [...draft.tags, tag],
    });

  const close = () => onClose(rated ?? 0);

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={saving ? () => undefined : close}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.badge}>
              <Star color="#ffffff" size={22} strokeWidth={2.2} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.eyebrow}>
                {done
                  ? "ALL DONE"
                  : reviewing
                    ? "REVIEW YOUR RATINGS"
                    : `RATE YOUR DRIVERS · ${index + 1} OF ${queue.length}`}
              </Text>
              <Text style={styles.title} numberOfLines={2}>
                {rental.destination}
              </Text>
            </View>
            {!saving && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={10}
                onPress={close}
              >
                <X color="#ffffff" size={18} strokeWidth={2.5} />
              </Pressable>
            )}
          </View>

          {!done && (
            <View style={styles.progress}>
              {[...queue, null].map((item, position) => (
                <Pressable
                  key={item?.id ?? "review"}
                  accessibilityRole="button"
                  accessibilityLabel={
                    item
                      ? `Go to ${item.driverName ?? "driver"}`
                      : "Go to review"
                  }
                  disabled={saving}
                  onPress={() => go(position)}
                  hitSlop={8}
                  style={[
                    styles.progressBar,
                    position < queue.length &&
                      drafts[position].score > 0 &&
                      styles.progressDone,
                    position === index && styles.progressCurrent,
                  ]}
                />
              ))}
            </View>
          )}

          {done ? (
            <Animated.View entering={FadeIn.duration(200)} style={styles.body}>
              <View style={styles.thanks}>
                <CircleCheck
                  color={palette.success}
                  size={40}
                  strokeWidth={2}
                />
                <Text style={styles.thanksTitle}>
                  {rated ? "Thanks for rating!" : "No problem"}
                </Text>
                <Text style={styles.thanksText}>
                  {rated
                    ? "Your ratings help other commuters choose, and help drivers improve."
                    : "You can rate your drivers anytime from Bookings."}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={close}
                style={({ pressed }) => [
                  styles.button,
                  styles.primary,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.primaryText}>DONE</Text>
              </Pressable>
            </Animated.View>
          ) : reviewing ? (
            <ScrollView contentContainerStyle={styles.body}>
              {queue.map((unit, position) => {
                const item = drafts[position];
                return (
                  <View key={unit.id} style={styles.reviewRow}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {(unit.driverName ?? "D").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.driverName} numberOfLines={1}>
                        {unit.driverName ?? "Your driver"}
                      </Text>
                      {item.score > 0 ? (
                        <View style={styles.reviewStars}>
                          {[1, 2, 3, 4, 5].map((value) => (
                            <Star
                              key={value}
                              size={14}
                              color={
                                value <= item.score ? "#f5b301" : "#d6dbe6"
                              }
                              fill={
                                value <= item.score ? "#f5b301" : "transparent"
                              }
                            />
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.reviewNone}>Not rated</Text>
                      )}
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Edit rating for ${unit.driverName ?? "driver"}`}
                      disabled={saving}
                      hitSlop={8}
                      onPress={() => go(position)}
                    >
                      <Text style={styles.editText}>
                        {item.score > 0 ? "Edit" : "Rate"}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}

              {!!problem && <ErrorAlert title="Rating" message={problem} />}

              <Text style={styles.reviewHint}>
                {ratedCount === 0
                  ? "Rate at least one driver to submit. You can also rate them later from Bookings."
                  : ratedCount < queue.length
                    ? "Drivers you didn't rate can be rated later from Bookings."
                    : "Ratings are sent to your drivers and can't be changed after you submit."}
              </Text>
              <View style={styles.nav}>
                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={() => go(queue.length - 1)}
                  style={({ pressed }) => [
                    styles.button,
                    styles.secondary,
                    styles.navButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.secondaryText}>BACK</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled: ratedCount === 0 || saving,
                    busy: saving,
                  }}
                  disabled={ratedCount === 0 || saving}
                  onPress={submitAll}
                  style={({ pressed }) => [
                    styles.button,
                    styles.primary,
                    styles.navButton,
                    { marginTop: 0 },
                    (pressed || ratedCount === 0) && styles.pressed,
                  ]}
                >
                  {saving ? (
                    <LoadingLogo color="#ffffff" size={20} label="Sending" />
                  ) : (
                    <Text style={styles.primaryText}>SUBMIT RATINGS</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.body}
            >
              <Animated.View
                key={driver.id}
                entering={FadeInRight.duration(220)}
                style={styles.step}
              >
                <View style={styles.driver}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(driver.driverName ?? "D").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.driverName} numberOfLines={1}>
                      {driver.driverName ?? "Your driver"}
                    </Text>
                    <Text style={styles.driverMeta} numberOfLines={1}>
                      {[driver.vehicleType, driver.plateNumber]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                </View>

                <Text style={styles.question}>
                  How was your trip with them?
                </Text>
                <StarInput
                  value={draft.score}
                  onChange={(value) =>
                    // Tags only make sense for the side of the scale they were picked on.
                    update(
                      value >= 4 !== draft.score >= 4
                        ? { score: value, tags: [] }
                        : { score: value },
                    )
                  }
                />
                <Text style={styles.scoreLabel}>
                  {draft.score
                    ? scoreLabels[draft.score]
                    : "Tap a star to rate"}
                </Text>

                {draft.score > 0 && (
                  <Animated.View
                    entering={FadeIn.duration(180)}
                    style={styles.tagsWrap}
                  >
                    <Text style={styles.section}>
                      {draft.score >= 4
                        ? "WHAT WENT WELL?"
                        : "WHAT WENT WRONG?"}
                    </Text>
                    <View style={styles.tags}>
                      {tagOptions.map((tag) => {
                        const selected = draft.tags.includes(tag);
                        return (
                          <Pressable
                            key={tag}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            onPress={() => toggleTag(tag)}
                            style={[styles.tag, selected && styles.tagSelected]}
                          >
                            <Text
                              style={[
                                styles.tagText,
                                selected && styles.tagTextSelected,
                              ]}
                            >
                              {tag}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <TextInput
                      value={draft.feedback}
                      onChangeText={(value) => update({ feedback: value })}
                      placeholder="Add a comment (optional)"
                      placeholderTextColor="#9a9a9a"
                      multiline
                      maxLength={maxFeedbackLength}
                      style={styles.input}
                    />
                  </Animated.View>
                )}

                <View style={styles.nav}>
                  {index > 0 && (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => go(index - 1)}
                      style={({ pressed }) => [
                        styles.button,
                        styles.secondary,
                        styles.navButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.secondaryText}>BACK</Text>
                    </Pressable>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => go(index + 1)}
                    style={({ pressed }) => [
                      styles.button,
                      styles.primary,
                      styles.navButton,
                      { marginTop: 0 },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.primaryText}>
                      {index + 1 < queue.length ? "NEXT DRIVER" : "REVIEW"}
                    </Text>
                  </Pressable>
                </View>
                {!draft.score && (
                  <Text style={styles.reviewHint}>
                    No stars? This driver is skipped. You can rate them later.
                  </Text>
                )}
              </Animated.View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type Draft = { score: number; tags: string[]; feedback: string };

const styles = StyleSheet.create({
  nav: { flexDirection: "row", gap: 10, marginTop: 4 },
  navButton: { flex: 1 },
  secondary: { borderWidth: 1.5, borderColor: palette.brand },
  secondaryText: {
    color: palette.brand,
    fontFamily: "SoraBold",
    fontSize: 13,
    letterSpacing: 1,
  },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#f1f5fc",
  },
  reviewStars: { flexDirection: "row", gap: 2, marginTop: 2 },
  reviewNone: {
    color: "#6b6b6b",
    fontFamily: "Sora",
    fontSize: 11,
    marginTop: 2,
  },
  editText: { color: palette.brand, fontFamily: "SoraBold", fontSize: 12 },
  reviewHint: {
    color: "#6b6b6b",
    fontFamily: "Sora",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
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
    backgroundColor: palette.header,
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
  eyebrow: { color: palette.cyan, fontFamily: "SoraBold", fontSize: 10 },
  title: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 17,
    lineHeight: 22,
  },
  progress: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e3ecfb",
  },
  progressDone: { backgroundColor: palette.success },
  progressCurrent: { backgroundColor: palette.brand },
  body: { gap: 12, padding: 18 },
  step: { gap: 12 },
  driver: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: "#e3ecfb",
  },
  avatarText: { color: palette.brand, fontFamily: "SoraBold", fontSize: 18 },
  driverName: { color: palette.brand, fontFamily: "SoraBold", fontSize: 15 },
  driverMeta: { color: "#6b6b6b", fontFamily: "Sora", fontSize: 12 },
  question: {
    marginTop: 4,
    color: "#111111",
    fontFamily: "SoraBold",
    fontSize: 13,
    textAlign: "center",
  },
  scoreLabel: {
    color: "#6b6b6b",
    fontFamily: "Sora",
    fontSize: 12,
    textAlign: "center",
  },
  tagsWrap: { gap: 8 },
  section: { color: "#6b6b6b", fontFamily: "SoraBold", fontSize: 10 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: "#dbe4f5",
    borderRadius: 999,
  },
  tagSelected: { borderColor: palette.brand, backgroundColor: palette.brand },
  tagText: { color: palette.brand, fontFamily: "SoraBold", fontSize: 11 },
  tagTextSelected: { color: "#ffffff" },
  input: {
    minHeight: 72,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#f1f5fc",
    color: "#111111",
    fontFamily: "Sora",
    fontSize: 12,
    textAlignVertical: "top",
  },
  button: {
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  primary: { marginTop: 4, backgroundColor: palette.brand },
  primaryText: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 13,
    letterSpacing: 1,
  },
  skip: { alignItems: "center", paddingVertical: 8 },
  skipText: { color: palette.brand, fontFamily: "SoraBold", fontSize: 12 },
  thanks: { alignItems: "center", gap: 8, paddingVertical: 8 },
  thanksTitle: { color: palette.brand, fontFamily: "SoraBold", fontSize: 17 },
  thanksText: {
    color: "#6b6b6b",
    fontFamily: "Sora",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  pressed: { opacity: 0.6 },
});
