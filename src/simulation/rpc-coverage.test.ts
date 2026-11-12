import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { handlers } from "@/simulation/rpc";

const collect = (dir: string, out: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) collect(full, out);
    else if (name === "routes.ts") out.push(full);
  }
  return out;
};

test("every rpc used by the api has a simulation handler", () => {
  const names = new Set<string>();
  for (const file of collect("src/api")) {
    for (const m of readFileSync(file, "utf8").matchAll(/rpc\(\s*"([a-z_0-9]+)"/g)) {
      names.add(m[1]);
    }
  }
  assert.equal(names.size, 50);
  const missing = [...names].filter((n) => !(n in handlers)).sort();
  assert.deepEqual(missing, [], `missing ${missing.length}: ${missing.join(", ")}`);
});
