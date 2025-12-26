const fs = require("fs");
const path = require("path");

const STORE = path.join(process.cwd(), "runtime", "ownership.json");

function readStore() {
    if (!fs.existsSync(STORE)) return { ownerships: [] };
    return JSON.parse(fs.readFileSync(STORE, "utf-8"));
}

function writeStore(data) {
    fs.writeFileSync(STORE, JSON.stringify(data, null, 2));
}

function addOwnership({ resourceType, resourceId, ownerUserId, role }) {
    const data = readStore();

    data.ownerships.push({
        resourceType,
        resourceId,
        ownerUserId,
        role,
        createdAt: new Date().toISOString()
    });

    writeStore(data);
}

function getOwners(resourceType, resourceId) {
    const data = readStore();
    return data.ownerships.filter(
        o => o.resourceType === resourceType && o.resourceId === resourceId
    );
}

function isOwnerOrAdmin(user, resourceType, resourceId) {
    if (user.role === "super_admin") return true;

    const owners = getOwners(resourceType, resourceId);
    return owners.some(o => o.ownerUserId === user.id);
}

module.exports = {
    addOwnership,
    getOwners,
    isOwnerOrAdmin
};
