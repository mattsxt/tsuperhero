import { mock, test } from "node:test";
import { signInAs } from "@/simulation/auth";
import { db } from "@/simulation/db";
import * as engine from "@/simulation/engine";
import { handlers } from "@/simulation/rpc";
import { userId } from "@/simulation/seed/people";
const sizes = () => Object.fromEntries(Object.entries(db.tables).map(([k, v]) => [k, (v as unknown[]).length]));
test("probe", () => {
  mock.timers.enable({ apis: ["setInterval", "setTimeout", "Date"], now: Date.now() });
  db.reset(); engine.reset();
  signInAs(userId("mario"), "mario@demo.tsuperhero");
  handlers.start_my_trip({ p_distance_total_km: 8 });
  engine.start(); engine.setSpeed(10);
  const a = sizes();
  const t0 = performance.now();
  for (let i = 0; i < 3600; i++) { mock.timers.tick(1000); if (i % 5 === 0) handlers.share_my_vehicle_location({ p_latitude: 13.62, p_longitude: 123.19 }); }
  const ms = performance.now() - t0;
  const b = sizes();
  const grew = Object.keys(b).filter((k) => b[k] - a[k] > 5).map((k) => `${k}:${a[k]}->${b[k]}`);
  console.log("grew", grew.join(" "));
  console.log("ms per tick", (ms / 3600).toFixed(3));
  engine.reset(); mock.timers.reset();
});
