export async function setStatus(statusRepo, resourceId, patch) {
    const safe = { ...(patch || {}) };
    delete safe.resourceId;

    await statusRepo.upsert(resourceId, {
        ...safe,
        lastUpdatedAt: new Date()
    });

    return statusRepo.upsert(resourceId, {}); // return latest doc
}

export function statusPatch(state, message = null, details = {}) {
    return {
        state,
        message,
        details
    };
}
