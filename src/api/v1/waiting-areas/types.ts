export type WaitingAreaRow = {
<<<<<<< HEAD
  id: string;
  name: string;
  lat: number;
  lng: number;
  route_id?: string | null;
  type?: string | null;
=======
  area_id: string;
  area_name: string;
  area_latitude: number;
  area_longitude: number;
  route_id?: string | null;
  area_type?: string | null;
>>>>>>> origin/mapbox
  vicinity?: string | null;
  is_active: boolean;
};
