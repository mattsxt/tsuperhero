import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import createConfig from "../app.config.ts";

const baseConfig = {
  name: "tsuperhero",
  slug: "tsuperhero",
  scheme: "tsuperhero",
  icon: "./src/assets/images/icon.png",
  android: {
    package: "com.xorti.tsuperhero",
    adaptiveIcon: {
      foregroundImage: "./src/assets/images/android-icon-foreground.png",
      backgroundImage: "./src/assets/images/android-icon-background.png",
    },
  },
};

const keys = [
  "APP_VARIANT",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "EXPO_PUBLIC_MAPBOX_TOKEN",
];

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  delete process.env.APP_VARIANT;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_fake";
});

afterEach(() => {
  for (const key of keys) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

function build() {
  return createConfig({ config: baseConfig, projectRoot: "." } as never);
}

describe("app.config", () => {
  it("keeps the real build unchanged without APP_VARIANT", () => {
    const config = build();
    assert.equal(config.name, "tsuperhero");
    assert.equal(config.scheme, "tsuperhero");
    assert.equal(config.android?.package, "com.xorti.tsuperhero");
    assert.equal(config.extra?.supabaseUrl, "https://example.supabase.co");
    assert.equal(config.extra?.supabasePublishableKey, "sb_publishable_fake");
    assert.equal("simulation" in (config.extra ?? {}), false);
    assert.equal(config.icon, "./src/assets/images/icon.png");
    assert.equal(
      config.android?.adaptiveIcon?.foregroundImage,
      "./src/assets/images/android-icon-foreground.png",
    );
  });

  it("builds the simulation variant", () => {
    process.env.APP_VARIANT = "simulation";
    const config = build();
    assert.equal(config.name, "TsuperHero Simulation");
    assert.equal(config.scheme, "tsuperhero-sim");
    assert.equal(config.android?.package, "com.xorti.tsuperhero.simulation");
    assert.equal(config.extra?.simulation, true);
    assert.equal(config.extra?.supabaseUrl, undefined);
    assert.equal(config.extra?.supabasePublishableKey, undefined);
    assert.equal(config.icon, "./src/assets/images/icon-simulation.png");
    assert.equal(
      config.android?.adaptiveIcon?.foregroundImage,
      "./src/assets/images/android-icon-foreground-simulation.png",
    );
    assert.equal(
      config.android?.adaptiveIcon?.backgroundImage,
      "./src/assets/images/android-icon-background.png",
    );
  });
});
