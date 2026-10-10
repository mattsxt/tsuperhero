import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { useOnline } from "@/hooks/use-online";

export function usePolling(
  task: () => unknown,
  intervalMs: number,
  enabled = true,
) {
  const taskRef = useRef(task);
  const online = useOnline();
  const active = enabled && online;

  useEffect(() => {
    taskRef.current = task;
  }, [task]);

  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setInterval> | null = null;
<<<<<<< HEAD
    const start = () => {
      if (timer) return;
      taskRef.current();
      timer = setInterval(() => taskRef.current(), intervalMs);
=======
    let running = false;
    const run = () => {
      if (running) return;
      running = true;
      void Promise.resolve()
        .then(() => taskRef.current())
        .catch(() => {})
        .finally(() => {
          running = false;
        });
    };
    const start = () => {
      if (timer) return;
      run();
      timer = setInterval(run, intervalMs);
>>>>>>> origin/mapbox
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    if (AppState.currentState === "active") start();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") start();
      else stop();
    });
    return () => {
      stop();
      subscription.remove();
    };
  }, [active, intervalMs]);
}
