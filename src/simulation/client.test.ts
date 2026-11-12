import assert from "node:assert/strict";
import { test } from "node:test";

import { createMockClient } from "@/simulation/client";
import { db } from "@/simulation/db";

const setup = () => {
  db.reset();
  return createMockClient();
};

test("password sign in returns the session and rejects wrong passwords", async () => {
  const client = setup();
  const juan = db.tables.user.find((u) => u.user_email === "juan@demo.tsuperhero")!;
  const ok = await client.auth.signInWithPassword({ email: "juan@demo.tsuperhero", password: "demo1234" });
  assert.equal(ok.error, null);
  assert.equal(ok.data.session?.user.id, juan.user_id);
  const bad = await client.auth.signInWithPassword({ email: "juan@demo.tsuperhero", password: "nope" });
  assert.equal(bad.error?.message, "Invalid login credentials");
  await client.auth.signOut({ scope: "local" });
  assert.equal((await client.auth.getSession()).data.session, null);
});

test("refreshSession returns the current session, or an error when signed out", async () => {
  const client = setup();
  await client.auth.signInWithPassword({ email: "juan@demo.tsuperhero", password: "demo1234" });
  const ok = await client.auth.refreshSession();
  assert.equal(ok.error, null);
  assert.equal(ok.data.session?.user.email, "juan@demo.tsuperhero");
  await client.auth.signOut({ scope: "local" });
  const missing = await client.auth.refreshSession();
  assert.equal(missing.data.session, null);
  assert.ok(missing.error);
});

test("verifyOtp with 123456 creates a new user", async () => {
  const client = setup();
  const before = db.tables.user.length;
  const res = await client.auth.verifyOtp({ email: "new@demo.tsuperhero", token: "123456", type: "email" });
  assert.equal(res.error, null);
  assert.equal(db.tables.user.length, before + 1);
  assert.equal(res.data.session?.user.email, "new@demo.tsuperhero");
  const bad = await client.auth.verifyOtp({ email: "x@demo.tsuperhero", token: "000000", type: "email" });
  assert.ok(bad.error);
});

test("select with embedded pickup returns arrays", async () => {
  const client = setup();
  const commuter = db.tables.commuter[0].commuter_id;
  db.tables.request.push({ request_id: "r1", commuter_id: commuter, request_type: "Pickup", is_draft: false, request_status: "pending", request_date: "2030-01-01" });
  db.tables.pickup.push({ pickup_id: "p1", request_id: "r1", pickup_destination: "X", other: 1 });
  const res = await client
    .from("request")
    .select("*, pickup(pickup_id, pickup_destination)")
    .eq("commuter_id", commuter)
    .in("request_status", ["pending", "accepted"])
    .order("request_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  assert.equal(res.error, null);
  assert.deepEqual((res.data as any).pickup, [{ pickup_id: "p1", pickup_destination: "X" }]);
});

test("upsert with ignoreDuplicates keeps the existing row", async () => {
  const client = setup();
  const id = db.tables.user[0].user_id;
  const email = db.tables.user[0].user_email;
  await client.from("user").upsert({ user_id: id, user_email: "other@x" }, { onConflict: "user_id", ignoreDuplicates: true });
  assert.equal(db.tables.user.find((u) => u.user_id === id)!.user_email, email);
  await client.from("user").upsert({ user_id: id, user_email: "other@x" }, { onConflict: "user_id" });
  assert.equal(db.tables.user.find((u) => u.user_id === id)!.user_email, "other@x");
});

test("insert select single returns generated id; single errors on none", async () => {
  const client = setup();
  const res = await client.from("commuter").insert({ user_id: "u-new" }).select("commuter_id").single();
  assert.ok((res.data as any).commuter_id);
  const none = await client.from("commuter").select("*").eq("user_id", "zzz").single();
  assert.ok(none.error);
  const maybe = await client.from("commuter").select("*").eq("user_id", "zzz").maybeSingle();
  assert.equal(maybe.data, null);
});

test("notification insert reaches a subscribed channel", async () => {
  const client = setup();
  const got: any[] = [];
  const ch = client
    .channel("n")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "notification", filter: "user_id=eq.u1" }, (p: any) => got.push(p))
    .subscribe();
  const row = { notification_id: "n1", user_id: "u1" };
  db.tables.notification.push(row);
  db.emit({ table: "notification", type: "INSERT", row });
  db.emit({ table: "notification", type: "INSERT", row: { notification_id: "n2", user_id: "u2" } });
  assert.equal(got.length, 1);
  assert.equal(got[0].eventType, "INSERT");
  assert.equal(got[0].new.notification_id, "n1");
  client.removeChannel(ch);
  db.emit({ table: "notification", type: "INSERT", row });
  assert.equal(got.length, 1);
});

test("storage and rpc", async () => {
  const client = setup();
  const avatar = "data:image/png;base64,AAA";
  assert.equal(client.storage.from("profile-pictures").getPublicUrl(avatar).data.publicUrl, avatar);
  await client.storage.from("profile-pictures").upload("a/b.jpg", new ArrayBuffer(1), { contentType: "image/jpeg" });
  assert.ok(client.storage.from("profile-pictures").getPublicUrl("a/b.jpg").data.publicUrl.length > 0);
  const res = await client.rpc("nope_fn" as any);
  assert.equal(res.error?.message, "nope_fn is not available in the simulation");
});
