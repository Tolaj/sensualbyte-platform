import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function listSchemaFiles(schemaDirAbs) {
  return fs.readdirSync(schemaDirAbs).filter((f) => f.endsWith(".schema.json"));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function findRepoRoot(startDir) {
  // Walk up a few levels until we find /packages/schemas/mongodb
  let cur = startDir;
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(cur, "packages", "schemas", "mongodb");
    if (fs.existsSync(candidate)) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  throw new Error(`Could not locate repo root from: ${startDir}`);
}

async function ensureCollection(db, name, opts) {
  const exists = (await db.listCollections({ name }).toArray()).length > 0;

  if (!exists) {
    await db.createCollection(name, {
      validator: opts.validator,
      validationLevel: opts.validationLevel ?? "strict",
      validationAction: opts.validationAction ?? "error"
    });
    return;
  }

  // Update validator on existing collection
  await db.command({
    collMod: name,
    validator: opts.validator,
    validationLevel: opts.validationLevel ?? "strict",
    validationAction: opts.validationAction ?? "error"
  });
}

export async function applyCollectionValidators(db) {
  const repoRoot = findRepoRoot(__dirname);
  const schemaDirAbs = path.join(repoRoot, "packages", "schemas", "mongodb");

  if (!fs.existsSync(schemaDirAbs)) {
    throw new Error(`Schema dir not found: ${schemaDirAbs}`);
  }

  const files = listSchemaFiles(schemaDirAbs);

  const schemas = files
    .map((f) => readJson(path.join(schemaDirAbs, f)))
    .sort((a, b) => a.collection.localeCompare(b.collection));

  for (const s of schemas) {
    await ensureCollection(db, s.collection, {
      validator: s.validator,
      validationLevel: s.validationLevel ?? "strict",
      validationAction: s.validationAction ?? "error"
    });
  }
}
