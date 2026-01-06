// v1 placeholder: secrets injection is applied later to compute env/mounts.
// keeping file because structure demands it.
export function injectEnvSecrets(envObj, secretMap) {
    return { ...(envObj || {}), ...(secretMap || {}) };
}
