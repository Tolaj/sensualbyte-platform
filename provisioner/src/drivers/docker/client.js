import Docker from "dockerode";

export function getDocker() {
    // v1: local docker via socket
    return new Docker({ socketPath: process.env.DOCKER_SOCKET || "/var/run/docker.sock" });
}

