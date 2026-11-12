import { db } from "@/simulation/db";

export const notify = (
  userId: unknown,
  type: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {},
): void => {
  if (!userId) return;
  const row = {
    notification_id: db.id(),
    user_id: userId,
    notification_type: type,
    title,
    body,
    data,
    created_at: db.now().toISOString(),
    read_at: null,
  };
  db.tables.notification.push(row);
  db.emit({ table: "notification", type: "INSERT", row });
};
