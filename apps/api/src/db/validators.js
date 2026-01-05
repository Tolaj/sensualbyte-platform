import fs from "node:fs";
import path from "node:path";

function listSchemaFiles(schemaDirAbs) {
  return fs.readdirSync(schemaDirAbs).filter((f) => f.endsWith(".schema.json"));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function ensureCollection(db, name, opts) {
  const exists = (await db.listCollections({ name }).toArray()).length > 0;

  if (!exists) {
    await db.createCollection(name, opts);
    return;
  }

  await db.command({
    collMod: name,
    validator: opts.validator,
    validationLevel: opts.validationLevel ?? "strict",
    validationAction: opts.validationAction ?? "error",
  });
}

export async function applyCollectionValidators(db) {
  // Running from apps/api, so go up to repo root and into packages/schemas
  const schemaDirAbs = path.resolve(process.cwd(), "../../packages/schemas/mongodb");
  const files = listSchemaFiles(schemaDirAbs);

  const schemas = files
    .map((f) => readJson(path.join(schemaDirAbs, f)))
    .sort((a, b) => a.collection.localeCompare(b.collection));

  for (const s of schemas) {
    await ensureCollection(db, s.collection, {
      validator: s.validator,
      validationLevel: s.validationLevel ?? "strict",
      validationAction: s.validationAction ?? "error",
    });
  }
}
