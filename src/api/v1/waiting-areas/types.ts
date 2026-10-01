export type WaitingAreaRow = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  route_id: string | null;
  vicinity?: string | null;
  route?: {
    route_name: string;
    route_code: string;
    vicinity: string[] | null;
  } | null;
  is_active: boolean;
};
