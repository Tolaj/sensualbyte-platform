const { execCmd } = require("../core/docker");

async function getLogs(containerName, tail = 200) {
    const out = await execCmd("docker", [
        "logs",
        "--tail",
        String(tail),
        containerName
    ]);
    return out;
}

module.exports = { getLogs };
