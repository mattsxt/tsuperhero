import { buildSeed } from "@/simulation/seed";

export type Row = Record<string, unknown>;

export type TableName =
  | "user"
  | "profile"
  | "commuter"
  | "transit_personnel"
  | "driver"
  | "operator"
  | "vehicle"
  | "route"
  | "waiting_area"
  | "trip"
  | "trip_history"
  | "location_records"
  | "request"
  | "pickup"
  | "pickup_companion"
  | "charter_rental"
  | "charter_rental_unit"
  | "rating"
  | "notification"
  | "ride_emergency";

export type Tables = Record<TableName, Row[]>;

export type DbEvent = {
  table: TableName;
  type: "INSERT" | "UPDATE" | "DELETE";
  row: Row;
};

const listeners = new Set<(event: DbEvent) => void>();
let counter = 0;

const hex = (n: number, len: number) => n.toString(16).padStart(len, "0");

const tables = buildSeed(new Date());

export const db = {
  tables,
  reset(): void {
    const seed = buildSeed(new Date());
    for (const name of Object.keys(seed) as TableName[]) {
      tables[name].length = 0;
      tables[name].push(...seed[name]);
    }
  },
  id(): string {
    counter += 1;
    const r = () => Math.floor(Math.random() * 0xffff);
    return `${hex(r(), 4)}${hex(r(), 4)}-${hex(r(), 4)}-4${hex(r() & 0xfff, 3)}-a${hex(r() & 0xfff, 3)}-${hex(counter, 12)}`;
  },
  now(): Date {
    return new Date();
  },
  subscribe(fn: (event: DbEvent) => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  emit(event: DbEvent): void {
    for (const fn of [...listeners]) fn(event);
  },
};
