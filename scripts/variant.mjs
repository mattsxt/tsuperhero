import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";

const [variant, command, ...args] = process.argv.slice(2);
const simulation = variant === "simulation";

if (!["real", "simulation"].includes(variant) || !["start", "android", "apk"].includes(command)) {
  console.error("Usage: node scripts/variant.mjs <real|simulation> <start|android|apk> [args]");
  process.exit(1);
}

const env = { ...process.env, EXPO_NO_GIT_STATUS: "1" };
if (simulation) env.APP_VARIANT = "simulation";
else delete env.APP_VARIANT;

const run = (program, programArgs, options = {}) => {
  const result = spawnSync(program, programArgs, { stdio: "inherit", shell: true, env, ...options });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

const basePackage = JSON.parse(readFileSync("app.json", "utf8")).expo.android.package;
const wantedPackage = simulation ? `${basePackage}.simulation` : basePackage;
const gradleFile = "android/app/build.gradle";

const prepareAndroid = () => {
  const built = existsSync(gradleFile)
    ? readFileSync(gradleFile, "utf8").match(/applicationId ['"]([^'"]+)['"]/)?.[1]
    : null;
  if (built === wantedPackage) return;
  console.log(`Generating android/ for ${wantedPackage}…`);
  run("npx", ["expo", "prebuild", "--platform", "android", ...(built ? ["--clean"] : [])]);
};

if (command === "start") run("npx", ["expo", "start", ...args]);

if (command === "android") {
  prepareAndroid();
  run("npx", ["expo", "run:android", ...args]);
}

if (command === "apk") {
  prepareAndroid();
  run(process.platform === "win32" ? "gradlew.bat" : "./gradlew", ["assembleRelease", ...args], {
    cwd: "android",
  });
  const name = simulation ? "simulation.apk" : "Tsuperhero.apk";
  mkdirSync("dist", { recursive: true });
  copyFileSync("android/app/build/outputs/apk/release/app-release.apk", `dist/${name}`);
  console.log(`APK ready: dist/${name}`);
}
