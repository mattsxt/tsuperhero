import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

import { getSupabaseClient } from "@/api/v1/client";

export type NotificationRow = {
  notification_id: string;
  user_id: string;
  notification_type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  created_at: string;
  read_at: string | null;
};

const notificationTable = () => getSupabaseClient().from("notification");

const pageSize = 50;

export const notificationRoutes = {
  list: () =>
    notificationTable()
      .select(
        "notification_id, user_id, notification_type, title, body, data, created_at, read_at",
      )
      .order("created_at", { ascending: false })
      .limit(pageSize),

  markRead: (ids: string[], readAt: string) =>
    notificationTable()
      .update({ read_at: readAt })
      .in("notification_id", ids)
      .is("read_at", null),

  markAllRead: (readAt: string) =>
    notificationTable().update({ read_at: readAt }).is("read_at", null),

  registerPushToken: (token: string, platform: string) =>
    getSupabaseClient().rpc("register_push_token", {
      p_token: token,
      p_platform: platform,
    }),

  unregisterPushToken: (token: string) =>
    getSupabaseClient().rpc("unregister_push_token", { p_token: token }),

  subscribe: (
    userId: string,
    onChange: (
      payload: RealtimePostgresChangesPayload<NotificationRow>,
    ) => void,
  ) => {
    const client = getSupabaseClient();
    const filter = `user_id=eq.${userId}`;
    const channel = client
      .channel(`notifications:${userId}`)
      .on<NotificationRow>(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notification", filter },
        onChange,
      )
      .on<NotificationRow>(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notification", filter },
        onChange,
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  },
};
