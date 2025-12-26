const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const KEY_DIR = path.join(process.cwd(), "ssh-keys");

function run(cmd, args) {
    return new Promise((resolve, reject) => {
        execFile(cmd, args, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr?.toString() || err.message));
            resolve(stdout.toString());
        });
    });
}

async function ensureKeypair(username = "default") {
    if (!fs.existsSync(KEY_DIR)) fs.mkdirSync(KEY_DIR, { recursive: true });

    const keyPath = path.join(KEY_DIR, `${username}`);
    const pubPath = `${keyPath}.pub`;

    if (!fs.existsSync(keyPath) || !fs.existsSync(pubPath)) {
        // Generate key
        await run("ssh-keygen", ["-t", "ed25519", "-f", keyPath, "-N", ""]);
    }

    const publicKey = fs.readFileSync(pubPath, "utf-8").trim();
    return { keyPath, pubPath, publicKey };
}

module.exports = { ensureKeypair };
