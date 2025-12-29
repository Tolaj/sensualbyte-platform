const path = require("path");
const { run } = require("../utils/exec");
const { flagsToArgs } = require("../utils/flags");

module.exports = (options) => {
    const script = path.resolve(__dirname, "../../scripts/install.sh");
    const args = flagsToArgs(options);
    run(script, args);
};
