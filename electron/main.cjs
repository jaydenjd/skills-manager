const { app, BrowserWindow, ipcMain, shell } = require("electron");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const https = require("node:https");
const path = require("node:path");
const AdmZip = require("adm-zip");
const { scanSkills, defaultSources, defaultIgnorePatterns, expandHome } = require("./scanner.cjs");

const isDev = !app.isPackaged;
let storeFile = "";
let storeCache = {};
let historyDir = "";
const uninstallMetaFile = ".skill-manager-uninstall.json";
const legacyUninstallMetaFile = ".skill-studio-uninstall.json";
const removedDefaultSourceIds = new Set([
  "codex-system",
  "codex-plugins",
  "cursor",
  "qoderwork-kb",
  "qoderwork-workspace",
  "qwen",
  "kiro",
  "openclaw-workspace",
  "opencode",
  "iflow"
]);

function managedDataDir() {
  return path.join(app.getPath("userData"), "managed-skills");
}

function managedSkillsDir() {
  return path.join(managedDataDir(), "skills");
}

function uninstalledSkillsDir() {
  return path.join(managedDataDir(), "uninstalled");
}

function legacyManagedSkillsDir() {
  return path.join(app.getPath("home"), ".skills-manager", "skills");
}

function legacyUninstalledSkillsDir() {
  return path.join(app.getPath("home"), ".skills-manager", "uninstalled");
}

function defaultSettings() {
  return {
    sources: defaultSources(),
    ignorePatterns: defaultIgnorePatterns(),
    installSourceId: "agents",
    baselineSourceId: "agents",
    installTargetMode: "remember-last",
    mergeDuplicateSkills: true,
    logRetentionDays: null,
    eventRetentionDays: null
  };
}

function normalizeSources(sources) {
  const next = (Array.isArray(sources) ? sources : defaultSources()).filter((source) => !removedDefaultSourceIds.has(source.id));
  return next.length ? next : defaultSources();
}

function normalizeRetentionDays(value) {
  if (value === null || value === undefined || value === "" || value === "forever") return null;
  const days = Number(value);
  return Number.isFinite(days) && days > 0 ? Math.floor(days) : null;
}

function getSettings() {
  const sources = normalizeSources(getStoreValue("sources", defaultSources()));
  const installSourceId = getStoreValue("installSourceId", "agents");
  const baselineSourceId = getStoreValue("baselineSourceId", "agents");
  return {
    sources,
    ignorePatterns: getStoreValue("ignorePatterns", defaultIgnorePatterns()),
    installSourceId: sources.some((source) => source.id === installSourceId) ? installSourceId : "agents",
    baselineSourceId: sources.some((source) => source.id === baselineSourceId) ? baselineSourceId : "agents",
    installTargetMode: getStoreValue("installTargetMode", "remember-last"),
    mergeDuplicateSkills: getStoreValue("mergeDuplicateSkills", true),
    logRetentionDays: normalizeRetentionDays(getStoreValue("logRetentionDays", null)),
    eventRetentionDays: normalizeRetentionDays(getStoreValue("eventRetentionDays", null))
  };
}

function saveSettings(settings) {
  const sources = normalizeSources(settings?.sources);
  const next = {
    sources,
    ignorePatterns: Array.isArray(settings?.ignorePatterns) ? settings.ignorePatterns : defaultIgnorePatterns(),
    installSourceId: sources.some((source) => source.id === settings?.installSourceId) ? settings.installSourceId : "agents",
    baselineSourceId: sources.some((source) => source.id === settings?.baselineSourceId) ? settings.baselineSourceId : "agents",
    installTargetMode: settings?.installTargetMode === "always-default" ? "always-default" : "remember-last",
    mergeDuplicateSkills: settings?.mergeDuplicateSkills !== false,
    logRetentionDays: normalizeRetentionDays(settings?.logRetentionDays),
    eventRetentionDays: normalizeRetentionDays(settings?.eventRetentionDays)
  };
  setStoreValue("sources", next.sources);
  setStoreValue("ignorePatterns", next.ignorePatterns);
  setStoreValue("installSourceId", next.installSourceId);
  setStoreValue("baselineSourceId", next.baselineSourceId);
  setStoreValue("installTargetMode", next.installTargetMode);
  setStoreValue("mergeDuplicateSkills", next.mergeDuplicateSkills);
  setStoreValue("logRetentionDays", next.logRetentionDays);
  setStoreValue("eventRetentionDays", next.eventRetentionDays);
  pruneOperationStores(next);
  return getSettings();
}

function sourceLabelById(settings, id) {
  return settings.sources.find((source) => source.id === id)?.client || id || "-";
}

function settingModeLabel(mode) {
  return mode === "always-default" ? "每次使用默认 Agent" : "记住上次选择";
}

