// workers/controllers/src/kinds/compute.controller.js
import { getDocker, ensureCompute, startCompute, stopCompute, removeComputeIfExists, extractComputeObserved, encryptString, decryptString, generateSshKeypair } from "@sensualbyte/provisioner";
import { setStatus } from "../common/status.js";

function sshEndpoint(resource, observed) {
    if ((resource.spec?.mode || "") !== "iaas") return null;

    const internalPort = resource.spec?.network?.internalPort || 2222;
    const key = `${internalPort}/tcp`;
    const binding = observed.ports?.[key]?.[0];

    if (!binding?.HostPort) return null;

    return {
        host: process.env.SSH_HOST || "localhost",
        port: Number(binding.HostPort),
        user: resource.spec?.iaas?.sshUser || "ubuntu"
    };
}

async function getOrCreateSshSecret({ secretsRepo, resourceId, sshUser }) {
    const secretId = `sec_${resourceId}_ssh`;

    const existing = await secretsRepo.get(secretId);
    if (existing) {
        // decrypt to get public key (needed to inject env every time)
        const plaintext = decryptString(existing.ciphertext, existing.encryptionMeta);
        const obj = JSON.parse(plaintext);
        if (!obj?.publicKeyOpenSsh) throw new Error(`SSH secret ${secretId} missing publicKeyOpenSsh`);
        return { secretId, publicKeyOpenSsh: obj.publicKeyOpenSsh, created: false };
    }

    const kp = generateSshKeypair(`sensualbyte:${resourceId}`);

    const payload = JSON.stringify({
        sshUser,
        publicKeyOpenSsh: kp.publicKeyOpenSsh,
        privateKeyPem: kp.privateKeyPem
    });

    const enc = encryptString(payload);

    // idempotent insert (safe if reconcile runs twice)
    await secretsRepo.upsertBySecretId(secretId, {
        secretId,
        storeId: "store_local",
        scopeType: "resource",
        scopeId: resourceId,
        name: "ssh/keypair",
        type: "ssh_key",
        ciphertext: enc.ciphertext,
        encryptionMeta: enc.encryptionMeta,
        createdBy: "system",
        createdAt: new Date()
    });

    return { secretId, publicKeyOpenSsh: kp.publicKeyOpenSsh, created: true };
}

export async function reconcileCompute({ resource, statusRepo, obsCache, secretsRepo }) {
    const docker = getDocker();

    // DELETE
    if (resource.desiredState === "deleted") {
        await setStatus(statusRepo, resource, {
            observedGeneration: resource.generation || 0,
            state: "deleting",
            message: "Deleting compute"
        });

        const r = await removeComputeIfExists(docker, resource.resourceId);

        await setStatus(statusRepo, resource, {
            observedGeneration: resource.generation || 0,
            state: "ready",
            message: r.removed ? "Deleted" : "Already absent",
            details: { deleted: true }
        });

        await obsCache.set(resource.resourceId, {
            kind: "compute",
            observedAt: new Date().toISOString(),
            actual: { state: "deleted" }
        });

        return { statusApplied: true };
    }

    const isIaas = (resource.spec?.mode || "") === "iaas";
    let sshKeySecretRef = null;

    // If IaaS: ensure SSH secret exists and inject env for linuxserver/openssh-server style images
    let resourceForProvisioner = resource;

    if (isIaas) {
        const sshUser = resource.spec?.iaas?.sshUser || "ubuntu";

        const s = await getOrCreateSshSecret({
            secretsRepo,
            resourceId: resource.resourceId,
            sshUser
        });

        sshKeySecretRef = s.secretId;

        // Inject env (works for linuxserver/openssh-server).
        // For other images, you must provide an image that already runs sshd and honors these envs,
        // or later we add a bootstrapper/ssh-router. For v1, keep ssh-capable image for iaas.
        const env = {
            ...(resource.spec?.env || {}),
            USER_NAME: sshUser,
            PUBLIC_KEY: s.publicKeyOpenSsh,
            PASSWORD_ACCESS: "false",
            SUDO_ACCESS: "true"
        };

        resourceForProvisioner = {
            ...resource,
            spec: {
                ...resource.spec,
                env
            }
        };

        if (s.created) {
            await setStatus(statusRepo, resource, {
                observedGeneration: resource.generation || 0,
                state: "creating",
                message: "Generated SSH keypair",
                details: { sshKeySecretRef }
            });
        }
    }

    await setStatus(statusRepo, resource, {
        state: "creating",
        message: "Reconciling compute",
        observedGeneration: resource.generation || 0
    });

    const c = await ensureCompute(docker, resourceForProvisioner);

    const inspect =
        resource.desiredState === "paused"
            ? await stopCompute(c)
            : await startCompute(c);

    const observed = extractComputeObserved(inspect);
    const ssh = sshEndpoint(resourceForProvisioner, observed);

    await setStatus(statusRepo, resource, {
        observedGeneration: resource.generation || 0,
        state: "ready",
        message: resource.desiredState === "paused" ? "Compute stopped" : "Compute running",
        details: {
            lastKnown: observed,
            ssh,
            sshKeySecretRef
        }
    });

    await obsCache.set(resource.resourceId, {
        kind: "compute",
        observedAt: new Date().toISOString(),
        actual: observed,
        ssh
    });

    return { statusApplied: true };
}
