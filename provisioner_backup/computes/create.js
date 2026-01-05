const { request, ensureImage } = require("../core/dockerEngine");
const { setupSSH } = require("../core/ssh");

async function createCompute({
    computeId,
    cpu,
    memoryMb,
    network,
    image,
    username,
    publishSsh = false,   // 👈 NEW

}) {
    // computeId already comes as cmp_xxx from API
    const name = computeId

    await ensureImage(image);

    const { Id } = await request(
        "POST",
        `/containers/create?name=${encodeURIComponent(name)}`,
        {
            Image: image,
            Cmd: ["sleep", "infinity"],
            Labels: {
                "sensualbyte.managed": "true",
                "sensualbyte.type": "compute",
                "sensualbyte.computeId": computeId,
            },
            HostConfig: {
                NanoCPUs: Number(cpu) * 1e9,
                Memory: Number(memoryMb) * 1024 * 1024,
                NetworkMode: network,
                PortBindings: publishSsh
                    ? { "22/tcp": [{ HostPort: "2222" }] }
                    : undefined
            },
            ExposedPorts: publishSsh ? { "22/tcp": {} } : undefined
        }
    );

    await request("POST", `/containers/${Id}/start`);
    await setupSSH(name, username);

    return name;
}

module.exports = { createCompute };
