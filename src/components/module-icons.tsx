import Svg, { Circle, Path } from "react-native-svg";

type ModuleIconProps = { color: string; size: number; strokeWidth?: number };

export function PickupIcon({
  color,
  size,
  strokeWidth = 1.8,
}: ModuleIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Circle cx={10} cy={7.5} r={4.5} />
      <Path d="M2.5 21a7.5 7.5 0 0 1 12-6" />
      <Path d="M19 21.5v-7" />
      <Path d="m16 17.5 3-3 3 3" />
    </Svg>
  );
}
