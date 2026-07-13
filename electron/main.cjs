const { app, BrowserWindow, Menu, ipcMain, shell } = require("electron");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");
const zlib = require("node:zlib");
const AdmZip = require("adm-zip");
const matter = require("gray-matter");
const { scanSkills, scanSkillDirectory, defaultSources, defaultIgnorePatterns, expandHome } = require("./scanner.cjs");

const isDev = !app.isPackaged;
let storeFile = "";
let storeCache = {};
let historyDir = "";
let apiServer = null;
let apiActualPort = null;
const windowDragState = new Map();
const uninstallMetaFile = ".skill-manager-uninstall.json";
const legacyUninstallMetaFile = ".skill-studio-uninstall.json";
const discoverPageSize = 80;
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

function skillVersionsDir() {
  return path.join(managedDataDir(), "versions");
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
    installTargetMode: "remember-last",
    language: "zh",
    mergeDuplicateSkills: true,
    skillVersionRetentionDays: 30,
    logRetentionDays: null,
    eventRetentionDays: null,
    apiEnabled: true,
    apiPort: 19010
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

function normalizeApiPort(value) {
  const port = Number(value);
  if (!Number.isFinite(port)) return 19010;
  return Math.min(65535, Math.max(1024, Math.floor(port)));
}

function getSettings() {
  const sources = normalizeSources(getStoreValue("sources", defaultSources()));
  const installSourceId = getStoreValue("installSourceId", "agents");
  return {
    sources,
    ignorePatterns: getStoreValue("ignorePatterns", defaultIgnorePatterns()),
    installSourceId: sources.some((source) => source.id === installSourceId) ? installSourceId : "agents",
    installTargetMode: getStoreValue("installTargetMode", "remember-last"),
    language: getStoreValue("language", "zh") === "en" ? "en" : "zh",
    mergeDuplicateSkills: getStoreValue("mergeDuplicateSkills", true),
    skillVersionRetentionDays: normalizeRetentionDays(getStoreValue("skillVersionRetentionDays", 30)) || 30,
    logRetentionDays: normalizeRetentionDays(getStoreValue("logRetentionDays", null)),
    eventRetentionDays: normalizeRetentionDays(getStoreValue("eventRetentionDays", null)),
    apiEnabled: getStoreValue("apiEnabled", true) !== false,
    apiPort: normalizeApiPort(getStoreValue("apiPort", 19010))
  };
}

function saveSettings(settings, options = {}) {
  const sources = normalizeSources(settings?.sources);
  const next = {
    sources,
    ignorePatterns: Array.isArray(settings?.ignorePatterns) ? settings.ignorePatterns : defaultIgnorePatterns(),
    installSourceId: sources.some((source) => source.id === settings?.installSourceId) ? settings.installSourceId : "agents",
    installTargetMode: settings?.installTargetMode === "always-default" ? "always-default" : "remember-last",
    language: settings?.language === "en" ? "en" : "zh",
    mergeDuplicateSkills: settings?.mergeDuplicateSkills !== false,
    skillVersionRetentionDays: normalizeRetentionDays(settings?.skillVersionRetentionDays) || 30,
    logRetentionDays: normalizeRetentionDays(settings?.logRetentionDays),
    eventRetentionDays: normalizeRetentionDays(settings?.eventRetentionDays),
    apiEnabled: settings?.apiEnabled !== false,
    apiPort: normalizeApiPort(settings?.apiPort || 19010)
  };
  Object.assign(storeCache, {
    sources: next.sources,
    ignorePatterns: next.ignorePatterns,
    installSourceId: next.installSourceId,
    installTargetMode: next.installTargetMode,
    language: next.language,
    mergeDuplicateSkills: next.mergeDuplicateSkills,
    skillVersionRetentionDays: next.skillVersionRetentionDays,
    logRetentionDays: next.logRetentionDays,
    eventRetentionDays: next.eventRetentionDays,
    apiEnabled: next.apiEnabled,
    apiPort: next.apiPort,
    operationLogs: pruneEntriesByRetention(getStoreValue("operationLogs", []), next.logRetentionDays, ["createdAt", "updatedAt"]),
    operationEvents: pruneEntriesByRetention(getStoreValue("operationEvents", []), next.eventRetentionDays, ["updatedAt", "createdAt"])
  });
  if (options.write !== false) writeStore();
  return getSettings();
}

function notifyLanguageChanged(language) {
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send("settings:language-changed", language);
  });
}

function notifyOpenSettings() {
  const windows = BrowserWindow.getAllWindows();
  const targets = windows.length ? windows : [createWindow()];
  targets.forEach((window) => {
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
    const send = () => window.webContents.send("app:open-settings");
    if (window.webContents.isLoading()) {
      window.webContents.once("did-finish-load", send);
    } else {
      send();
    }
  });
}

function notifySkillsChanged(payload = {}) {
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send("skills:changed", {
      changedAt: new Date().toISOString(),
      ...payload
    });
  });
}

function setLanguage(language) {
  const current = getSettings();
  const { saved } = saveSettingsWithLog({ ...current, language: language === "en" ? "en" : "zh" });
  buildAppMenu();
  notifyLanguageChanged(saved.language);
  return saved;
}

