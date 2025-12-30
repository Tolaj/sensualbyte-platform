const http = require("http");

const DOCKER_SOCKET = "/var/run/docker.sock";

function safeParseJSON(data) {
    try {
        return JSON.parse(data);
    } catch {
        return data; // return raw text if not JSON
    }
}

function request(method, path, body = null, opts = {}) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;

        const req = http.request(
            {
                socketPath: DOCKER_SOCKET,
                path,
                method,
                headers: payload
                    ? {
                        "Content-Type": "application/json",
                        "Content-Length": Buffer.byteLength(payload),
                    }
                    : {},
            },
            (res) => {
                let data = "";
                res.on("data", (c) => (data += c));
                res.on("end", () => {
                    if (res.statusCode >= 300) {
                        return reject(
                            new Error(`Docker API ${method} ${path} failed: ${data}`)
                        );
                    }

                    // 🔑 DO NOT JSON.parse streaming responses
                    if (opts.raw === true) {
                        return resolve(data);
                    }

                    return resolve(data ? safeParseJSON(data) : null);
                });
            }
        );

        req.on("error", reject);
        if (payload) req.write(payload);
        req.end();
    });
}


/**
 * Ensure Docker image exists locally, otherwise pull it
 */
async function ensureImage(image) {
    try {
        // Check if image exists locally
        await request("GET", `/images/${encodeURIComponent(image)}/json`);
        return true;
    } catch {
        // Pull image (STREAMING RESPONSE)
        await request(
            "POST",
            `/images/create?fromImage=${encodeURIComponent(image)}`,
            null,
            { raw: true }   // 🔑 IMPORTANT
        );
        return true;
    }
}


/**
 * Docker exec (engine API equivalent of `docker exec`)
 * Fire-and-forget execution inside container.
 */
async function exec(containerName, cmd) {
    // 1) create exec instance
    const execCreate = await request(
        "POST",
        `/containers/${containerName}/exec`,
        {
            AttachStdout: true,
            AttachStderr: true,
            AttachStdin: false,
            Tty: false,
            Cmd: cmd,
        }
    );

    // 2) start exec
    await request(
        "POST",
        `/exec/${execCreate.Id}/start`,
        {
            Detach: false,
            Tty: false,
        },
        { raw: true }
    );

    return true;
}

module.exports = {
    request,
    ensureImage,
    exec,
};
