export function baseLabels(resource) {
    return {
        "sensual.resourceId": resource.resourceId,
        "sensual.projectId": resource.projectId,
        "sensual.kind": resource.kind
    };
}
export function computeLabels(resource) {
    const spec = resource.spec || {};
    return {
        ...baseLabels(resource),
        "sensual.compute.impl": spec.implementation || "docker",
        "sensual.compute.mode": spec.mode || "paas"
    };
}
export function postgresLabels(resource) {
    return { ...baseLabels(resource), "sensual.db.engine": "postgres" };
}
export function routeLabels(resource) {
    return { ...baseLabels(resource), "sensual.route": "http" };
}