function buildAppMenu() {
  const language = getSettings().language;
  const zh = language !== "en";
  const menu = zh ? {
    file: "文件",
    edit: "编辑",
    view: "视图",
    window: "窗口",
    help: "帮助",
    language: "语言",
    settings: "设置...",
    close: "关闭窗口",
    quit: "退出 Skill Manager",
    undo: "撤销",
    redo: "重做",
    cut: "剪切",
    copy: "复制",
    paste: "粘贴",
    selectAll: "全选",
    reload: "重新加载",
    forceReload: "强制重新加载",
    toggleDevTools: "切换开发者工具",
    resetZoom: "实际大小",
    zoomIn: "放大",
    zoomOut: "缩小",
    togglefullscreen: "切换全屏",
    minimize: "最小化",
    zoom: "缩放",
    front: "全部置于顶层",
    about: "关于 Skill Manager",
    services: "服务",
    hide: "隐藏 Skill Manager",
    hideOthers: "隐藏其他",
    unhide: "全部显示"
  } : {
    file: "File",
    edit: "Edit",
    view: "View",
    window: "Window",
    help: "Help",
    language: "Language",
    settings: "Settings...",
    close: "Close Window",
    quit: "Quit Skill Manager",
    undo: "Undo",
    redo: "Redo",
    cut: "Cut",
    copy: "Copy",
    paste: "Paste",
    selectAll: "Select All",
    reload: "Reload",
    forceReload: "Force Reload",
    toggleDevTools: "Toggle Developer Tools",
    resetZoom: "Actual Size",
    zoomIn: "Zoom In",
    zoomOut: "Zoom Out",
    togglefullscreen: "Toggle Full Screen",
    minimize: "Minimize",
    zoom: "Zoom",
    front: "Bring All to Front",
    about: "About Skill Manager",
    services: "Services",
    hide: "Hide Skill Manager",
    hideOthers: "Hide Others",
    unhide: "Show All"
  };
  const languageSubmenu = {
    label: menu.language,
    submenu: [
      {
        label: "中文",
        type: "radio",
        checked: language !== "en",
        click: () => setLanguage("zh")
      },
      {
        label: "English",
        type: "radio",
        checked: language === "en",
        click: () => setLanguage("en")
      }
    ]
  };
  const settingsMenuItem = {
    label: menu.settings,
    accelerator: "CmdOrCtrl+,",
    click: notifyOpenSettings
  };
  const template = [
    ...(process.platform === "darwin" ? [{
      label: app.name,
      submenu: [
        { role: "about", label: menu.about },
        { type: "separator" },
        settingsMenuItem,
        languageSubmenu,
        { type: "separator" },
        { role: "services", label: menu.services },
        { type: "separator" },
        { role: "hide", label: menu.hide },
        { role: "hideOthers", label: menu.hideOthers },
        { role: "unhide", label: menu.unhide },
        { type: "separator" },
        { role: "quit", label: menu.quit }
      ]
    }] : []),
    {
      label: menu.file,
      submenu: [
        ...(process.platform === "darwin" ? [
          { role: "close", label: menu.close }
        ] : [
          settingsMenuItem,
          languageSubmenu,
          { type: "separator" },
          { role: "quit", label: menu.quit }
        ])
      ]
    },
    {
      label: menu.edit,
      submenu: [
        { role: "undo", label: menu.undo },
        { role: "redo", label: menu.redo },
        { type: "separator" },
        { role: "cut", label: menu.cut },
        { role: "copy", label: menu.copy },
        { role: "paste", label: menu.paste },
        { role: "selectAll", label: menu.selectAll }
      ]
    },
    {
      label: menu.view,
      submenu: [
        { role: "reload", label: menu.reload },
        { role: "forceReload", label: menu.forceReload },
        { role: "toggleDevTools", label: menu.toggleDevTools },
        { type: "separator" },
        { role: "resetZoom", label: menu.resetZoom },
        { role: "zoomIn", label: menu.zoomIn },
        { role: "zoomOut", label: menu.zoomOut },
        { type: "separator" },
        { role: "togglefullscreen", label: menu.togglefullscreen }
      ]
    },
    {
      label: menu.window,
      submenu: [
        { role: "minimize", label: menu.minimize },
        { role: "zoom", label: menu.zoom },
        ...(process.platform === "darwin" ? [
          { type: "separator" },
          { role: "front", label: menu.front }
        ] : [
          { role: "close", label: menu.close }
        ])
      ]
    },
    {
      label: menu.help,
      submenu: [
        {
          label: "GitHub",
          click: () => shell.openExternal("https://github.com/jaydenjd/skills-manager")
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function sourceLabelById(settings, id) {
  return settings.sources.find((source) => source.id === id)?.client || id || "-";
}

function sourceByIdOrName(value, settings = getSettings()) {
  const token = String(value || "").trim();
  if (!token) return null;
  return settings.sources.find((source) => (
    source.id === token
    || source.client === token
    || source.label === token
  )) || null;
}

function settingModeLabel(mode) {
  return mode === "always-default" ? "每次使用默认 Agent" : "记住上次选择";
}

function summarizeSettingsChange(before, after) {
  const changes = [];
  if (before.installSourceId !== after.installSourceId) {
    changes.push(`默认安装目标：${sourceLabelById(before, before.installSourceId)} -> ${sourceLabelById(after, after.installSourceId)}`);
  }
  if (before.installTargetMode !== after.installTargetMode) {
    changes.push(`安装弹窗默认选择：${settingModeLabel(before.installTargetMode)} -> ${settingModeLabel(after.installTargetMode)}`);
  }
  if (before.language !== after.language) {
    changes.push(`语言：${before.language || "zh"} -> ${after.language || "zh"}`);
  }
  if (before.mergeDuplicateSkills !== after.mergeDuplicateSkills) {
    changes.push(`All Agents 同名合并：${before.mergeDuplicateSkills ? "开启" : "关闭"} -> ${after.mergeDuplicateSkills ? "开启" : "关闭"}`);
  }
  if (before.skillVersionRetentionDays !== after.skillVersionRetentionDays) {
    changes.push(`Skill 版本保留：${before.skillVersionRetentionDays} 天 -> ${after.skillVersionRetentionDays} 天`);
  }
  if (before.apiEnabled !== after.apiEnabled) {
    changes.push(`本地 API：${before.apiEnabled ? "开启" : "关闭"} -> ${after.apiEnabled ? "开启" : "关闭"}`);
  }
  if (before.apiPort !== after.apiPort) {
    changes.push(`本地 API 端口：${before.apiPort} -> ${after.apiPort}`);
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

function saveSettingsWithLog(settings) {
  const before = getSettings();
  const saved = saveSettings(settings, { write: false });
  const detail = summarizeSettingsChange(before, saved);
  if (detail !== "无配置变化") {
    const logs = pruneEntriesByRetention(getStoreValue("operationLogs", []), saved.logRetentionDays, ["createdAt", "updatedAt"]);
    storeCache.operationLogs = [{
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString(),
      type: "settings",
      status: "success",
      title: "Settings",
      message: "设置已保存。",
      detail
    }, ...logs];
  }
  writeStore();
  return { before, saved };
}

function installRootFor(sourceId) {
  const settings = getSettings();
  const sources = settings.sources.length ? settings.sources : defaultSources();
  const selected = sources.find((source) => source.id === sourceId) || sources.find((source) => source.id === settings.installSourceId) || sources.find((source) => source.id === "agents");
  return selected?.root ? expandHome(selected.root) : path.join(app.getPath("home"), ".agents", "skills");
}

function normalizeUserPathInput(value) {
  return String(value || "").trim().replace(/^["']|["']$/g, "").replace(/^～(?=$|\/|\\)/, "~");
}

function safeName(input) {
  return String(input).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "skill";
}

function formatBeijingLocalTimestamp(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(value).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}${parts.month}${parts.day}.${parts.hour}${parts.minute}${parts.second}`;
}

function localVersionLabel(value = new Date()) {
  return `v.${formatBeijingLocalTimestamp(value)}`;
}

function isGeneratedLocalVersionLabel(value = "") {
  const label = String(value || "").trim();
  return /^local\b/i.test(label) || /^v\.local\./i.test(label) || /^v\.\d{8}(?:\.\d{4,6})?$/i.test(label);
}

function normalizeConflictStrategy(value, fallback = "skip") {
  return ["skip", "replace"].includes(value) ? value : fallback;
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

function writeStore() {
  fs.mkdirSync(path.dirname(storeFile), { recursive: true });
  fs.writeFileSync(storeFile, JSON.stringify(storeCache, null, 2));
}

function setStoreValue(key, value) {
  storeCache[key] = value;
  writeStore();
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

function directoryHash(root) {
  const hash = crypto.createHash("sha256");
  function walk(dir) {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries
      .filter((entry) => ![".git", "node_modules", "__pycache__", ".DS_Store", uninstallMetaFile, legacyUninstallMetaFile].includes(entry.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((entry) => {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(root, fullPath).split(path.sep).join("/");
        hash.update(relPath);
        if (entry.isDirectory()) {
          hash.update("dir");
          walk(fullPath);
        } else if (entry.isFile()) {
          hash.update("file");
          hash.update(fs.readFileSync(fullPath));
        }
      });
  }
  walk(root);
  return hash.digest("hex");
}

function directoryUpdatedAt(root) {
  let updatedAt = 0;
  function walk(dir) {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries
      .filter((entry) => ![".git", "node_modules", "__pycache__", ".DS_Store", uninstallMetaFile, legacyUninstallMetaFile].includes(entry.name))
      .forEach((entry) => {
        const fullPath = path.join(dir, entry.name);
        let stats = null;
        try {
          stats = fs.statSync(fullPath);
        } catch {
          return;
        }
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          updatedAt = Math.max(updatedAt, stats.mtimeMs || 0);
        }
      });
  }
  walk(root);
  if (!updatedAt) {
    try {
      const stats = fs.statSync(root);
      updatedAt = stats.mtimeMs || 0;
    } catch {
      updatedAt = 0;
    }
  }
  return new Date(updatedAt || Date.now());
}

function readSkillPackageMeta(skillDir) {
  const skillFile = path.join(skillDir, "SKILL.md");
  let raw = "";
  let data = {};
  try {
    raw = fs.readFileSync(skillFile, "utf8");
    data = matter(raw).data || {};
  } catch {
    data = {};
  }
  const hasExplicitName = Boolean(data.name);
  const name = data.name || path.basename(skillDir);
  const version = data.version || data.Version || data.metadata?.version || "";
  return {
    name,
    hasExplicitName,
    version: version ? String(version) : "",
    skillKey: safeName(name).toLowerCase(),
    skillFile,
    raw
  };
}

function readUninstallMeta(skillDir) {
  for (const fileName of [uninstallMetaFile, legacyUninstallMetaFile]) {
    try {
      const filePath = path.join(skillDir, fileName);
      if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      // Ignore malformed legacy metadata and fall back to the skill package name.
    }
  }
  return {};
}

function installDirectoryNameForSkill(skillDir) {
  const meta = readSkillPackageMeta(skillDir);
  if (meta.hasExplicitName && meta.name) return safeName(meta.name);
  const uninstallMeta = readUninstallMeta(skillDir);
  if (uninstallMeta?.sourceDir) return safeName(path.basename(uninstallMeta.sourceDir));
  throw new Error("无法确定 skill 的稳定目录名：请在 SKILL.md frontmatter 中配置 name，或使用带卸载元信息的记录恢复。");
}

function bumpSkillVersion(version = "") {
  const value = String(version || "").trim();
  const semver = value.match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(.*)$/);
  if (semver) {
    const major = Number(semver[1] || 0);
    const minor = Number(semver[2] || 0);
    const patch = Number(semver[3] || 0) + 1;
    return `${major}.${minor}.${patch}`;
  }
  const trailing = value.match(/^(.*?)(\d+)$/);
  if (trailing) return `${trailing[1]}${Number(trailing[2]) + 1}`;
  return "0.1.0";
}

function normalizeVersionValue(version = "") {
  return String(version || "").trim().replace(/^v/i, "");
}

function compareSemanticVersionAsc(a = "", b = "") {
  const left = semanticVersionParts(a);
  const right = semanticVersionParts(b);
  if (!left || !right) return null;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] || 0) - (right[index] || 0);
    if (diff) return diff;
  }
  return 0;
}

function updateSkillMarkdownVersion(content, nextVersion) {
  const value = String(nextVersion || "").trim();
  if (!value) return content;
  if (content.startsWith("---")) {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (match) {
      const frontmatter = match[1];
      const eol = match[0].includes("\r\n") ? "\r\n" : "\n";
      let nextFrontmatter = "";
      if (/^version\s*:/im.test(frontmatter)) {
        nextFrontmatter = frontmatter.replace(/^version\s*:.*$/im, `version: "${value}"`);
      } else if (/^name\s*:/im.test(frontmatter)) {
        nextFrontmatter = frontmatter.replace(/^(name\s*:.*)$/im, `$1${eol}version: "${value}"`);
      } else {
        nextFrontmatter = `version: "${value}"${eol}${frontmatter}`;
      }
      return `---${eol}${nextFrontmatter}${eol}---${eol}${content.slice(match[0].length)}`;
    }
  }
  return `---\nversion: "${value}"\n---\n${content}`;
}

function versionFromSkillMarkdown(content = "") {
  try {
    const parsed = matter(content);
    const version = parsed.data?.version || parsed.data?.Version || parsed.data?.metadata?.version || "";
    return version ? String(version) : "";
  } catch {
    return "";
  }
}

function versionStore() {
  return getStoreValue("skillVersionState", { installations: {} });
}

function setVersionStore(next) {
  setStoreValue("skillVersionState", {
    installations: next?.installations || {}
  });
}

function installVersionKey(sourceId, skillKey) {
  return `${sourceId || "unknown"}:${skillKey}`;
}

function versionManifestPath(skillKey, archiveId) {
  return path.join(skillVersionsDir(), skillKey, archiveId, "manifest.json");
}

function publicManifest(manifest) {
  if (!manifest) return null;
  const { archivePath, ...rest } = manifest;
  return rest;
}

async function readVersionManifest(skillKey, archiveId) {
  try {
    return JSON.parse(await fsp.readFile(versionManifestPath(skillKey, archiveId), "utf8"));
  } catch {
    return null;
  }
}

async function listSkillVersions(skillKey) {
  const root = path.join(skillVersionsDir(), skillKey);
  let entries = [];
  try {
    entries = await fsp.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const manifests = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifest = await readVersionManifest(skillKey, entry.name);
    if (manifest) manifests.push(publicManifest(manifest));
  }
  const activeStates = Object.values(versionStore().installations || {})
    .filter((state) => state.skillKey === skillKey && state.activeArchiveId);
  const activeIds = new Set(activeStates.map((state) => state.activeArchiveId));
  const activeClientsById = new Map();
  activeStates.forEach((state) => {
    const clients = activeClientsById.get(state.activeArchiveId) || [];
    clients.push(state.sourceClient || state.sourceId || "Agent");
    activeClientsById.set(state.activeArchiveId, clients);
  });
  const retentionDays = getSettings().skillVersionRetentionDays;
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const visible = [];
  for (const manifest of manifests) {
    const createdAt = new Date(manifest.createdAt || 0).getTime();
    const expired = Number.isFinite(createdAt) && createdAt > 0 && createdAt < cutoff;
    if (expired && !activeIds.has(manifest.id)) {
      await fsp.rm(path.join(root, manifest.id), { recursive: true, force: true }).catch(() => {});
    } else {
      visible.push({
        ...manifest,
        active: activeIds.has(manifest.id),
        activeClients: activeClientsById.get(manifest.id) || []
      });
    }
  }
  return dedupeSkillVersionManifests(visible).sort(compareSkillVersionManifests);
}

async function latestManagedSemanticVersion(skillKey, sourceInfo = {}) {
  const sourceId = sourceInfo?.sourceId || "";
  const versions = await listSkillVersions(skillKey);
  const scopedVersions = sourceId
    ? versions.filter((version) => (
      version.sourceId === sourceId
      || (version.sourceIds || []).includes(sourceId)
    ))
    : versions;
  const activeVersions = [];
  if (sourceId) {
    const activeStates = Object.values(versionStore().installations || {})
      .filter((state) => state.skillKey === skillKey && state.sourceId === sourceId && state.activeArchiveId);
    for (const state of activeStates) {
      const manifest = await readVersionManifest(skillKey, state.activeArchiveId);
      if (manifest) activeVersions.push(publicManifest(manifest));
    }
  }
  const semanticVersions = [...scopedVersions, ...activeVersions]
    .filter((version) => !isGeneratedLocalVersionLabel(version.label))
    .map((version) => normalizeVersionValue(version.version || version.label))
    .filter((version) => semanticVersionParts(version));
  if (!semanticVersions.length) return "";
  return semanticVersions.sort((a, b) => compareSemanticVersionDesc(a, b) || 0)[0];
}

function versionGroupKey(manifest = {}) {
  const version = String(manifest.version || manifest.label || "").replace(/^v/i, "").trim();
  return version || manifest.label || manifest.id;
}

function dedupeSkillVersionManifests(manifests = []) {
  const groups = new Map();
  for (const manifest of manifests) {
    const key = versionGroupKey(manifest);
    const list = groups.get(key) || [];
    list.push(manifest);
    groups.set(key, list);
  }
  return [...groups.values()].map((list) => {
    const sorted = [...list].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
    const primary = sorted[0];
    const duplicateIds = sorted.map((item) => item.id);
    const activeClients = [...new Set(sorted.flatMap((item) => item.activeClients || []))];
    const sourceIds = [...new Set(sorted.map((item) => item.sourceId).filter(Boolean))];
    const sourceClients = [...new Set(sorted.map((item) => item.sourceClient).filter(Boolean))];
    return {
      ...primary,
      duplicateIds,
      active: sorted.some((item) => item.active),
      activeClients,
      sourceIds,
      sourceClients
    };
  });
}

function semanticVersionParts(value = "") {
  const text = String(value || "").replace(/^v/i, "").trim();
  const match = text.match(/^(\d+(?:\.\d+)*)(?:[-+].*)?$/);
  if (!match) return null;
  return match[1].split(".").map((part) => Number(part));
}

function compareSemanticVersionDesc(a, b) {
  const left = semanticVersionParts(a);
  const right = semanticVersionParts(b);
  if (!left || !right) return null;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (right[index] || 0) - (left[index] || 0);
    if (diff) return diff;
  }
  return 0;
}

function compareSkillVersionManifests(a, b) {
  const versionCompare = compareSemanticVersionDesc(a.version || a.label, b.version || b.label);
  if (versionCompare !== null && versionCompare !== 0) return versionCompare;
  return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
}

async function archiveSkillDirectory(skillDir, metadata = {}) {
  if (!skillDir || !fs.existsSync(skillDir)) return null;
  const stats = await fsp.stat(skillDir);
  if (!stats.isDirectory()) return null;
  const meta = readSkillPackageMeta(skillDir);
  const skillKey = metadata.skillKey || meta.skillKey;
  const hash = directoryHash(skillDir);
  const now = new Date().toISOString();
  const contentUpdatedAt = directoryUpdatedAt(skillDir).toISOString();
  const label = meta.version ? `v${meta.version}` : localVersionLabel(new Date(contentUpdatedAt));
  const existing = (await listSkillVersions(skillKey)).find((entry) => entry.hash === hash && entry.label === label);
  if (existing) return existing;
  let archiveId = `${safeName(label).toLowerCase()}-${hash.slice(0, 8)}`;
  let archiveRoot = path.join(skillVersionsDir(), skillKey, archiveId);
  if (fs.existsSync(archiveRoot)) {
    archiveId = `${archiveId}-${Date.now()}`;
    archiveRoot = path.join(skillVersionsDir(), skillKey, archiveId);
  }
  const archivePath = path.join(skillVersionsDir(), skillKey, archiveId, "files");
  await fsp.mkdir(path.dirname(archivePath), { recursive: true });
  await fsp.cp(skillDir, archivePath, { recursive: true, force: true });
  const manifest = {
    id: archiveId,
    skillKey,
    name: meta.name,
    version: meta.version,
    label,
    hash,
    sourceDir: skillDir,
    sourceId: metadata.sourceId || "",
    sourceClient: metadata.client || metadata.sourceClient || "",
    sourceLabel: metadata.sourceLabel || "",
    reason: metadata.reason || "archive",
    message: metadata.message || metadata.note || "",
    archivePath,
    createdAt: now,
    contentUpdatedAt
  };
  await fsp.writeFile(versionManifestPath(skillKey, archiveId), JSON.stringify(manifest, null, 2));
  return publicManifest(manifest);
}

async function ensureInstallVersionState(skill) {
  const meta = readSkillPackageMeta(skill.dir);
  const key = installVersionKey(skill.sourceId, meta.skillKey);
  const store = versionStore();
  if (!meta.version) {
    if (store.installations?.[key]) {
      delete store.installations[key];
      setVersionStore(store);
    }
    const currentHash = directoryHash(skill.dir);
    const currentLabel = localVersionLabel(directoryUpdatedAt(skill.dir));
    return {
      skillKey: meta.skillKey,
      activeArchiveId: "",
      activeLabel: "",
      currentHash,
      currentVersion: "",
      currentLabel,
      unmanaged: true,
      versions: []
    };
  }
  let state = store.installations[key];
  const currentHash = directoryHash(skill.dir);
  const currentLabel = meta.version ? `v${meta.version}` : "";
  let activeManifest = state?.activeArchiveId ? await readVersionManifest(meta.skillKey, state.activeArchiveId) : null;
  if (!state?.activeArchiveId || !activeManifest) {
    const archived = await archiveSkillDirectory(skill.dir, { ...skill, skillKey: meta.skillKey, reason: "initial-active" });
    state = {
      installKey: key,
      skillKey: meta.skillKey,
      sourceId: skill.sourceId,
      sourceClient: skill.client,
      path: skill.dir,
      activeArchiveId: archived?.id || "",
      activeLabel: archived?.label || (meta.version ? `v${meta.version}` : ""),
      updatedAt: new Date().toISOString()
    };
    store.installations[key] = state;
    setVersionStore(store);
    activeManifest = archived;
  }
  const versions = await listSkillVersions(meta.skillKey);
  return {
    skillKey: meta.skillKey,
    activeArchiveId: state.activeArchiveId || "",
    activeLabel: state.activeLabel || "",
    currentHash,
    currentVersion: meta.version || "",
    currentLabel: currentLabel || state.activeLabel || "",
    versions
  };
}

async function setActiveVersionState(skillDir, sourceInfo, manifest) {
  const meta = readSkillPackageMeta(skillDir);
  const key = installVersionKey(sourceInfo?.sourceId, meta.skillKey);
  const store = versionStore();
  store.installations[key] = {
    installKey: key,
    skillKey: meta.skillKey,
    sourceId: sourceInfo?.sourceId || "",
    sourceClient: sourceInfo?.client || sourceInfo?.sourceClient || "",
    path: skillDir,
    activeArchiveId: manifest?.id || "",
    activeLabel: manifest?.label || (meta.version ? `v${meta.version}` : ""),
    updatedAt: new Date().toISOString()
  };
  setVersionStore(store);
}

function inferSourceIdForSkillDir(skillDir) {
  const resolved = path.resolve(skillDir || "");
  const sources = getSettings().sources || [];
  const matched = sources
    .filter((source) => source?.id && source?.root)
    .map((source) => ({ source, root: path.resolve(expandHome(source.root)) }))
    .filter(({ root }) => resolved === root || resolved.startsWith(`${root}${path.sep}`))
    .sort((a, b) => b.root.length - a.root.length)[0];
  return matched?.source?.id || "";
}

async function clearVersionHistoryForInstallation(skillDir, sourceInfo = {}) {
  if (!skillDir || !fs.existsSync(skillDir)) return { deleted: [], skipped: [] };
  const meta = readSkillPackageMeta(skillDir);
  const sourceId = sourceInfo?.sourceId || inferSourceIdForSkillDir(skillDir);
  if (!sourceId || !meta.skillKey) return { deleted: [], skipped: [] };
  const store = versionStore();
  delete store.installations[installVersionKey(sourceId, meta.skillKey)];
  setVersionStore(store);

  const remainingStates = Object.values(store.installations || {})
    .filter((state) => state.skillKey === meta.skillKey && state.activeArchiveId);
  const activeIds = new Set(remainingStates.map((state) => state.activeArchiveId));
  const root = path.join(skillVersionsDir(), meta.skillKey);
  let entries = [];
  try {
    entries = await fsp.readdir(root, { withFileTypes: true });
  } catch {
    return { deleted: [], skipped: [] };
  }

  const deleted = [];
  const skipped = [];
  const normalizedSkillDir = path.resolve(skillDir);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifest = await readVersionManifest(meta.skillKey, entry.name);
    if (!manifest) continue;
    const sameSource = manifest.sourceId === sourceId;
    const samePath = manifest.sourceDir && path.resolve(manifest.sourceDir) === normalizedSkillDir;
    if (!sameSource && !samePath) continue;
    const archiveRoot = path.join(root, entry.name);
    if (activeIds.has(manifest.id)) {
      const owner = remainingStates.find((state) => state.activeArchiveId === manifest.id);
      if (owner && sameSource) {
        await fsp.writeFile(versionManifestPath(meta.skillKey, manifest.id), JSON.stringify({
          ...manifest,
          sourceId: owner.sourceId || "",
          sourceClient: owner.sourceClient || "",
          sourceDir: owner.path || manifest.sourceDir
        }, null, 2)).catch(() => {});
      }
      skipped.push({ id: manifest.id, reason: "active" });
      continue;
    }
    await fsp.rm(archiveRoot, { recursive: true, force: true });
    deleted.push(manifest.id);
  }
  return { deleted, skipped };
}

async function clearPreviousUninstalledSnapshots(skillDir, sourceInfo = {}) {
  if (!skillDir || !fs.existsSync(skillDir)) return [];
  const meta = readSkillPackageMeta(skillDir);
  const sourceId = sourceInfo?.sourceId || inferSourceIdForSkillDir(skillDir);
  const sourceClient = sourceInfo?.client || sourceInfo?.sourceClient || "";
  if (!meta.skillKey || (!sourceId && !sourceClient)) return [];
  const root = uninstalledSkillsDir();
  let entries = [];
  try {
    entries = await fsp.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const deleted = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(root, entry.name);
    const recordMeta = readSkillPackageMeta(dir);
    if (recordMeta.skillKey !== meta.skillKey) continue;
    const uninstallMeta = readUninstallMeta(dir);
    const sameSource = sourceId
      ? uninstallMeta.sourceId === sourceId
      : (uninstallMeta.sourceClient || uninstallMeta.sourceLabel) === sourceClient;
    if (!sameSource) continue;
    await fsp.rm(dir, { recursive: true, force: true });
    deleted.push(dir);
  }
  return deleted;
}

async function enrichSkillVersionInfo(data) {
  const skills = [];
  for (const skill of data.skills || []) {
    if (!skill?.dir || !skill?.sourceId || skill.sourceId === "uninstalled") {
      skills.push(skill);
      continue;
    }
    try {
      const versionInfo = await ensureInstallVersionState(skill);
      skills.push({ ...skill, versionInfo });
    } catch {
      skills.push(skill);
    }
  }
  return { ...data, skills };
}

async function activateSkillVersion(payload = {}) {
  const { skillDir, sourceInfo = {}, archiveId } = payload;
  if (!skillDir || !archiveId) throw new Error("缺少要回滚的 skill 或版本。");
  const activeMeta = readSkillPackageMeta(skillDir);
  const manifest = await readVersionManifest(activeMeta.skillKey, archiveId);
  if (!manifest?.archivePath || !fs.existsSync(manifest.archivePath)) throw new Error("找不到这个 skill 版本的归档文件。");
  const store = versionStore();
  const currentState = store.installations[installVersionKey(sourceInfo?.sourceId, activeMeta.skillKey)];
  const currentManifest = currentState?.activeArchiveId ? await readVersionManifest(activeMeta.skillKey, currentState.activeArchiveId) : null;
  const currentHash = directoryHash(skillDir);
  if (currentManifest?.hash !== currentHash) {
    await archiveSkillDirectory(skillDir, { ...sourceInfo, skillKey: activeMeta.skillKey, reason: "before-activate" });
  }
  await fsp.rm(skillDir, { recursive: true, force: true });
  await fsp.cp(manifest.archivePath, skillDir, { recursive: true, force: true });
  await setActiveVersionState(skillDir, sourceInfo, manifest);
  const snapshot = await scanSkillDirectory(skillDir, {
    id: sourceInfo?.sourceId || manifest.sourceId || "local",
    client: sourceInfo?.client || sourceInfo?.sourceClient || manifest.sourceClient || "Local",
    label: sourceInfo?.sourceLabel || manifest.sourceLabel || "Local",
    root: path.dirname(skillDir)
  }, { ignorePatterns: getSettings().ignorePatterns });
  const versionInfo = await ensureInstallVersionState(snapshot);
  appendOperationLog({
    type: "version",
    status: "success",
    title: manifest.name || path.basename(skillDir),
    message: `已切换到 ${manifest.label || manifest.id}。`,
    detail: `${manifest.archivePath} -> ${skillDir}`
  });
  return {
    path: skillDir,
    activeVersion: publicManifest(manifest),
    skill: { ...snapshot, versionInfo }
  };
}

async function deleteSkillVersions(payload = {}) {
  const { skillDir, archiveIds = [] } = payload;
  if (!skillDir || !fs.existsSync(skillDir)) throw new Error("缺少 skill 目录。");
  const ids = [...new Set((archiveIds || []).map((id) => String(id || "").trim()).filter(Boolean))];
  if (!ids.length) throw new Error("请选择要删除的版本。");
  const meta = readSkillPackageMeta(skillDir);
  const store = versionStore();
  const activeStates = Object.values(store.installations || {})
    .filter((state) => state.skillKey === meta.skillKey && state.activeArchiveId);
  const activeIds = new Set(activeStates.map((state) => state.activeArchiveId));
  const activeClientsById = new Map();
  activeStates.forEach((state) => {
    const clients = activeClientsById.get(state.activeArchiveId) || [];
    clients.push(state.sourceClient || state.sourceId || "Agent");
    activeClientsById.set(state.activeArchiveId, clients);
  });
  const deleted = [];
  const skipped = [];
  for (const id of ids) {
    if (activeIds.has(id)) {
      skipped.push({ id, reason: "active", activeClients: activeClientsById.get(id) || [] });
      continue;
    }
    const manifest = await readVersionManifest(meta.skillKey, id);
    if (!manifest) {
      skipped.push({ id, reason: "missing" });
      continue;
    }
    await fsp.rm(path.join(skillVersionsDir(), meta.skillKey, id), { recursive: true, force: true });
    deleted.push(id);
  }
  appendOperationLog({
    type: "version",
    status: "success",
    title: meta.name || path.basename(skillDir),
    message: `已删除 ${deleted.length} 个历史版本。`,
    detail: skipped.length ? `跳过 ${skipped.length} 个当前使用或不存在的版本。` : skillDir
  });
  return {
    deleted,
    skipped,
    versions: await listSkillVersions(meta.skillKey)
  };
}

function collectTextFilesSync(root, options = {}) {
  const includeContent = options.includeContent !== false;
  const files = new Map();
  function walk(dir) {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if ([".git", "node_modules", "__pycache__", ".DS_Store", uninstallMetaFile, legacyUninstallMetaFile].includes(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(root, fullPath).split(path.sep).join("/");
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        try {
          const stats = fs.statSync(fullPath);
          if (stats.size > 2 * 1024 * 1024) {
            files.set(relPath, { path: relPath, binary: true, content: "", hash: `large:${stats.size}` });
            continue;
          }
          const buffer = fs.readFileSync(fullPath);
          const binary = buffer.includes(0);
          files.set(relPath, {
            path: relPath,
            fullPath,
            binary,
            content: binary || !includeContent ? "" : buffer.toString("utf8"),
            hash: contentHash(buffer)
          });
        } catch {
          // Ignore unreadable files in diff.
        }
      }
    }
  }
  walk(root);
  return files;
}

function collectedFileContent(file) {
  if (!file || file.binary) return "";
  if (file.content) return file.content;
  if (!file.fullPath) return "";
  try {
    return fs.readFileSync(file.fullPath, "utf8");
  } catch {
    return "";
  }
}

async function diffSkillVersion(payload = {}) {
  const { skillDir, archiveId } = payload;
  if (!skillDir || !archiveId) throw new Error("缺少 skill 目录或版本。");
  const meta = readSkillPackageMeta(skillDir);
  const manifest = await readVersionManifest(meta.skillKey, archiveId);
  if (!manifest?.archivePath || !fs.existsSync(manifest.archivePath)) throw new Error("找不到这个 skill 版本的归档文件。");
  const oldFiles = collectTextFilesSync(manifest.archivePath, { includeContent: false });
  const currentFiles = collectTextFilesSync(skillDir, { includeContent: false });
  const paths = [...new Set([...oldFiles.keys(), ...currentFiles.keys()])].sort();
  const files = paths.flatMap((relPath) => {
    const before = oldFiles.get(relPath);
    const after = currentFiles.get(relPath);
    if (before?.hash === after?.hash) return [];
    return [{
      path: relPath,
      type: before && after ? "modified" : before ? "deleted" : "added",
      binary: Boolean(before?.binary || after?.binary),
      content: collectedFileContent(before),
      current: collectedFileContent(after)
    }];
  });
  return {
    version: publicManifest(manifest),
    files
  };
}

function buildFileDiff(beforeFiles, afterFiles) {
  const paths = [...new Set([...beforeFiles.keys(), ...afterFiles.keys()])].sort();
  return paths.flatMap((relPath) => {
    const before = beforeFiles.get(relPath);
    const after = afterFiles.get(relPath);
    if (before?.hash === after?.hash) return [];
    return [{
      path: relPath,
      type: before && after ? "modified" : before ? "deleted" : "added",
      binary: Boolean(before?.binary || after?.binary),
      content: collectedFileContent(before),
      current: collectedFileContent(after)
    }];
  });
}

async function resolveSkillPublishTarget(skillDir, requestedVersion = "", sourceInfo = {}) {
  const meta = readSkillPackageMeta(skillDir);
  const fileVersion = normalizeVersionValue(meta.version);
  const latestManagedVersion = await latestManagedSemanticVersion(meta.skillKey, sourceInfo);
  const requested = normalizeVersionValue(requestedVersion);
  if (requested) {
    return {
      meta,
      fileVersion,
      latestManagedVersion,
      targetVersion: requested,
      reason: "requested"
    };
  }
  if (!fileVersion) {
    return {
      meta,
      fileVersion,
      latestManagedVersion,
      targetVersion: latestManagedVersion ? bumpSkillVersion(latestManagedVersion) : "0.0.1",
      reason: "first-managed-version"
    };
  }
  if (!latestManagedVersion) {
    return {
      meta,
      fileVersion,
      latestManagedVersion,
      targetVersion: fileVersion,
      reason: "external-version"
    };
  }
  const compare = compareSemanticVersionAsc(fileVersion, latestManagedVersion);
  if (compare !== null && compare > 0) {
    return {
      meta,
      fileVersion,
      latestManagedVersion,
      targetVersion: fileVersion,
      reason: "external-version-ahead"
    };
  }
  return {
    meta,
    fileVersion,
    latestManagedVersion,
    targetVersion: bumpSkillVersion(latestManagedVersion),
    reason: compare !== null && compare < 0 ? "file-version-behind" : "managed-version-bump"
  };
}

async function previewSkillUpgrade(payload = {}) {
  const { skillDir, nextVersion, sourceInfo = {}, forceContentChanges = false } = payload;
  let { activeArchiveId } = payload;
  if (!skillDir || !fs.existsSync(skillDir)) throw new Error("缺少 skill 目录。");
  const { meta, fileVersion, latestManagedVersion, targetVersion, reason } = await resolveSkillPublishTarget(skillDir, nextVersion, sourceInfo);
  if (!activeArchiveId && sourceInfo?.sourceId) {
    const state = versionStore().installations?.[installVersionKey(sourceInfo.sourceId, meta.skillKey)];
    activeArchiveId = state?.activeArchiveId || "";
  }
  if (!activeArchiveId) {
    const state = Object.values(versionStore().installations || {}).find((item) => item.skillKey === meta.skillKey && path.resolve(item.path || "") === path.resolve(skillDir));
    activeArchiveId = state?.activeArchiveId || "";
  }
  if (!targetVersion) throw new Error("请输入目标版本。");
  const activeManifest = activeArchiveId ? await readVersionManifest(meta.skillKey, activeArchiveId) : null;
  const hasBaseline = Boolean(activeManifest?.archivePath && fs.existsSync(activeManifest.archivePath));
  const beforeRoot = hasBaseline ? activeManifest.archivePath : skillDir;
  const beforeFiles = collectTextFilesSync(beforeRoot, { includeContent: false });
  const currentFiles = collectTextFilesSync(skillDir, { includeContent: false });
  const contentFiles = buildFileDiff(beforeFiles, currentFiles);
  const afterFiles = new Map(currentFiles);
  const currentSkill = currentFiles.get("SKILL.md");
  const beforeContent = collectedFileContent(currentSkill) || meta.raw || "";
  const afterContent = updateSkillMarkdownVersion(beforeContent, targetVersion);
  afterFiles.set("SKILL.md", {
    path: "SKILL.md",
    binary: false,
    content: afterContent,
    hash: contentHash(Buffer.from(afterContent, "utf8"))
  });
  return {
    version: {
      id: "upgrade-preview",
      label: `v${targetVersion}`,
      reason: "manual-version-preview",
      createdAt: new Date().toISOString()
    },
    fromVersion: activeManifest?.version || fileVersion || latestManagedVersion || "",
    toVersion: targetVersion,
    fileVersion,
    latestManagedVersion,
    reason,
    hasBaseline,
    hasContentChanges: Boolean(forceContentChanges)
      || !hasBaseline
      || contentFiles.length > 0
      || reason === "first-managed-version"
      || reason === "external-version-ahead",
    contentFiles,
    files: buildFileDiff(beforeFiles, afterFiles)
  };
}

async function commitSkillUpgrade(payload = {}) {
  const { skillDir, sourceInfo = {}, nextVersion } = payload;
  const message = String(payload.message || "").trim();
  if (!skillDir || !fs.existsSync(skillDir)) throw new Error("缺少 skill 目录。");
  const { meta, fileVersion, latestManagedVersion, targetVersion } = await resolveSkillPublishTarget(skillDir, nextVersion, sourceInfo);
  const skillFilePath = path.join(skillDir, "SKILL.md");
  if (!fs.existsSync(skillFilePath)) throw new Error("找不到 SKILL.md。");
  const currentContent = await fsp.readFile(skillFilePath, "utf8");
  if (!targetVersion) throw new Error("请输入目标版本。");
  const nextContent = updateSkillMarkdownVersion(currentContent, targetVersion);
  if (nextContent !== currentContent) {
    await createVersionSnapshot(skillFilePath, "手动发布版本前");
    await fsp.writeFile(skillFilePath, nextContent, "utf8");
  } else if (fileVersion && latestManagedVersion && compareSemanticVersionAsc(fileVersion, latestManagedVersion) === 0) {
    const state = sourceInfo?.sourceId ? versionStore().installations?.[installVersionKey(sourceInfo.sourceId, meta.skillKey)] : null;
    const currentHash = directoryHash(skillDir);
    if (state?.activeArchiveId) {
      const activeManifest = await readVersionManifest(meta.skillKey, state.activeArchiveId);
      if (activeManifest?.hash === currentHash) throw new Error("目标版本与当前版本一致。");
    }
  }
  const activeVersion = await archiveSkillDirectory(skillDir, {
    ...sourceInfo,
    skillKey: meta.skillKey,
    reason: "manual-version-active",
    message
  });
  await setActiveVersionState(skillDir, sourceInfo, activeVersion);
  appendOperationLog({
    type: "version",
    status: "success",
    title: meta.name || path.basename(skillDir),
    message: `已发布版本 v${targetVersion}。`,
    detail: skillDir
  });
  notifySkillsChanged({ type: "version", skillDir, sourceInfo });
  const stats = await fsp.stat(skillFilePath);
  const snapshot = await scanSkillDirectory(skillDir, {
    id: sourceInfo?.sourceId || activeVersion?.sourceId || "local",
    client: sourceInfo?.client || sourceInfo?.sourceClient || activeVersion?.sourceClient || "Local",
    label: sourceInfo?.sourceLabel || activeVersion?.sourceLabel || "Local",
    root: path.dirname(skillDir)
  }, { ignorePatterns: getSettings().ignorePatterns });
  const versionInfo = await ensureInstallVersionState(snapshot);
  return {
    path: skillFilePath,
    content: nextContent,
    size: stats.size,
    updatedAt: stats.mtime.toISOString(),
    activeVersion,
    fromVersion: fileVersion || latestManagedVersion || "",
    toVersion: targetVersion,
    skill: { ...snapshot, versionInfo }
  };
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

function compressedRequestHeaders(headers = {}) {
  return {
    "User-Agent": "Skill-Manager",
    "Accept-Encoding": "gzip, br, deflate",
    ...headers
  };
}

function decodedResponseStream(response) {
  const encoding = String(response.headers["content-encoding"] || "").toLowerCase();
  if (encoding.includes("br")) {
    const stream = zlib.createBrotliDecompress();
    response.pipe(stream);
    return stream;
  }
  if (encoding.includes("gzip")) {
    const stream = zlib.createGunzip();
    response.pipe(stream);
    return stream;
  }
  if (encoding.includes("deflate")) {
    const stream = zlib.createInflate();
    response.pipe(stream);
    return stream;
  }
  return response;
}

function fetchJsonApi(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: compressedRequestHeaders({ "Accept": "application/json", ...headers })
    }, (response) => {
      let body = "";
      const stream = decodedResponseStream(response);
      stream.setEncoding("utf8");
      stream.on("data", (chunk) => {
        body += chunk;
      });
      stream.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          const error = new Error(`HTTP ${response.statusCode}: ${body.slice(0, 180)}`);
          error.statusCode = response.statusCode;
          reject(error);
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
      stream.on("error", reject);
    });
    request.setTimeout(12000, () => {
      request.destroy(new Error("Request timed out"));
    });
    request.on("error", reject);
  });
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: compressedRequestHeaders() }, (response) => {
      let body = "";
      const stream = decodedResponseStream(response);
      stream.setEncoding("utf8");
      stream.on("data", (chunk) => {
        body += chunk;
      });
      stream.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`HTTP ${response.statusCode}: ${body.slice(0, 180)}`));
          return;
        }
        resolve(body);
      });
      stream.on("error", reject);
    });
    request.setTimeout(12000, () => {
      request.destroy(new Error("Request timed out"));
    });
    request.on("error", reject);
  });
}

const initialSkillsMarker = "\\\"initialSkills\\\":";

function initialSkillsEndIndex(html) {
  const markerIndex = html.indexOf(initialSkillsMarker);
  if (markerIndex < 0) return -1;
  const start = html.indexOf("[", markerIndex + initialSkillsMarker.length);
  if (start < 0) return -1;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let index = start; index < html.length; index += 1) {
    const char = html[index];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === "\\") {
        escape = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "[") depth += 1;
    if (char === "]") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  return -1;
}

function fetchSkillsShLeaderboardText(url) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let body = "";
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const request = https.get(url, { headers: compressedRequestHeaders() }, (response) => {
      const stream = decodedResponseStream(response);
      stream.setEncoding("utf8");
      stream.on("data", (chunk) => {
        body += chunk;
        const end = initialSkillsEndIndex(body);
        if (end > 0) {
          finish(body.slice(0, end));
          request.destroy();
        }
      });
      stream.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          fail(new Error(`HTTP ${response.statusCode}: ${body.slice(0, 180)}`));
          return;
        }
        finish(body);
      });
      stream.on("error", fail);
    });
    request.setTimeout(8000, () => {
      request.destroy(new Error("Request timed out"));
    });
    request.on("error", (error) => {
      if (!settled) reject(error);
    });
  });
}

async function fetchTextWithRetry(url, attempts = 2) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchText(url);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
    }
  }
  throw lastError;
}

async function fetchSkillsShLeaderboardTextWithRetry(url, attempts = 1) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchSkillsShLeaderboardText(url);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }
  throw lastError;
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
    version: record.version || record.latestVersion || record.metadata?.version || "",
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

function skillsShViewForMode(mode) {
  if (mode === "trending") return "trending";
  if (mode === "hot") return "hot";
  return "all-time";
}

function skillFromSkillsShApiRecord(record, index, mode) {
  const fullName = record.source || "";
  const name = record.slug || record.skillId || record.name || "";
  const url = record.url || `https://www.skills.sh/${fullName}/${name}`;
  const repositoryUrl = record.installUrl || (fullName.includes("/") ? `https://github.com/${fullName}` : url);
  return {
    id: `skillssh:${record.id || `${fullName}/${name}`}`,
    name,
    fullName,
    description: record.description || `${name} from ${fullName}`,
    url,
    repositoryUrl,
    source: "skillssh",
    sourceLabel: "skills.sh",
    sourceName: fullName,
    sourceUrl: "https://www.skills.sh/",
    discoverMode: mode,
    version: record.version || record.latestVersion || record.metadata?.version || "",
    rank: index + 1,
    installsLabel: compactNumber(Number(record.installs || 0)),
    weeklyLabel: "",
    changeLabel: "",
    stars: 0,
    language: "Agent skill",
    updatedAt: new Date().toISOString(),
    installCommand: `npx --yes skills add ${repositoryUrl} --skill ${name}`,
    installMethod: "skills-cli",
    official: Boolean(record.isOfficial)
  };
}

async function fetchSkillsShSearchPage(mode, page = 0, query = "") {
  const searchQuery = String(query || "").trim();
  if (searchQuery.length < 2) return null;
  const pageNumber = Math.max(0, Number(page) || 0);
  const limit = Math.max(discoverPageSize * (pageNumber + 1), 500);
  const url = `https://www.skills.sh/api/search?q=${encodeURIComponent(searchQuery)}&limit=${limit}`;
  const result = await fetchJsonApi(url);
  const allItems = (Array.isArray(result?.skills) ? result.skills : [])
    .map((record, index) => skillFromSkillsShRecord(record, index, mode))
    .filter((item) => item.name && item.fullName);
  if (!allItems.length) {
    return {
      source: "skills.sh",
      mode,
      page: pageNumber,
      perPage: discoverPageSize,
      total: 0,
      totalLabel: "0",
      tabLabels: { alltime: "", trending: "24h", hot: "" },
      hasMore: false,
      items: [],
      allItems,
      searchType: result?.searchType || "search"
    };
  }
  const start = pageNumber * discoverPageSize;
  const items = allItems.slice(start, start + discoverPageSize);
  const total = Number(result?.count || allItems.length);
  return {
    source: "skills.sh",
    mode,
    page: pageNumber,
    perPage: discoverPageSize,
    total,
    totalLabel: total ? total.toLocaleString("en-US") : "",
    tabLabels: { alltime: "", trending: "24h", hot: "" },
    hasMore: start + discoverPageSize < allItems.length,
    items,
    allItems,
    searchType: result?.searchType || "search"
  };
}

async function fetchSkillsShApiPage(mode, page = 0, query = "") {
  const token = process.env.VERCEL_OIDC_TOKEN || process.env.SKILLS_SH_TOKEN || "";
  if (!token) return null;
  const pageNumber = Math.max(0, Number(page) || 0);
  const searchQuery = String(query || "").trim();
  const url = `https://www.skills.sh/api/v1/skills?view=${encodeURIComponent(skillsShViewForMode(mode))}&page=${pageNumber}&per_page=${discoverPageSize}${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ""}`;
  const result = await fetchJsonApi(url, { Authorization: `Bearer ${token}` });
  const pagination = result?.pagination || {};
  const total = Number(pagination.total || 0);
  const items = (Array.isArray(result?.data) ? result.data : [])
    .map((record, index) => skillFromSkillsShApiRecord(record, pageNumber * discoverPageSize + index, mode))
    .filter((item) => item.name && item.fullName);
  if (!items.length) return null;
  return {
    source: "skills.sh",
    mode,
    page: Number(pagination.page || 0),
    perPage: Number(pagination.perPage || discoverPageSize),
    total,
    totalLabel: total ? total.toLocaleString("en-US") : "",
    tabLabels: { alltime: total && mode === "alltime" ? total.toLocaleString("en-US") : "", trending: "24h", hot: "" },
    hasMore: Boolean(pagination.hasMore),
    items
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
      if ([".git", "node_modules", "__pycache__", ".DS_Store"].includes(entry.name)) continue;
      await walk(path.join(dir, entry.name), depth + 1);
    }
  }

  await walk(root, 0);
  candidates.sort((a, b) => b.score - a.score || a.dir.length - b.dir.length);
  if (!candidates.length) throw new Error("仓库里没有找到 SKILL.md。");
  return candidates[0].dir;
}

function parseSkillsShLeaderboard(html, mode = "alltime", page = 0) {
  const tabLabels = parseSkillsShTabs(html);
  const initialSkills = extractInitialSkills(html);
  const allItems = initialSkills.length ? initialSkills.map((record, index) => skillFromSkillsShRecord(record, index, mode)) : (html.match(/<a class="group[\s\S]*?<\/a>/g) || []).map((chunk, index) => {
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
      version: "",
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
  const pageNumber = Math.max(0, Number(page) || 0);
  const start = pageNumber * discoverPageSize;
  const items = allItems.slice(start, start + discoverPageSize);
  return {
    source: "skills.sh",
    mode,
    page: pageNumber,
    perPage: discoverPageSize,
    totalLabel: mode === "alltime" ? tabLabels.alltime : "",
    tabLabels,
    hasMore: start + discoverPageSize < allItems.length,
    items,
    allItems
  };
}

async function loadSkillsShLeaderboard(url, mode, page = 0, query = "") {
  const searchQuery = String(query || "").trim();
  const cacheKey = `discoverCache:${mode}:${searchQuery.toLowerCase()}`;
  const pageNumber = Math.max(0, Number(page) || 0);
  function publicPayload(payload, items = payload.items || []) {
    const { allItems: _allItems, ...rest } = payload;
    return { ...rest, items };
  }
  const cachedBeforeFetch = getStoreValue(cacheKey, null);
  if (pageNumber > 0 && cachedBeforeFetch?.allItems?.length) {
    const start = pageNumber * discoverPageSize;
    const items = cachedBeforeFetch.allItems.slice(start, start + discoverPageSize);
    return publicPayload({
      ...cachedBeforeFetch,
      page: pageNumber,
      perPage: Number(cachedBeforeFetch.perPage || discoverPageSize),
      hasMore: start + discoverPageSize < cachedBeforeFetch.allItems.length,
      stale: false,
      error: ""
    }, items);
  }
  try {
    let parsed = null;
    if (searchQuery) {
      parsed = await fetchSkillsShSearchPage(mode, pageNumber, searchQuery);
    } else {
      try {
        parsed = await fetchSkillsShApiPage(mode, pageNumber, searchQuery);
      } catch {
        parsed = null;
      }
      parsed = parsed || parseSkillsShLeaderboard(await fetchSkillsShLeaderboardTextWithRetry(url, 1), mode, pageNumber);
    }
    if (!parsed.items.length) throw new Error("skills.sh 返回内容为空，暂时无法解析 Discover 列表。");
    const cached = {
      ...parsed,
      cachedAt: new Date().toISOString(),
      stale: false,
      error: ""
    };
    if (pageNumber === 0) setStoreValue(cacheKey, cached);
    return publicPayload(cached);
  } catch (error) {
    const cached = getStoreValue(cacheKey, null);
    if (pageNumber === 0 && cached?.items?.length) {
      return publicPayload({
        ...cached,
        page: Number(cached.page || 0),
        perPage: Number(cached.perPage || discoverPageSize),
        hasMore: Boolean(cached.hasMore || cached.allItems?.length > discoverPageSize || cached.items.length > discoverPageSize),
        stale: true,
        error: error.message || String(error)
      }, (cached.allItems || cached.items).slice(0, discoverPageSize));
    }
    throw error;
  }
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

async function scanInstalledSkills() {
  const settings = getSettings();
  return scanSkills(settings.sources, { ignorePatterns: settings.ignorePatterns, includeTree: false, fastStats: true });
}

async function scanUninstalledSkills() {
  return scanSkills([
    { id: "uninstalled", client: "Uninstalled", label: "Uninstalled", root: uninstalledSkillsDir(), enabled: true }
  ], { ignorePatterns: getSettings().ignorePatterns, includeTree: false, fastStats: true });
}

async function skillDetailSnapshot(payload = {}) {
  const { skillDir, source = {} } = payload;
  if (!skillDir) throw new Error("缺少 skill 目录。");
  if (!fs.existsSync(skillDir) || !fs.existsSync(path.join(skillDir, "SKILL.md"))) {
    return {
      id: `${source.id || source.sourceId || "missing"}:${safeName(path.basename(skillDir))}`,
      name: path.basename(skillDir),
      dir: skillDir,
      sourceId: source.id || source.sourceId || "missing",
      client: source.client || source.sourceClient || "Missing",
      sourceLabel: source.label || source.sourceLabel || "Missing",
      missing: true,
      detailLoaded: false
    };
  }
  const settings = getSettings();
  const snapshot = await scanSkillDirectory(skillDir, {
    id: source.id || source.sourceId || "local",
    client: source.client || source.sourceClient || "Local",
    label: source.label || source.sourceLabel || source.client || "Local",
    root: source.root || path.dirname(skillDir)
  }, { ignorePatterns: settings.ignorePatterns });
  if (!snapshot?.dir || snapshot.sourceId === "uninstalled") return snapshot;
  try {
    const versionInfo = await ensureInstallVersionState(snapshot);
    return { ...snapshot, versionInfo };
  } catch {
    return snapshot;
  }
}

function apiStatus() {
  const settings = getSettings();
  return {
    ok: true,
    app: {
      name: app.getName(),
      version: app.getVersion(),
      isPackaged: app.isPackaged
    },
    api: {
      enabled: settings.apiEnabled,
      configuredPort: settings.apiPort,
      port: apiActualPort,
      baseUrl: apiActualPort ? `http://127.0.0.1:${apiActualPort}` : ""
    }
  };
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error(`Invalid JSON body: ${error.message}`));
      }
    });
    request.on("error", reject);
  });
}

function writeApiJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "http://127.0.0.1",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  response.end(JSON.stringify(payload, null, 2));
}

function resolveSkillTarget(payload = {}) {
  const settings = getSettings();
  const source = sourceByIdOrName(payload.sourceId || payload.agent || payload.targetSourceId, settings)
    || (payload.skillDir ? sourceByIdOrName(inferSourceIdForSkillDir(expandHome(payload.skillDir)), settings) : null)
    || sourceByIdOrName(settings.installSourceId, settings)
    || settings.sources[0];
  const sourceId = source?.id || payload.sourceId || payload.agent || settings.installSourceId;
  const skillDir = payload.skillDir
    ? expandHome(payload.skillDir)
    : path.join(installRootFor(sourceId), safeName(payload.skill || payload.name || ""));
  return {
    skillDir,
    source,
    sourceInfo: {
      sourceId,
      client: source?.client || payload.agent || sourceId,
      sourceLabel: source?.label || payload.sourceLabel || source?.client || sourceId,
      root: source?.root
    }
  };
}

async function routeLocalApi(request, url) {
  if (request.method === "OPTIONS") return { status: 204, body: {} };
  if (request.method === "GET" && ["/", "/api", "/api/status"].includes(url.pathname)) {
    return { status: 200, body: apiStatus() };
  }
  if (request.method === "GET" && url.pathname === "/api/settings") {
    return { status: 200, body: getSettings() };
  }
  if (request.method === "POST" && url.pathname === "/api/settings") {
    const { saved: next } = saveSettingsWithLog(await readRequestBody(request));
    setTimeout(() => restartLocalApiServer(), 0);
    buildAppMenu();
    return { status: 200, body: next };
  }
  if (request.method === "GET" && url.pathname === "/api/skills") {
    const scope = url.searchParams.get("scope") || "installed";
    return { status: 200, body: scope === "uninstalled" ? await scanUninstalledSkills() : await scanInstalledSkills() };
  }
  if (request.method === "POST" && url.pathname === "/api/skills/detail") {
    return { status: 200, body: await skillDetailSnapshot(await readRequestBody(request)) };
  }
  if (request.method === "POST" && url.pathname === "/api/skills/publish") {
    const payload = await readRequestBody(request);
    const target = resolveSkillTarget(payload);
    return {
      status: 200,
      body: await commitSkillUpgrade({
        skillDir: target.skillDir,
        sourceInfo: target.sourceInfo,
        nextVersion: payload.nextVersion,
        message: payload.message
      })
    };
  }
  if (request.method === "POST" && url.pathname === "/api/skills/install-local") {
    const payload = await readRequestBody(request);
    const target = resolveSkillTarget(payload);
    const sourceDir = expandHome(payload.sourceDir || payload.skillDir || "");
    return { status: 200, body: await performInstallLocalSkill(sourceDir, target.sourceInfo.sourceId, payload.conflictStrategy) };
  }
  if (request.method === "POST" && url.pathname === "/api/skills/uninstall") {
    const payload = await readRequestBody(request);
    const target = resolveSkillTarget(payload);
    return { status: 200, body: await performUninstallSkill(target.skillDir, target.sourceInfo) };
  }
  if (request.method === "POST" && url.pathname === "/api/skills/recover") {
    const payload = await readRequestBody(request);
    const target = resolveSkillTarget(payload);
    const sourceDir = expandHome(payload.sourceDir || payload.skillDir || "");
    return { status: 200, body: await performRestoreSkill(sourceDir, target.sourceInfo.sourceId, payload.conflictStrategy) };
  }
  if (request.method === "POST" && url.pathname === "/api/discover/install") {
    const payload = await readRequestBody(request);
    const target = resolveSkillTarget(payload);
    return {
      status: 200,
      body: await performInstallDiscoverSkill(payload.item, target.sourceInfo.sourceId, Boolean(payload.forceUpdate), payload.conflictStrategy)
    };
  }
  if (request.method === "GET" && url.pathname === "/api/logs") {
    return { status: 200, body: getOperationLogs() };
  }
  if (request.method === "GET" && url.pathname === "/api/events") {
    return { status: 200, body: getOperationEvents() };
  }
  if (request.method === "POST" && url.pathname === "/api/events") {
    const payload = await readRequestBody(request);
    const targetIds = payload.targetIds || [];
    const skills = payload.skills || [];
    const targets = payload.targets || [];
    const title = payload.title || payload.item?.name || payload.skillName || "Operation";
    const total = payload.type === "uninstall"
      ? Math.max(1, skills.length)
      : payload.type === "sync-skill"
        ? Math.max(1, targets.length)
        : Math.max(1, targetIds.length);
    const detail = payload.type === "uninstall"
      ? `${skills.length} installed copies`
      : payload.type === "sync-skill"
        ? targets.map((target) => target.client || path.basename(target.dir)).join(", ")
        : sourceNamesForTargetIds(targetIds);
    const event = createOperationEvent({ type: payload.type, title, total, detail });
    setTimeout(() => runOperationEvent(event.id, payload), 0);
    return { status: 202, body: event };
  }
  return { status: 404, body: { ok: false, error: "Not found" } };
}

async function handleLocalApiRequest(request, response) {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);
    const result = await routeLocalApi(request, url);
    writeApiJson(response, result.status, result.body);
  } catch (error) {
    writeApiJson(response, 500, { ok: false, error: error.message || String(error) });
  }
}

function listenApiServerOn(port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handleLocalApiRequest);
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve(server);
    });
  });
}

