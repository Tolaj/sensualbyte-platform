// provisioner/src/drivers/docker/exec.js
import { wrapErr } from "../../utils/errors.js";

function collectStream(docker, stream, { timeoutMs } = {}) {
    return new Promise((resolve, reject) => {
        let stdout = "";
        let stderr = "";

        const stdoutStream = { write: (chunk) => (stdout += chunk.toString("utf8")) };
        const stderrStream = { write: (chunk) => (stderr += chunk.toString("utf8")) };

        let timeout = null;
        if (timeoutMs && Number(timeoutMs) > 0) {
            timeout = setTimeout(() => {
                try { stream.destroy(new Error("exec stream timeout")); } catch (_) { }
                reject(new Error(`exec stream timeout after ${timeoutMs}ms`));
            }, Number(timeoutMs));
        }

        try {
            docker.modem.demuxStream(stream, stdoutStream, stderrStream);
        } catch (err) {
            if (timeout) clearTimeout(timeout);
            return reject(err);
        }

        stream.on("end", () => {
            if (timeout) clearTimeout(timeout);
            resolve({ stdout, stderr });
        });

        stream.on("error", (err) => {
            if (timeout) clearTimeout(timeout);
            reject(err);
        });
    });
}

export async function execInContainer(docker, containerName, cmd, opts = {}) {
    if (!docker) throw new Error("docker client required");
    if (!containerName) throw new Error("containerName required");
    if (!Array.isArray(cmd) || cmd.length === 0) throw new Error("cmd must be non-empty array");

    const env =
        opts.env ? Object.entries(opts.env).map(([k, v]) => `${k}=${String(v)}`) : undefined;

    const c = docker.getContainer(containerName);

    let exec;
    try {
        exec = await c.exec({
            AttachStdout: true,
            AttachStderr: true,
            Cmd: cmd,
            WorkingDir: opts.workingDir,
            Env: env
        });
    } catch (err) {
        throw wrapErr("Failed to create exec in container", err, { containerName, cmd });
    }

    let stream;
    try {
        stream = await exec.start({ hijack: true, stdin: false });
    } catch (err) {
        throw wrapErr("Failed to start exec in container", err, { containerName, cmd });
    }

    let out;
    try {
        out = await collectStream(docker, stream, { timeoutMs: opts.timeoutMs });
    } catch (err) {
        throw wrapErr("Failed while collecting exec output", err, { containerName, cmd });
    }

    let info;
    try {
        info = await exec.inspect();
    } catch (err) {
        throw wrapErr("Failed to inspect exec result", err, { containerName, cmd });
    }

    return {
        exitCode: info.ExitCode ?? null,
        stdout: out.stdout,
        stderr: out.stderr
    };
}
