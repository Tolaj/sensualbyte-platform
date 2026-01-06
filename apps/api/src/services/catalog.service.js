import { deepMerge } from "../../../../packages/shared/offeringDefaults.js";

export function applyOfferingDefaults(item, overrides) {
    return deepMerge(item.defaults || {}, overrides || {});
}
