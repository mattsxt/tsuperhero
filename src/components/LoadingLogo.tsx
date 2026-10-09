import { useEffect } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";

type Point = [number, number];
type Segment = Point[];

const routeShape =
  "M9.83609 6.93587C14.3217 8.96964 13.0508 13.1516 10.9479 14.8336C8.52376 16.7738 5.40818 16.561 3.68811 14.808C5.33909 15.8576 8.25116 14.8884 9.32771 13.2734C10.5497 11.4404 10.2617 9.36081 8.31319 8.47744C8.31319 8.47744 5.44234 7.18998 5.44173 7.18977C4.93641 6.96136 4.80839 6.38545 5.05701 5.88495C5.30405 5.38761 5.83695 5.1359 6.34085 5.35854L9.83609 6.93587ZM4.80119 9.1799C2.85309 8.29635 2.56539 6.21615 3.78667 4.3829C4.8631 2.76805 7.77535 1.79879 9.42665 2.84906C7.70582 1.09547 4.59129 0.883249 2.16663 2.82307C0.0636456 4.50531 -1.20806 8.68606 3.27854 10.7208L6.71019 12.2775C7.21408 12.5001 7.74621 12.2478 7.9935 11.7499C8.24191 11.25 8.11444 10.6743 7.6086 10.4447C7.60754 10.4447 4.80119 9.1799 4.80119 9.1799Z";

const upperRoute: Segment[] = [
  [
    [10.8, 2.7],
    [8.8, 1.4],
    [5.2, 1.4],
    [3.2, 3.4],
  ],
  [
    [3.2, 3.4],
    [1.2, 5.4],
    [1.4, 8.6],
    [4, 9.9],
  ],
  [
    [4, 9.9],
    [7, 11.3],
  ],
];

const lowerRoute: Segment[] = [
  [
    [2.72, 14.27],
    [4.72, 15.57],
    [8.32, 15.57],
    [10.32, 13.57],
  ],
  [
    [10.32, 13.57],
    [12.32, 11.57],
    [12.12, 8.37],
    [9.52, 7.07],
  ],
  [
    [9.52, 7.07],
    [6.52, 5.67],
  ],
];

const samplesPerSegment = 24;
const cycleMs = 1800;
const viewBox = { x: -2, y: -2, width: 18, height: 21 };

function pointOn(segment: Segment, t: number): Point {
  if (segment.length === 2) {
    const [[x0, y0], [x1, y1]] = segment;
    return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
  }
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = segment;
  const u = 1 - t;
  return [
    u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
    u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
  ];
}

function sampleRoute(route: Segment[]) {
  const points: Point[] = [];
  route.forEach((segment, index) => {
    for (let step = index === 0 ? 0 : 1; step <= samplesPerSegment; step++) {
      points.push(pointOn(segment, step / samplesPerSegment));
    }
  });
  const lengths = [0];
  for (let index = 1; index < points.length; index++) {
    const [ax, ay] = points[index - 1];
    const [bx, by] = points[index];
    lengths.push(lengths[index - 1] + Math.hypot(bx - ax, by - ay));
  }
  const total = lengths[lengths.length - 1];
  return {
    xs: points.map(([x]) => x),
    ys: points.map(([, y]) => y),
    stops: lengths.map((length) => length / total),
  };
}

const upperSamples = sampleRoute(upperRoute);
const lowerSamples = sampleRoute(lowerRoute);

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

function Stop({
  samples,
  progress,
  color,
}: {
  samples: ReturnType<typeof sampleRoute>;
  progress: SharedValue<number>;
  color: string;
}) {
  const animatedProps = useAnimatedProps(() => {
    const t = progress.get();
    return {
      cx: interpolate(t, samples.stops, samples.xs),
      cy: interpolate(t, samples.stops, samples.ys),
      opacity: interpolate(t, [0, 0.2, 0.7, 1], [0, 1, 1, 0]),
    };
  });
  return (
    <AnimatedCircle
      r={1.727}
      stroke={color}
      strokeWidth={2}
      fill="none"
      animatedProps={animatedProps}
    />
  );
}

export function LoadingLogo({
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
  const reduceMotion = useReducedMotion();
  const travel = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    travel.set(0);
    travel.set(
      withRepeat(
        withTiming(1, {
          duration: cycleMs,
          easing: Easing.bezier(0.65, 0, 0.35, 1),
        }),
        -1,
      ),
    );
    pulse.set(0.45);
    pulse.set(
      withRepeat(
        withTiming(1, {
          duration: cycleMs / 2,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true,
      ),
    );
    return () => {
      cancelAnimation(travel);
      cancelAnimation(pulse);
    };
  }, [reduceMotion, travel, pulse]);

  const routeProps = useAnimatedProps(() => ({ opacity: pulse.get() }));
  const width = size * (viewBox.width / viewBox.height);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={[{ width, height: size, alignSelf: "center" }, style]}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        fill="none"
      >
        <AnimatedPath d={routeShape} fill={color} animatedProps={routeProps} />
        {!reduceMotion && (
          <>
            <Stop samples={upperSamples} progress={travel} color={color} />
            <Stop samples={lowerSamples} progress={travel} color={color} />
          </>
        )}
      </Svg>
    </View>
  );
}