function summarizeSettingsChange(before, after) {
  const changes = [];
  if (before.installSourceId !== after.installSourceId) {
    changes.push(`默认安装目标：${sourceLabelById(before, before.installSourceId)} -> ${sourceLabelById(after, after.installSourceId)}`);
  }
  if (before.baselineSourceId !== after.baselineSourceId) {
    changes.push(`默认基准 Agent：${sourceLabelById(before, before.baselineSourceId)} -> ${sourceLabelById(after, after.baselineSourceId)}`);
  }
  if (before.installTargetMode !== after.installTargetMode) {
    changes.push(`安装弹窗默认选择：${settingModeLabel(before.installTargetMode)} -> ${settingModeLabel(after.installTargetMode)}`);
  }
  if (before.mergeDuplicateSkills !== after.mergeDuplicateSkills) {
    changes.push(`All Agents 同名合并：${before.mergeDuplicateSkills ? "开启" : "关闭"} -> ${after.mergeDuplicateSkills ? "开启" : "关闭"}`);
  }

  const beforeIgnore = (before.ignorePatterns || []).join("\n");
  const afterIgnore = (after.ignorePatterns || []).join("\n");
  if (beforeIgnore !== afterIgnore) {
    changes.push(`Ignore 规则：${before.ignorePatterns.length} -> ${after.ignorePatterns.length}`);
  }

  const beforeSources = new Map((before.sources || []).map((source) => [source.id, source]));
  const afterSources = new Map((after.sources || []).map((source) => [source.id, source]));
  const added = [...afterSources.keys()].filter((id) => !beforeSources.has(id));
  const removed = [...beforeSources.keys()].filter((id) => !afterSources.has(id));
  const changed = [...afterSources.keys()].filter((id) => {
    const oldSource = beforeSources.get(id);
    const newSource = afterSources.get(id);
    if (!oldSource || !newSource) return false;
    return ["client", "label", "root", "enabled"].some((key) => oldSource[key] !== newSource[key]);
  });

  if (added.length) changes.push(`新增 Agent：${added.map((id) => sourceLabelById(after, id)).join(", ")}`);
  if (removed.length) changes.push(`移除 Agent：${removed.map((id) => sourceLabelById(before, id)).join(", ")}`);
  if (changed.length) changes.push(`修改 Agent：${changed.map((id) => sourceLabelById(after, id)).join(", ")}`);

  return changes.length ? changes.join("；") : "无配置变化";
}

function installRootFor(sourceId) {
  const settings = getSettings();
  const sources = settings.sources.length ? settings.sources : defaultSources();
  const selected = sources.find((source) => source.id === sourceId) || sources.find((source) => source.id === settings.installSourceId) || sources.find((source) => source.id === "agents");
  return selected?.root ? expandHome(selected.root) : path.join(app.getPath("home"), ".agents", "skills");
}

function safeName(input) {
  return String(input).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "skill";
}

function normalizeCommandError(command, error, stderr = "") {
  const output = `${error?.message || ""}\n${stderr || ""}`;
  if (/xcode license agreements|xcodebuild -license/i.test(output)) {
    const friendly = new Error(
      `${command} 无法运行：这台 Mac 还没有同意 Xcode/Apple SDK 许可。请在 Terminal 执行 sudo xcodebuild -license，按提示同意后再重试。`
    );
    friendly.code = "XCODE_LICENSE_NOT_ACCEPTED";
    friendly.cause = error;
    return friendly;
  }
  if (/xcrun: error|invalid active developer path|install the command line developer tools/i.test(output)) {
    const friendly = new Error(
      `${command} 无法运行：这台 Mac 缺少或未配置 Apple Command Line Tools。请在 Terminal 执行 xcode-select --install 后再重试。`
    );
    friendly.code = "COMMAND_LINE_TOOLS_MISSING";
    friendly.cause = error;
    return friendly;
  }
  error.message = `${error.message}\n${stderr || ""}`.trim();
  return error;
}

function execFileAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(normalizeCommandError(command, error, stderr));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function readStore() {
  try {
    storeCache = JSON.parse(fs.readFileSync(storeFile, "utf8"));
  } catch {
    storeCache = {};
  }
}

function getStoreValue(key, fallback) {
  return Object.prototype.hasOwnProperty.call(storeCache, key) ? storeCache[key] : fallback;
}

function setStoreValue(key, value) {
  storeCache[key] = value;
  fs.mkdirSync(path.dirname(storeFile), { recursive: true });
  fs.writeFileSync(storeFile, JSON.stringify(storeCache, null, 2));
}

async function moveDirectoryContents(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir) || path.resolve(sourceDir) === path.resolve(targetDir)) return;
  await fsp.mkdir(targetDir, { recursive: true });
  let entries = [];
  try {
    entries = await fsp.readdir(sourceDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const source = path.join(sourceDir, entry.name);
    const baseTarget = path.join(targetDir, entry.name);
    let target = baseTarget;
    let index = 1;
    while (fs.existsSync(target)) {
      target = `${baseTarget}-${index}`;
      index += 1;
    }
    await fsp.rename(source, target).catch(async () => {
      if (entry.isDirectory()) {
        await fsp.cp(source, target, { recursive: true, force: false });
        await fsp.rm(source, { recursive: true, force: true });
      }
    });
  }
  await fsp.rmdir(sourceDir).catch(() => {});
  await fsp.rmdir(path.dirname(sourceDir)).catch(() => {});
}

async function migrateLegacyManagedDirectories() {
  await moveDirectoryContents(legacyUninstalledSkillsDir(), uninstalledSkillsDir());
  await moveDirectoryContents(legacyManagedSkillsDir(), managedSkillsDir());
}

function pruneEntriesByRetention(entries, retentionDays, dateKeys) {
  const days = normalizeRetentionDays(retentionDays);
  if (!days) return Array.isArray(entries) ? entries : [];
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return (Array.isArray(entries) ? entries : []).filter((entry) => {
    const value = dateKeys.map((key) => entry?.[key]).find(Boolean);
    if (!value) return true;
    const time = new Date(value).getTime();
    return Number.isNaN(time) || time >= cutoff;
  });
}

function pruneOperationStores(settings = getSettings()) {
  const logs = pruneEntriesByRetention(getStoreValue("operationLogs", []), settings.logRetentionDays, ["createdAt", "updatedAt"]);
  const events = pruneEntriesByRetention(getStoreValue("operationEvents", []), settings.eventRetentionDays, ["updatedAt", "createdAt"]);
  setStoreValue("operationLogs", logs);
  setStoreValue("operationEvents", events);
  return { logs, events };
}

