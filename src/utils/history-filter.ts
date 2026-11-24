export type HistoryPeriod = "today" | "week" | "month" | "all";

export const historyPeriods: { value: HistoryPeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "Last month" },
  { value: "all", label: "All" },
];

export const defaultHistoryPeriod: HistoryPeriod = "today";

export function periodStart(period: HistoryPeriod, now: Date): Date | null {
  if (period === "all") return null;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === "week") start.setDate(start.getDate() - start.getDay());
  if (period === "month") {
    const day = start.getDate();
    start.setDate(1);
    start.setMonth(start.getMonth() - 1);
    const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    start.setDate(Math.min(day, lastDay));
  }
  return start;
}

export function inPeriod(
  date: Date | null,
  period: HistoryPeriod,
  now: Date,
): boolean {
  const start = periodStart(period, now);
  if (!start) return true;
  return !!date && date.getTime() >= start.getTime();
}

const accents = /[\u0300-\u036f]/g;

const fold = (text: string) => {
  let folded = text.toLowerCase();
  try {
    folded = folded.normalize("NFD").replace(accents, "");
  } catch {
    folded = text.toLowerCase();
  }
  return folded.replace(/\s+/g, " ").trim();
};

export function matchesSearch(
  fields: (string | number | null | undefined)[],
  query: string,
): boolean {
  const terms = fold(query).split(" ").filter(Boolean);
  if (!terms.length) return true;
  const haystack = fold(
    fields.filter((field) => field !== null && field !== undefined).join(" "),
  );
  return terms.every((term) => haystack.includes(term));
}

export function newestFirst<T>(items: T[], dateOf: (item: T) => Date | null): T[] {
  return [...items].sort((a, b) => {
    const left = dateOf(a)?.getTime() ?? -Infinity;
    const right = dateOf(b)?.getTime() ?? -Infinity;
    return right - left;
  });
}

export type HistoryView<T> = {
  visible: T[];
  matchesAllTime: number;
  total: number;
};

export function filterHistory<T>(
  items: T[],
  options: {
    period: HistoryPeriod;
    query: string;
    now: Date;
    dateOf: (item: T) => Date | null;
    searchFields: (item: T) => (string | number | null | undefined)[];
  },
): HistoryView<T> {
  const matching = items.filter((item) =>
    matchesSearch(options.searchFields(item), options.query),
  );
  const visible = newestFirst(
    matching.filter((item) =>
      inPeriod(options.dateOf(item), options.period, options.now),
    ),
    options.dateOf,
  );
  return { visible, matchesAllTime: matching.length, total: items.length };
}
