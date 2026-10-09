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
    kind?: "stop" | "terminal";
  }[];
  vehicles: {
    id: string;
    lat: number;
    lng: number;
    type: string;
    label?: string | null;
    muted?: boolean;
  }[];
  focus: {
    key: number | string;
    lat: number;
    lng: number;
    zoom?: number;
  } | null;
  padTop: number;
  padBottom: number;
  pickups?: { id: string; lat: number; lng: number; passengers?: number }[];
  pickupLine?: [number, number][] | null;
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
