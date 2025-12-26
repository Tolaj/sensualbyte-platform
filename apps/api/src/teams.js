const fs = require("fs");
const path = require("path");

const STORE = path.join(process.cwd(), "runtime", "teams.json");

function readStore() {
    if (!fs.existsSync(STORE)) return { teams: [] };
    return JSON.parse(fs.readFileSync(STORE, "utf-8"));
}

function writeStore(data) {
    fs.writeFileSync(STORE, JSON.stringify(data, null, 2));
}

function createTeam({ id, name, ownerUserId }) {
    const data = readStore();

    const team = {
        id,
        name,
        createdBy: ownerUserId,
        members: [
            { userId: ownerUserId, role: "owner" }
        ],
        createdAt: new Date().toISOString()
    };

    data.teams.push(team);
    writeStore(data);
    return team;
}

function getTeam(teamId) {
    const data = readStore();
    return data.teams.find(t => t.id === teamId);
}

function isTeamMember(userId, teamId) {
    const team = getTeam(teamId);
    if (!team) return false;
    return team.members.some(m => m.userId === userId);
}

function getTeamRole(userId, teamId) {
    const team = getTeam(teamId);
    if (!team) return null;
    const member = team.members.find(m => m.userId === userId);
    return member?.role || null;
}

module.exports = {
    createTeam,
    getTeam,
    isTeamMember,
    getTeamRole
};
