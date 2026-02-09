#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");

const COMMAND_NAME = "bootstrap.md";
const COMMANDS_DIR = path.join(os.homedir(), ".claude", "commands");
const TARGET = path.join(COMMANDS_DIR, COMMAND_NAME);
const SOURCE = path.join(__dirname, "..", COMMAND_NAME);

const pkg = require("../package.json");

const command = process.argv[2];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function install() {
  ensureDir(COMMANDS_DIR);

  if (fs.existsSync(TARGET)) {
    const existing = fs.readFileSync(TARGET, "utf8");
    const incoming = fs.readFileSync(SOURCE, "utf8");

    if (existing === incoming) {
      console.log("bootstrap.md is already up to date.");
      return;
    }

    console.log("Existing bootstrap.md found — replacing with v" + pkg.version);
  }

  fs.copyFileSync(SOURCE, TARGET);
  console.log("Installed bootstrap.md to " + TARGET);
  console.log("");
  console.log("Run /bootstrap in any project to set up the agentic workflow.");
}

function uninstall() {
  if (!fs.existsSync(TARGET)) {
    console.log("bootstrap.md not found — nothing to remove.");
    return;
  }

  fs.unlinkSync(TARGET);
  console.log("Removed " + TARGET);
}

function showHelp() {
  console.log("@studiomopoke/agentic-bootstrap v" + pkg.version);
  console.log("");
  console.log("Usage:");
  console.log("  agentic-bootstrap install     Install /bootstrap command for Claude Code");
  console.log("  agentic-bootstrap update      Update to the latest version");
  console.log("  agentic-bootstrap uninstall   Remove the /bootstrap command");
  console.log("  agentic-bootstrap --version   Show version");
  console.log("  agentic-bootstrap --help      Show this help");
}

switch (command) {
  case "install":
    install();
    break;
  case "update":
    install();
    break;
  case "uninstall":
  case "remove":
    uninstall();
    break;
  case "--version":
  case "-v":
    console.log(pkg.version);
    break;
  case "--help":
  case "-h":
  case undefined:
    showHelp();
    break;
  default:
    console.error("Unknown command: " + command);
    console.error('Run "agentic-bootstrap --help" for usage.');
    process.exit(1);
}
