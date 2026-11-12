import type { Row } from "@/simulation/db";
import { avatar, avatars } from "@/simulation/seed/avatars";
import { routes } from "@/simulation/seed/geography";
import { pathLengthMeters, pointAtAlong, sliceAlong, type LatLngPair } from "@/utils/geo";

export const sid = (ns: number, n: number): string =>
  `${ns.toString(16).padStart(8, "0")}-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

const U = 1;
const P = 2;
const C = 3;
const D = 4;
const V = 5;
const OP = 6;

export const COOPERATIVE_ID = sid(7, 1);
const OPERATOR_ID = sid(OP, 1);

export const routeByCode = (code: string): string =>
  String(routes.find((r) => r.route_code === code)?.route_id);

export type Person = {
  key: string;
  first: string;
  last: string;
  email: string;
  phone: string;
  birth: string;
  kind: "commuter" | "driver" | "operator";
  avatar: string;
  n: number;
};

const extra = (
  key: string,
  first: string,
  last: string,
  kind: "commuter" | "driver",
  n: number,
  birth: string,
): Person => ({
  key,
  first,
  last,
  email: `${key}@demo.tsuperhero`,
  phone: `+63${String(n).padStart(10, "0")}`,
  birth,
  kind,
  avatar: avatar(`${first[0]}${last[0]}`, n),
  n,
});

export const people: Person[] = [
  { key: "juan", first: "Juan", last: "Dela Cruz", email: "juan@demo.tsuperhero", phone: "+630000000001", birth: "1996-03-14", kind: "commuter", avatar: avatars.juan, n: 1 },
  { key: "ana", first: "Ana", last: "Reyes", email: "ana@demo.tsuperhero", phone: "+630000000002", birth: "1998-07-02", kind: "commuter", avatar: avatars.ana, n: 2 },
  { key: "nena", first: "Nena", last: "Garcia", email: "nena@demo.tsuperhero", phone: "+630000000003", birth: "1992-11-21", kind: "commuter", avatar: avatars.nena, n: 3 },
  { key: "bong", first: "Bong", last: "Pascual", email: "bong@demo.tsuperhero", phone: "+630000000004", birth: "1990-01-09", kind: "commuter", avatar: avatars.bong, n: 4 },
  { key: "mario", first: "Mario", last: "Santos", email: "mario@demo.tsuperhero", phone: "+630000000011", birth: "1984-05-30", kind: "driver", avatar: avatars.mario, n: 11 },
  { key: "pedro", first: "Pedro", last: "Cruz", email: "pedro@demo.tsuperhero", phone: "+630000000012", birth: "1988-09-17", kind: "driver", avatar: avatars.pedro, n: 12 },
  { key: "carla", first: "Carla", last: "Lopez", email: "carla@demo.tsuperhero", phone: "+630000000013", birth: "1987-02-25", kind: "driver", avatar: avatars.carla, n: 13 },
  { key: "luis", first: "Luis", last: "Mendoza", email: "luis@demo.tsuperhero", phone: "+630000000014", birth: "1985-12-05", kind: "driver", avatar: avatars.luis, n: 14 },
  { key: "rosa", first: "Rosa", last: "Bautista", email: "rosa@demo.tsuperhero", phone: "+630000000015", birth: "1991-06-18", kind: "driver", avatar: avatars.rosa, n: 15 },
  { key: "tomas", first: "Tomas", last: "Villanueva", email: "tomas@demo.tsuperhero", phone: "+630000000016", birth: "1983-08-08", kind: "driver", avatar: avatars.tomas, n: 16 },
  extra("liza", "Liza", "Ramos", "commuter", 31, "1999-04-11"),
  extra("jun", "Jun", "Aquino", "commuter", 32, "1994-10-03"),
  extra("maricel", "Maricel", "Flores", "commuter", 33, "2001-01-27"),
  extra("ramon", "Ramon", "Castillo", "commuter", 34, "1978-06-15"),
  extra("joy", "Joy", "Navarro", "commuter", 35, "2003-09-08"),
  extra("paolo", "Paolo", "Santiago", "commuter", 36, "1997-12-19"),
  extra("carmen", "Carmen", "Dizon", "commuter", 37, "1969-03-02"),
  extra("rico", "Rico", "Domingo", "commuter", 38, "2000-08-23"),
  extra("grace", "Grace", "Villareal", "commuter", 39, "1995-05-30"),
  extra("allan", "Allan", "Torres", "commuter", 40, "1989-11-12"),
  extra("ben", "Ben", "Ocampo", "driver", 41, "1981-02-14"),
  extra("dante", "Dante", "Salazar", "driver", 42, "1976-07-21"),
  extra("edgar", "Edgar", "Manalo", "driver", 43, "1983-03-09"),
  extra("fely", "Fely", "Gonzales", "driver", 44, "1986-10-30"),
  extra("gil", "Gil", "Ramirez", "driver", 45, "1979-12-01"),
  extra("henry", "Henry", "Tolentino", "driver", 46, "1990-04-17"),
  extra("ike", "Ike", "Bernardo", "driver", 47, "1982-08-05"),
  extra("jose", "Jose", "Valdez", "driver", 48, "1975-01-22"),
  extra("karen", "Karen", "Medina", "driver", 49, "1993-06-28"),
  extra("lito", "Lito", "Soriano", "driver", 50, "1987-09-14"),
  extra("manny", "Manny", "Aguilar", "driver", 51, "1980-05-06"),
  extra("noel", "Noel", "Fajardo", "driver", 52, "1992-02-19"),
  extra("oscar", "Oscar", "Rivera", "driver", 53, "1984-11-26"),
  { key: "operator", first: "Bicol Demo Transport", last: "Cooperative", email: "operator@demo.tsuperhero", phone: "+630000000021", birth: "1980-01-01", kind: "operator", avatar: avatars.operator, n: 21 },
];

export const userId = (key: string): string => sid(U, people.find((p) => p.key === key)!.n);
export const commuterId = (key: string): string => sid(C, people.find((p) => p.key === key)!.n);
const personnelId = (key: string): string => sid(P, people.find((p) => p.key === key)!.n);
export const driverId = (key: string): string => sid(D, people.find((p) => p.key === key)!.n);

type VehicleSpec = {
  key: string;
  n: number;
  plate: string;
  type: "Jeepney" | "Tricycle" | "Van";
  seats: number;
  route: string;
  driver: string;
  status: string;
  modern: boolean;
  lat: number;
  lng: number;
  load?: number;
  circuit?: { route: string; from: number; to: number };
};

const routePathOf = (code: string): LatLngPair[] =>
  (routes.find((r) => r.route_code === code)?.path as LatLngPair[] | null) ?? [];

const along = (code: string, fraction: number) => {
  const path = routePathOf(code);
  const [lat, lng] = pointAtAlong(path, pathLengthMeters(path) * fraction);
  return { lat, lng };
};

const jeepney = (
  key: string,
  n: number,
  driver: string,
  route: string,
  fraction: number,
  seats: number,
  load: number,
  modern: boolean,
): VehicleSpec => ({
  key,
  n,
  plate: `DEMO ${100 + n}`,
  type: "Jeepney",
  seats,
  route,
  driver,
  status: "on-trip",
  modern,
  load,
  ...along(route, fraction),
});

const tricycle = (
  key: string,
  n: number,
  driver: string,
  route: string,
  from: number,
  to: number,
  load: number,
): VehicleSpec => ({
  key,
  n,
  plate: `TRC ${200 + n}`,
  type: "Tricycle",
  seats: 4,
  route: "NAGA-CITY",
  driver,
  status: "on-trip",
  modern: false,
  load,
  circuit: { route, from, to },
  ...along(route, from),
});

export const vehicleSpecs: VehicleSpec[] = [
  { key: "mario", n: 1, plate: "DEMO 101", type: "Jeepney", seats: 24, route: "DEL-CON-MAG-CEN", driver: "mario", status: "idle", modern: true, lat: 13.62295, lng: 123.18592 },
  { key: "pedro", n: 2, plate: "TRC 202", type: "Tricycle", seats: 4, route: "NAGA-CITY", driver: "pedro", status: "idle", modern: false, lat: 13.62295, lng: 123.18465 },
  { key: "bg1", n: 3, plate: "DEMO 103", type: "Jeepney", seats: 22, route: "DEL-CON-PAN-CEN", driver: "carla", status: "on-trip", modern: true, lat: 13.62142, lng: 123.19846 },
  { key: "bg2", n: 4, plate: "DEMO 104", type: "Jeepney", seats: 20, route: "DIVAB-MAG-CEN", driver: "luis", status: "on-trip", modern: false, lat: 13.61781, lng: 123.19738 },
  { key: "bg3", n: 5, plate: "DEMO 105", type: "Van", seats: 14, route: "SFE-FRA-CEN", driver: "rosa", status: "on-trip", modern: true, lat: 13.63639, lng: 123.19986 },
  tricycle("bg4", 6, "tomas", "DEL-CON-PAN-CEN", 0.65, 1, 2),
  jeepney("j7", 7, "ben", "DEL-CON-MAG-CEN", 0.2, 22, 9, false),
  jeepney("j8", 8, "dante", "DEL-CON-MAG-CEN", 0.55, 24, 17, true),
  jeepney("j9", 9, "edgar", "DEL-CON-PAN-CEN", 0.35, 20, 20, false),
  jeepney("j10", 10, "fely", "DIVAB-MAG-CEN", 0.6, 22, 6, true),
  jeepney("j11", 11, "gil", "DEL-CON-DIV-CEN", 0.25, 20, 12, false),
  jeepney("j12", 12, "henry", "DEL-CON-DIV-CEN", 0.7, 24, 4, true),
  jeepney("j13", 13, "ike", "DIVCD-MAG-CEN", 0.3, 22, 15, false),
  jeepney("j14", 14, "jose", "DIVCD-MAG-CEN", 0.75, 20, 8, false),
  jeepney("j15", 15, "karen", "SFE-FRA-CEN", 0.4, 22, 11, true),
  tricycle("t16", 16, "lito", "DIVAB-MAG-CEN", 0.6, 1, 1),
  tricycle("t17", 17, "manny", "DIVCD-MAG-CEN", 0.55, 0.95, 3),
  tricycle("t18", 18, "noel", "SFE-FRA-CEN", 0.5, 1, 0),
  tricycle("t19", 19, "oscar", "DEL-CON-MAG-CEN", 0.7, 1, 2),
];

export const vehicleCircuit = (id: unknown): LatLngPair[] | null => {
  const spec = vehicleSpecs.find((v) => vehicleId(v.key) === id);
  if (!spec?.circuit) return null;
  const path = routePathOf(spec.circuit.route);
  const length = pathLengthMeters(path);
  const circuit = sliceAlong(path, length * spec.circuit.from, length * spec.circuit.to);
  return circuit.length > 1 ? circuit : null;
};

export const vehicleId = (key: string): string => sid(V, vehicleSpecs.find((v) => v.key === key)!.n);

export const buildPeople = (now: Date) => {
  const joined = "2024-02-01";
  const user: Row[] = people.map((p) => ({
    user_id: userId(p.key),
    user_email: p.email,
    user_type: p.kind === "commuter" ? "commuter" : "transit_personnel",
  }));
  const profile: Row[] = people.map((p) => ({
    profile_id: sid(8, p.n),
    user_id: userId(p.key),
    user_type: p.kind === "commuter" ? "commuter" : "transit_personnel",
    first_name: p.first,
    last_name: p.last,
    contact_number: p.phone,
    birth_date: p.birth,
    profile_picture: p.avatar,
  }));
  const commuter: Row[] = people
    .filter((p) => p.kind === "commuter")
    .map((p) => ({ commuter_id: commuterId(p.key), user_id: userId(p.key) }));
  const transit_personnel: Row[] = people
    .filter((p) => p.kind !== "commuter")
    .map((p) => ({
      personnel_id: personnelId(p.key),
      user_id: userId(p.key),
      date_hired: joined,
      employment_status: "Active",
      documents_checked: ["license", "nbi"],
      cooperative_id: COOPERATIVE_ID,
    }));
  const operator: Row[] = [
    { operator_id: OPERATOR_ID, personnel_id: personnelId("operator"), operator_type: "Cooperative" },
  ];
  const vehicle: Row[] = vehicleSpecs.map((v) => ({
    vehicle_id: vehicleId(v.key),
    plate_number: v.plate,
    vehicle_type: v.type,
    vehicle_status: v.status,
    max_capacity: v.seats,
    current_capacity: v.load ?? 0,
    occupancy_level: 0,
    operator_id: OPERATOR_ID,
    is_modern: v.modern,
    documents_checked: ["registration", "franchise"],
    verified_at: now.toISOString(),
    cooperative_id: COOPERATIVE_ID,
    route_id: routeByCode(v.route),
    is_full: (v.load ?? 0) >= v.seats,
  }));
  const driver: Row[] = vehicleSpecs.map((v) => ({
    driver_id: driverId(v.driver),
    personnel_id: personnelId(v.driver),
    driver_type: v.type,
    years_of_experience: 3 + v.n,
    vehicle_id: vehicleId(v.key),
    operator_id: OPERATOR_ID,
    driver_code: `DRV-${String(v.n).padStart(3, "0")}`,
    duty: v.key === "mario" || v.key === "pedro" ? "off-duty" : "on-trip",
    attendance: "present",
    passenger_bucket: 0,
  }));
  const location_records: Row[] = vehicleSpecs.map((v) => ({
    vehicle_id: vehicleId(v.key),
    records_latitude: v.lat,
    records_longitude: v.lng,
    speed_kmh: 0,
    heading: 0,
    recorded_at: now.toISOString(),
  }));
  return { user, profile, commuter, transit_personnel, operator, vehicle, driver, location_records };
};

export const homePoints: Record<string, [number, number]> = {
  juan: [13.6244, 123.20293],
  ana: [13.62651, 123.20272],
};
