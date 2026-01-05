export function computeLabels(resource) {
    const spec = resource.spec || {};
    return {
        "sensual.kind": "compute",
        "sensual.resourceId": resource.resourceId,
        "sensual.projectId": resource.projectId,
        "sensual.compute.impl": spec.implementation || "docker",
        "sensual.compute.mode": spec.mode || "paas"
    };
}
