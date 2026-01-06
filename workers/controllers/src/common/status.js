export async function setStatus(statusRepo, resource, patch) {
    const safe = { ...(patch || {}) };
    delete safe.resourceId;

    // REQUIRED by schema:
    if (safe.observedGeneration === undefined || safe.observedGeneration === null) {
        safe.observedGeneration = resource?.generation ?? 0;
    }

    safe.lastUpdatedAt = new Date();

    await statusRepo.upsert(resource.resourceId, safe);
    return statusRepo.get(resource.resourceId); // <-- read latest (no extra write)
}
