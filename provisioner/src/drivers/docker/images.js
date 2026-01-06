// provisioner/src/drivers/docker/images.js
import { wrapErr, isNotFoundDockerErr } from "../../utils/errors.js";

export async function ensureImage(docker, image) {
    if (!docker) throw new Error("docker client required");
    if (!image) throw new Error("spec.image is required");

    // already present?
    try {
        await docker.getImage(image).inspect();
        return { image, pulled: false };
    } catch (err) {
        if (!isNotFoundDockerErr(err)) {
            throw wrapErr("Failed to inspect image", err, { image });
        }
        // not found -> pull
    }

    let stream;
    try {
        stream = await docker.pull(image);
    } catch (err) {
        throw wrapErr("Failed to start docker pull", err, { image });
    }

    try {
        await new Promise((resolve, reject) => {
            // Track a useful last status for debugging
            let lastStatus = null;

            const onProgress = (evt) => {
                if (!evt) return;
                // evt can have { status, progress, id, error, errorDetail }
                if (evt.error || evt.errorDetail) {
                    lastStatus = evt.error || evt.errorDetail?.message || JSON.stringify(evt.errorDetail);
                } else if (evt.status) {
                    const id = evt.id ? ` ${evt.id}` : "";
                    const prog = evt.progress ? ` ${evt.progress}` : "";
                    lastStatus = `${evt.status}${id}${prog}`;
                }
            };

            docker.modem.followProgress(stream, (err) => {
                if (err) {
                    const e = wrapErr("Docker pull failed", err, { image, lastStatus });
                    return reject(e);
                }
                resolve();
            }, onProgress);
        });
    } catch (err) {
        // ensure we always throw wrapped error with context
        if (err?.extra?.image) throw err;
        throw wrapErr("Failed to pull image", err, { image });
    }

    // Verify pull worked (optional but nice)
    try {
        await docker.getImage(image).inspect();
    } catch (err) {
        throw wrapErr("Image pull finished but inspect still failed", err, { image });
    }

    return { image, pulled: true };
}
