// provisioner/src/secrets/inject.js
import { execInContainer } from "../drivers/docker/exec.js";
import { wrapErr } from "../utils/errors.js";

function escapeShSingleQuotes(s) {
    // safe for: ' -> '\'' in shell single-quoted string
    return String(s).replace(/'/g, `'\\''`);
}

/**
 * Writes env variables into a file inside the container (default: /etc/sensual/env).
 * This does NOT automatically apply env to the running process unless the app reads it.
 * It's useful for "ssh_box" or debug containers.
 */
export async function injectEnvToContainer(docker, containerName, envMap, opts = {}) {
    if (!docker) throw new Error("docker client required");
    if (!containerName) throw new Error("containerName required");

    const targetPath = opts.path || "/etc/sensual/env";
    const mode = opts.mode || "600";

    const entries = Object.entries(envMap || {});
    const lines = entries.map(([k, v]) => `${k}=${String(v)}`);

    // create dir + write file atomically-ish
    const dir = targetPath.split("/").slice(0, -1).join("/") || "/";
    const tmp = `${targetPath}.tmp`;

    const content = lines.join("\n") + "\n";

    try {
        // mkdir -p
        await execInContainer(docker, containerName, ["sh", "-lc", `mkdir -p '${escapeShSingleQuotes(dir)}'`], { timeoutMs: 15000 });

        // write tmp
        await execInContainer(
            docker,
            containerName,
            ["sh", "-lc", `cat > '${escapeShSingleQuotes(tmp)}' <<'EOF'\n${content}EOF\n`],
            { timeoutMs: 15000 }
        );

        // chmod + move
        await execInContainer(
            docker,
            containerName,
            ["sh", "-lc", `chmod ${mode} '${escapeShSingleQuotes(tmp)}' && mv '${escapeShSingleQuotes(tmp)}' '${escapeShSingleQuotes(targetPath)}'`],
            { timeoutMs: 15000 }
        );

        return { injected: true, path: targetPath, keys: entries.map(([k]) => k) };
    } catch (err) {
        throw wrapErr("injectEnvToContainer failed", err, { containerName, targetPath });
    }
}

/**
 * Ensures an SSH public key exists in authorized_keys for a user inside the container.
 * Assumes the container has: sh, mkdir, chown, chmod, tee/printf/cat.
 */
export async function ensureAuthorizedKey(docker, containerName, sshUser, publicKey, opts = {}) {
    if (!docker) throw new Error("docker client required");
    if (!containerName) throw new Error("containerName required");
    if (!sshUser) throw new Error("sshUser required");
    if (!publicKey) throw new Error("publicKey required");

    const home = opts.homeDir || `/home/${sshUser}`;
    const sshDir = `${home}/.ssh`;
    const authFile = `${sshDir}/authorized_keys`;

    const pub = String(publicKey).trim();

    const cmd = `
set -e
mkdir -p '${escapeShSingleQuotes(sshDir)}'
touch '${escapeShSingleQuotes(authFile)}'
chmod 700 '${escapeShSingleQuotes(sshDir)}'
chmod 600 '${escapeShSingleQuotes(authFile)}'
grep -qxF '${escapeShSingleQuotes(pub)}' '${escapeShSingleQuotes(authFile)}' || echo '${escapeShSingleQuotes(pub)}' >> '${escapeShSingleQuotes(authFile)}'
chown -R ${escapeShSingleQuotes(sshUser)}:${escapeShSingleQuotes(sshUser)} '${escapeShSingleQuotes(sshDir)}' || true
`;

    try {
        const r = await execInContainer(docker, containerName, ["sh", "-lc", cmd], { timeoutMs: 20000 });
        if (r.exitCode !== 0) {
            throw new Error(r.stderr || r.stdout || "unknown error");
        }
        return { ensured: true, user: sshUser, file: authFile };
    } catch (err) {
        throw wrapErr("ensureAuthorizedKey failed", err, { containerName, sshUser, home });
    }
}