async function stopLocalApiServer() {
  const server = apiServer;
  apiServer = null;
  apiActualPort = null;
  if (!server) return;
  await new Promise((resolve) => {
    server.close(() => resolve());
    server.closeAllConnections?.();
    server.closeIdleConnections?.();
  });
}

async function startLocalApiServer() {
  const settings = getSettings();
  await stopLocalApiServer();
  if (!settings.apiEnabled) return null;
  const startPort = normalizeApiPort(settings.apiPort);
  const maxPort = Math.min(65535, startPort + 99);
  for (let port = startPort; port <= maxPort; port += 1) {
    try {
      apiServer = await listenApiServerOn(port);
      apiActualPort = port;
      return apiActualPort;
    } catch (error) {
      if (error?.code !== "EADDRINUSE" && error?.code !== "EACCES") throw error;
    }
  }
  throw new Error(`No available local API port from ${startPort} to ${maxPort}.`);
}

async function restartLocalApiServer() {
  try {
    return await startLocalApiServer();
  } catch (error) {
    appendOperationLog({
      type: "api",
      status: "failed",
      title: "Local API",
      message: error.message || String(error),
      detail: `Configured port: ${getSettings().apiPort}`
    });
    return null;
  }
}

function localApiInfo() {
  const settings = getSettings();
  return {
    name: app.getName(),
    version: app.getVersion(),
    isPackaged: app.isPackaged,
    apiPort: apiActualPort,
    apiBaseUrl: apiActualPort ? `http://127.0.0.1:${apiActualPort}` : "",
    apiEnabled: settings.apiEnabled
  };
}

