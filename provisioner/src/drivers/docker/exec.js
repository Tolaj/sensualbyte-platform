export async function execInContainer(docker, containerName, cmd) {
    const c = docker.getContainer(containerName);
    const exec = await c.exec({
        AttachStdout: true,
        AttachStderr: true,
        Cmd: cmd
    });
    const stream = await exec.start({ hijack: true, stdin: false });
    await new Promise((resolve) => stream.on("end", resolve));
}
