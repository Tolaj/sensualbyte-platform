const fs = require("fs");
const path = require("path");

const STORE = path.join(__dirname, "..", "runtime", "apps.json");

const OUT_PATH = path.join(__dirname, "..", "infra", "nginx", "sensual-apps.conf");
const OUT_SERVERS = path.join(__dirname, "..", "infra", "nginx", "sensual-apps-servers.conf");

// Later: "*.ecs.sensualbyte.com"
const SUBDOMAIN_SUFFIX = "ecs.sensualbyte.com";

function readStore() {
    if (!fs.existsSync(STORE)) return { apps: [] };
    return JSON.parse(fs.readFileSync(STORE, "utf-8"));
}

function sanitizePort(p) {
    const n = Number(p);
    if (!Number.isFinite(n) || n <= 0 || n > 65535) return null;
    return n;
}

function main() {
    const data = readStore();
    const apps = Array.isArray(data.apps) ? data.apps : [];

    // ---------- PATH ROUTING ----------
    // /apps/<appId>/  -> http://<ip>:<internalPort>/
    // NOTE: We rewrite prefix so app sees "/"
    const pathBlocks = [];
    pathBlocks.push(`# AUTO-GENERATED. DO NOT EDIT.`);
    pathBlocks.push(`# Generated at: ${new Date().toISOString()}`);
    pathBlocks.push("");

    for (const app of apps) {
        if (!app || app.status !== "running") continue;
        if (!app.id || !app.ip) continue;

        const port = sanitizePort(app.internalPort);
        if (!port) continue;

        const prefix = `/apps/${app.id}/`;

        pathBlocks.push(`# App: ${app.id} (${app.name || ""}) -> ${app.ip}:${port}`);
        pathBlocks.push(`location ^~ ${prefix} {`);
        pathBlocks.push(`  proxy_http_version 1.1;`);
        pathBlocks.push(`  proxy_set_header Host $host;`);
        pathBlocks.push(`  proxy_set_header X-Real-IP $remote_addr;`);
        pathBlocks.push(`  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`);
        pathBlocks.push(`  proxy_set_header X-Forwarded-Proto $scheme;`);
        pathBlocks.push("");
        pathBlocks.push(`  # strip /apps/<id>/ prefix`);
        pathBlocks.push(`  rewrite ^${prefix}(.*)$ /$1 break;`);
        pathBlocks.push(`  proxy_pass http://${app.ip}:${port};`);
        pathBlocks.push(`}`);
        pathBlocks.push("");
    }

    fs.writeFileSync(OUT_PATH, pathBlocks.join("\n"));

    // ---------- SUBDOMAIN ROUTING ----------
    // <appId>.ecs.sensualbyte.com -> http://<ip>:<internalPort>
    const serverBlocks = [];
    serverBlocks.push(`# AUTO-GENERATED. DO NOT EDIT.`);
    serverBlocks.push(`# Generated at: ${new Date().toISOString()}`);
    serverBlocks.push("");

    for (const app of apps) {
        if (!app || app.status !== "running") continue;
        if (!app.id || !app.ip) continue;

        const port = sanitizePort(app.internalPort);
        if (!port) continue;

        const host = `${app.id}.${SUBDOMAIN_SUFFIX}`;

        serverBlocks.push(`server {`);
        serverBlocks.push(`  listen 80;`);
        serverBlocks.push(`  server_name ${host};`);
        serverBlocks.push(`  location / {`);
        serverBlocks.push(`    proxy_http_version 1.1;`);
        serverBlocks.push(`    proxy_set_header Host $host;`);
        serverBlocks.push(`    proxy_set_header X-Real-IP $remote_addr;`);
        serverBlocks.push(`    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`);
        serverBlocks.push(`    proxy_set_header X-Forwarded-Proto $scheme;`);
        serverBlocks.push(`    proxy_pass http://${app.ip}:${port};`);
        serverBlocks.push(`  }`);
        serverBlocks.push(`}`);
        serverBlocks.push("");
    }

    fs.writeFileSync(OUT_SERVERS, serverBlocks.join("\n"));

    console.log("✅ Rendered nginx app routing:");
    console.log(" -", OUT_PATH);
    console.log(" -", OUT_SERVERS);
}

main();
