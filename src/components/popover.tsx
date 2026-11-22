import { useRef, useState, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, { Keyframe, ZoomIn, ZoomOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { palette } from "@/constants/colors";

const maxWidth = 256;
const tipBackground = "#111827";
const edge = 12;
const popMs = 200;

const variants = {
  popover: { offset: 10, arrowSize: 12, closeMs: popMs },
  tooltip: { offset: 6, arrowSize: 8, closeMs: 100 },
} as const;

const tooltipIn = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.85 }] },
  100: { opacity: 1, transform: [{ scale: 1 }] },
}).duration(120);
const tooltipOut = new Keyframe({
  0: { opacity: 1, transform: [{ scale: 1 }] },
  100: { opacity: 0, transform: [{ scale: 0.85 }] },
}).duration(100);

type Anchor = { x: number; y: number; width: number; height: number };

export function Popover({
  heading,
  body,
  children,
  accessibilityLabel,
  triggerStyle,
  variant = "popover",
}: {
  variant?: keyof typeof variants;
  heading: string;
  body?: ReactNode;
  children: ReactNode;
  accessibilityLabel: string;
  triggerStyle?: StyleProp<ViewStyle>;
}) {
  const trigger = useRef<View>(null);
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [showing, setShowing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { offset, arrowSize, closeMs } = variants[variant];
  const tooltip = variant === "tooltip";

  const open = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    trigger.current?.measureInWindow((x, y, width, height) => {
      setSize(null);
      setAnchor({ x, y, width, height });
      setShowing(true);
    });
  };

  const close = () => {
    setShowing(false);
    closeTimer.current = setTimeout(() => setAnchor(null), closeMs);
  };

  let placement: {
    left: number;
    top: number;
    above: boolean;
    arrowLeft: number;
  } | null = null;
  if (anchor && size) {
    const centre = anchor.x + anchor.width / 2;
    const left = Math.min(
      Math.max(centre - size.width / 2, edge),
      window.width - size.width - edge,
    );
    const above = anchor.y - offset - size.height >= insets.top + edge;
    placement = {
      left,
      top: above
        ? anchor.y - offset - size.height
        : anchor.y + anchor.height + offset,
      above,
      arrowLeft: Math.min(
        Math.max(centre - left - arrowSize / 2, 10),
        size.width - arrowSize - 10,
      ),
    };
  }

  const content = (
    <>
      <Text style={tooltip ? styles.tipHeading : styles.heading}>
        {heading}
      </Text>
      {typeof body === "string" ? (
        <Text style={tooltip ? styles.tipBody : styles.body}>{body}</Text>
      ) : (
        body
      )}
    </>
  );

  return (
    <>
      <Pressable
        ref={trigger}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: showing }}
        onPress={() => (showing ? close() : open())}
        style={({ pressed }) => [triggerStyle, pressed && styles.pressed]}
      >
        {children}
      </Pressable>

      <Modal
        visible={!!anchor}
        transparent
        statusBarTranslucent
        animationType="none"
        onRequestClose={close}
      >
        <Pressable
          accessibilityLabel="Close"
          style={StyleSheet.absoluteFill}
          onPress={close}
        />

        {anchor && !size && (
          <View
            pointerEvents="none"
            style={[tooltip ? styles.tip : styles.card, styles.measuring]}
            onLayout={(event) =>
              setSize({
                width: event.nativeEvent.layout.width,
                height: event.nativeEvent.layout.height,
              })
            }
          >
            {content}
          </View>
        )}

        {showing && placement && (
          <Animated.View
            entering={tooltip ? tooltipIn : ZoomIn.duration(popMs)}
            exiting={tooltip ? tooltipOut : ZoomOut.duration(popMs)}
            accessibilityRole="alert"
            style={[
              tooltip ? styles.tip : styles.card,
              { left: placement.left, top: placement.top, width: size?.width },
            ]}
          >
            <View
              style={[
                styles.arrow,
                {
                  left: placement.arrowLeft,
                  width: arrowSize,
                  height: arrowSize,
                  backgroundColor: tooltip ? tipBackground : "#ffffff",
                },
                placement.above
                  ? { bottom: -arrowSize / 2 + 1 }
                  : { top: -arrowSize / 2 + 1 },
              ]}
            />
            {content}
          </Animated.View>
        )}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pressed: { transform: [{ scale: 0.92 }] },
  card: {
    position: "absolute",
    maxWidth,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  measuring: { left: 0, top: 0, opacity: 0 },
  arrow: { position: "absolute", transform: [{ rotate: "45deg" }] },
  tip: {
    position: "absolute",
    maxWidth: 220,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: tipBackground,
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 10,
  },
  tipHeading: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 12 },
  tipBody: { marginTop: 1, color: "#cbd5e1", fontFamily: "Sora", fontSize: 11 },
  heading: { color: palette.navy, fontFamily: "SoraBold", fontSize: 13 },
  body: {
    marginTop: 4,
    color: "#5b6474",
    fontFamily: "Sora",
    fontSize: 12,
    lineHeight: 17,
  },
});
