// apps/api/src/validators/validateOfferingInput.js
import { applyOfferingDefaults } from "../services/catalog.service.js";
import { validateResourceSpec } from "./validateResourceSpec.js";

/**
 * Validates user-provided overrides for a catalog item.
 * We validate the *merged* spec (defaults + overrides), because schemas describe final specs.
 */
export function validateOfferingInput(item, overrides) {
  if (!item) return { ok: false, errors: [{ message: "catalog item required" }] };
  const merged = applyOfferingDefaults(item, overrides || {});
  return validateResourceSpec(item.kind, merged, { schemaRef: item.specSchemaRef });
}