function testLocalApiConnection(port = apiActualPort) {
  const targetPort = Number(port || apiActualPort);
  if (!Number.isFinite(targetPort) || targetPort <= 0) {
    return Promise.resolve({ ok: false, port: null, message: "Local API is not running." });
  }
  return new Promise((resolve) => {
    const request = http.get({
      host: "127.0.0.1",
      port: targetPort,
      path: "/api/status",
      timeout: 1200
    }, (response) => {
      response.resume();
      resolve({
        ok: response.statusCode >= 200 && response.statusCode < 300,
        port: targetPort,
        statusCode: response.statusCode
      });
    });
    request.on("timeout", () => {
      request.destroy();
      resolve({ ok: false, port: targetPort, message: "Connection timed out." });
    });
    request.on("error", (error) => {
      resolve({ ok: false, port: targetPort, message: error.message || String(error) });
    });
  });
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
  return win;
}

function normalizeDragPoint(point) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

ipcMain.on("window-drag:start", (event, point) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const startMouse = normalizeDragPoint(point);
  if (!win || !startMouse || win.isDestroyed() || win.isFullScreen()) return;
  const [windowX, windowY] = win.getPosition();
  windowDragState.set(event.sender.id, {
    startMouse,
    startWindow: { x: windowX, y: windowY }
  });
});

