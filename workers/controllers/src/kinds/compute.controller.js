import { getDocker, ensureCompute, startCompute, stopCompute, removeComputeIfExists, extractComputeObserved, encryptString, generateSshKeypair } from "../../../../provisioner/src/index.js";
import { setStatus } from "../common/status.js";

function sshEndpoint(resource, observed) {
    if ((resource.spec?.mode || "") !== "iaas") return null;
    const internalPort = resource.spec?.network?.internalPort || 2222;
    const key = `${internalPort}/tcp`;
    const binding = observed.ports?.[key]?.[0];
    if (!binding?.HostPort) return null;
    return { host: process.env.SSH_HOST || "localhost", port: Number(binding.HostPort) };
}

export async function reconcileCompute({ resource, statusRepo, obsCache, secretsRepo }) {
    const docker = getDocker();

    if (resource.desiredState === "deleted") {
        await setStatus(statusRepo, resource.resourceId, { observedGeneration: resource.generation || 0, state: "deleting", message: "Deleting compute" });
        const r = await removeComputeIfExists(docker, resource.resourceId);
        await setStatus(statusRepo, resource.resourceId, { observedGeneration: resource.generation || 0, state: "ready", message: r.removed ? "Deleted" : "Already absent", details: { deleted: true } });
        await obsCache.set(resource.resourceId, { kind: "compute", observedAt: new Date().toISOString(), actual: { state: "deleted" } });
        return;
    }

    // If iaas and no sshKeySecretRef => generate keypair and store private key secret (encrypted)
    if ((resource.spec?.mode || "") === "iaas" && !resource.spec?.iaas?.sshKeySecretRef) {
        const kp = generateSshKeypair();
        const enc = encryptString(kp.privateKey);
        const secretId = `sec_${Math.random().toString(16).slice(2, 10)}${Date.now().toString(16).slice(0, 6)}`;
        await secretsRepo.create({
            secretId,
            storeId: "store_local",
            scopeType: "resource",
            scopeId: resource.resourceId,
            name: "ssh/privateKey",
            type: "ssh_key",
            ciphertext: enc.ciphertext,
            encryptionMeta: enc.encryptionMeta,
            createdBy: "system",
            createdAt: new Date()
        });

        // NOTE: In v1 we only store secretId in status.details so user can retrieve via API later.
        // In Step 5 we’ll patch resource.spec to reference it (immutable desired state vs actual is a bigger decision).
        await setStatus(statusRepo, resource.resourceId, {
            state: "creating",
            message: "Generated SSH keypair",
            details: { sshKeySecretRef: secretId, publicKey: kp.publicKey }
        });
    }

    await setStatus(statusRepo, resource.resourceId, { state: "creating", message: "Reconciling compute" });

    const c = await ensureCompute(docker, resource);
    const inspect = resource.desiredState === "paused" ? await stopCompute(c) : await startCompute(c);
    const observed = extractComputeObserved(inspect);
    const ssh = sshEndpoint(resource, observed);

    await setStatus(statusRepo, resource.resourceId, {
        observedGeneration: resource.generation || 0,
        state: "ready",
        message: resource.desiredState === "paused" ? "Compute stopped" : "Compute running",
        details: { lastKnown: observed, ssh }
    });

    await obsCache.set(resource.resourceId, { kind: "compute", observedAt: new Date().toISOString(), actual: observed, ssh });
}
