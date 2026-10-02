export type WaitingAreaRow = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  route_id?: string | null;
  type?: string | null;
  vicinity?: string | null;
  is_active: boolean;
};
