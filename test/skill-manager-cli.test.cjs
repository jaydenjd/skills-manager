const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const {
  DEFAULT_START_PORT,
  findApiBaseUrl,
  isSkillManagerStatus,
  readConfiguredPort,
  settingsFilePath
} = require("../bin/skill-manager-cli.cjs");

test("settingsFilePath matches Electron userData conventions", () => {
  assert.equal(
    settingsFilePath({ platform: "darwin", homeDir: "/Users/test", env: {} }),
    "/Users/test/Library/Application Support/skill-manager/settings.json"
  );
  assert.equal(
    settingsFilePath({ platform: "win32", homeDir: "C:\\Users\\test", env: { APPDATA: "D:\\Roaming" } }),
    path.join("D:\\Roaming", "skill-manager", "settings.json")
  );
  assert.equal(
    settingsFilePath({ platform: "linux", homeDir: "/home/test", env: { XDG_CONFIG_HOME: "/tmp/config" } }),
    "/tmp/config/skill-manager/settings.json"
  );
});

test("readConfiguredPort reads a valid App setting", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "skill-manager-cli-"));
  const file = path.join(dir, "settings.json");
  await fs.writeFile(file, JSON.stringify({ apiPort: 23123 }));

  assert.equal(await readConfiguredPort({ filePath: file }), 23123);
});

test("readConfiguredPort falls back for invalid or missing settings", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "skill-manager-cli-"));
  const invalid = path.join(dir, "invalid.json");
  await fs.writeFile(invalid, JSON.stringify({ apiPort: 80 }));

  assert.equal(await readConfiguredPort({ filePath: invalid }), DEFAULT_START_PORT);
  assert.equal(await readConfiguredPort({ filePath: path.join(dir, "missing.json") }), DEFAULT_START_PORT);
});

test("isSkillManagerStatus rejects unrelated local services", () => {
  assert.equal(isSkillManagerStatus({ ok: true, app: { name: "skill-manager" } }), true);
  assert.equal(isSkillManagerStatus({ ok: true, app: { name: "another-app" } }), false);
  assert.equal(isSkillManagerStatus({ ok: false, app: { name: "skill-manager" } }), false);
});

test("findApiBaseUrl probes the configured port first and validates identity", async () => {
  const visited = [];
  const result = await findApiBaseUrl({}, {
    configuredPort: 20123,
    portWindow: 3,
    requestStatus: async (baseUrl) => {
      visited.push(baseUrl);
      if (baseUrl.endsWith(":20124")) return { ok: true, app: { name: "skill-manager" } };
      return { ok: true, app: { name: "another-app" } };
    }
  });

  assert.equal(result, "http://127.0.0.1:20124");
  assert.deepEqual(visited, ["http://127.0.0.1:20123", "http://127.0.0.1:20124"]);
});

test("findApiBaseUrl honors an explicit URL without probing", async () => {
  let probed = false;
  const result = await findApiBaseUrl({ url: "http://127.0.0.1:29999/" }, {
    requestStatus: async () => {
      probed = true;
      return {};
    }
  });

  assert.equal(result, "http://127.0.0.1:29999");
  assert.equal(probed, false);
});
