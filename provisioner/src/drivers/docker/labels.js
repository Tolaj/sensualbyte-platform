// provisioner/src/drivers/docker/labels.js
function safe(v) {
    if (v === undefined || v === null) return "";
    return String(v);
}

export function baseLabels(resource) {
    return {
        "sensualbyte.managedBy": "sensualbytebyte-provisioner",
        "sensualbyte.controllerVersion": safe(process.env.SENSUALBYTE_CONTROLLER_VERSION || "v1"),
        "sensualbyte.resourceId": safe(resource.resourceId),
        "sensualbyte.projectId": safe(resource.projectId),
        "sensualbyte.kind": safe(resource.kind),
        "sensualbyte.name": safe(resource.name || ""),
        "sensualbyte.generation": safe(resource.generation || 0),
        ...(resource.rootResourceId ? { "sensualbyte.rootResourceId": safe(resource.rootResourceId) } : {}),
        ...(resource.parentResourceId ? { "sensualbyte.parentResourceId": safe(resource.parentResourceId) } : {})
    };
}

export function computeLabels(resource) {
    const spec = resource.spec || {};
    return {
        ...baseLabels(resource),
        "sensualbyte.compute.impl": safe(spec.implementation || "docker"),
        "sensualbyte.compute.mode": safe(spec.mode || "paas"),
        ...(spec.network?.exposure ? { "sensualbyte.network.exposure": safe(spec.network.exposure) } : {}),
        ...(spec.network?.internalPort ? { "sensualbyte.network.internalPort": safe(spec.network.internalPort) } : {}),
        ...(spec.paas?.healthPath ? { "sensualbyte.health.path": safe(spec.paas.healthPath) } : {})
    };
}

export function postgresLabels(resource) {
    return { ...baseLabels(resource), "sensualbyte.db.engine": "postgres" };
}

export function routeLabels(resource) {
    const spec = resource.spec || {};
    return {
        ...baseLabels(resource),
        "sensualbyte.route": "http",
        ...(spec.hostname ? { "sensualbyte.route.hostname": safe(spec.hostname) } : {}),
        ...(spec.targetResourceId ? { "sensualbyte.route.targetResourceId": safe(spec.targetResourceId) } : {})
    };
}
