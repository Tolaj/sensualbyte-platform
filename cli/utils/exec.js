const { spawnSync } = require("child_process");

function run(script, args = []) {
    const res = spawnSync("bash", [script, ...args], {
        stdio: "inherit",
    });

    if (res.status !== 0) {
        process.exit(res.status ?? 1);
    }
}

module.exports = { run };
