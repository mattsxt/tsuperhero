export type WaitingAreaRow = {
  area_id: string;
  area_name: string;
  area_latitude: number;
  area_longitude: number;
  route_id?: string | null;
  area_type?: string | null;
  vicinity?: string | null;
  is_active: boolean;
};
