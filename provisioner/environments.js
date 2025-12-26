const { execCmd } = require("./container");
const { setupSSH } = require("./ssh");

async function createEnvironment(envId, cpu, memoryMb, networkName, image, username) {
    const name = `env_${envId}`;

    await execCmd("docker", [
        "run",
        "-d",
        "--name",
        name,
        "--network",
        networkName,
        "--cpus",
        String(cpu),
        "--memory",
        `${memoryMb}m`,
        "--label", "sensual.managed=true",
        "--label", `sensual.type=environment`,
        "--label", `sensual.envId=${envId}`,
        image,
        "sleep", "infinity"
    ]);

    await setupSSH(name, username);
    return name;
}

module.exports = { createEnvironment };
