// Docker
import {
    getDocker,
    pingDocker
} from "./drivers/docker/client.js";

import {
    ensureCompute,
    startIfNeeded as startCompute,
    stopIfNeeded as stopCompute,
    removeComputeIfExists,
    extractObserved as extractComputeObserved
} from "./drivers/docker/compute.js";

import { ensureVolume, removeVolumeIfExists } from "./drivers/docker/volumes.js";
import { ensureNetwork, removeNetworkIfExists } from "./drivers/docker/networks.js";
import { execInContainer } from "./drivers/docker/exec.js";

// Adapters
import { getMinio, ensureBucket, deleteBucket } from "./adapters/minio.js";

import {
    ensurePostgresContainer,
    startIfNeeded as startPostgres,
    removePostgresIfExists,
    extractObserved as extractPostgresObserved
} from "./adapters/postgres.js";

import {
    ensureMosquitto,
    startMosquitto,
    stopMosquitto,
    removeMosquittoIfExists,
    extractMosquittoObserved
} from "./adapters/mosquitto.js";

// Gateway
import { applyNginxRoute, deleteNginxRoute, applyNginxRoutesBatch } from "./gateway/http/nginx.js";

// Secrets helpers (local helpers; API/worker should prefer packages/shared/crypto.js)
import { encryptString, decryptString } from "./secrets/encrypt.js";
import { generateSshKeypair } from "./secrets/sshKeys.js";
import { injectEnvToContainer } from "./secrets/inject.js";


export {
    // Docker --------------------------
    // client
    getDocker,
    pingDocker,
    // compute
    ensureCompute,
    startCompute,
    stopCompute,
    removeComputeIfExists,
    extractComputeObserved,
    // volumes
    ensureVolume,
    removeVolumeIfExists,
    // network
    ensureNetwork,
    removeNetworkIfExists,
    // exec
    execInContainer,

    // Adapters --------------------------

    // minio
    getMinio,
    ensureBucket,
    deleteBucket,
    // postgres
    ensurePostgresContainer,
    startPostgres,
    removePostgresIfExists,
    extractPostgresObserved,
    // mosquitto
    ensureMosquitto,
    startMosquitto,
    stopMosquitto,
    removeMosquittoIfExists,
    extractMosquittoObserved,
    // Gateway --------------------------

    // nginx
    applyNginxRoute,
    deleteNginxRoute,
    applyNginxRoutesBatch,

    // Secrets helpers --------------------------

    // secrets/encrypt
    encryptString,
    decryptString,
    // secrets/sshKeys
    generateSshKeypair,
    // secrets/inject
    injectEnvToContainer
}