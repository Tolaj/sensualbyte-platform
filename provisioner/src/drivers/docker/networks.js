export async function ensureNetwork(docker, name) {
    const nets = await docker.listNetworks();
    const found = nets.find((n) => n.Name === name);
    if (found) return docker.getNetwork(found.Id);
    return docker.createNetwork({ Name: name, Driver: "bridge" });
}
