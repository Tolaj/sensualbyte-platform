function flagsToArgs(options) {
    const args = [];
    if (options.yes) args.push("--yes");
    if (options.defaults) args.push("--defaults");
    return args;
}

module.exports = { flagsToArgs };
