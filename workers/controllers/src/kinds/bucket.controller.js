import { getMinio, ensureBucket, deleteBucket } from "@sensualbyte/provisioner";
import { setStatus } from "../common/status.js";

export async function reconcileBucket({ resource, statusRepo, obsCache }) {
    const minio = getMinio();

    const bucketName =
        resource.spec?.bucketName ||
        `sb-${resource.projectId}-${resource.resourceId}`.toLowerCase();

    if (resource.desiredState === "deleted") {
        await setStatus(statusRepo, resource.resourceId, {
            observedGeneration: resource.generation || 0,
            state: "deleting",
            message: "Deleting bucket"
        });

        const r = await deleteBucket(minio, bucketName);

        await setStatus(statusRepo, resource.resourceId, {
            observedGeneration: resource.generation || 0,
            state: "ready",
            message: r.removed ? "Deleted" : "Delete skipped",
            details: { bucketName, deleted: true }
        });

        await obsCache.set(resource.resourceId, {
            kind: "bucket",
            observedAt: new Date().toISOString(),
            actual: { deleted: true, bucketName }
        });

        return { statusApplied: true };
    }

    await ensureBucket(minio, bucketName);

    await setStatus(statusRepo, resource.resourceId, {
        observedGeneration: resource.generation || 0,
        state: "ready",
        message: "Bucket ready",
        details: { bucketName }
    });

    await obsCache.set(resource.resourceId, {
        kind: "bucket",
        observedAt: new Date().toISOString(),
        actual: { bucketName }
    });

    return { statusApplied: true };
}
