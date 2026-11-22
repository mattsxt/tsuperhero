import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const srcRoot = new URL("../src/", import.meta.url);
const suffixes = [".ts", ".tsx", "/index.ts", "/index.tsx"];

function findFile(base) {
  for (const suffix of suffixes) {
    const candidate = new URL(base.href + suffix);
    if (existsSync(fileURLToPath(candidate))) return candidate.href;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  let base = null;
  if (specifier.startsWith("@/")) {
    base = new URL(specifier.slice(2), srcRoot);
  } else if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL
  ) {
    base = new URL(specifier, context.parentURL);
  }
  if (base && !/\.[cm]?[jt]sx?$/.test(base.pathname)) {
    const found = findFile(base);
    if (found) return nextResolve(found, context);
  } else if (base && specifier.startsWith("@/")) {
    return nextResolve(pathToFileURL(fileURLToPath(base)).href, context);
  }
  return nextResolve(specifier, context);
}
