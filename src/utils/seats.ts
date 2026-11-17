export type SeatPlan = {
  capacity: number;
  onBoard: number;
  reserved: number;
  open: number;
  walkInLimit: number;
  canAddWalkIn: boolean;
  blockedBy: "marked-full" | "full" | "reserved" | null;
};

const whole = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);

export function seatPlan(
  capacity: number,
  onBoard: number,
  reserved: number,
  markedFull = false,
): SeatPlan {
  const seats = whole(capacity);
  const board = Math.min(whole(onBoard), seats);
  const held = Math.min(whole(reserved), seats - board);
  const walkInLimit = seats - held;
  const blockedBy = markedFull
    ? "marked-full"
    : board >= seats
      ? "full"
      : board >= walkInLimit
        ? "reserved"
        : null;
  return {
    capacity: seats,
    onBoard: board,
    reserved: held,
    open: markedFull ? 0 : seats - board - held,
    walkInLimit,
    canAddWalkIn: blockedBy === null,
    blockedBy,
  };
}

export function fitsPickup(plan: SeatPlan, passengers: number): boolean {
  return whole(passengers) > 0 && whole(passengers) <= plan.open;
}

export function clampWalkIns(plan: SeatPlan, next: number): number {
  return Math.min(Math.max(0, Math.floor(next)), plan.walkInLimit);
}
