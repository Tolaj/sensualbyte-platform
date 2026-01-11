// apps/api/src/config/loadEnv.js
// Load .env for local/dev runs (safe default). In production, rely on real env vars.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function bool(v, fallback = false) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return fallback;
  return s === "1" || s === "true" || s === "yes" || s === "y";
}

function findRepoRoot(startDir) {
  // Walk up until we find "packages/schemas" or a git/package.json root.
  let cur = startDir;
  for (let i = 0; i < 10; i++) {
    if (
      fs.existsSync(path.join(cur, "packages", "schemas")) ||
      fs.existsSync(path.join(cur, ".git")) ||
      fs.existsSync(path.join(cur, "package.json"))
    ) {
      return cur;
    }
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return startDir;
}

export function loadEnv() {
  const nodeEnv = process.env.NODE_ENV || "development";
  const shouldLoad = bool(process.env.LOAD_DOTENV, nodeEnv !== "production");
  if (!shouldLoad) return { loaded: false, dotenvPath: null };

  const repoRoot = findRepoRoot(__dirname);
  const dotenvPath = path.join(repoRoot, ".env");

  if (!fs.existsSync(dotenvPath)) return { loaded: false, dotenvPath };

  const result = dotenv.config({ path: dotenvPath });
  if (result.error) throw result.error;

  return { loaded: true, dotenvPath };
}
