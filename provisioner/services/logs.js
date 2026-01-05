const http = require("http");

const DOCKER_SOCKET = "/var/run/docker.sock";

function requestBuffer(path) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        const req = http.request(
            { socketPath: DOCKER_SOCKET, path, method: "GET" },
            (res) => {
                res.on("data", (c) => chunks.push(Buffer.from(c)));
                res.on("end", () => {
                    const buf = Buffer.concat(chunks);
                    if (res.statusCode >= 300) {
                        return reject(new Error(`Docker API GET ${path} failed: ${buf.toString("utf8")}`));
                    }
                    resolve(buf);
                });
            }
        );
        req.on("error", reject);
        req.end();
    });
}

// If logs are multiplexed, remove the 8-byte header per frame.
function demuxDockerLogs(buffer) {
    // Heuristic: multiplex header is 8 bytes; byte0 is 1 or 2.
    // If not multiplexed, just return as-is.
    if (!buffer || buffer.length < 8) return buffer;

    const out = [];
    let i = 0;

    while (i + 8 <= buffer.length) {
        const streamType = buffer[i]; // 1 stdout, 2 stderr
        const size = buffer.readUInt32BE(i + 4);

        // If header doesn't look valid, stop demux and return original.
        if ((streamType !== 1 && streamType !== 2) || size < 0) {
            return buffer;
        }

        const start = i + 8;
        const end = start + size;

        // If frame is out of bounds, return original (not multiplexed).
        if (end > buffer.length) return buffer;

        out.push(buffer.slice(start, end));
        i = end;
    }

    return Buffer.concat(out);
}

async function getLogs(containerName, tail = 200) {
    const t = Number(tail) || 200;

    const path =
        `/containers/${encodeURIComponent(containerName)}/logs` +
        `?stdout=true&stderr=true&tail=${encodeURIComponent(String(t))}`;

    const raw = await requestBuffer(path);
    const clean = demuxDockerLogs(raw);

    return clean.toString("utf8");
}

module.exports = { getLogs };