ipcMain.on("window-drag:move", (event, point) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const drag = windowDragState.get(event.sender.id);
  const mouse = normalizeDragPoint(point);
  if (!win || !drag || !mouse || win.isDestroyed() || win.isFullScreen()) return;
  const nextX = Math.round(drag.startWindow.x + mouse.x - drag.startMouse.x);
  const nextY = Math.round(drag.startWindow.y + mouse.y - drag.startMouse.y);
  win.setPosition(nextX, nextY, false);
});

ipcMain.on("window-drag:end", (event) => {
  windowDragState.delete(event.sender.id);
});

ipcMain.handle("skills:scan", async () => {
  return scanInstalledSkills();
});

ipcMain.handle("clipboard:write", async (_event, text) => {
  const { clipboard } = require("electron");
  clipboard.writeText(String(text || ""));
  return true;
});

ipcMain.handle("skills:uninstalled", async () => {
  return scanUninstalledSkills();
});

ipcMain.handle("skills:delete-uninstalled", async (_event, dirs = []) => {
  const root = path.resolve(uninstalledSkillsDir());
  const targets = [...new Set((dirs || []).map((dir) => String(dir || "").trim()).filter(Boolean))];
  const deleted = [];
  const skipped = [];
  for (const dir of targets) {
    const resolved = path.resolve(dir);
    if (!resolved.startsWith(`${root}${path.sep}`)) {
      skipped.push({ dir, reason: "outside-uninstalled-root" });
      continue;
    }
    if (!fs.existsSync(resolved)) {
      skipped.push({ dir, reason: "missing" });
      continue;
    }
    await fsp.rm(resolved, { recursive: true, force: true });
    deleted.push(dir);
  }
  appendOperationLog({
    type: "uninstalled",
    status: "success",
    title: "Delete records",
    message: `已删除 ${deleted.length} 个 Uninstalled 记录。`,
    detail: skipped.length ? `跳过 ${skipped.length} 个记录。` : root
  });
  notifySkillsChanged({ type: "delete-uninstalled", deleted });
  return { deleted, skipped };
});

