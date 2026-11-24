import { useState } from "react";

export const historyPageSize = 20;

export function useIncremental<T>(
  items: T[],
  resetKey: string,
  step = historyPageSize,
) {
  const [limit, setLimit] = useState(step);
  const [key, setKey] = useState(resetKey);
  if (key !== resetKey) {
    setKey(resetKey);
    setLimit(step);
  }
  const shownLimit = key === resetKey ? limit : step;
  return {
    shown: items.length > shownLimit ? items.slice(0, shownLimit) : items,
    remaining: Math.max(0, items.length - shownLimit),
    showMore: () => setLimit((current) => current + step),
  };
}
