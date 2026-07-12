const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const DEFAULT_START_PORT = 19010;
const DEFAULT_PORT_WINDOW = 100;

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      args._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      "content-type": "application/json"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

function settingsFilePath(options = {}) {
  const platform = options.platform || process.platform;
  const homeDir = options.homeDir || os.homedir();
  const env = options.env || process.env;
  if (platform === "darwin") return path.join(homeDir, "Library", "Application Support", "skill-manager", "settings.json");
  if (platform === "win32") return path.join(env.APPDATA || path.join(homeDir, "AppData", "Roaming"), "skill-manager", "settings.json");
  return path.join(env.XDG_CONFIG_HOME || path.join(homeDir, ".config"), "skill-manager", "settings.json");
}

function validPort(value) {
  return Number.isInteger(value) && value >= 1024 && value <= 65535;
}

async function readConfiguredPort(options = {}) {
  try {
    const filePath = options.filePath || settingsFilePath(options);
    const settings = JSON.parse(await fs.readFile(filePath, "utf8"));
    return validPort(settings.apiPort) ? settings.apiPort : DEFAULT_START_PORT;
  } catch {
    return DEFAULT_START_PORT;
  }
}

function isSkillManagerStatus(payload) {
  return payload?.ok === true && payload?.app?.name === "skill-manager";
}

async function findApiBaseUrl(args, options = {}) {
  if (args.url) return args.url.replace(/\/$/, "");
  if (process.env.SKILL_MANAGER_API_URL) return process.env.SKILL_MANAGER_API_URL.replace(/\/$/, "");
  const startPort = options.configuredPort || await readConfiguredPort(options);
  const portWindow = options.portWindow || DEFAULT_PORT_WINDOW;
  const requestStatus = options.requestStatus || ((baseUrl) => requestJson(baseUrl, "/api/status"));
  for (let port = startPort; port <= 65535 && port < startPort + portWindow; port += 1) {
    const baseUrl = `http://127.0.0.1:${port}`;
    try {
      const status = await requestStatus(baseUrl);
      if (isSkillManagerStatus(status)) return baseUrl;
    } catch {
      // keep probing
    }
  }
  throw new Error("Skill Manager is not running. Open the app and try again.");
}

function printHelp() {
  console.log(`Skill Manager CLI

Usage:
  skill-manager status
  skill-manager scan [--scope installed|uninstalled]
  skill-manager publish --agent Codex --skill tdd [--message "..."]
  skill-manager uninstall --agent Codex --skill tdd
  skill-manager install-local --dir /path/to/skill --agent Agents [--conflict skip|replace]
  skill-manager recover --dir /path/to/uninstalled-snapshot --agent Codex [--conflict skip|replace]
  skill-manager logs
  skill-manager events

Options:
  --url http://127.0.0.1:19010   Override local API URL
`);
}

function requireValue(args, key) {
  const value = args[key];
  if (!value || value === true) throw new Error(`Missing --${key}`);
  return value;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] || "help";
  if (command === "help" || args.help) {
    printHelp();
    return;
  }
  const baseUrl = await findApiBaseUrl(args);
  let result;
  if (command === "status") {
    result = await requestJson(baseUrl, "/api/status");
  } else if (command === "scan") {
    const scope = args.scope || "installed";
    result = await requestJson(baseUrl, `/api/skills?scope=${encodeURIComponent(scope)}`);
  } else if (command === "publish") {
    result = await requestJson(baseUrl, "/api/skills/publish", {
      method: "POST",
      body: {
        agent: requireValue(args, "agent"),
        skill: requireValue(args, "skill"),
        message: args.message || ""
      }
    });
  } else if (command === "uninstall") {
    result = await requestJson(baseUrl, "/api/skills/uninstall", {
      method: "POST",
      body: {
        agent: requireValue(args, "agent"),
        skill: requireValue(args, "skill")
      }
    });
  } else if (command === "install-local") {
    result = await requestJson(baseUrl, "/api/skills/install-local", {
      method: "POST",
      body: {
        sourceDir: requireValue(args, "dir"),
        agent: requireValue(args, "agent"),
        conflictStrategy: args.conflict || "skip"
      }
    });
  } else if (command === "recover") {
    result = await requestJson(baseUrl, "/api/skills/recover", {
      method: "POST",
      body: {
        sourceDir: requireValue(args, "dir"),
        agent: requireValue(args, "agent"),
        conflictStrategy: args.conflict || "skip"
      }
    });
  } else if (command === "logs") {
    result = await requestJson(baseUrl, "/api/logs");
  } else if (command === "events") {
    result = await requestJson(baseUrl, "/api/events");
  } else {
    printHelp();
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_PORT_WINDOW,
  DEFAULT_START_PORT,
  findApiBaseUrl,
  isSkillManagerStatus,
  parseArgs,
  readConfiguredPort,
  settingsFilePath
};