ipcMain.handle("skills:detail", async (_event, payload = {}) => {
  return skillDetailSnapshot(payload);
});

async function diffDirsHandler(_event, payload = {}) {
  const beforeDir = payload.beforeDir;
  const afterDir = payload.afterDir;
  if (!beforeDir || !afterDir || !fs.existsSync(beforeDir) || !fs.existsSync(afterDir)) {
    throw new Error("缺少可比较的目录。");
  }
  if (!fs.existsSync(path.join(beforeDir, "SKILL.md")) || !fs.existsSync(path.join(afterDir, "SKILL.md"))) {
    throw new Error("只能比较两个有效的 skill 目录。");
  }
  return {
    files: buildFileDiff(
      collectTextFilesSync(beforeDir, { includeContent: false }),
      collectTextFilesSync(afterDir, { includeContent: false })
    )
  };
}

ipcMain.handle("skills:diff-dirs", diffDirsHandler);
ipcMain.handle("skill-diff-dirs", diffDirsHandler);
ipcMain.handle("skill:diff-dirs", diffDirsHandler);
ipcMain.handle("skill-diff dirs", diffDirsHandler);

async function performUninstallSkill(skillDir, sourceInfo = {}) {
  try {
    if (!fs.existsSync(skillDir)) {
      appendOperationLog({ type: "uninstall", status: "missing", title: path.basename(skillDir), message: "原目录不存在，已跳过卸载。", detail: skillDir });
      return { path: skillDir, missing: true };
    }
    const stats = await fsp.stat(skillDir);
    if (!stats.isDirectory()) throw new Error("只能卸载 skill 目录。");
    const meta = readSkillPackageMeta(skillDir);
    const sourceId = sourceInfo.sourceId || inferSourceIdForSkillDir(skillDir);
    const activeState = sourceId ? versionStore().installations?.[installVersionKey(sourceId, meta.skillKey)] : null;
    const snapshotVersion = meta.version || "";
    const snapshotVersionLabel = snapshotVersion ? `v${snapshotVersion}` : (activeState?.activeLabel && !isGeneratedLocalVersionLabel(activeState.activeLabel)
      ? activeState.activeLabel
      : localVersionLabel(directoryUpdatedAt(skillDir)));
    await clearVersionHistoryForInstallation(skillDir, sourceInfo);
    await fsp.mkdir(uninstalledSkillsDir(), { recursive: true });
    await clearPreviousUninstalledSnapshots(skillDir, sourceInfo);
    const target = path.join(uninstalledSkillsDir(), `${safeName(path.basename(skillDir))}-${Date.now()}`);
    await fsp.rename(skillDir, target);
    await fsp.writeFile(path.join(target, uninstallMetaFile), JSON.stringify({
      sourceDir: skillDir,
      sourceClient: sourceInfo.client || "",
      sourceId,
      sourceLabel: sourceInfo.sourceLabel || "",
      version: snapshotVersion,
      versionLabel: snapshotVersionLabel,
      uninstalledAt: new Date().toISOString()
    }, null, 2));
    appendOperationLog({ type: "uninstall", status: "success", title: path.basename(skillDir), message: "已移动到 Uninstalled。", detail: `${skillDir} -> ${target}` });
    notifySkillsChanged({ type: "uninstall", skillDir, target, sourceInfo });
    return { path: target };
  } catch (error) {
    appendOperationLog({ type: "uninstall", status: "failed", title: path.basename(skillDir), message: error.message || String(error), detail: skillDir });
    throw error;
  }
}

