#!/usr/bin/env node

const { Command } = require("commander");

const install = require("./commands/install");
const verify = require("./commands/verify");
const uninstall = require("./commands/uninstall");

const program = new Command();

program
    .name("sensual")
    .description("SENSUAL SERVER CLI")
    .version("0.1.0");

program
    .command("install")
    .description("Install SENSUAL SERVER on this machine")
    .option("-y, --yes", "auto-confirm prompts")
    .option("-d, --defaults", "use default values")
    .action(install);

program
    .command("verify")
    .description("Run sanity checks")
    .action(verify);

program
    .command("uninstall")
    .description("Uninstall SENSUAL SERVER")
    .option("-y, --yes", "auto-confirm prompts")
    .action(uninstall);

program.parse(process.argv);
