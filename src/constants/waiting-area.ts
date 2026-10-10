export type WaitingAreaType = "stop" | "terminal" | "tricycle_station";

export const waitingAreaPinColors: Record<WaitingAreaType, string> = {
  stop: "#1e9e45",
  terminal: "#87ceeb",
  tricycle_station: "#87ceeb",
};

export function parseWaitingAreaType(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized?.includes("tricycle")) return "tricycle_station" as const;
  return normalized?.includes("terminal")
    ? ("terminal" as const)
    : ("stop" as const);
}
