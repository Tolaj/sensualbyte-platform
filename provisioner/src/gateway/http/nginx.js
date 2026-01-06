import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execInContainer } from "../../drivers/docker/exec.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function tplPath() {
    return path.join(__dirname, "templates", "route.conf.tpl");
}

export function renderRouteConf({ hostname, targetIp, targetPort }) {
    const tpl = fs.readFileSync(tplPath(), "utf8");
    return tpl
        .replaceAll("__HOSTNAME__", hostname)
        .replaceAll("__TARGET_IP__", targetIp)
        .replaceAll("__TARGET_PORT__", String(targetPort));
}

export async function applyNginxRoute({ docker, routeResourceId, hostname, targetIp, targetPort }) {
    const confDir = process.env.NGINX_CONF_DIR;
    if (!confDir) throw new Error("NGINX_CONF_DIR is required (absolute path to infra/nginx/conf.d)");

    fs.mkdirSync(confDir, { recursive: true });

    const filename = `sb_${routeResourceId}.conf`;
    const abs = path.join(confDir, filename);

    fs.writeFileSync(abs, renderRouteConf({ hostname, targetIp, targetPort }), "utf8");

    const nginxName = process.env.NGINX_CONTAINER_NAME || "sb-nginx";
    await execInContainer(docker, nginxName, ["nginx", "-t"]);
    await execInContainer(docker, nginxName, ["nginx", "-s", "reload"]);

    return { file: abs, reloaded: true };
}

export async function deleteNginxRoute({ docker, routeResourceId }) {
    const confDir = process.env.NGINX_CONF_DIR;
    if (!confDir) throw new Error("NGINX_CONF_DIR is required (absolute path to infra/nginx/conf.d)");

    const filename = `sb_${routeResourceId}.conf`;
    const abs = path.join(confDir, filename);

    if (fs.existsSync(abs)) fs.unlinkSync(abs);

    const nginxName = process.env.NGINX_CONTAINER_NAME || "sb-nginx";
    await execInContainer(docker, nginxName, ["nginx", "-t"]);
    await execInContainer(docker, nginxName, ["nginx", "-s", "reload"]);

    return { deleted: true };
}
