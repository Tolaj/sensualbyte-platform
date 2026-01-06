import { setStatus } from "../common/status.js";

export async function reconcileMqtt({ resource, statusRepo }) {
    await setStatus(statusRepo, resource.resourceId, {
        observedGeneration: resource.generation || 0,
        state: "error",
        message: "MQTT managed service not implemented in v1"
    });
}
