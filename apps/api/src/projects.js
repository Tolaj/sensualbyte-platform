const fs = require("fs");
const path = require("path");

const STORE = path.join(process.cwd(), "runtime", "projects.json");

function readStore() {
    if (!fs.existsSync(STORE)) return { projects: [] };
    return JSON.parse(fs.readFileSync(STORE, "utf-8"));
}

function writeStore(data) {
    fs.writeFileSync(STORE, JSON.stringify(data, null, 2));
}

function createProject({ id, name, teamId, userId }) {
    const data = readStore();

    const project = {
        id,
        name,
        teamId,
        createdBy: userId,
        createdAt: new Date().toISOString()
    };

    data.projects.push(project);
    writeStore(data);
    return project;
}

function getProject(projectId) {
    const data = readStore();
    return data.projects.find(p => p.id === projectId);
}

function listProjectsByTeam(teamId) {
    const data = readStore();
    return data.projects.filter(p => p.teamId === teamId);
}

module.exports = {
    createProject,
    getProject,
    listProjectsByTeam
};
