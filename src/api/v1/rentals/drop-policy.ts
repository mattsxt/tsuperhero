export type CancelActor = "driver" | "commuter";

export type CancelReason = {
  code: string;
  label: string;
  hint: string;
};

export const cancelReasons: Record<CancelActor, CancelReason[]> = {
  driver: [
    {
      code: "vehicle_problem",
      label: "Vehicle problem",
      hint: "Breakdown, repairs or a failed inspection",
    },
    {
      code: "schedule_conflict",
      label: "Schedule conflict",
      hint: "Another commitment at the same time",
    },
    {
      code: "personal_emergency",
      label: "Personal emergency",
      hint: "Illness, family or another urgent matter",
    },
    {
      code: "commuter_unreachable",
      label: "Can't reach the commuter",
      hint: "No answer to calls or messages",
    },
    { code: "other", label: "Something else", hint: "Tell us what happened" },
  ],
  commuter: [
    {
      code: "driver_unresponsive",
      label: "Driver isn't responding",
      hint: "No answer to calls or messages",
    },
    {
      code: "plans_changed",
      label: "Trip plans changed",
      hint: "Fewer passengers, a new time or a new route",
    },
    {
      code: "vehicle_unsuitable",
      label: "Vehicle doesn't suit the trip",
      hint: "Size, condition or comfort",
    },
    {
      code: "safety_concern",
      label: "Safety or conduct concern",
      hint: "Something about the driver worried you",
    },
    { code: "other", label: "Something else", hint: "Tell us what happened" },
  ],
};

export const maxCancelDetailsLength = 300;

export function reasonLabel(code: string): string {
  for (const reasons of Object.values(cancelReasons)) {
    const match = reasons.find((reason) => reason.code === code);
    if (match && code !== "other") return match.label;
  }
  return "Other reason";
}

export function reasonProblem(
  actor: CancelActor,
  code: string | null,
  details: string,
): string | null {
  const trimmed = details.trim();
  if (!code) {
    return actor === "driver"
      ? "Choose a reason for dropping this job."
      : "Choose a reason for removing this driver.";
  }
  if (!cancelReasons[actor].some((reason) => reason.code === code)) {
    return "Choose one of the listed reasons.";
  }
  if (code === "other" && !trimmed) {
    return actor === "driver"
      ? "Add a few words about why you're dropping this job."
      : "Add a few words about why you're removing this driver.";
  }
  if (trimmed.length > maxCancelDetailsLength) {
    return `Keep the details under ${maxCancelDetailsLength} characters.`;
  }
  return null;
}

export const dropWindowDays = 7;

export type DropPenalty =
  | { kind: "warning" }
  | { kind: "cooldown"; minutes: number }
  | { kind: "suspended" };

export function penaltyForDrop(strike: number): DropPenalty {
  if (strike >= 4) return { kind: "suspended" };
  if (strike === 3) return { kind: "cooldown", minutes: 30 };
  if (strike === 2) return { kind: "cooldown", minutes: 15 };
  return { kind: "warning" };
}

export function formatWait(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} hr${rest ? ` ${rest} min` : ""}`;
}

export function dropWarning(
  penalty: DropPenalty,
  drops: number,
): { tone: "info" | "warning" | "danger"; text: string } {
  const counted =
    drops === 0
      ? `This is your first drop in the last ${dropWindowDays} days.`
      : `You've dropped ${drops} ${drops === 1 ? "job" : "jobs"} in the last ${dropWindowDays} days.`;
  if (penalty.kind === "suspended") {
    return {
      tone: "danger",
      text: `${counted} Dropping this one pauses your rental jobs until your cooperative head reviews it.`,
    };
  }
  if (penalty.kind === "cooldown") {
    return {
      tone: "warning",
      text: `${counted} Dropping this one means you can't accept another job for ${penalty.minutes} minutes.`,
    };
  }
  return {
    tone: "info",
    text: `${counted} Repeated drops limit when you can accept new jobs.`,
  };
}

export function dropOutcomeMessage(penalty: DropPenalty): string {
  if (penalty.kind === "suspended") {
    return "Job dropped. Rental jobs are paused until your cooperative head reviews it.";
  }
  if (penalty.kind === "cooldown") {
    return `Job dropped. You can accept another job in ${penalty.minutes} minutes.`;
  }
  return "Job dropped. The commuter has been notified.";
}
