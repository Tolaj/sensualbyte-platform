const fs = require("fs");
const path = require("path");
const { readJson, writeJson } = require("./store");

const STORE = path.join(process.cwd(), "runtime", "ownership.json");


function readStore() {
    return readJson(STORE, { ownership: [] });
}

function writeStore(data) {
    writeJson(STORE, data);
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

const { getTeamRole } = require("./teams");

function isOwnerOrAdmin(user, resourceType, resourceId) {
    if (user.role === "super_admin") return true;

    const data = readStore();

    const records = data.ownerships.filter(
        o => o.resourceType === resourceType && o.resourceId === resourceId
    );

    for (const o of records) {
        // Direct user ownership
        if (o.ownerType === "user" && o.ownerId === user.id) {
            return true;
        }

        // Team ownership
        if (o.ownerType === "team") {
            const role = getTeamRole(user.id, o.ownerId);
            if (role === "owner" || role === "admin") {
                return true;
            }
        }
    }

    return false;
}


module.exports = {
    addOwnership,
    getOwners,
    isOwnerOrAdmin
};
