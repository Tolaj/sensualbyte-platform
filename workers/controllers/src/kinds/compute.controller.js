import crypto from "node:crypto";
import {
    getDocker,
    ensureCompute,
    startCompute,
    stopCompute,
    removeComputeIfExists,
    extractComputeObserved,
    encryptString,
    generateSshKeypair
} from "@sensualbyte/provisioner";

import { setStatus } from "../common/status.js";

function genId(prefix) {
    return `${prefix}_${crypto.randomBytes(6).toString("hex")}${Date.now().toString(16)}`;
}

function sshEndpoint(resource, observed) {
    if ((resource.spec?.mode || "") !== "iaas") return null;

    const internalPort = resource.spec?.network?.internalPort || 2222;
    const key = `${internalPort}/tcp`;
    const binding = observed.ports?.[key]?.[0];

    if (!binding?.HostPort) return null;

    return {
        host: process.env.SSH_HOST || "localhost",
        port: Number(binding.HostPort)
    };
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

    // IaaS: generate ssh key if missing (v1 stores secret, doesn’t mutate desired state)
    if ((resource.spec?.mode || "") === "iaas" && !resource.spec?.iaas?.sshKeySecretRef) {
        const kp = generateSshKeypair();
        const enc = encryptString(kp.privateKey);

        const secretId = genId("sec");
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

        await setStatus(statusRepo, resource, {
            state: "creating",
            message: "Generated SSH keypair",
            details: { sshKeySecretRef: secretId, publicKey: kp.publicKey }
        });
    }

    await setStatus(statusRepo, resource, {
        state: "creating",
        message: "Reconciling compute",
        observedGeneration: resource.generation || 0
    });

    const c = await ensureCompute(docker, resource);

    const inspect =
        resource.desiredState === "paused"
            ? await stopCompute(c)
            : await startCompute(c);

    const observed = extractComputeObserved(inspect);
    const ssh = sshEndpoint(resource, observed);

    await setStatus(statusRepo, resource, {
        observedGeneration: resource.generation || 0,
        state: "ready",
        message: resource.desiredState === "paused" ? "Compute stopped" : "Compute running",
        details: { lastKnown: observed, ssh }
    });

    await obsCache.set(resource.resourceId, {
        kind: "compute",
        observedAt: new Date().toISOString(),
        actual: observed,
        ssh
    });

    return { statusApplied: true };
}
