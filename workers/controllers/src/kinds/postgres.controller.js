import {
    getDocker,
    ensurePostgresContainer,
    startPostgres,
    removePostgresIfExists,
    extractPostgresObserved,
    decryptString
} from "@sensualbyte/provisioner";

import { setStatus } from "../common/status.js";

export async function reconcilePostgres({ resource, statusRepo, obsCache, secretsRepo }) {
    const docker = getDocker();
    const volumeName = `sb_pgdata_${resource.resourceId}`;

    if (resource.desiredState === "deleted") {
        await setStatus(statusRepo, resource, {
            observedGeneration: resource.generation || 0,
            state: "deleting",
            message: "Deleting postgres"
        });

        const r = await removePostgresIfExists(docker, resource.resourceId);

        await setStatus(statusRepo, resource, {
            observedGeneration: resource.generation || 0,
            state: "ready",
            message: r.removed ? "Deleted" : "Already absent",
            details: { deleted: true }
        });

        await obsCache.set(resource.resourceId, {
            kind: "postgres",
            observedAt: new Date().toISOString(),
            actual: { deleted: true }
        });

        return { statusApplied: true };
    }

    const secretId = resource.spec?.passwordSecretRef;
    if (!secretId) {
        await setStatus(statusRepo, resource, {
            observedGeneration: resource.generation || 0,
            state: "error",
            message: "Postgres missing spec.passwordSecretRef (API should have created it)",
            details: { spec: resource.spec }
        });
        return { statusApplied: true };
    }

    const secret = await secretsRepo.get(secretId);
    if (!secret) {
        await setStatus(statusRepo, resource, {
            observedGeneration: resource.generation || 0,
            state: "error",
            message: "Password secret not found",
            details: { passwordSecretRef: secretId }
        });
        return { statusApplied: true };
    }

    let passwordPlain;
    try {
        passwordPlain = decryptString(secret.ciphertext, secret.encryptionMeta);
    } catch (e) {
        await setStatus(statusRepo, resource, {
            observedGeneration: resource.generation || 0,
            state: "error",
            message: "Failed to decrypt password secret",
            details: { error: String(e?.message || e) }
        });
        return { statusApplied: true };
    }

    await setStatus(statusRepo, resource, {
        observedGeneration: resource.generation || 0,
        state: "creating",
        message: "Reconciling postgres"
    });

    const c = await ensurePostgresContainer(docker, resource, passwordPlain, volumeName);
    const inspect = await startPostgres(c);
    const observed = extractPostgresObserved(inspect);

    await setStatus(statusRepo, resource, {
        observedGeneration: resource.generation || 0,
        state: "ready",
        message: "Postgres ready",
        details: {
            endpoint: { host: "localhost", port: observed.hostPort },
            dbName: resource.spec?.dbName || "app",
            username: resource.spec?.username || "app",
            passwordSecretRef: secretId,
            volumeName
        }
    });

    await obsCache.set(resource.resourceId, {
        kind: "postgres",
        observedAt: new Date().toISOString(),
        actual: observed
    });

    return { statusApplied: true };
}