function getOperationLogs() {
  const settings = getSettings();
  const logs = pruneEntriesByRetention(getStoreValue("operationLogs", []), settings.logRetentionDays, ["createdAt", "updatedAt"]);
  if (logs.length !== getStoreValue("operationLogs", []).length) setStoreValue("operationLogs", logs);
  return logs;
}

function appendOperationLog(entry) {
  const logs = getOperationLogs();
  const next = [{
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    ...entry
  }, ...logs];
  setStoreValue("operationLogs", next);
  return next[0];
}

function getOperationEvents() {
  const settings = getSettings();
  const events = pruneEntriesByRetention(getStoreValue("operationEvents", []), settings.eventRetentionDays, ["updatedAt", "createdAt"]);
  if (events.length !== getStoreValue("operationEvents", []).length) setStoreValue("operationEvents", events);
  return events;
}

function setOperationEvents(events) {
  const settings = getSettings();
  setStoreValue("operationEvents", pruneEntriesByRetention(events, settings.eventRetentionDays, ["updatedAt", "createdAt"]));
}

function createOperationEvent(entry) {
  const now = new Date().toISOString();
  const event = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: entry.type,
    title: entry.title,
    detail: entry.detail || "",
    status: "queued",
    progress: 0,
    total: entry.total || 1,
    current: "",
    createdAt: now,
    updatedAt: now,
    startedAt: "",
    finishedAt: "",
    error: ""
  };
  setOperationEvents([event, ...getOperationEvents()]);
  return event;
}

function updateOperationEvent(id, patch) {
  const now = new Date().toISOString();
  let updated = null;
  const next = getOperationEvents().map((event) => {
    if (event.id !== id) return event;
    updated = { ...event, ...patch, updatedAt: now };
    return updated;
  });
  setOperationEvents(next);
  return updated;
}

function historyKey(filePath) {
  return Buffer.from(filePath).toString("base64url");
}

function historyPaths(filePath) {
  const dir = path.join(historyDir, historyKey(filePath));
  return {
    dir,
    index: path.join(dir, "index.json")
  };
}

