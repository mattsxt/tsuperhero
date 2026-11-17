const listeners = new Set<() => void>();

export function subscribeDemoRefresh(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function requestDemoRefresh(): void {
  for (const fn of listeners) fn();
}
