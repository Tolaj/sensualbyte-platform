import { reconcileCompute } from "./kinds/compute.controller.js";
import { reconcileVolume } from "./kinds/volume.controller.js";
import { reconcileBucket } from "./kinds/bucket.controller.js";
import { reconcilePostgres } from "./kinds/postgres.controller.js";
import { reconcileHttpRoute } from "./kinds/httpRoute.controller.js";
import { reconcileObservability } from "./kinds/observability.controller.js";
import { reconcileMqtt } from "./kinds/mqtt.controller.js";

export async function dispatch(ctx) {
    switch (ctx.resource.kind) {
        case "compute": return reconcileCompute(ctx);
        case "volume": return reconcileVolume(ctx);
        case "bucket": return reconcileBucket(ctx);
        case "postgres": return reconcilePostgres(ctx);
        case "http_route": return reconcileHttpRoute(ctx);
        case "observability": return reconcileObservability(ctx);
        case "mqtt": return reconcileMqtt(ctx);
        default:
            throw new Error(`Unknown kind: ${ctx.resource.kind}`);
    }
}
