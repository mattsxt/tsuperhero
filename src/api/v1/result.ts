import { getErrorMessage } from "@/api/v1/client";

export type Result<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

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

export async function attempt<T>(action: () => Promise<T>): Promise<Result<T>> {
  try {
    return success(await action());
  } catch (error) {
    return failure(getErrorMessage(error));
  }
}
