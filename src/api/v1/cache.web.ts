const storagePrefix = "tsuperhero-cache:v1:";

type Entry<T> = { savedAt: number; data: T };

function getStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function readCache<T>(key: string): T | null {
  try {
    const raw = getStorage()?.getItem(storagePrefix + key);
    if (!raw) return null;
    return (JSON.parse(raw) as Entry<T>).data;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, data: T) {
  try {
    getStorage()?.setItem(
      storagePrefix + key,
      JSON.stringify({ savedAt: Date.now(), data } satisfies Entry<T>),
    );
  } catch {}
}

export async function clearCache() {
  const storage = getStorage();
  if (!storage) return;

  try {
    for (let index = storage.length - 1; index >= 0; index--) {
      const key = storage.key(index);
      if (key?.startsWith(storagePrefix)) storage.removeItem(key);
    }
  } catch {}
}

export function isConnectionError(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : "";
  const status =
    error && typeof error === "object" && "status" in error
      ? Number((error as { status: unknown }).status)
      : NaN;
  return (
    status === 0 ||
    /network request failed|failed to fetch|fetch failed|networkerror|timed? ?out|timeout|offline/i.test(
      message,
    ) ||
    !message
  );
}

export async function unwrapCached<R extends { data: unknown; error: unknown }>(
  key: string,
  request: PromiseLike<R>,
): Promise<R["data"]> {
  let result: R;
  try {
    result = await request;
  } catch (error) {
    const cached = readCache<R["data"]>(key);
    if (cached !== null) return cached;
    throw error;
  }
  if (result.error) {
    const cached = readCache<R["data"]>(key);
    if (cached !== null && isConnectionError(result.error)) return cached;
    throw result.error;
  }
  writeCache(key, result.data);
  return result.data;
}
