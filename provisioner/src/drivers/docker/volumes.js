export async function ensureVolume(docker, name, labels = {}) {
    try {
        const v = docker.getVolume(name);
        await v.inspect();
        return v;
    } catch (_) {
        return docker.createVolume({ Name: name, Labels: labels });
    }
}

export async function removeVolumeIfExists(docker, name) {
    try {
        const v = docker.getVolume(name);
        await v.remove({ force: true });
        return { removed: true };
    } catch (_) {
        return { removed: false };
    }
}
