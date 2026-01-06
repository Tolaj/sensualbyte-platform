// provisioner/src/adapters/mosquitto.js
import { ensureImage } from "../drivers/docker/images.js";
import { ensureVolume } from "../drivers/docker/volumes.js";
import { ensureNetwork } from "../drivers/docker/networks.js";
import { baseLabels } from "../drivers/docker/labels.js";
import { wrapErr, isNotFoundDockerErr } from "../utils/errors.js";

function containerName(resourceId) {
    return `sb_mqtt_${resourceId}`;
}

function mqttLabels(resource) {
    return {
        ...baseLabels(resource),
        "sensualbyte.mqtt.engine": "mosquitto"
    };
}

async function inspectIfExists(docker, name) {
    try {
        const c = docker.getContainer(name);
        const i = await c.inspect();
        return { container: c, inspect: i };
    } catch (err) {
        if (isNotFoundDockerErr(err)) return { container: null, inspect: null };
        throw wrapErr("Failed to inspect mosquitto container", err, { name });
    }
}

/**
 * ensureMosquitto:
 * spec example:
 * {
 *   version: "2",
 *   network: { name: "sensualbyte_default" },
 *   ports: { mqtt: 1883 },         // internal container port
 *   persistence: true
 * }
 */
export async function ensureMosquitto(docker, resource) {
    if (!docker) throw new Error("docker client required");
    if (!resource?.resourceId) throw new Error("resource.resourceId required");

    const spec = resource.spec || {};
    const name = containerName(resource.resourceId);

    const image = `eclipse-mosquitto:${spec.version || "2"}`;

    await ensureImage(docker, image);

    const netName = spec.network?.name || "sensualbyte_default";
    await ensureNetwork(docker, netName, {
        "sensualbyte.kind": "network",
        "sensualbyte.network": "bridge"
    });

    const existing = await inspectIfExists(docker, name);
    if (existing.container) return existing.container;

    const dataVol = `sb_mqttdata_${resource.resourceId}`;
    const logVol = `sb_mqttlog_${resource.resourceId}`;

    // persistence volumes (safe even if not used)
    await ensureVolume(docker, dataVol, {
        "sensualbyte.kind": "volume",
        "sensualbyte.resourceId": String(resource.resourceId),
        "sensualbyte.usage": "mqtt_data"
    });

    await ensureVolume(docker, logVol, {
        "sensualbyte.kind": "volume",
        "sensualbyte.resourceId": String(resource.resourceId),
        "sensualbyte.usage": "mqtt_log"
    });

    const internalPort = Number(spec.ports?.mqtt || 1883);
    const key = `${internalPort}/tcp`;

    try {
        const c = await docker.createContainer({
            name,
            Image: image,
            Labels: mqttLabels(resource),
            ExposedPorts: { [key]: {} },
            HostConfig: {
                RestartPolicy: { Name: "unless-stopped" },
                Binds: [
                    `${dataVol}:/mosquitto/data`,
                    `${logVol}:/mosquitto/log`
                ],
                PortBindings: { [key]: [{ HostPort: "" }] }
            }
        });

        // connect to desired network
        try {
            const net = docker.getNetwork(netName);
            await net.connect({ Container: name });
        } catch (err) {
            const msg = err?.json?.message || err?.message || "";
            if (!/already exists|already connected/i.test(msg)) {
                throw wrapErr("Failed to connect mosquitto to network", err, { netName, name });
            }
        }

        return c;
    } catch (err) {
        throw wrapErr("Failed to create mosquitto container", err, { name, image, netName });
    }
}