function contentHash(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function readHistoryIndex(filePath) {
  const paths = historyPaths(filePath);
  try {
    const raw = await fsp.readFile(paths.index, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeHistoryIndex(filePath, entries) {
  const paths = historyPaths(filePath);
  await fsp.mkdir(paths.dir, { recursive: true });
  await fsp.writeFile(paths.index, JSON.stringify(entries, null, 2));
}

async function createVersionSnapshot(filePath, reason) {
  const stats = await fsp.stat(filePath);
  if (stats.isDirectory() || stats.size > 2 * 1024 * 1024) return null;
  const buffer = await fsp.readFile(filePath);
  if (buffer.includes(0)) return null;
  const hash = contentHash(buffer);
  const paths = historyPaths(filePath);
  await fsp.mkdir(paths.dir, { recursive: true });
  const entries = await readHistoryIndex(filePath);
  if (entries[0]?.hash === hash) return null;
  const now = new Date();
  const id = `${now.toISOString().replace(/[:.]/g, "-")}-${Math.random().toString(16).slice(2, 8)}`;
  const versionFile = path.join(paths.dir, `${id}.txt`);
  await fsp.writeFile(versionFile, buffer);
  const entry = {
    id,
    reason,
    filePath,
    snapshotPath: versionFile,
    hash,
    size: stats.size,
    createdAt: now.toISOString()
  };
  entries.unshift(entry);
  await writeHistoryIndex(filePath, entries.slice(0, 60));
  return entry;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        "User-Agent": "Skill-Manager",
        "Accept": "application/vnd.github+json"
      }
    }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`GitHub ${response.statusCode}: ${body.slice(0, 180)}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.setTimeout(12000, () => {
      request.destroy(new Error("GitHub trends request timed out"));
    });
    request.on("error", reject);
  });
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { "User-Agent": "Skill-Manager" } }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`HTTP ${response.statusCode}: ${body.slice(0, 180)}`));
          return;
        }
        resolve(body);
      });
    });
    request.setTimeout(12000, () => {
      request.destroy(new Error("Request timed out"));
    });
    request.on("error", reject);
  });
}

function fetchBuffer(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { "User-Agent": "Skill-Manager" } }, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        if (redirects > 5) {
          reject(new Error("下载 GitHub zip 时重定向次数过多。"));
          return;
        }
        const nextUrl = new URL(response.headers.location, url).toString();
        response.resume();
        fetchBuffer(nextUrl, redirects + 1).then(resolve, reject);
        return;
      }

      const chunks = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => {
        const body = Buffer.concat(chunks);
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`HTTP ${response.statusCode}: ${body.toString("utf8", 0, 180)}`));
          return;
        }
        resolve(body);
      });
    });
    request.setTimeout(180000, () => {
      request.destroy(new Error("下载 GitHub zip 超时。"));
    });
    request.on("error", reject);
  });
}

function decodeHtml(input = "") {
  return String(input)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, value) => String.fromCodePoint(parseInt(value, 16)))
    .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(parseInt(value, 10)));
}

function stripHtml(input = "") {
  return decodeHtml(String(input).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function htmlToText(input = "") {
  return decodeHtml(String(input)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h1|h2|h3|li|pre)>/gi, "\n")
    .replace(/<li>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim());
}

function githubRepoFullName(repoUrlOrFullName = "") {
  const value = String(repoUrlOrFullName || "").trim();
  if (/^[\w.-]+\/[\w.-]+$/.test(value)) return value;
  const match = value.match(/github\.com[:/]([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:[/?#]|$)/i);
  if (!match) return "";
  return `${match[1]}/${match[2].replace(/\.git$/i, "")}`;
}

async function extractZipBuffer(zipBuffer, destination) {
  const zip = new AdmZip(zipBuffer);
  const destinationRoot = path.resolve(destination);
  await fsp.mkdir(destinationRoot, { recursive: true });

  for (const entry of zip.getEntries()) {
    const outputPath = path.resolve(destinationRoot, entry.entryName);
    if (!outputPath.startsWith(destinationRoot + path.sep) && outputPath !== destinationRoot) {
      throw new Error("GitHub zip 包含不安全路径，已拒绝解压。");
    }
    if (entry.isDirectory) {
      await fsp.mkdir(outputPath, { recursive: true });
      continue;
    }
    await fsp.mkdir(path.dirname(outputPath), { recursive: true });
    await fsp.writeFile(outputPath, entry.getData());
  }
}

async function downloadGithubRepoZip(repoFullName, destination) {
  if (!repoFullName) throw new Error("无法识别 GitHub 仓库地址。");
  const zipUrl = `https://api.github.com/repos/${repoFullName}/zipball`;
  const zipBuffer = await fetchBuffer(zipUrl);
  await extractZipBuffer(zipBuffer, destination);
  const entries = await fsp.readdir(destination, { withFileTypes: true });
  const rootDir = entries.find((entry) => entry.isDirectory());
  if (!rootDir) throw new Error("GitHub zip 解压后没有找到仓库目录。");
  return path.join(destination, rootDir.name);
}

async function cloneGithubRepoWithFallback(repoUrl, destination, fallbackRoot) {
  try {
    await execFileAsync("git", ["clone", "--depth", "1", repoUrl, destination], { timeout: 180000 });
    return { repoDir: destination, method: "git-clone" };
  } catch (gitError) {
    const repoFullName = githubRepoFullName(repoUrl);
    if (!repoFullName) throw gitError;
    const zipDestination = path.join(fallbackRoot, "zip");
    try {
      const repoDir = await downloadGithubRepoZip(repoFullName, zipDestination);
      return { repoDir, method: "github-zip", gitError };
    } catch (zipError) {
      zipError.message = `git clone 失败，GitHub zip fallback 也失败：${zipError.message}\n原始 git 错误：${gitError.message || String(gitError)}`;
      throw zipError;
    }
  }
}

function compactNumber(value) {
  if (!Number.isFinite(value)) return "";
  if (value >= 1000000) return `${(value / 1000000).toFixed(value >= 10000000 ? 0 : 1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 100000 ? 0 : 1)}K`;
  return String(Math.round(value));
}

function parseSkillsShTabs(html) {
  const allTimeLabel = decodeHtml(html.match(/>All Time \(([^)]+)\)<\/a>/)?.[1] || "");
  return {
    alltime: allTimeLabel,
    trending: "24h",
    hot: ""
  };
}

function extractInitialSkills(html) {
  const marker = "\\\"initialSkills\\\":";
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return [];
  const start = html.indexOf("[", markerIndex + marker.length);
  if (start < 0) return [];
  let depth = 0;
  let end = -1;
  for (let index = start; index < html.length; index += 1) {
    if (html[index] === "[") depth += 1;
    if (html[index] === "]") {
      depth -= 1;
      if (depth === 0) {
        end = index;
        break;
      }
    }
  }
  if (end < 0) return [];
  try {
    return JSON.parse(html.slice(start, end + 1).replace(/\\"/g, "\"").replace(/\\n/g, "\n").replace(/\\\\/g, "\\"));
  } catch {
    return [];
  }
}

function skillFromSkillsShRecord(record, index, mode) {
  const fullName = record.source || "";
  const name = record.skillId || record.name || "";
  const weeklyTotal = Array.isArray(record.weeklyInstalls) ? record.weeklyInstalls.reduce((total, value) => total + Number(value || 0), 0) : 0;
  return {
    id: `skillssh:${fullName}/${name}`,
    name,
    fullName,
    description: record.description || `${name} from ${fullName}`,
    url: `https://www.skills.sh/${fullName}/${name}`,
    repositoryUrl: fullName.includes("/") ? `https://github.com/${fullName}` : `https://www.skills.sh/${fullName}/${name}`,
    source: "skillssh",
    sourceLabel: "skills.sh",
    sourceName: fullName,
    sourceUrl: "https://www.skills.sh/",
    discoverMode: mode,
    rank: index + 1,
    installsLabel: compactNumber(Number(record.installs || 0)),
    weeklyLabel: weeklyTotal ? compactNumber(weeklyTotal) : "",
    changeLabel: Number.isFinite(record.change) ? String(record.change) : "",
    stars: 0,
    language: "Agent skill",
    updatedAt: new Date().toISOString(),
    installCommand: `npx --yes skills add https://github.com/${fullName} --skill ${name}`,
    installMethod: "skills-cli",
    official: Boolean(record.isOfficial)
  };
}

async function findSkillDirectory(root, skillName) {
  const wanted = String(skillName || "").toLowerCase();
  const candidates = [];

  async function walk(dir, depth) {
    if (depth > 6) return;
    let entries = [];
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    const hasSkillMd = entries.some((entry) => entry.isFile() && entry.name === "SKILL.md");
    if (hasSkillMd) {
      const skillFile = path.join(dir, "SKILL.md");
      let frontmatterName = "";
      try {
        const raw = await fsp.readFile(skillFile, "utf8");
        frontmatterName = raw.match(/^---[\s\S]*?\nname:\s*["']?([^"'\n]+)["']?/m)?.[1]?.trim() || "";
      } catch {
        frontmatterName = "";
      }
      const base = path.basename(dir).toLowerCase();
      const fm = frontmatterName.toLowerCase();
      candidates.push({
        dir,
        score: (base === wanted ? 100 : 0) + (fm === wanted ? 90 : 0) + (dir === root ? 5 : 0)
      });
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if ([".git", "node_modules", "__pycache__"].includes(entry.name)) continue;
      await walk(path.join(dir, entry.name), depth + 1);
    }
  }

  await walk(root, 0);
  candidates.sort((a, b) => b.score - a.score || a.dir.length - b.dir.length);
  if (!candidates.length) throw new Error("仓库里没有找到 SKILL.md。");
  return candidates[0].dir;
}

function parseSkillsShLeaderboard(html, mode = "alltime") {
  const tabLabels = parseSkillsShTabs(html);
  const initialSkills = extractInitialSkills(html);
  const items = initialSkills.length ? initialSkills.map((record, index) => skillFromSkillsShRecord(record, index, mode)) : (html.match(/<a class="group[\s\S]*?<\/a>/g) || []).map((chunk, index) => {
    const href = chunk.match(/href="\/([^"]+)"/)?.[1] || "";
    const parts = href.split("/");
    const name = decodeHtml(chunk.match(/<h3[^>]*>([^<]+)<\/h3>/)?.[1] || parts.at(-1) || "");
    const fullName = decodeHtml(chunk.match(/<p[^>]*>([^<]+)<\/p>/)?.[1] || parts.slice(0, 2).join("/"));
    const rank = Number(chunk.match(/<span[^>]*font-mono[^>]*>(\d+)<\/span>/)?.[1] || index + 1);
    const installSpans = [...chunk.matchAll(/<span class="font-mono text-sm text-foreground">([^<]+)<\/span>/g)];
    const installsLabel = decodeHtml(installSpans.at(-1)?.[1] || "");
    const weeklyNumbers = (chunk.match(/Weekly installs:\s*([^"]+)/)?.[1] || "")
      .split(",")
      .map((part) => Number(part.replace(/[^\d]/g, "")))
      .filter(Boolean);
    const weeklyTotal = weeklyNumbers.reduce((total, value) => total + value, 0);
    return {
      id: `skillssh:${href}`,
      name,
      fullName,
      description: `${name} from ${fullName}`,
      url: `https://www.skills.sh/${href}`,
      repositoryUrl: fullName.includes("/") ? `https://github.com/${fullName}` : `https://www.skills.sh/${href}`,
      source: "skillssh",
      sourceLabel: "skills.sh",
      sourceName: fullName,
      sourceUrl: "https://www.skills.sh/",
      discoverMode: mode,
      rank,
      installsLabel,
      weeklyLabel: weeklyTotal ? compactNumber(weeklyTotal) : "",
      stars: 0,
      language: "Agent skill",
      updatedAt: new Date().toISOString(),
      installCommand: `npx --yes skills add https://github.com/${fullName} --skill ${name}`,
      installMethod: "skills-cli"
    };
  }).filter((item) => item.name && item.fullName);
  return {
    source: "skills.sh",
    mode,
    totalLabel: mode === "alltime" ? tabLabels.alltime : "",
    tabLabels,
    items
  };
}

function parseSkillsShDetail(html, item = {}) {
  const installCommand = stripHtml(html.match(/<code class="truncate">([\s\S]*?)<\/code>/)?.[1] || item.installCommand || "");
  const summaryStart = html.indexOf(">Summary</div>");
  const summaryEnd = summaryStart >= 0 ? html.indexOf("<span>SKILL.md</span>", summaryStart) : -1;
  const summaryHtml = summaryStart >= 0 && summaryEnd > summaryStart ? html.slice(summaryStart, summaryEnd) : "";
  const summaryLead = stripHtml(summaryHtml.match(/<p>\s*<strong>([\s\S]*?)<\/strong>\s*<\/p>/)?.[1] || "");
  const summaryItems = [...summaryHtml.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((match) => stripHtml(match[1])).filter(Boolean);
  const skillMdStart = html.indexOf("<span>SKILL.md</span>");
  const skillMdHtml = skillMdStart >= 0 ? html.slice(skillMdStart, html.indexOf("<div class=\"relative\">", skillMdStart)) : "";
  const skillMdLead = stripHtml(skillMdHtml.match(/<p>([\s\S]*?)<\/p>/)?.[1] || "");
  const skillMdText = htmlToText(skillMdHtml.replace(/^.*?<div class="prose[\s\S]*?>/, ""));
  return {
    installCommand: installCommand.replace(/^\$\s*/, ""),
    summaryLead,
    summaryItems,
    skillMdLead,
    skillMdText
  };
}

function createWindow() {
  const appIcon = path.join(__dirname, "../build/icon.png");
  if (process.platform === "darwin" && app.dock && fs.existsSync(appIcon)) {
    app.dock.setIcon(appIcon);
  }
  const win = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    title: "Skill Manager",
    icon: appIcon,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#f4f1e8",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    win.loadURL("http://127.0.0.1:5173");
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

ipcMain.handle("skills:scan", async () => {
  const settings = getSettings();
  return scanSkills(settings.sources, { ignorePatterns: settings.ignorePatterns });
});

ipcMain.handle("skills:uninstalled", async () => {
  return scanSkills([
    { id: "uninstalled", client: "Uninstalled", label: "Uninstalled", root: uninstalledSkillsDir(), enabled: true }
  ], { ignorePatterns: getSettings().ignorePatterns });
});

async function performUninstallSkill(skillDir, sourceInfo = {}) {
  try {
    if (!fs.existsSync(skillDir)) {
      appendOperationLog({ type: "uninstall", status: "missing", title: path.basename(skillDir), message: "原目录不存在，已跳过卸载。", detail: skillDir });
      return { path: skillDir, missing: true };
    }
    const stats = await fsp.stat(skillDir);
    if (!stats.isDirectory()) throw new Error("只能卸载 skill 目录。");
    await fsp.mkdir(uninstalledSkillsDir(), { recursive: true });
    const target = path.join(uninstalledSkillsDir(), `${safeName(path.basename(skillDir))}-${Date.now()}`);
    await fsp.rename(skillDir, target);
    await fsp.writeFile(path.join(target, uninstallMetaFile), JSON.stringify({
      sourceDir: skillDir,
      sourceClient: sourceInfo.client || "",
      sourceId: sourceInfo.sourceId || "",
      sourceLabel: sourceInfo.sourceLabel || "",
      uninstalledAt: new Date().toISOString()
    }, null, 2));
    appendOperationLog({ type: "uninstall", status: "success", title: path.basename(skillDir), message: "已移动到 Uninstalled。", detail: `${skillDir} -> ${target}` });
    return { path: target };
  } catch (error) {
    appendOperationLog({ type: "uninstall", status: "failed", title: path.basename(skillDir), message: error.message || String(error), detail: skillDir });
    throw error;
  }
}

ipcMain.handle("skills:uninstall", async (_event, skillDir) => performUninstallSkill(skillDir));

async function performRestoreSkill(skillDir, targetSourceId) {
  try {
    if (!fs.existsSync(skillDir)) {
      appendOperationLog({ type: "restore", status: "missing", title: path.basename(skillDir), message: "Uninstalled 目录不存在，已跳过恢复。", detail: skillDir });
      return { path: skillDir, missing: true };
    }
    const stats = await fsp.stat(skillDir);
    if (!stats.isDirectory()) throw new Error("只能恢复 skill 目录。");
    const targetRoot = installRootFor(targetSourceId || getSettings().installSourceId);
    await fsp.mkdir(targetRoot, { recursive: true });
    const target = path.join(targetRoot, safeName(path.basename(skillDir).replace(/-\d+$/, "")));
    let finalTarget = target;
    let index = 1;
    while (fs.existsSync(finalTarget)) {
      finalTarget = `${target}-${index}`;
      index += 1;
    }
    await fsp.rename(skillDir, finalTarget);
    await fsp.rm(path.join(finalTarget, uninstallMetaFile), { force: true }).catch(() => {});
    await fsp.rm(path.join(finalTarget, legacyUninstallMetaFile), { force: true }).catch(() => {});
    appendOperationLog({ type: "restore", status: "success", title: path.basename(finalTarget), message: "已恢复安装。", detail: `${skillDir} -> ${finalTarget}` });
    return { path: finalTarget };
  } catch (error) {
    appendOperationLog({ type: "restore", status: "failed", title: path.basename(skillDir), message: error.message || String(error), detail: skillDir });
    throw error;
  }
}

ipcMain.handle("skills:restore", async (_event, skillDir, targetSourceId) => performRestoreSkill(skillDir, targetSourceId));

async function performInstallLocalSkill(skillDir, targetSourceId) {
  const installRoot = installRootFor(targetSourceId || getSettings().installSourceId);
  const target = path.join(installRoot, safeName(path.basename(skillDir)));
  try {
    if (!fs.existsSync(skillDir)) {
      appendOperationLog({ type: "install", status: "missing", title: path.basename(skillDir), message: "本地 skill 目录不存在，已跳过安装。", detail: skillDir });
      return { path: skillDir, missing: true };
    }
    const stats = await fsp.stat(skillDir);
    if (!stats.isDirectory()) throw new Error("只能安装 skill 目录。");
    await fsp.mkdir(installRoot, { recursive: true });
    if (path.resolve(skillDir) === path.resolve(target)) {
      appendOperationLog({ type: "install", status: "skipped", title: path.basename(skillDir), message: "目标 Agent 已经是当前目录。", detail: target });
      return { path: target, installed: true, alreadyInstalled: true };
    }
    if (fs.existsSync(target)) {
      appendOperationLog({ type: "install", status: "skipped", title: path.basename(skillDir), message: "目标 Agent 已存在同名 skill。", detail: target });
      return { path: target, installed: true, alreadyInstalled: true };
    }
    await fsp.cp(skillDir, target, { recursive: true, force: true });
    await fsp.rm(path.join(target, uninstallMetaFile), { force: true }).catch(() => {});
    await fsp.rm(path.join(target, legacyUninstallMetaFile), { force: true }).catch(() => {});
    appendOperationLog({ type: "install", status: "success", title: path.basename(skillDir), message: "已复制安装到指定 Agent。", detail: `${skillDir} -> ${target}` });
    return { path: target, installed: true };
  } catch (error) {
    appendOperationLog({ type: "install", status: "failed", title: path.basename(skillDir), message: error.message || String(error), detail: `${skillDir} -> ${target}` });
    throw error;
  }
}

ipcMain.handle("skills:install-local", async (_event, skillDir, targetSourceId) => performInstallLocalSkill(skillDir, targetSourceId));

ipcMain.handle("skills:reveal", async (_event, filePath) => {
  shell.showItemInFolder(filePath);
  return true;
});

ipcMain.handle("skills:open", async (_event, filePath) => {
  if (/^https?:\/\//.test(filePath)) {
    await shell.openExternal(filePath);
    return true;
  }
  await shell.openPath(filePath);
  return true;
});

ipcMain.handle("files:read", async (_event, filePath) => {
  const stats = await fsp.stat(filePath);
  if (stats.isDirectory()) {
    return { path: filePath, type: "directory", content: "", size: 0 };
  }
  if (stats.size > 2 * 1024 * 1024) {
    throw new Error("文件超过 2MB，请用外部编辑器打开。");
  }
  const buffer = await fsp.readFile(filePath);
  if (buffer.includes(0)) {
    throw new Error("这看起来是二进制文件，请用外部编辑器打开。");
  }
  return {
    path: filePath,
    type: "file",
    content: buffer.toString("utf8"),
    size: stats.size,
    updatedAt: stats.mtime.toISOString()
  };
});

ipcMain.handle("files:save", async (_event, filePath, content) => {
  const current = await fsp.readFile(filePath);
  if (contentHash(current) === contentHash(Buffer.from(content, "utf8"))) {
    const stats = await fsp.stat(filePath);
    return { path: filePath, size: stats.size, updatedAt: stats.mtime.toISOString(), unchanged: true };
  }
  await createVersionSnapshot(filePath, "保存前");
  await fsp.writeFile(filePath, content, "utf8");
  const stats = await fsp.stat(filePath);
  return { path: filePath, size: stats.size, updatedAt: stats.mtime.toISOString() };
});

ipcMain.handle("files:history", async (_event, filePath) => {
  const entries = await readHistoryIndex(filePath);
  const seen = new Set();
  const unique = [];
  for (const entry of entries) {
    let hash = entry.hash;
    if (!hash) {
      try {
        hash = contentHash(await fsp.readFile(entry.snapshotPath));
      } catch {
        hash = entry.id;
      }
    }
    if (seen.has(hash)) continue;
    seen.add(hash);
    const { snapshotPath, ...publicEntry } = { ...entry, hash };
    unique.push(publicEntry);
  }
  return unique;
});

ipcMain.handle("files:version", async (_event, filePath, versionId) => {
  const entries = await readHistoryIndex(filePath);
  const version = entries.find((entry) => entry.id === versionId);
  if (!version) throw new Error("找不到这个历史版本。");
  const content = await fsp.readFile(version.snapshotPath, "utf8");
  const current = await fsp.readFile(filePath, "utf8");
  return {
    id: version.id,
    reason: version.reason,
    createdAt: version.createdAt,
    size: version.size,
    content,
    current
  };
});

ipcMain.handle("files:restore", async (_event, filePath, versionId) => {
  const entries = await readHistoryIndex(filePath);
  const version = entries.find((entry) => entry.id === versionId);
  if (!version) throw new Error("找不到这个历史版本。");
  const content = await fsp.readFile(version.snapshotPath);
  const current = await fsp.readFile(filePath);
  if (contentHash(current) !== contentHash(content)) await createVersionSnapshot(filePath, "恢复前");
  await fsp.writeFile(filePath, content);
  const stats = await fsp.stat(filePath);
  return {
    path: filePath,
    content: content.toString("utf8"),
    size: stats.size,
    updatedAt: stats.mtime.toISOString()
  };
});

ipcMain.handle("github:trends", async (_event, source = "alltime") => {
  const skillsShUrls = {
    skillssh: "https://www.skills.sh/",
    alltime: "https://www.skills.sh/",
    trending: "https://www.skills.sh/trending",
    hot: "https://www.skills.sh/hot"
  };
  if (skillsShUrls[source]) return parseSkillsShLeaderboard(await fetchText(skillsShUrls[source]), source);
  const queries = {
    all: "agent skill SKILL.md",
    anthropic: "anthropic skills SKILL.md",
    awesome: "awesome-agent-skills",
    antigravity: "antigravity awesome skills",
    skillssh: "skills.sh skills"
  };
  const sourceLabels = {
    all: "GitHub",
    anthropic: "anthropics/skills",
    awesome: "awesome-agent-skills",
    antigravity: "antigravity-awesome-skills",
    skillssh: "skills.sh"
  };
  const query = encodeURIComponent(queries[source] || queries.all);
  const result = await fetchJson(`https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=50`);
  return (result.items || []).map((repo) => ({
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description || "",
    url: repo.html_url,
    source,
    sourceLabel: sourceLabels[source] || "GitHub",
    sourceUrl: "https://github.com",
    repositoryUrl: repo.html_url,
    installCommand: `git clone --depth 1 ${repo.html_url}`,
    installMethod: "git-clone",
    stars: repo.stargazers_count,
    language: repo.language || "Mixed",
    updatedAt: repo.updated_at
  }));
});

ipcMain.handle("discover:detail", async (_event, item) => {
  if (!item?.url || item.source !== "skillssh") return {};
  return parseSkillsShDetail(await fetchText(item.url), item);
});

async function performInstallDiscoverSkill(item, targetSourceId, forceUpdate = false) {
  if (!item?.url || !item?.fullName) throw new Error("缺少可安装的 discover 条目。");
  const installRoot = installRootFor(targetSourceId || getSettings().installSourceId);
  const target = path.join(installRoot, safeName(item.name || item.fullName));
  const repoUrl = item.repositoryUrl || (item.fullName.startsWith("http") ? item.fullName : `https://github.com/${item.fullName}`);
  let tempRoot = "";
  try {
    await fsp.mkdir(installRoot, { recursive: true });
    if (fs.existsSync(target) && !forceUpdate) {
      appendOperationLog({ type: "install", status: "skipped", title: item.name, message: "目标 Agent 已存在同名 skill。", detail: target });
      return { path: target, installed: true, alreadyInstalled: true };
    }
    if (fs.existsSync(target) && forceUpdate) await fsp.rm(target, { recursive: true, force: true });

    if (item.installMethod === "skills-cli" || item.source === "skillssh") {
      tempRoot = await fsp.mkdtemp(path.join(app.getPath("temp"), "skill-manager-install-"));
      const repoDir = path.join(tempRoot, "repo");
      const cloneResult = await cloneGithubRepoWithFallback(repoUrl, repoDir, tempRoot);
      const skillDir = await findSkillDirectory(cloneResult.repoDir, item.name);
      await fsp.cp(skillDir, target, { recursive: true, force: true });
      const message = cloneResult.method === "github-zip" ? "git 失败后，已通过 GitHub zip 安装到指定 Agent。" : "已安装到指定 Agent。";
      appendOperationLog({ type: "install", status: "success", title: item.name, message, detail: `${repoUrl} -> ${target}` });
      return { path: target, installed: true, command: item.installCommand, method: cloneResult.method === "github-zip" ? "github-zip-fallback" : "copy-from-repo" };
    }

    try {
      await execFileAsync("git", ["clone", "--depth", "1", item.url, target], { timeout: 120000 });
      appendOperationLog({ type: "install", status: "success", title: item.name, message: "已安装到指定 Agent。", detail: `${item.url} -> ${target}` });
      return { path: target, installed: true, method: "git-clone" };
    } catch (gitError) {
      const repoFullName = githubRepoFullName(item.url);
      if (!repoFullName) throw gitError;
      await fsp.rm(target, { recursive: true, force: true }).catch(() => {});
      tempRoot = await fsp.mkdtemp(path.join(app.getPath("temp"), "skill-manager-install-"));
      const repoDir = await downloadGithubRepoZip(repoFullName, path.join(tempRoot, "zip"));
      const skillDir = await findSkillDirectory(repoDir, item.name);
      await fsp.cp(skillDir, target, { recursive: true, force: true });
      appendOperationLog({ type: "install", status: "success", title: item.name, message: "git 失败后，已通过 GitHub zip 安装到指定 Agent。", detail: `${item.url} -> ${target}` });
      return { path: target, installed: true, method: "github-zip-fallback" };
    }
  } catch (error) {
    appendOperationLog({ type: "install", status: "failed", title: item.name || item.fullName, message: error.message || String(error), detail: `${repoUrl} -> ${target}` });
    throw error;
  } finally {
    if (tempRoot) await fsp.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

ipcMain.handle("discover:install", async (_event, item, targetSourceId, forceUpdate = false) => performInstallDiscoverSkill(item, targetSourceId, forceUpdate));

ipcMain.handle("sources:get", async () => getStoreValue("sources", defaultSources()));

ipcMain.handle("sources:save", async (_event, sources) => {
  setStoreValue("sources", sources);
  return getStoreValue("sources", defaultSources());
});

ipcMain.handle("settings:get", async () => getSettings());

ipcMain.handle("settings:save", async (_event, settings) => {
  const saved = saveSettings(settings);
  return saved;
});

ipcMain.handle("app:info", async () => ({
  name: app.getName(),
  version: app.getVersion(),
  isPackaged: app.isPackaged
}));

function sourceNamesForTargetIds(targetIds = []) {
  const settings = getSettings();
  return targetIds.map((id) => sourceLabelById(settings, id)).join(", ");
}

async function runOperationEvent(eventId, payload) {
  updateOperationEvent(eventId, { status: "running", startedAt: new Date().toISOString(), current: "开始执行" });
  let progress = 0;
  try {
    if (payload.type === "install-discover") {
      for (const targetId of payload.targetIds || []) {
        updateOperationEvent(eventId, { progress, current: `安装到 ${sourceNamesForTargetIds([targetId])}` });
        await performInstallDiscoverSkill(payload.item, targetId, Boolean(payload.forceUpdate));
        progress += 1;
        updateOperationEvent(eventId, { progress });
      }
    } else if (payload.type === "install-local") {
      for (const targetId of payload.targetIds || []) {
        updateOperationEvent(eventId, { progress, current: `安装到 ${sourceNamesForTargetIds([targetId])}` });
        await performInstallLocalSkill(payload.skillDir, targetId);
        progress += 1;
        updateOperationEvent(eventId, { progress });
      }
    } else if (payload.type === "restore") {
      const targetIds = payload.targetIds || [];
      for (let index = 0; index < targetIds.length; index += 1) {
        const targetId = targetIds[index];
        updateOperationEvent(eventId, { progress, current: `恢复到 ${sourceNamesForTargetIds([targetId])}` });
        if (index === targetIds.length - 1) await performRestoreSkill(payload.skillDir, targetId);
        else await performInstallLocalSkill(payload.skillDir, targetId);
        progress += 1;
        updateOperationEvent(eventId, { progress });
      }
    } else if (payload.type === "uninstall") {
      for (const skill of payload.skills || []) {
        updateOperationEvent(eventId, { progress, current: `卸载 ${skill.client || path.basename(skill.dir)}` });
        await performUninstallSkill(skill.dir, skill);
        progress += 1;
        updateOperationEvent(eventId, { progress });
      }
    }
    updateOperationEvent(eventId, { status: "success", progress, current: "完成", finishedAt: new Date().toISOString() });
  } catch (error) {
    updateOperationEvent(eventId, { status: "failed", progress, current: "失败", finishedAt: new Date().toISOString(), error: error.message || String(error) });
  }
}

ipcMain.handle("events:submit", async (_event, payload) => {
  const targetIds = payload.targetIds || [];
  const skills = payload.skills || [];
  const title = payload.title || payload.item?.name || payload.skillName || "Operation";
  const total = payload.type === "uninstall" ? Math.max(1, skills.length) : Math.max(1, targetIds.length);
  const detail = payload.type === "uninstall"
    ? `${skills.length} installed copies`
    : sourceNamesForTargetIds(targetIds);
  const event = createOperationEvent({ type: payload.type, title, total, detail });
  setTimeout(() => runOperationEvent(event.id, payload), 0);
  return event;
});

ipcMain.handle("operations:list", async () => getOperationLogs());

ipcMain.handle("operations:clear", async () => {
  setStoreValue("operationLogs", []);
  return [];
});

ipcMain.handle("events:list", async () => getOperationEvents());

ipcMain.handle("events:clear", async () => {
  setOperationEvents([]);
  return [];
});

app.whenReady().then(async () => {
  storeFile = path.join(app.getPath("userData"), "settings.json");
  historyDir = path.join(app.getPath("userData"), "history");
  readStore();
  saveSettings(getSettings());
  await migrateLegacyManagedDirectories();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
