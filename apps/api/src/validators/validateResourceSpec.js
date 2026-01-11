// apps/api/src/validators/validateResourceSpec.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ajv } from "./ajv.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cache = new Map(); // schemaPath -> validateFn

function findRepoRoot(startDir) {
  let cur = startDir;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(cur, "packages", "schemas"))) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  throw new Error(`Could not locate repo root from: ${startDir}`);
}

function defaultSchemaRefForKind(kind) {
  const k = String(kind || "").trim();
  if (!k) return null;
  return `packages/schemas/kinds/${k}.spec.schema.json`;
}

function loadValidator(schemaRef) {
  const ref = String(schemaRef || "").trim();
  if (!ref) throw new Error("schemaRef required");

  // Prevent path traversal / arbitrary reads. We only allow known prefix.
  if (!ref.startsWith("packages/schemas/kinds/") || !ref.endsWith(".json")) {
    throw new Error(`Invalid schemaRef: ${ref}`);
  }

  const repoRoot = findRepoRoot(__dirname);
  const abs = path.resolve(repoRoot, ref);

  if (cache.has(abs)) return cache.get(abs);

  if (!fs.existsSync(abs)) {
    throw new Error(`Spec schema not found: ${ref}`);
  }

  const schema = JSON.parse(fs.readFileSync(abs, "utf8"));

  // Cache compiled validator.
  const validate = ajv.compile(schema);
  cache.set(abs, validate);
  return validate;
}

/**
 * Validates a resource spec against its kind schema.
 * @param {string} kind
 * @param {object} spec
 * @param {{ schemaRef?: string }} [opts]
 */
export function validateResourceSpec(kind, spec, opts = {}) {
  const schemaRef = opts.schemaRef || defaultSchemaRefForKind(kind);

  try {
    const validate = loadValidator(schemaRef);
    const ok = validate(spec);
    return {
      ok: ok === true,
      schemaRef,
      errors: ok ? [] : (validate.errors || [])
    };
  } catch (err) {
    return {
      ok: false,
      schemaRef,
      errors: [{ message: err?.message || String(err) }]
    };
  }
}
