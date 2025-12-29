const fs = require("fs");
const path = require("path");

const STORE = path.join(__dirname, "..", "runtime", "services.json");

const OUT_PATH = path.join(__dirname, "..", "infra", "nginx", "sensualbyte-apps.conf");
const OUT_SERVERS = path.join(__dirname, "..", "infra", "nginx", "sensualbyte-apps-servers.conf");

// e.g. svc_xxx.ecs.sensualbyte.com
const SUBDOMAIN_SUFFIX = "ecs.sensualbyte.com";

function readStore() {
    if (!fs.existsSync(STORE)) return { services: [] };
    try {
        const raw = fs.readFileSync(STORE, "utf-8");
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return { services: [] };
        return parsed;
    } catch {
        return { services: [] };
    }
}

function sanitizePort(p) {
    const n = Number(p);
    if (!Number.isFinite(n) || n <= 0 || n > 65535) return null;
    return n;
}

function safeId(id) {
    // for hostnames and url paths: keep alnum, dash, underscore
    return String(id || "")
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "");
}

function headerLines() {
    return [
        `# AUTO-GENERATED. DO NOT EDIT.`,
        `# Generated at: ${new Date().toISOString()}`,
        ``
    ];
}

function main() {
    const data = readStore();
    const services = Array.isArray(data.services) ? data.services : [];

    // ---------- PATH ROUTING ----------
    // /services/<serviceId>/  -> http://<ip>:<internalPort>/
    // Strip prefix so service sees "/"
    const pathBlocks = [];
    pathBlocks.push(...headerLines());

    for (const svc of services) {
        if (!svc || svc.status !== "running") continue;
        if (!svc.id || !svc.ip) continue;

        const port = sanitizePort(svc.internalPort || 3000);
        if (!port) continue;

        const id = safeId(svc.id);
        if (!id) continue;

        const prefix = `/services/${id}/`;

        pathBlocks.push(`# Service: ${svc.id} (${svc.name || ""}) -> ${svc.ip}:${port}`);
        pathBlocks.push(`location ^~ ${prefix} {`);
        pathBlocks.push(`  proxy_http_version 1.1;`);
        pathBlocks.push(`  proxy_set_header Host $host;`);
        pathBlocks.push(`  proxy_set_header X-Real-IP $remote_addr;`);
        pathBlocks.push(`  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`);
        pathBlocks.push(`  proxy_set_header X-Forwarded-Proto $scheme;`);
        pathBlocks.push(``);
        pathBlocks.push(`  # strip /services/<id>/ prefix`);
        pathBlocks.push(`  rewrite ^${prefix}(.*)$ /$1 break;`);
        pathBlocks.push(`  proxy_pass http://${svc.ip}:${port};`);
        pathBlocks.push(`}`);
        pathBlocks.push(``);
    }

    fs.writeFileSync(OUT_PATH, pathBlocks.join("\n"));

    // ---------- SUBDOMAIN ROUTING ----------
    // <serviceId>.ecs.sensualbyte.com -> http://<ip>:<internalPort>
    const serverBlocks = [];
    serverBlocks.push(...headerLines());

    for (const svc of services) {
        if (!svc || svc.status !== "running") continue;
        if (!svc.id || !svc.ip) continue;

        const port = sanitizePort(svc.internalPort || 3000);
        if (!port) continue;

        const id = safeId(svc.id);
        if (!id) continue;

        const host = `${id}.${SUBDOMAIN_SUFFIX}`;

        serverBlocks.push(`server {`);
        serverBlocks.push(`  listen 80;`);
        serverBlocks.push(`  server_name ${host};`);
        serverBlocks.push(`  location / {`);
        serverBlocks.push(`    proxy_http_version 1.1;`);
        serverBlocks.push(`    proxy_set_header Host $host;`);
        serverBlocks.push(`    proxy_set_header X-Real-IP $remote_addr;`);
        serverBlocks.push(`    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`);
        serverBlocks.push(`    proxy_set_header X-Forwarded-Proto $scheme;`);
        serverBlocks.push(`    proxy_pass http://${svc.ip}:${port};`);
        serverBlocks.push(`  }`);
        serverBlocks.push(`}`);
        serverBlocks.push(``);
    }

    fs.writeFileSync(OUT_SERVERS, serverBlocks.join("\n"));

    console.log("✅ Rendered nginx routing:");
    console.log(" -", OUT_PATH);
    console.log(" -", OUT_SERVERS);
}

main();
