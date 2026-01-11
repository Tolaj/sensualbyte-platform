// apps/api/src/utils/time.js

/** Returns a Date instance representing "now". */
export function now() {
  return new Date();
}

/** RFC3339-ish string for logs, etc. */
export function isoNow() {
  return new Date().toISOString();
}
