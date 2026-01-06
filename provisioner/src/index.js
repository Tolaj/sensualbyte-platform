// Docker
export {
    getDocker,
    pingDocker
} from "./drivers/docker/client.js";

export {
    ensureCompute,
    startIfNeeded as startCompute,
    stopIfNeeded as stopCompute,
    removeComputeIfExists,
    extractObserved as extractComputeObserved
} from "./drivers/docker/compute.js";

export { ensureVolume, removeVolumeIfExists } from "./drivers/docker/volumes.js";
export { ensureNetwork, removeNetworkIfExists } from "./drivers/docker/networks.js";
export { execInContainer } from "./drivers/docker/exec.js";

// Adapters
export { getMinio, ensureBucket, deleteBucket } from "./adapters/minio.js";

export {
    ensurePostgresContainer,
    startIfNeeded as startPostgres,
    removePostgresIfExists,
    extractObserved as extractPostgresObserved
} from "./adapters/postgres.js";

export { ensureMosquitto } from "./adapters/mosquitto.js";

// Gateway
export { applyNginxRoute, deleteNginxRoute, applyNginxRoutesBatch } from "./gateway/http/nginx.js";

// Secrets helpers (local helpers; API/worker should prefer packages/shared/crypto.js)
export { encryptString, decryptString } from "./secrets/encrypt.js";
export { generateSshKeypair } from "./secrets/sshKeys.js";
export { injectEnvToContainer } from "./secrets/inject.js";
