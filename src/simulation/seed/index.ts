import type { Tables } from "@/simulation/db";
import { routes, waitingAreas } from "@/simulation/seed/geography";
import { buildHistory } from "@/simulation/seed/history";
import { buildPeople } from "@/simulation/seed/people";

export const buildSeed = (now: Date): Tables => {
  const people = buildPeople(now);
  const history = buildHistory(now);
  return {
    ...people,
    ...history,
    route: routes.map((r) => ({ ...r })),
    waiting_area: waitingAreas.map((w) => ({ ...w })),
  };
};
