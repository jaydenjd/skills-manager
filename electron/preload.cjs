const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("skillStudio", {
  scan: () => ipcRenderer.invoke("skills:scan"),
  scanUninstalled: () => ipcRenderer.invoke("skills:uninstalled"),
  uninstallSkill: (dir) => ipcRenderer.invoke("skills:uninstall", dir),
  installLocalSkill: (dir, targetSourceId) => ipcRenderer.invoke("skills:install-local", dir, targetSourceId),
  restoreSkill: (dir, targetSourceId) => ipcRenderer.invoke("skills:restore", dir, targetSourceId),
  reveal: (path) => ipcRenderer.invoke("skills:reveal", path),
  open: (path) => ipcRenderer.invoke("skills:open", path),
  readFile: (path) => ipcRenderer.invoke("files:read", path),
  saveFile: (path, content) => ipcRenderer.invoke("files:save", path, content),
  fileHistory: (path) => ipcRenderer.invoke("files:history", path),
  fileVersion: (path, versionId) => ipcRenderer.invoke("files:version", path, versionId),
  restoreFileVersion: (path, versionId) => ipcRenderer.invoke("files:restore", path, versionId),
  githubTrends: (source) => ipcRenderer.invoke("github:trends", source),
  discoverDetail: (item) => ipcRenderer.invoke("discover:detail", item),
  installDiscover: (item, targetSourceId, forceUpdate) => ipcRenderer.invoke("discover:install", item, targetSourceId, forceUpdate),
  getSources: () => ipcRenderer.invoke("sources:get"),
  saveSources: (sources) => ipcRenderer.invoke("sources:save", sources),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  operationLogs: () => ipcRenderer.invoke("operations:list"),
  clearOperationLogs: () => ipcRenderer.invoke("operations:clear"),
  submitEvent: (payload) => ipcRenderer.invoke("events:submit", payload),
  operationEvents: () => ipcRenderer.invoke("events:list"),
  clearOperationEvents: () => ipcRenderer.invoke("events:clear")
});
