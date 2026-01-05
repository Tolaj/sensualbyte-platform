import { reconcileCompute } from "./kinds/compute.controller.js";
import { reconcileNotImplemented } from "./kinds/notImplemented.controller.js";

export async function dispatch({ resource, statusRepo, obsCache }) {
    switch (resource.kind) {
        case "compute":
            return reconcileCompute({ resource, statusRepo, obsCache });
        default:
            return reconcileNotImplemented({ resource, statusRepo });
    }
}
