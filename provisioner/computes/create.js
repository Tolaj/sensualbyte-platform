const { execCmd } = require("../core/docker");
const { setupSSH } = require("../core/ssh");

async function createCompute({
    computeId,
    cpu,
    memoryMb,
    network,
    image,
    username
}) {
    const name = `cmp_${computeId}`;

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
        "--label", "sensual.type=compute",
        "--label", `sensual.computeId=${computeId}`,

        image,
        "sleep", "infinity"
    ]);

    await setupSSH(name, username);
    return name;
}

module.exports = { createCompute };
