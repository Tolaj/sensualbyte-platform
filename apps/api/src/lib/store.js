const fs = require("fs");

function readJson(path, fallback) {
    if (!fs.existsSync(path)) return fallback;
    return JSON.parse(fs.readFileSync(path, "utf-8"));
}

function writeJson(path, data) {
    fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

module.exports = { readJson, writeJson };
