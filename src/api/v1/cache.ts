import { SQLiteStorage } from "expo-sqlite/kv-store";

const store = new SQLiteStorage("tsuperhero-cache.db");
const prefix = "v1:";

type Entry<T> = { savedAt: number; data: T };

const writtenFingerprints = new Map<string, number>();

function fingerprint(text: string) {
  let hash = 5381;
  for (let index = 0; index < text.length; index++) {
    hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
  }
  return hash;
}

export function readCache<T>(key: string): T | null {
  try {
    const raw = store.getItemSync(prefix + key);
    if (!raw) return null;
    return (JSON.parse(raw) as Entry<T>).data;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, data: T) {
  const serialized = JSON.stringify(data) ?? "null";
  const print = fingerprint(serialized);
  if (writtenFingerprints.get(key) === print) return;
  writtenFingerprints.set(key, print);
  store
    .setItem(prefix + key, `{"savedAt":${Date.now()},"data":${serialized}}`)
    .catch(() => writtenFingerprints.delete(key));
}

export async function clearCache() {
  writtenFingerprints.clear();
  await store.clearAsync().catch(() => {});
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
