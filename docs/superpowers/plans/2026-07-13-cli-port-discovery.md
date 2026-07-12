# Skill Manager CLI Dynamic Port Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Skill Manager CLI discover the App's configured API port automatically while keeping the Agent skill entirely CLI-oriented.

**Architecture:** Keep connection discovery inside the packaged CommonJS CLI. Resolve the Electron-compatible settings path per platform, read and validate `apiPort`, then probe from that configured start while verifying `/api/status` identifies Skill Manager; explicit URL overrides remain diagnostic-only CLI features. Test pure path/port helpers and injected discovery behavior with Node's built-in test runner.

**Tech Stack:** Node.js CommonJS, Node `node:test`, Electron settings JSON, Markdown Agent Skills, Skill Manager CLI publishing.

## Global Constraints

- Agent skill examples use only `skill-manager` CLI commands.
- Agent skill contains no fixed port, curl command, HTTP endpoint, or `SKILL_MANAGER_API_URL`.
- CLI keeps `--url` and `SKILL_MANAGER_API_URL` as advanced manual overrides.
- No new runtime or test dependency.
- Preserve unrelated uncommitted workspace changes.

---

### Task 1: Config-Aware CLI Discovery

**Files:**
- Modify: `bin/skill-manager-cli.cjs`
- Create: `test/skill-manager-cli.test.cjs`

**Interfaces:**
- Produces: `settingsFilePath({ platform, homeDir, env }): string`
- Produces: `readConfiguredPort(options): Promise<number>`
- Produces: `findApiBaseUrl(args, options): Promise<string>`
- Produces: `isSkillManagerStatus(payload): boolean`

- [ ] **Step 1: Write failing tests**

Test macOS, Windows, and Linux settings paths; valid and invalid `apiPort` values; configured-port-first probing; fallback to the following port; rejection of unrelated `{ ok: true }` services; and explicit URL override without probing.

```js
test("findApiBaseUrl probes the configured port first and validates app identity", async () => {
  const visited = [];
  const result = await findApiBaseUrl({}, {
    configuredPort: 20123,
    requestStatus: async (baseUrl) => {
      visited.push(baseUrl);
      if (baseUrl.endsWith(":20124")) return { ok: true, app: { name: "skill-manager" } };
      return { ok: true, app: { name: "another-app" } };
    }
  });
  assert.equal(result, "http://127.0.0.1:20124");
  assert.deepEqual(visited, ["http://127.0.0.1:20123", "http://127.0.0.1:20124"]);
});
```

- [ ] **Step 2: Run the focused test to verify RED**

Run: `node --test test/skill-manager-cli.test.cjs`

Expected: FAIL because the CLI does not export the required helpers.

- [ ] **Step 3: Implement settings path and port parsing**

Use `os.homedir()`, `path.join`, and `fs/promises.readFile`. Accept only integer ports from 1024 through 65535; otherwise return `DEFAULT_START_PORT`.

- [ ] **Step 4: Implement identity-aware discovery with dependency injection**

Treat a status as valid only when `payload.ok === true` and `payload.app.name === "skill-manager"`. Explicit overrides are returned as-is; automatic discovery probes from the configured port for `DEFAULT_PORT_WINDOW` candidates. Export helpers and call `main()` only under `require.main === module`.

- [ ] **Step 5: Run focused and full tests to verify GREEN**

Run: `node --test test/skill-manager-cli.test.cjs && npm test`

Expected: all CLI and existing settings utility tests pass.

### Task 2: CLI-Only Skill Documentation

**Files:**
- Modify: `skills/skill-manager/SKILL.md`
- Modify: `/Users/wu/.codex/skills/skill-manager/SKILL.md`

**Interfaces:**
- Consumes: packaged `skill-manager` CLI and its automatic App connection discovery.
- Produces: identical built-in and Codex-installed CLI-only skill instructions.

- [ ] **Step 1: Rewrite the built-in skill**

Change the description to CLI lifecycle management, state that agents must not call the local API directly, retain CLI command examples and packaged executable lookup, and remove all API/port/curl/environment-variable content.

- [ ] **Step 2: Synchronize the Codex-installed copy**

Apply the same content to `/Users/wu/.codex/skills/skill-manager/SKILL.md` and verify both files are byte-identical before publishing.

- [ ] **Step 3: Validate the documentation contract**

Run:

```bash
cmp skills/skill-manager/SKILL.md /Users/wu/.codex/skills/skill-manager/SKILL.md
! rg -n '19010|curl|/api/|SKILL_MANAGER_API_URL|http://|https://' skills/skill-manager/SKILL.md
```

Expected: files match and the forbidden-pattern search returns no matches.

### Task 3: End-to-End Verification and Skill Publication

**Files:**
- Verify: `bin/skill-manager-cli.cjs`
- Verify: `skills/skill-manager/SKILL.md`
- Verify: `/Users/wu/.codex/skills/skill-manager/SKILL.md`

**Interfaces:**
- Consumes: completed CLI and skill documentation.
- Produces: a published, active Skill Manager version for the Codex-installed skill.

- [ ] **Step 1: Verify CLI against the currently configured App**

Run the repository wrapper with `status` and confirm it reaches the active Skill Manager instance without `--url`.

- [ ] **Step 2: Run full project verification**

Run: `npm test && npm run build && git diff --check`

Expected: all tests pass, Vite production build succeeds, and no whitespace errors are reported.

- [ ] **Step 3: Publish through the CLI**

Run:

```bash
bin/skill-manager publish --agent Codex --skill skill-manager --message "改为仅使用 CLI，并支持从 App 配置动态发现 API 端口。"
```

Expected: Skill Manager creates a new active version and reports its version ID.

- [ ] **Step 4: Verify the published record and installed content**

Use `bin/skill-manager scan --scope installed` and `bin/skill-manager events` to confirm the active Codex skill is present, its content is CLI-only, and publication completed successfully.
