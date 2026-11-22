import { getErrorMessage, refreshExpiredSession } from "@/api/v1/client";

export type Result<T = void> =
  { ok: true; data: T } | { ok: false; error: string };

export const success = <T>(data: T): Result<T> => ({ ok: true, data });

export const failure = <T = never>(error: string): Result<T> => ({
  ok: false,
  error,
});

export async function unwrap<R extends { data: unknown; error: unknown }>(
  request: PromiseLike<R>,
): Promise<R["data"]> {
  const { data, error } = await request;
  if (error) throw error;
  return data;
}

const isExpiredToken = (error: unknown) => {
  const { code, message } = (error ?? {}) as {
    code?: unknown;
    message?: unknown;
  };
  return (
    code === "PGRST301" ||
    code === "PGRST303" ||
    /jwt expired|invalid jwt/i.test(String(message ?? ""))
  );
};

export async function attempt<T>(action: () => Promise<T>): Promise<Result<T>> {
  try {
    return success(await action());
  } catch (error) {
    if (isExpiredToken(error) && (await refreshExpiredSession())) {
      try {
        return success(await action());
      } catch (retryError) {
        return failure(getErrorMessage(retryError));
      }
    }
    return failure(getErrorMessage(error));
  }
}
