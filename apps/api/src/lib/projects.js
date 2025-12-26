const fs = require("fs");
const path = require("path");
const { readJson, writeJson } = require("./store");

const STORE = path.join(process.cwd(), "runtime", "projects.json");


function readStore() {
    return readJson(STORE, { projects: [] });
}

function writeStore(data) {
    writeJson(STORE, data);
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
