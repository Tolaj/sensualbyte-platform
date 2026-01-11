// apps/api/src/utils/merge.js

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

/**
 * Deep-merge two plain objects.
 * - Arrays are replaced (not concatenated)
 * - Primitive values are replaced
 */
export function deepMerge(base, patch) {
  if (!isPlainObject(base)) return isPlainObject(patch) ? { ...patch } : patch;
  if (!isPlainObject(patch)) return { ...base };

  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (isPlainObject(v) && isPlainObject(out[k])) out[k] = deepMerge(out[k], v);
    else out[k] = v;
  }
  return out;
}
