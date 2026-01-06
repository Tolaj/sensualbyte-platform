export async function setStatus(statusRepo, resourceId, patch) {
    const safe = { ...patch };
    delete safe.resourceId; // avoid mongo conflict
    await statusRepo.upsert(resourceId, { ...safe, lastUpdatedAt: new Date() });
}
