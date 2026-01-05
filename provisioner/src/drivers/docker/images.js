export async function ensureImage(docker, image) {
    if (!image) throw new Error("compute.spec.image is required for docker implementation");

    try {
        await docker.getImage(image).inspect();
        return;
    } catch (_) {
        // pull
    }

    const stream = await docker.pull(image);
    await new Promise((resolve, reject) => {
        docker.modem.followProgress(stream, (err, _output) => (err ? reject(err) : resolve()));
    });
}
