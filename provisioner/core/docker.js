const { execFile } = require("child_process");

function execCmd(cmd, args, options = {}) {
    return new Promise((resolve, reject) => {
        execFile(cmd, args, { maxBuffer: 1024 * 1024 * 20, ...options }, (err, stdout, stderr) => {
            if (err) {
                const msg = (stderr || stdout || err.message || "").toString();
                return reject(new Error(`${cmd} ${args.join(" ")} failed: ${msg}`));
            }
            resolve((stdout || "").toString().trim());
        });
    });
}

async function ensureNetwork(networkName) {
    try {
        await execCmd("docker", ["network", "inspect", networkName]);
    } catch {
        await execCmd("docker", ["network", "create", networkName]);
    }
}




async function getContainerIP(containerName, networkName) {
    // Safer: docker inspect by network
    const out = await execCmd("docker", [
        "inspect",
        "-f",
        `{{(index .NetworkSettings.Networks "${networkName}").IPAddress}}`,
        containerName,
    ]);
    return out;
}

async function stopContainer(containerName) {
    await execCmd("docker", ["stop", containerName]);
}

async function startContainer(containerName) {
    await execCmd("docker", ["start", containerName]);
}

async function removeContainer(containerName) {
    // remove force (stops if running)
    await execCmd("docker", ["rm", "-f", containerName]);
}


module.exports = {
    execCmd,
    ensureNetwork,
    getContainerIP,
    stopContainer,
    startContainer,
    removeContainer,
};
