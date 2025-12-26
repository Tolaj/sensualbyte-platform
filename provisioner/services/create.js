const { execCmd } = require("../core/docker");

async function createService({
    serviceId,
    image,
    cpu,
    memoryMb,
    network,
    internalPort
}) {
    const name = `svc_${serviceId}`;

    await execCmd("docker", [
        "run",
        "-d",
        "--name",
        name,
        "--network",
        network,
        "--cpus",
        String(cpu),
        "--memory",
        `${memoryMb}m`,

        "--label", "sensual.managed=true",
        "--label", "sensual.type=service",
        "--label", `sensual.serviceId=${serviceId}`,
        "--label", "sensual.health.path=/health",
        "--label", `sensual.health.port=${internalPort}`,

        image
    ]);

    return name;
}

module.exports = { createService };
