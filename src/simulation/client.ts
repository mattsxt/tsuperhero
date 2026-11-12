import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getSessionValue,
  onAuthChange,
  signInWithPassword,
  signOutAll,
  updateCurrentUser,
  verifyCode,
} from "@/simulation/auth";
import { db, type DbEvent, type TableName } from "@/simulation/db";
import { start as startEngine } from "@/simulation/engine";
import { QueryBuilder } from "@/simulation/query";
import { handlers } from "@/simulation/rpc";

const later = <T>(fn: () => T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(fn()), 0));

const uploads = new Map<string, string>();

type Callback = (payload: unknown) => void;
type Binding = {
  event: string;
  table: string;
  filter: string | undefined;
  callback: Callback;
};

class MockChannel {
  private bindings: Binding[] = [];
  private stop: (() => void) | null = null;

  on(
    _type: string,
    filter: { event: string; table: string; filter?: string },
    callback: Callback,
  ): this {
    this.bindings.push({
      event: filter.event,
      table: filter.table,
      filter: filter.filter,
      callback,
    });
    return this;
  }

  subscribe(): this {
    this.stop?.();
    this.stop = db.subscribe((event) => this.dispatch(event));
    return this;
  }

  unsubscribe(): void {
    this.stop?.();
    this.stop = null;
  }

  private dispatch(event: DbEvent): void {
    const { __old, ...row } = event.row as Record<string, unknown>;
    for (const b of this.bindings) {
      if (b.table !== event.table) continue;
      if (b.event !== "*" && b.event !== event.type) continue;
      if (b.filter) {
        const [column, value] = b.filter.split("=eq.");
        if (String(row[column]) !== value) continue;
      }
      b.callback({
        schema: "public",
        table: event.table,
        eventType: event.type,
        new: event.type === "DELETE" ? {} : row,
        old:
          event.type === "INSERT"
            ? {}
            : event.type === "DELETE"
              ? row
              : (__old ?? {}),
      });
    }
  }
}

function toBase64(body: unknown): string {
  if (!(body instanceof ArrayBuffer)) return "";
  let binary = "";
  const bytes = new Uint8Array(body);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return typeof btoa === "function" ? btoa(binary) : "";
}

export function createMockClient(): SupabaseClient {
  startEngine();
  const auth = {
    signInWithPassword: ({ email, password }: { email: string; password: string }) =>
      later(() => {
        const result = signInWithPassword(email, password);
        if ("error" in result) {
          return { data: { user: null, session: null }, error: result.error };
        }
        return {
          data: { user: result.session.user, session: result.session },
          error: null,
        };
      }),
    signInWithOtp: (_args: unknown) =>
      later(() => ({ data: { user: null, session: null }, error: null })),
    verifyOtp: ({ email, token }: { email: string; token: string; type?: string }) =>
      later(() => {
        const result = verifyCode(email, token);
        if ("error" in result) {
          return { data: { user: null, session: null }, error: result.error };
        }
        return {
          data: { user: result.session.user, session: result.session },
          error: null,
        };
      }),
    updateUser: (attrs: { password?: string; email?: string }) =>
      later(() => {
        const result = updateCurrentUser(attrs);
        if ("error" in result) return { data: { user: null }, error: result.error };
        return { data: { user: result.user }, error: null };
      }),
    signOut: (_options?: unknown) =>
      later(() => {
        signOutAll();
        return { error: null };
      }),
    getSession: () =>
      later(() => ({ data: { session: getSessionValue() }, error: null })),
    getUser: () =>
      later(() => {
        const session = getSessionValue();
        if (!session) {
          return {
            data: { user: null },
            error: { message: "Auth session missing!", code: "session_not_found" },
          };
        }
        return { data: { user: session.user }, error: null };
      }),
    refreshSession: () =>
      later(() => {
        const session = getSessionValue();
        if (!session) {
          return {
            data: { user: null, session: null },
            error: { message: "Auth session missing!", code: "session_not_found" },
          };
        }
        return { data: { user: session.user, session }, error: null };
      }),
    onAuthStateChange: (callback: Parameters<typeof onAuthChange>[0]) => {
      const unsubscribe = onAuthChange(callback);
      return { data: { subscription: { unsubscribe } } };
    },
    startAutoRefresh: () => later(() => undefined),
    stopAutoRefresh: () => later(() => undefined),
  };

  const storage = {
    from: (bucket: string) => ({
      upload: (path: string, body: unknown, options?: { contentType?: string }) =>
        later(() => {
          const type = options?.contentType ?? "image/jpeg";
          uploads.set(`${bucket}/${path}`, `data:${type};base64,${toBase64(body)}`);
          return { data: { path }, error: null };
        }),
      remove: (paths: string[]) =>
        later(() => {
          for (const path of paths) uploads.delete(`${bucket}/${path}`);
          return { data: [], error: null };
        }),
      getPublicUrl: (path: string) => ({
        data: {
          publicUrl: path.startsWith("data:")
            ? path
            : (uploads.get(`${bucket}/${path}`) ?? path),
        },
      }),
    }),
  };

  const client = {
    auth,
    storage,
    from: (table: string) => new QueryBuilder(table as TableName),
    rpc: (name: string, args?: unknown) =>
      later(() => {
        const handler = handlers[name];
        if (!handler) {
          return {
            data: null,
            error: {
              message: `${name} is not available in the simulation`,
              code: "PGRST202",
            },
          };
        }
        try {
          return { data: handler(args ?? {}), error: null };
        } catch (e) {
          const err = e as { message?: string; code?: string };
          return {
            data: null,
            error: { message: err.message ?? "Error", code: err.code ?? "P0001" },
          };
        }
      }),
    channel: (_name: string) => new MockChannel(),
    removeChannel: (channel: MockChannel) => {
      channel.unsubscribe();
      return Promise.resolve("ok");
    },
  };

  return client as unknown as SupabaseClient;
}
