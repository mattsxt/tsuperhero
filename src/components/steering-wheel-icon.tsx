import Svg, { Circle, Path } from "react-native-svg";

export function SteeringWheelIcon({
  color = "#000000",
  size = 24,
  strokeWidth = 2,
}: {
  color?: string;
  size?: number;
  strokeWidth?: number;
}) {
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
      <Circle cx="12" cy="12" r="10" />
      <Circle cx="12" cy="12" r="2.5" />
      <Path d="M2.5 10.5 9.6 11.4" />
      <Path d="M21.5 10.5 14.4 11.4" />
      <Path d="M12 14.5V22" />
    </Svg>
  );
}
