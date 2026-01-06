// provisioner/src/gateway/http/nginx.js
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execInContainer } from "../../drivers/docker/exec.js";
import { wrapErr } from "../../utils/errors.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function tplPath() {
    return path.join(__dirname, "templates", "route.conf.tpl");
}

function requireAbsDir(p) {
    if (!p) throw new Error("NGINX_CONF_DIR is required (absolute path to a host folder mounted into nginx /etc/nginx/conf.d)");
    if (!path.isAbsolute(p)) throw new Error(`NGINX_CONF_DIR must be absolute. Got: ${p}`);
    return p;
}

function safeFileName(s) {
    // allow only a-zA-Z0-9._-
    return String(s).replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function renderRouteConf({ hostname, targetIp, targetPort, pathPrefix }) {
    if (!hostname) throw new Error("hostname required");
    if (!targetIp) throw new Error("targetIp required");
    if (!targetPort) throw new Error("targetPort required");

    const tpl = await fs.readFile(tplPath(), "utf8");

    const prefix = pathPrefix && String(pathPrefix).trim() ? String(pathPrefix).trim() : "/";
    const normalizedPrefix = prefix.startsWith("/") ? prefix : `/${prefix}`;

    return tpl
        .replaceAll("__HOSTNAME__", String(hostname))
        .replaceAll("__TARGET_IP__", String(targetIp))
        .replaceAll("__TARGET_PORT__", String(targetPort))
        .replaceAll("__PATH_PREFIX__", normalizedPrefix);
}

async function atomicWriteFile(absPath, content) {
    const tmp = `${absPath}.tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await fs.writeFile(tmp, content, "utf8");
    await fs.rename(tmp, absPath);
}

async function nginxTestAndReload(docker, nginxName) {
    const test = await execInContainer(docker, nginxName, ["nginx", "-t"], { timeoutMs: 15000 });
    if (test.exitCode !== 0) {
        throw wrapErr("nginx -t failed", new Error(test.stderr || test.stdout || "unknown"), {
            nginxName,
            stdout: test.stdout,
            stderr: test.stderr,
            exitCode: test.exitCode
        });
    }

    const reload = await execInContainer(docker, nginxName, ["nginx", "-s", "reload"], { timeoutMs: 15000 });
    if (reload.exitCode !== 0) {
        throw wrapErr("nginx reload failed", new Error(reload.stderr || reload.stdout || "unknown"), {
            nginxName,
            stdout: reload.stdout,
            stderr: reload.stderr,
            exitCode: reload.exitCode
        });
    }

    return { tested: true, reloaded: true };
}

/**
 * Apply a single route config (writes file + nginx -t + reload).
 */
export async function applyNginxRoute({ docker, routeResourceId, hostname, targetIp, targetPort, pathPrefix = "/" }) {
    if (!docker) throw new Error("docker client required");
    if (!routeResourceId) throw new Error("routeResourceId required");

    const confDir = requireAbsDir(process.env.NGINX_CONF_DIR);
    const nginxName = process.env.NGINX_CONTAINER_NAME || "sb-nginx";

    try {
        await fs.mkdir(confDir, { recursive: true });
    } catch (err) {
        throw wrapErr("Failed to mkdir NGINX_CONF_DIR", err, { confDir });
    }

    const filename = `sb_${safeFileName(routeResourceId)}.conf`;
    const abs = path.join(confDir, filename);

    let conf;
    try {
        conf = await renderRouteConf({ hostname, targetIp, targetPort, pathPrefix });
    } catch (err) {
        throw wrapErr("Failed to render route config", err, { routeResourceId, hostname, targetIp, targetPort, pathPrefix });
    }

    try {
        await atomicWriteFile(abs, conf);
    } catch (err) {
        throw wrapErr("Failed to write nginx route file", err, { abs });
    }

    await nginxTestAndReload(docker, nginxName);

    return { file: abs, reloaded: true };
}

/**
 * Delete a single route config (removes file + nginx -t + reload).
 */
export async function deleteNginxRoute({ docker, routeResourceId }) {
    if (!docker) throw new Error("docker client required");
    if (!routeResourceId) throw new Error("routeResourceId required");

    const confDir = requireAbsDir(process.env.NGINX_CONF_DIR);
    const nginxName = process.env.NGINX_CONTAINER_NAME || "sb-nginx";

    const filename = `sb_${safeFileName(routeResourceId)}.conf`;
    const abs = path.join(confDir, filename);

    try {
        if (fsSync.existsSync(abs)) await fs.unlink(abs);
    } catch (err) {
        throw wrapErr("Failed to delete nginx route file", err, { abs });
    }

    await nginxTestAndReload(docker, nginxName);

    return { deleted: true };
}

/**
 * Batch apply: write many route files then do ONE nginx -t and ONE reload.
 * This is what you want when worker reconciles many routes in one poll.
 *
 * routes = [{ routeResourceId, hostname, targetIp, targetPort, pathPrefix }]
 */
export async function applyNginxRoutesBatch({ docker, routes }) {
    if (!docker) throw new Error("docker client required");
    if (!Array.isArray(routes)) throw new Error("routes must be an array");

    const confDir = requireAbsDir(process.env.NGINX_CONF_DIR);
    const nginxName = process.env.NGINX_CONTAINER_NAME || "sb-nginx";

    try {
        await fs.mkdir(confDir, { recursive: true });
    } catch (err) {
        throw wrapErr("Failed to mkdir NGINX_CONF_DIR", err, { confDir });
    }

    const written = [];

    for (const r of routes) {
        const routeResourceId = r.routeResourceId;
        if (!routeResourceId) throw new Error("routes[] missing routeResourceId");

        const filename = `sb_${safeFileName(routeResourceId)}.conf`;
        const abs = path.join(confDir, filename);

        let conf;
        try {
            conf = await renderRouteConf(r);
        } catch (err) {
            throw wrapErr("Failed to render route config (batch)", err, { routeResourceId, route: r });
        }

        try {
            await atomicWriteFile(abs, conf);
            written.push(abs);
        } catch (err) {
            throw wrapErr("Failed to write nginx route file (batch)", err, { abs, routeResourceId });
        }
    }

    await nginxTestAndReload(docker, nginxName);

    return { written, reloaded: true };
}