ipcMain.handle("skills:uninstall", async (_event, skillDir, sourceInfo = {}) => performUninstallSkill(skillDir, sourceInfo));

async function performRestoreSkill(skillDir, targetSourceId, conflictStrategy = "skip") {
  try {
    if (!fs.existsSync(skillDir)) {
      appendOperationLog({ type: "restore", status: "missing", title: path.basename(skillDir), message: "Uninstalled 目录不存在，已跳过恢复。", detail: skillDir });
      return { path: skillDir, missing: true };
    }
    const stats = await fsp.stat(skillDir);
    if (!stats.isDirectory()) throw new Error("只能恢复 skill 目录。");
    const targetRoot = installRootFor(targetSourceId || getSettings().installSourceId);
    await fsp.mkdir(targetRoot, { recursive: true });
    const target = path.join(targetRoot, installDirectoryNameForSkill(skillDir));
    const strategy = normalizeConflictStrategy(conflictStrategy, "skip");
    if (fs.existsSync(target) && strategy === "skip") {
      appendOperationLog({ type: "restore", status: "skipped", title: path.basename(skillDir), message: "目标 Agent 已存在同名 skill，已按选择跳过。", detail: target });
      return { path: target, skipped: true, alreadyInstalled: true };
    }
    if (fs.existsSync(target) && strategy === "replace") {
      await archiveSkillDirectory(target, {
        sourceId: targetSourceId || getSettings().installSourceId,
        client: sourceLabelById(getSettings(), targetSourceId || getSettings().installSourceId),
        reason: "before-restore-replace"
      });
      await fsp.rm(target, { recursive: true, force: true });
    }
    const finalTarget = target;
    await fsp.rename(skillDir, finalTarget);
    await fsp.rm(path.join(finalTarget, uninstallMetaFile), { force: true }).catch(() => {});
    await fsp.rm(path.join(finalTarget, legacyUninstallMetaFile), { force: true }).catch(() => {});
    const restoredManifest = await archiveSkillDirectory(finalTarget, {
      sourceId: targetSourceId || getSettings().installSourceId,
      client: sourceLabelById(getSettings(), targetSourceId || getSettings().installSourceId),
      reason: "restore-active"
    });
    await setActiveVersionState(finalTarget, {
      sourceId: targetSourceId || getSettings().installSourceId,
      client: sourceLabelById(getSettings(), targetSourceId || getSettings().installSourceId)
    }, restoredManifest);
    appendOperationLog({ type: "restore", status: "success", title: path.basename(finalTarget), message: "已恢复安装。", detail: `${skillDir} -> ${finalTarget}` });
    notifySkillsChanged({ type: "restore", skillDir, target: finalTarget, targetSourceId });
    return { path: finalTarget };
  } catch (error) {
    appendOperationLog({ type: "restore", status: "failed", title: path.basename(skillDir), message: error.message || String(error), detail: skillDir });
    throw error;
  }
}

ipcMain.handle("skills:restore", async (_event, skillDir, targetSourceId, conflictStrategy) => performRestoreSkill(skillDir, targetSourceId, conflictStrategy));

async function performInstallLocalSkill(skillDir, targetSourceId, conflictStrategy = "skip") {
  const installRoot = installRootFor(targetSourceId || getSettings().installSourceId);
  const target = path.join(installRoot, installDirectoryNameForSkill(skillDir));
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
    const strategy = normalizeConflictStrategy(conflictStrategy, "skip");
    let finalTarget = target;
    if (fs.existsSync(target) && strategy === "skip") {
      appendOperationLog({ type: "install", status: "skipped", title: path.basename(skillDir), message: "目标 Agent 已存在同名 skill。", detail: target });
      return { path: target, installed: true, alreadyInstalled: true };
    }
    if (fs.existsSync(target) && strategy === "replace") {
      await archiveSkillDirectory(target, {
        sourceId: targetSourceId || getSettings().installSourceId,
        client: sourceLabelById(getSettings(), targetSourceId || getSettings().installSourceId),
        reason: "before-install-replace"
      });
      await fsp.rm(target, { recursive: true, force: true });
    }
    await fsp.cp(skillDir, finalTarget, { recursive: true, force: true });
    await fsp.rm(path.join(finalTarget, uninstallMetaFile), { force: true }).catch(() => {});
    await fsp.rm(path.join(finalTarget, legacyUninstallMetaFile), { force: true }).catch(() => {});
    const manifest = await archiveSkillDirectory(finalTarget, {
      sourceId: targetSourceId || getSettings().installSourceId,
      client: sourceLabelById(getSettings(), targetSourceId || getSettings().installSourceId),
      reason: "install-local-active"
    });
    await setActiveVersionState(finalTarget, {
      sourceId: targetSourceId || getSettings().installSourceId,
      client: sourceLabelById(getSettings(), targetSourceId || getSettings().installSourceId)
    }, manifest);
    appendOperationLog({ type: "install", status: "success", title: path.basename(skillDir), message: "已复制安装到指定 Agent。", detail: `${skillDir} -> ${finalTarget}` });
    notifySkillsChanged({ type: "install-local", skillDir, target: finalTarget, targetSourceId });
    return { path: finalTarget, installed: true };
  } catch (error) {
    appendOperationLog({ type: "install", status: "failed", title: path.basename(skillDir), message: error.message || String(error), detail: `${skillDir} -> ${target}` });
    throw error;
  }
}

ipcMain.handle("skills:install-local", async (_event, skillDir, targetSourceId, conflictStrategy) => performInstallLocalSkill(skillDir, targetSourceId, conflictStrategy));

async function performSyncSkill(sourceSkillDir, targetSkillDir, targetInfo = {}) {
  if (!sourceSkillDir || !targetSkillDir) throw new Error("缺少同步源或目标目录。");
  if (!fs.existsSync(sourceSkillDir)) throw new Error("同步源目录不存在。");
  if (path.resolve(sourceSkillDir) === path.resolve(targetSkillDir)) throw new Error("不能同步到自身。");
  const sourceStats = await fsp.stat(sourceSkillDir);
  if (!sourceStats.isDirectory()) throw new Error("同步源必须是 skill 目录。");
  if (fs.existsSync(targetSkillDir)) {
    await archiveSkillDirectory(targetSkillDir, { ...targetInfo, reason: "before-sync" });
    await fsp.rm(targetSkillDir, { recursive: true, force: true });
  }
  await fsp.mkdir(path.dirname(targetSkillDir), { recursive: true });
  await fsp.cp(sourceSkillDir, targetSkillDir, { recursive: true, force: true });
  const manifest = await archiveSkillDirectory(targetSkillDir, { ...targetInfo, reason: "sync-active" });
  await setActiveVersionState(targetSkillDir, targetInfo, manifest);
  appendOperationLog({
    type: "sync",
    status: "success",
    title: path.basename(targetSkillDir),
    message: `已同步到 ${targetInfo.client || targetInfo.sourceClient || path.basename(path.dirname(targetSkillDir))}。`,
    detail: `${sourceSkillDir} -> ${targetSkillDir}`
  });
  notifySkillsChanged({ type: "sync", source: sourceSkillDir, target: targetSkillDir, targetInfo });
  return { source: sourceSkillDir, target: targetSkillDir, manifest };
}

ipcMain.handle("skills:reveal", async (_event, filePath) => {
  shell.showItemInFolder(expandHome(normalizeUserPathInput(filePath)));
  return true;
});

ipcMain.handle("skills:open", async (_event, filePath) => {
  if (/^https?:\/\//.test(filePath)) {
    await shell.openExternal(filePath);
    return true;
  }
  const target = expandHome(normalizeUserPathInput(filePath));
  if (!fs.existsSync(target)) throw new Error("目录不存在");
  await shell.openPath(target);
  return true;
});

