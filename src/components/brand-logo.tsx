import { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { ClipPath, Defs, G, Path, Rect } from "react-native-svg";

export function BrandLogo({
  size,
  color = "#ffffff",
  style,
}: {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Svg
      width={size ?? "100%"}
      height={size ?? "100%"}
      viewBox="0 0 38 38"
      fill="none"
      style={style}
    >
      <Defs>
        <ClipPath id="brand-logo-mark">
          <Rect
            width={10.3636}
            height={14.9697}
            transform="translate(11.5151 14.761) rotate(-25.1073)"
          />
        </ClipPath>
      </Defs>
      <Path
        d="M38 0L17.3598 3.00586L16.0609 3.19141L16.0832 3.19883C8.60938 4.5793 2.92422 11.1328 2.92422 19C2.92422 23.4309 4.72773 27.4535 7.63711 30.3629L0 38L20.6402 34.9941L21.9391 34.8086L21.9168 34.8012C29.3906 33.4207 35.0758 26.8672 35.0758 19C35.0758 14.5691 33.2723 10.5465 30.3629 7.63711L38 0ZM19 5.84844C26.2512 5.84844 32.1516 11.7488 32.1516 19C32.1516 26.2512 26.2512 32.1516 19 32.1516C11.7488 32.1516 5.84844 26.2512 5.84844 19C5.84844 11.7488 11.7488 5.84844 19 5.84844Z"
        fill={color}
      />
      <G clipPath="url(#brand-logo-mark)">
        <Path
          d="M22.6543 17.451C27.1399 19.4848 25.8689 23.6667 23.7661 25.3488C21.3419 27.2889 18.2264 27.0762 16.5063 25.3232C18.1573 26.3727 21.0693 25.4035 22.1459 23.7885C23.3679 21.9555 23.0799 19.876 21.1314 18.9926C21.1314 18.9926 18.2605 17.7051 18.2599 17.7049C17.7546 17.4765 17.6266 16.9006 17.8752 16.4001C18.1222 15.9027 18.6551 15.651 19.159 15.8737L22.6543 17.451ZM17.6194 19.695C15.6713 18.8115 15.3836 16.7313 16.6049 14.898C17.6813 13.2832 20.5935 12.3139 22.2448 13.3642C20.524 11.6106 17.4095 11.3984 14.9848 13.3382C12.8818 15.0204 11.6101 19.2012 16.0967 21.2359L19.5284 22.7926C20.0323 23.0153 20.5644 22.763 20.8117 22.265C21.0601 21.7651 20.9326 21.1894 20.4268 20.9598C20.4257 20.9598 17.6194 19.695 17.6194 19.695Z"
          fill={color}
        />
      </G>
      <Path
        d="M23.6061 14.9697C24.56 14.9697 25.3333 14.1964 25.3333 13.2424C25.3333 12.2885 24.56 11.5151 23.6061 11.5151C22.6521 11.5151 21.8788 12.2885 21.8788 13.2424C21.8788 14.1964 22.6521 14.9697 23.6061 14.9697Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15.5454 26.4848C16.4994 26.4848 17.2727 25.7115 17.2727 24.7575C17.2727 23.8036 16.4994 23.0303 15.5454 23.0303C14.5915 23.0303 13.8182 23.8036 13.8182 24.7575C13.8182 25.7115 14.5915 26.4848 15.5454 26.4848Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const loadingLayers = {
  origin: {
    d: "M10.7879 4.45455C11.7418 4.45455 12.5152 3.68122 12.5152 2.72727C12.5152 1.77333 11.7418 1 10.7879 1C9.83393 1 9.06061 1.77333 9.06061 2.72727C9.06061 3.68122 9.83393 4.45455 10.7879 4.45455Z",
    stroke: true,
  },
  road: {
    d: "M9.83609 6.93587C14.3217 8.96964 13.0508 13.1516 10.9479 14.8336C8.52376 16.7738 5.40818 16.561 3.68811 14.808C5.33909 15.8576 8.25116 14.8884 9.32771 13.2734C10.5497 11.4404 10.2617 9.36081 8.31319 8.47744C8.31319 8.47744 5.44234 7.18998 5.44173 7.18977C4.93641 6.96136 4.80839 6.38545 5.05701 5.88495C5.30405 5.38761 5.83695 5.1359 6.34085 5.35854L9.83609 6.93587ZM4.80119 9.1799C2.85309 8.29635 2.56539 6.21615 3.78667 4.3829C4.8631 2.76805 7.77535 1.79879 9.42665 2.84906C7.70582 1.09547 4.59129 0.883249 2.16663 2.82307C0.0636456 4.50531 -1.20806 8.68606 3.27854 10.7208L6.71019 12.2775C7.21408 12.5001 7.74621 12.2478 7.9935 11.7499C8.24191 11.25 8.11444 10.6743 7.6086 10.4447C7.60754 10.4447 4.80119 9.1799 4.80119 9.1799Z",
    stroke: false,
  },
  destination: {
    d: "M2.72727 15.9697C3.68122 15.9697 4.45455 15.1964 4.45455 14.2424C4.45455 13.2885 3.68122 12.5151 2.72727 12.5151C1.77333 12.5151 1 13.2885 1 14.2424C1 15.1964 1.77333 15.9697 2.72727 15.9697Z",
    stroke: true,
  },
};

const loadingCycleMs = 1_800;
const revealWindows = {
  origin: [0, 0.16],
  road: [0.14, 0.38],
  destination: [0.36, 0.52],
} as const;
const fadeOutWindow = [0.74, 0.92] as const;

function LoadingLayer({
  layer,
  progress,
  color,
  reduceMotion,
}: {
  layer: keyof typeof loadingLayers;
  progress: SharedValue<number>;
  color: string;
  reduceMotion: boolean;
}) {
  const [inStart, inEnd] = revealWindows[layer];
  const animatedStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: 1 };
    const fadeIn = interpolate(
      progress.value,
      [inStart, inEnd],
      [0, 1],
      "clamp",
    );
    const fadeOut = interpolate(
      progress.value,
      [fadeOutWindow[0], fadeOutWindow[1]],
      [1, 0],
      "clamp",
    );
    return { opacity: fadeIn * fadeOut };
  });
  const { d, stroke } = loadingLayers[layer];
  return (
    <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
      <Svg width="100%" height="100%" viewBox="0 0 14 17" fill="none">
        <Path
          d={d}
          fill={stroke ? "none" : color}
          stroke={stroke ? color : undefined}
          strokeWidth={stroke ? 2 : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
}

export function LoadingSprite({
  size = 40,
  color = "#193caf",
  label = "Loading",
  style,
}: {
  size?: number;
  color?: string;
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withRepeat(
      withTiming(1, {
        duration: loadingCycleMs,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
    );
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion]);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={[styles.sprite, { width: size * (14 / 17), height: size }, style]}
    >
      {(Object.keys(loadingLayers) as (keyof typeof loadingLayers)[]).map(
        (layer) => (
          <LoadingLayer
            key={layer}
            layer={layer}
            progress={progress}
            color={color}
            reduceMotion={reduceMotion}
          />
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sprite: { alignSelf: "center" },
});
