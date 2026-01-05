export async function reconcileNotImplemented({ resource, statusRepo }) {
    await statusRepo.upsert(resource.resourceId, {
        observedGeneration: resource.generation || 0,
        state: "error",
        message: `Kind not implemented yet: ${resource.kind}`,
        details: { kind: resource.kind },
        lastUpdatedAt: new Date()
    });
}