ipcMain.handle("path:exists", async (_event, filePath) => {
  if (!filePath) return false;
  const target = expandHome(normalizeUserPathInput(filePath));
  return fs.existsSync(target);
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

ipcMain.handle("files:create", async (_event, payload = {}) => {
  const baseDir = path.resolve(payload.baseDir || "");
  const rawName = String(payload.name || "").trim();
  const type = payload.type === "directory" ? "directory" : "file";
  if (!baseDir || !fs.existsSync(baseDir)) throw new Error("目标目录不存在。");
  if (!rawName || rawName.includes("\0")) throw new Error("请输入有效名称。");
  const target = path.resolve(baseDir, rawName);
  if (!target.startsWith(`${baseDir}${path.sep}`) && target !== baseDir) throw new Error("不能在 skill 目录外创建文件。");
  if (fs.existsSync(target)) throw new Error("目标已存在。");
  await fsp.mkdir(path.dirname(target), { recursive: true });
  if (type === "directory") {
    await fsp.mkdir(target, { recursive: true });
  } else {
    await fsp.writeFile(target, "", "utf8");
  }
  return { path: target, name: path.basename(target), type };
});

ipcMain.handle("files:rename", async (_event, payload = {}) => {
  const source = path.resolve(payload.path || "");
  const rawName = String(payload.name || "").trim();
  if (!source || !fs.existsSync(source)) throw new Error("要重命名的文件不存在。");
  if (!rawName || rawName.includes("\0") || rawName.includes("/") || rawName.includes("\\")) throw new Error("请输入有效名称。");
  const stats = await fsp.stat(source);
  const target = path.resolve(path.dirname(source), rawName);
  if (target === source) return { path: source, name: path.basename(source), type: stats.isDirectory() ? "directory" : "file", unchanged: true };
  if (target !== path.join(path.dirname(source), rawName)) throw new Error("不能重命名到当前目录外。");
  if (fs.existsSync(target)) throw new Error("目标名称已存在。");
  const skillRoot = payload.skillDir ? path.resolve(payload.skillDir) : "";
  const isSkillPackageRename = Boolean(skillRoot && (source === skillRoot || source.startsWith(`${skillRoot}${path.sep}`)));
  if (isSkillPackageRename && source === skillRoot) throw new Error("不能重命名 skill 根目录。");
  await fsp.rename(source, target);
  return { path: target, name: path.basename(target), type: stats.isDirectory() ? "directory" : "file" };
});

ipcMain.handle("files:delete", async (_event, payload = {}) => {
  const target = path.resolve(payload.path || "");
  const skillRoot = payload.skillDir ? path.resolve(payload.skillDir) : "";
  if (!target || !fs.existsSync(target)) throw new Error("要删除的文件不存在。");
  if (!skillRoot || !(target === skillRoot || target.startsWith(`${skillRoot}${path.sep}`))) throw new Error("只能删除当前 skill 目录内的文件。");
  if (target === skillRoot) throw new Error("不能删除 skill 根目录。");
  if (target === path.join(skillRoot, "SKILL.md")) throw new Error("不能删除 SKILL.md。");
  const stats = await fsp.stat(target);
  if (stats.isFile()) await createVersionSnapshot(target, "删除前");
  await fsp.rm(target, { recursive: true, force: true });
  return {
    path: target,
    parentDir: path.dirname(target),
    name: path.basename(target),
    type: stats.isDirectory() ? "directory" : "file"
  };
});

ipcMain.handle("files:save", async (_event, filePath, content, context = {}) => {
  const current = await fsp.readFile(filePath);
  if (contentHash(current) === contentHash(Buffer.from(content, "utf8"))) {
    const stats = await fsp.stat(filePath);
    return { path: filePath, content, size: stats.size, updatedAt: stats.mtime.toISOString(), unchanged: true };
  }
  const skillRoot = context?.skillDir ? path.resolve(context.skillDir) : "";
  const resolvedFilePath = path.resolve(filePath);
  const isSkillPackageSave = Boolean(skillRoot && (resolvedFilePath === skillRoot || resolvedFilePath.startsWith(`${skillRoot}${path.sep}`)));
  await createVersionSnapshot(filePath, "保存前");
  await fsp.writeFile(filePath, content, "utf8");
  const stats = await fsp.stat(filePath);
  return { path: filePath, content, size: stats.size, updatedAt: stats.mtime.toISOString(), packageChanged: isSkillPackageSave };
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

ipcMain.handle("skill-versions:activate", async (_event, payload) => activateSkillVersion(payload));
ipcMain.handle("skill-versions:delete", async (_event, payload) => deleteSkillVersions(payload));
ipcMain.handle("skill-versions:diff", async (_event, payload) => diffSkillVersion(payload));
ipcMain.handle("skill-versions:preview-upgrade", async (_event, payload) => previewSkillUpgrade(payload));
ipcMain.handle("skill-versions:commit-upgrade", async (_event, payload) => commitSkillUpgrade(payload));

ipcMain.handle("github:trends", async (_event, source = "alltime", page = 0, query = "") => {
  const skillsShUrls = {
    skillssh: "https://www.skills.sh/",
    alltime: "https://www.skills.sh/",
    trending: "https://www.skills.sh/trending",
    hot: "https://www.skills.sh/hot"
  };
  if (skillsShUrls[source]) return loadSkillsShLeaderboard(skillsShUrls[source], source, page, query);
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
  const fallbackQuery = [queries[source] || queries.all, query].filter(Boolean).join(" ");
  const encodedQuery = encodeURIComponent(fallbackQuery);
  const result = await fetchJson(`https://api.github.com/search/repositories?q=${encodedQuery}&sort=stars&order=desc&per_page=50`);
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

async function performInstallDiscoverSkill(item, targetSourceId, forceUpdate = false, conflictStrategy = "") {
  if (!item?.url || !item?.fullName) throw new Error("缺少可安装的 discover 条目。");
  const installRoot = installRootFor(targetSourceId || getSettings().installSourceId);
  const target = path.join(installRoot, safeName(item.name || item.fullName));
  let finalTarget = target;
  const repoUrl = item.repositoryUrl || (item.fullName.startsWith("http") ? item.fullName : `https://github.com/${item.fullName}`);
  let tempRoot = "";
  try {
    await fsp.mkdir(installRoot, { recursive: true });
    const strategy = normalizeConflictStrategy(conflictStrategy, forceUpdate ? "replace" : "skip");
    if (fs.existsSync(target) && strategy === "skip") {
      appendOperationLog({ type: "install", status: "skipped", title: item.name, message: "目标 Agent 已存在同名 skill。", detail: target });
      return { path: target, installed: true, alreadyInstalled: true };
    }
    if (fs.existsSync(target) && strategy === "replace") {
      await archiveSkillDirectory(target, {
        sourceId: targetSourceId || getSettings().installSourceId,
        client: sourceLabelById(getSettings(), targetSourceId || getSettings().installSourceId),
        reason: "before-update"
      });
      await fsp.rm(target, { recursive: true, force: true });
    }
    if (item.installMethod === "skills-cli" || item.source === "skillssh") {
      tempRoot = await fsp.mkdtemp(path.join(app.getPath("temp"), "skill-manager-install-"));
      const repoDir = path.join(tempRoot, "repo");
      const cloneResult = await cloneGithubRepoWithFallback(repoUrl, repoDir, tempRoot);
      const skillDir = await findSkillDirectory(cloneResult.repoDir, item.name);
      await fsp.cp(skillDir, finalTarget, { recursive: true, force: true });
      const manifest = await archiveSkillDirectory(finalTarget, {
        sourceId: targetSourceId || getSettings().installSourceId,
        client: sourceLabelById(getSettings(), targetSourceId || getSettings().installSourceId),
        reason: strategy === "replace" ? "update-active" : "install-discover-active"
      });
      await setActiveVersionState(finalTarget, {
        sourceId: targetSourceId || getSettings().installSourceId,
        client: sourceLabelById(getSettings(), targetSourceId || getSettings().installSourceId)
      }, manifest);
      const message = cloneResult.method === "github-zip" ? "git 失败后，已通过 GitHub zip 安装到指定 Agent。" : "已安装到指定 Agent。";
      appendOperationLog({ type: "install", status: "success", title: item.name, message, detail: `${repoUrl} -> ${finalTarget}` });
      notifySkillsChanged({ type: "install-discover", item, target: finalTarget, targetSourceId });
      return { path: finalTarget, installed: true, command: item.installCommand, method: cloneResult.method === "github-zip" ? "github-zip-fallback" : "copy-from-repo" };
    }

    try {
      await execFileAsync("git", ["clone", "--depth", "1", item.url, finalTarget], { timeout: 120000 });
      const manifest = await archiveSkillDirectory(finalTarget, {
        sourceId: targetSourceId || getSettings().installSourceId,
        client: sourceLabelById(getSettings(), targetSourceId || getSettings().installSourceId),
        reason: strategy === "replace" ? "update-active" : "install-discover-active"
      });
      await setActiveVersionState(finalTarget, {
        sourceId: targetSourceId || getSettings().installSourceId,
        client: sourceLabelById(getSettings(), targetSourceId || getSettings().installSourceId)
      }, manifest);
      appendOperationLog({ type: "install", status: "success", title: item.name, message: "已安装到指定 Agent。", detail: `${item.url} -> ${finalTarget}` });
      notifySkillsChanged({ type: "install-discover", item, target: finalTarget, targetSourceId });
      return { path: finalTarget, installed: true, method: "git-clone" };
    } catch (gitError) {
      const repoFullName = githubRepoFullName(item.url);
      if (!repoFullName) throw gitError;
      await fsp.rm(finalTarget, { recursive: true, force: true }).catch(() => {});
      tempRoot = await fsp.mkdtemp(path.join(app.getPath("temp"), "skill-manager-install-"));
      const repoDir = await downloadGithubRepoZip(repoFullName, path.join(tempRoot, "zip"));
      const skillDir = await findSkillDirectory(repoDir, item.name);
      await fsp.cp(skillDir, finalTarget, { recursive: true, force: true });
      const manifest = await archiveSkillDirectory(finalTarget, {
        sourceId: targetSourceId || getSettings().installSourceId,
        client: sourceLabelById(getSettings(), targetSourceId || getSettings().installSourceId),
        reason: strategy === "replace" ? "update-active" : "install-discover-active"
      });
      await setActiveVersionState(finalTarget, {
        sourceId: targetSourceId || getSettings().installSourceId,
        client: sourceLabelById(getSettings(), targetSourceId || getSettings().installSourceId)
      }, manifest);
      appendOperationLog({ type: "install", status: "success", title: item.name, message: "git 失败后，已通过 GitHub zip 安装到指定 Agent。", detail: `${item.url} -> ${finalTarget}` });
      notifySkillsChanged({ type: "install-discover", item, target: finalTarget, targetSourceId });
      return { path: finalTarget, installed: true, method: "github-zip-fallback" };
    }
  } catch (error) {
    appendOperationLog({ type: "install", status: "failed", title: item.name || item.fullName, message: error.message || String(error), detail: `${repoUrl} -> ${target}` });
    throw error;
  } finally {
    if (tempRoot) await fsp.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

ipcMain.handle("discover:install", async (_event, item, targetSourceId, forceUpdate = false, conflictStrategy) => performInstallDiscoverSkill(item, targetSourceId, forceUpdate, conflictStrategy));

ipcMain.handle("sources:get", async () => getStoreValue("sources", defaultSources()));

ipcMain.handle("sources:save", async (_event, sources) => {
  setStoreValue("sources", sources);
  return getStoreValue("sources", defaultSources());
});

ipcMain.handle("settings:get", async () => getSettings());

ipcMain.handle("settings:save", async (_event, settings) => {
  const { before, saved } = saveSettingsWithLog(settings);
  buildAppMenu();
  if (before.language !== saved.language) notifyLanguageChanged(saved.language);
  if (before.apiEnabled !== saved.apiEnabled || before.apiPort !== saved.apiPort) await restartLocalApiServer();
  return saved;
});

ipcMain.handle("settings:set-language", async (_event, language) => setLanguage(language));

ipcMain.handle("api:restart", async (_event, settings) => {
  const { before, saved } = saveSettingsWithLog(settings || getSettings());
  buildAppMenu();
  if (before.language !== saved.language) notifyLanguageChanged(saved.language);
  await restartLocalApiServer();
  const connection = await testLocalApiConnection();
  return { settings: saved, info: localApiInfo(), connection };
});

ipcMain.handle("api:test", async (_event, port) => testLocalApiConnection(port || apiActualPort));

ipcMain.handle("app:info", async () => localApiInfo());

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
        await performInstallDiscoverSkill(payload.item, targetId, Boolean(payload.forceUpdate), payload.conflictActions?.[targetId]);
        progress += 1;
        updateOperationEvent(eventId, { progress });
      }
    } else if (payload.type === "install-local") {
      for (const targetId of payload.targetIds || []) {
        updateOperationEvent(eventId, { progress, current: `安装到 ${sourceNamesForTargetIds([targetId])}` });
        await performInstallLocalSkill(payload.skillDir, targetId, payload.conflictActions?.[targetId]);
        progress += 1;
        updateOperationEvent(eventId, { progress });
      }
    } else if (payload.type === "restore") {
      const targetIds = payload.targetIds || [];
      const restoreRecords = payload.restoreRecords || {};
      for (let index = 0; index < targetIds.length; index += 1) {
        const targetId = targetIds[index];
        const recordDir = restoreRecords[targetId] || "";
        updateOperationEvent(eventId, { progress, current: `恢复到 ${sourceNamesForTargetIds([targetId])}` });
        if (recordDir) await performRestoreSkill(recordDir, targetId, payload.conflictActions?.[targetId]);
        else await performInstallLocalSkill(payload.skillDir, targetId, payload.conflictActions?.[targetId]);
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
    } else if (payload.type === "sync-skill") {
      const settings = getSettings();
      const targets = payload.targets || [];
      await Promise.all(targets.map(async (target) => {
        const targetSourceId = target.sourceId || target.id;
        const configuredSource = settings.sources.find((source) => source.id === targetSourceId || source.client === target.client);
        const targetRoot = target.root || configuredSource?.root;
        const targetDir = target.dir || (targetRoot
          ? path.join(expandHome(targetRoot), safeName(path.basename(payload.sourceDir || payload.skillName || payload.title || "skill")))
          : "");
        const targetInfo = {
          ...target,
          sourceId: targetSourceId,
          client: target.client || configuredSource?.client,
          sourceLabel: target.sourceLabel || configuredSource?.label,
          root: targetRoot
        };
        updateOperationEvent(eventId, { progress, current: `同步到 ${targetInfo.client || path.basename(targetDir)}` });
        await performSyncSkill(payload.sourceDir, targetDir, targetInfo);
        progress += 1;
        updateOperationEvent(eventId, { progress });
      }));
    }
    updateOperationEvent(eventId, { status: "success", progress, current: "完成", finishedAt: new Date().toISOString() });
  } catch (error) {
    updateOperationEvent(eventId, { status: "failed", progress, current: "失败", finishedAt: new Date().toISOString(), error: error.message || String(error) });
  }
}

ipcMain.handle("events:submit", async (_event, payload) => {
  const targetIds = payload.targetIds || [];
  const skills = payload.skills || [];
  const targets = payload.targets || [];
  const title = payload.title || payload.item?.name || payload.skillName || "Operation";
  const total = payload.type === "uninstall"
    ? Math.max(1, skills.length)
    : payload.type === "sync-skill"
      ? Math.max(1, targets.length)
      : Math.max(1, targetIds.length);
  const detail = payload.type === "uninstall"
    ? `${skills.length} installed copies`
    : payload.type === "sync-skill"
      ? targets.map((target) => target.client || path.basename(target.dir)).join(", ")
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
  buildAppMenu();
  await migrateLegacyManagedDirectories();
  await restartLocalApiServer();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (apiServer) apiServer.close();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
