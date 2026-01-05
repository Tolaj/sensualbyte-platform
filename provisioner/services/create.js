const { request, ensureImage } = require("../core/dockerEngine");

async function createService({
    serviceId,
    image,
    cpu,
    memoryMb,
    network,
    internalPort,
    healthPath
}) {
    const name = serviceId;

    await ensureImage(image);

    const { Id } = await request("POST", `/containers/create?name=${encodeURIComponent(name)}`, {
        Image: image,
        Labels: {
            "sensual.managed": "true",
            "sensualbyte.type": "service",
            "sensualbyte.serviceId": serviceId,
            "sensualbyte.health.path": healthPath,
            "sensualbyte.health.port": String(internalPort),
        },
        ExposedPorts: {
            [`${internalPort}/tcp`]: {},
        },
        HostConfig: {
            NanoCPUs: cpu * 1e9,
            Memory: memoryMb * 1024 * 1024,
            NetworkMode: network,
        },
    });

    await request("POST", `/containers/${Id}/start`);
    return name;
}

module.exports = { createService };
