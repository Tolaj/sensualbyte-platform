// apps/api/src/services/catalog.service.js
import { deepMerge } from "../utils/merge.js";

export function applyOfferingDefaults(item, overrides) {
  if (!item) throw new Error("applyOfferingDefaults: item required");
  return deepMerge(item.defaults || {}, overrides || {});
}
