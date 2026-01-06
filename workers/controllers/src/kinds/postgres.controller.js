import {
    getDocker,
    ensurePostgresContainer,
    startPostgres,
    removePostgresIfExists,
    extractPostgresObserved
} from "../../../../provisioner/src/index.js";

import { setStatus } from "../common/status.js";
import { decryptString } from "../../../../packages/shared/crypto.js";

export async function reconcilePostgres({ resource, statusRepo, obsCache, secretsRepo }) {
    const docker = getDocker();
    const volumeName = `sb_pgdata_${resource.resourceId}`;

    if (resource.desiredState === "deleted") {
        await setStatus(statusRepo, resource.resourceId, {
            observedGeneration: resource.generation || 0,
            state: "deleting",
            message: "Deleting postgres"
        });

        const r = await removePostgresIfExists(docker, resource.resourceId);

        await setStatus(statusRepo, resource.resourceId, {
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
        return;
    }

    const secretId = resource.spec?.passwordSecretRef;
    if (!secretId) {
        await setStatus(statusRepo, resource.resourceId, {
            observedGeneration: resource.generation || 0,
            state: "error",
            message: "Postgres missing spec.passwordSecretRef (API should have created it)",
            details: { spec: resource.spec }
        });
        return;
    }

    const secret = await secretsRepo.get(secretId);
    if (!secret) {
        await setStatus(statusRepo, resource.resourceId, {
            observedGeneration: resource.generation || 0,
            state: "error",
            message: "Password secret not found",
            details: { passwordSecretRef: secretId }
        });
        return;
    }

    let passwordPlain = null;
    try {
        passwordPlain = decryptString(secret.ciphertext, secret.encryptionMeta);
    } catch (e) {
        await setStatus(statusRepo, resource.resourceId, {
            observedGeneration: resource.generation || 0,
            state: "error",
            message: "Failed to decrypt password secret",
            details: { error: String(e?.message || e) }
        });
        return;
    }

    await setStatus(statusRepo, resource.resourceId, {
        state: "creating",
        message: "Reconciling postgres"
    });

    const c = await ensurePostgresContainer(docker, resource, passwordPlain, volumeName);
    const inspect = await startPostgres(c);
    const observed = extractPostgresObserved(inspect);

    await setStatus(statusRepo, resource.resourceId, {
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
}
