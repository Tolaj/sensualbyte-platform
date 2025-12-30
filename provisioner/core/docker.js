const { request } = require("./dockerEngine");

async function ensureNetwork(name) {
    try {
        await request("GET", `/networks/${name}`);
    } catch {
        await request("POST", "/networks/create", {
            Name: name,
            Driver: "bridge",
        });
    }
}

async function getContainerIP(containerName, networkName) {
    const info = await request("GET", `/containers/${containerName}/json`);
    return info.NetworkSettings.Networks[networkName].IPAddress;
}

async function startContainer(name) {
    await request("POST", `/containers/${name}/start`);
}

async function stopContainer(name) {
    await request("POST", `/containers/${name}/stop`);
}

async function removeContainer(name) {
    await request("DELETE", `/containers/${name}?force=true`);
}

async function listContainersByLabel(label) {
    return request(
        "GET",
        `/containers/json?all=1&filters=${encodeURIComponent(
            JSON.stringify({ label: [label] })
        )}`
    );
}

async function inspectContainer(name) {
    return request("GET", `/containers/${name}/json`);
}

module.exports = {
    ensureNetwork,
    getContainerIP,
    startContainer,
    stopContainer,
    removeContainer,
    listContainersByLabel,
    inspectContainer,
};
