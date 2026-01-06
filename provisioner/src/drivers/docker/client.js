import Docker from "dockerode";
import fs from "node:fs";

let _docker = null;

function buildDockerOptions() {
    // Priority:
    // 1) DOCKER_HOST (tcp / ssh style)
    // 2) DOCKER_SOCKET (unix socket)
    // 3) default unix socket

    const dockerHost = process.env.DOCKER_HOST; // e.g. tcp://127.0.0.1:2375
    const socketPath = process.env.DOCKER_SOCKET || "/var/run/docker.sock";

    // TLS support (optional)
    const tlsVerify = process.env.DOCKER_TLS_VERIFY === "1" || process.env.DOCKER_TLS_VERIFY === "true";
    const certPath = process.env.DOCKER_CERT_PATH; // folder containing ca.pem cert.pem key.pem

    if (dockerHost) {
        // dockerode accepts host/port/protocol, or a URL-style host string.
        // We'll parse tcp://host:port
        try {
            const u = new URL(dockerHost);
            const protocol = u.protocol.replace(":", ""); // tcp/http/https
            const host = u.hostname;
            const port = u.port ? Number(u.port) : (protocol === "https" ? 2376 : 2375);

            const opts = { protocol, host, port };

            if (tlsVerify) {
                if (!certPath) throw new Error("DOCKER_CERT_PATH is required when DOCKER_TLS_VERIFY=true");
                opts.ca = fs.readFileSync(`${certPath}/ca.pem`);
                opts.cert = fs.readFileSync(`${certPath}/cert.pem`);
                opts.key = fs.readFileSync(`${certPath}/key.pem`);
            }

            return opts;
        } catch (e) {
            throw new Error(`Invalid DOCKER_HOST: ${dockerHost}. Expected like tcp://127.0.0.1:2375 (${e.message})`);
        }
    }

    // Default: local unix socket
    return { socketPath };
}

/**
 * Singleton docker client.
 * Only the provisioner should directly talk to Docker.
 */
export function getDocker() {
    if (_docker) return _docker;
    const opts = buildDockerOptions();
    _docker = new Docker(opts);
    return _docker;
}

/**
 * Health check to confirm Docker connectivity.
 */
export async function pingDocker() {
    const docker = getDocker();
    try {
        const info = await docker.info();
        return {
            ok: true,
            serverVersion: info.ServerVersion || null,
            containers: info.Containers ?? null,
            images: info.Images ?? null
        };
    } catch (e) {
        return {
            ok: false,
            error: String(e?.message || e),
            hint:
                "Check Docker is running and the socket/host is reachable. If using WSL, ensure /var/run/docker.sock is accessible."
        };
    }
}
