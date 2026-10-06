import { Image } from "expo-image";
import Svg, { Circle, Path } from "react-native-svg";

import type { VehicleType } from "@/api/v1/transit-routes/controllers";

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

const jeepneyPath =
  "M19,13V7H20V4H4V7H5V13H2C2,13.93 2.5,14.71 3.5,14.93V20A1,1 0 0,0 4.5,21H5.5A1,1 0 0,0 6.5,20V19H17.5V20A1,1 0 0,0 18.5,21H19.5A1,1 0 0,0 20.5,20V14.93C21.5,14.7 22,13.93 22,13H19M8,15A1.5,1.5 0 0,1 6.5,13.5A1.5,1.5 0 0,1 8,12A1.5,1.5 0 0,1 9.5,13.5A1.5,1.5 0 0,1 8,15M16,15A1.5,1.5 0 0,1 14.5,13.5A1.5,1.5 0 0,1 16,12A1.5,1.5 0 0,1 17.5,13.5A1.5,1.5 0 0,1 16,15M17.5,10.5C15.92,10.18 14.03,10 12,10C9.97,10 8,10.18 6.5,10.5V7H17.5V10.5Z";

// tintColor can't recolor the PNG embedded in tricycle.svg, so the
// tricycle uses the plain PNG, which tints reliably on every platform.
export function VehicleIcon({
  type,
  color,
  size,
}: {
  type: VehicleType;
  color: string;
  size: number;
}) {
  if (type === "tricy") {
    return (
      <Image
        source={require("@/assets/images/tricycle.png")}
        style={{ width: size, height: size }}
        tintColor={color}
        contentFit="contain"
      />
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d={jeepneyPath} />
    </Svg>
  );
}
