import { deepMerge } from "../../../../packages/shared/offeringDefaults.js";

export function applyOfferingDefaults(item, overrides) {
    if (!item) throw new Error("applyOfferingDefaults: item required");
    return deepMerge(item.defaults || {}, overrides || {});
}
