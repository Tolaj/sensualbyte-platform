const { execCmd } = require("./container");

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
