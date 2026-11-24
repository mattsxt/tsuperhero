import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import type { SharedValue } from "react-native-reanimated";

export type HomeTab = "notifications" | "home" | "profile";

export const homeTabOrder: HomeTab[] = ["notifications", "home", "profile"];

export type HomeTabHeader = {
  title: string;
  subtitle: string;
  icon: ReactNode;
  progress: SharedValue<number>;
};

type HomeTabsValue = {
  navHidden: Record<HomeTab, SharedValue<number>>;
  setLocked: (locked: boolean) => void;
  setHeader: (tab: HomeTab, header: HomeTabHeader | null) => void;
};

export const HomeTabsContext = createContext<HomeTabsValue | null>(null);

let visiblePath: string | null = null;
const visibleListeners = new Set<() => void>();

export function setVisibleHomePath(path: string | null) {
  if (path === visiblePath) return;
  visiblePath = path;
  for (const listener of visibleListeners) listener();
}

const subscribeVisible = (listener: () => void) => {
  visibleListeners.add(listener);
  return () => {
    visibleListeners.delete(listener);
  };
};

export function useVisibleHomePath() {
  return useSyncExternalStore(subscribeVisible, () => visiblePath);
}

export function useHomeTabHeader(
  tab: HomeTab,
  header: HomeTabHeader | null,
) {
  const context = useContext(HomeTabsContext);
  const setHeader = context?.setHeader;
  useEffect(() => {
    if (!setHeader) return;
    setHeader(tab, header);
  }, [setHeader, tab, header]);
  useEffect(() => {
    if (!setHeader) return;
    return () => setHeader(tab, null);
  }, [setHeader, tab]);
}

export function useHomeTabNavHidden(tab: HomeTab) {
  return useContext(HomeTabsContext)?.navHidden[tab];
}

export function useHomeTabsLock(locked: boolean) {
  const context = useContext(HomeTabsContext);
  useEffect(() => {
    if (!context || !locked) return;
    context.setLocked(true);
    return () => context.setLocked(false);
  }, [context, locked]);
}
