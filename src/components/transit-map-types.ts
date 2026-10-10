import type { OccupancyLevel } from "@/api/v1/transit-routes/controllers";
import type { WaitingAreaType } from "@/constants/waiting-area";

export const occupancyPinColors: Record<OccupancyLevel, string> = {
  Available: "#b7e4c7",
  Moderate: "#ffe066",
  "Almost Full": "#ffa94d",
  Full: "#ff6b6b",
};

export type TransitMapState = {
  routeId: string | null;
  route: [number, number][] | null;
  alternativeRoutes?: [number, number][][];
  waitingAreas?: {
    id: string;
    name: string;
    lat: number;
    lng: number;
    tag?: string | null;
    kind?: WaitingAreaType;
  }[];
  showStops?: boolean;
  vehicles: {
    id: string;
    lat: number;
    lng: number;
    type: string;
    label?: string | null;
    occupancy?: OccupancyLevel;
    isFull?: boolean;
  }[];
  focus: {
    key: number | string;
    lat: number;
    lng: number;
    zoom?: number;
  } | null;
  padTop: number;
  padBottom: number;
  pickups?: {
    id: string;
    lat: number;
    lng: number;
    passengers?: number;
    label?: string;
  }[];
  pickupLine?: [number, number][] | null;
  pickupLineColor?: string;
  userLocation?: { lat: number; lng: number } | null;
  fit?: { key: number | string; points: [number, number][] } | null;
};

export type MapCenter = { lat: number; lng: number };

export type TransitMapProps = {
  state: TransitMapState;
  onDrag?: () => void;
  onCenterChange?: (center: MapCenter) => void;
  onVehiclePress?: (id: string) => void;
};
