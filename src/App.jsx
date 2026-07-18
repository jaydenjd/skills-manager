import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Command,
  Edit3,
  ExternalLink,
  Eye,
  FileCode2,
  FileText,
  FolderOpen,
  Github,
  History,
  ListTree,
  GripVertical,
  RefreshCcw,
  RotateCcw,
  Save,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tags,
  Trash2,
  X
} from "lucide-react";
import "./styles.css";
import { moveItem, orderedAgentCounts } from "./settings-utils.js";

const fmt = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit"
});
const starStorageKey = "skill-manager-stars";
const legacyStarStorageKey = "skill-studio-stars";
const installTargetsStorageKey = "skill-manager-last-install-targets";
const uninstallTargetsStorageKey = "skill-manager-last-uninstall-targets";
const versionTargetsStorageKey = "skill-manager-last-version-targets";
const legacyInstallTargetsStorageKey = "skill-studio-last-install-targets";
const scanCacheStorageKey = "skill-manager-last-scan";
const settingsModeStorageKey = "skill-manager-settings-mode";
const starSourceOptions = [
  ["discover", "Discover"],
  ["installed", "Installed"],
  ["uninstalled", "Uninstalled"]
];

const I18nContext = createContext({ lang: "zh", t: (key) => key });

const messages = {
  zh: {
    appSubtitle: "本地多客户端 skill 管理器",
    language: "语言",
    zh: "中文",
    en: "English",
    library: "资料库",
    discover: "发现",
    installed: "已安装",
    uninstalled: "已卸载",
    starred: "收藏",
    tags: "标签",
    agents: "Agents",
    allAgents: "全部 Agents",
    events: "事件",
    logs: "日志",
    settings: "设置",
    loading: "加载中",
    scanning: "扫描中",
    preparing: "准备中",
    matches: "个匹配项",
    searchConfig: "搜索配置",
    rescan: "重新扫描",
    sortOrder: "排序",
    sortUpdated: "更新时间",
    sortAlpha: "字母顺序",
    tagFilter: "标签",
    selectedTags: "多选标签",
    clear: "清除",
    relation: "关系",
    all: "全部",
    source: "来源",
    installedLabel: "已安装",
    totalInstalls: "累计",
    recentEightWeeks: "近 8 周",
    install: "安装",
    installSkills: "安装 Skills",
    skillsLeaderboard: "Skills 榜单",
    skillsLeaderboardDesc: "来自 skills.sh 的公开榜单",
    localInstall: "本地导入",
    localInstallDesc: "从本机目录或 zip 压缩包导入包含 SKILL.md 的 skill",
    remoteInstall: "远程安装",
    remoteInstallDesc: "从 Git / URL / 压缩包安装 skill",
    importLocal: "本地导入",
    importLocalTitle: "导入本地 skill",
    importLocalDesc: "选择或输入一个包含 SKILL.md 的目录或 zip 压缩包，导入后会复制安装到选中的 Agent。",
    chooseDirectory: "选择目录/zip",
    localSkillPath: "本地 skill 目录或 zip",
    localSkillPathPlaceholder: "~/work/my-skill 或 ~/Downloads/my-skill.zip",
    importLocalInvalid: "导入失败：{message}",
    remoteSkillUrl: "远程地址",
    remoteSkillUrlPlaceholder: "https://github.com/owner/repo 或 https://example.com/skill.zip",
    remoteSkillName: "skill 名称（可选）",
    remoteSkillNamePlaceholder: "仓库里有多个 skill 时填写",
    remoteInstallHint: "支持 GitHub、Git URL 和 zip 压缩包。仓库内有多个 skill 时建议填写 skill 名称。",
    remoteInstallInvalid: "远程安装失败：{message}",
    uninstall: "卸载",
    update: "更新",
    recover: "恢复",
    sync: "同步",
    delete: "删除",
    cancel: "取消",
    confirm: "确认",
    processing: "处理中",
    installing: "安装中",
    publishVersion: "发布版本",
    publishing: "发布中",
    confirmPublish: "确认发布",
    edit: "编辑",
    cancelEdit: "取消编辑",
    history: "历史版本",
    clearRecords: "清空记录",
    cancelSelection: "取消勾选",
    refresh: "刷新",
    clearLogs: "清空日志",
    clearEvents: "清空事件",
    operationLogs: "操作日志",
    operationEvents: "操作事件",
    operationLogsDesc: "查看安装、卸载、恢复和设置的最近操作结果。",
    operationEventsDesc: "后台安装、卸载、更新、恢复的状态流转和进度。",
    logFilter: "分类",
    allTypes: "全部分类",
    selectNoTypes: "全不选",
    searchLogs: "搜索标题、内容、详情",
    noLogs: "还没有操作日志。",
    noEvents: "还没有操作事件。",
    settingsDesc: "管理安装目标、agent 命名和 skill 目录展示规则。",
    saveSettings: "保存设置",
    discardSettings: "取消修改",
    unsavedSettings: "查看修改内容",
    viewSettingChanges: "修改内容",
    settingsChanges: "设置修改",
    settingChangeCount: "{count} 项修改",
    noSettingChanges: "暂无配置修改。",
    before: "修改前",
    after: "修改后",
    directoryMissing: "目录不存在",
    saving: "保存中",
    visual: "可视化",
    json: "JSON",
    appVersion: "应用版本",
    packagedApp: "已打包应用",
    devMode: "开发模式",
    jsonSettings: "JSON 配置",
    jsonSettingsDesc: "直接编辑完整 settings。保存时会校验 JSON，并继续应用默认值与来源过滤规则。",
    localApi: "本地 API",
    localApiDesc: "给 CLI、agent 和自动化脚本使用，只监听 127.0.0.1。",
    enableLocalApi: "启用本地 API",
    configuredPort: "配置端口",
    currentPort: "当前端口",
    apiBaseUrl: "API 地址",
    apiStopped: "未启动",
    apiConnectivity: "连通状态",
    refreshApi: "刷新 API",
    testApi: "测试连通",
    apiTesting: "连通中",
    apiConnected: "已连通",
    apiDisconnected: "未连通",
    apiRefreshing: "刷新中",
    apiRefreshFailed: "刷新失败：{message}",
    defaultInstallTarget: "默认安装目标",
    defaultInstallTargetDesc: "发现页安装和已卸载恢复默认会放到这里。",
    installToAgent: "安装到 agent",
    installDialogDefault: "安装弹窗默认选择",
    rememberLast: "记住上次选择",
    alwaysDefault: "每次使用默认 agent",
    mergeAllAgents: "All Agents 下合并同名 skill",
    retention: "记录保留",
    retentionDesc: "Events 和 Logs 默认永久保留；填写天数后会自动清理更早的记录。",
    retentionDays: "保留天数",
    forever: "永久保留",
    customDays: "按天数保留",
    ignoreTitle: "目录 Ignore",
    ignoreDesc: "类似 gitignore。配置后文件不会出现在 skill 目录树里。",
    agentsDesc: "配置左侧 Agents 的命名，以及每个 agent 对应的 skills 目录。",
    dragToReorder: "拖动排序",
    moveUp: "上移",
    moveDown: "下移",
    addAgent: "新增 agent",
    moreAgents: "更多 Agent（{count}）",
    collapseAgents: "收起 Agent",
    newAgent: "New Agent",
    newAgentSkills: "New Agent Skills",
    duplicateAgentName: "Agent 名称不能重复：{name}",
    enabled: "启用",
    disabled: "停用",
    enabledStatus: "已启用",
    detectedDisabled: "已检测但未启用",
    name: "名称",
    description: "说明",
    directory: "目录",
    openDirectory: "打开目录",
    remove: "移除",
    removeAgentConfirm: "确认移除 Agent「{name}」？相关配置会从 Skill Manager 中删除。",
    chooseInstallAgent: "选择安装到的 agent",
    chooseUninstallAgent: "选择卸载的 agent",
    chooseUpgradeAgent: "选择发布版本的 agent",
    chooseSyncAgent: "选择同步到的 agent",
    chooseRecoverAgent: "选择恢复到的 agent",
    chooseDeleteUninstalled: "选择删除的已卸载记录",
    chooseUpdateAgent: "选择更新的 agent",
    selectAll: "全选",
    deselectAll: "取消全选",
    snapshot: "快照",
    notInstalled: "未安装",
    searchScope: "搜索范围",
    searchName: "名称",
    searchDescription: "描述",
    searchTags: "标签",
    searchPath: "路径",
    searchContent: "内容",
    customSearch: "可自定义",
    sourceFilter: "来源",
    allSources: "所有来源",
    noSource: "无",
    selectTagHint: "选择一个标签，查看包含该标签的所有 skill。",
    tagContains: "个 skill 包含这个标签",
    noDescription: "暂无描述",
    clearLogsConfirm: "确认清空所有操作日志？此操作不可撤销。",
    clearEventsConfirm: "确认清空所有操作事件？此操作不可撤销。",
    selectedCount: "已选择",
    submit: "确认提交",
    submitting: "提交中",
    back: "返回",
    viewDiff: "查看差异",
    unknownVersion: "版本未知",
    installedVersion: "已安装",
    snapshotVersion: "快照",
    skip: "跳过",
    replace: "覆盖",
    conflictHint: "目标 agent 已存在同名 skill，请为每个冲突选择处理方式。",
    conflictNote: "Discover 远端安装前没有本地目录时无法直接比较；替换前会自动归档当前目录。",
    installConflict: "安装冲突确认",
    updateConflict: "更新冲突确认",
    recoverConflict: "恢复冲突确认",
    star: "收藏",
    unstar: "取消收藏",
    repository: "仓库",
    openOn: "打开",
    localScanning: "本地 skills 扫描中",
    discoverScanning: "正在加载 skills.sh",
    emptyUninstalled: "已卸载里还没有可恢复的 skill。",
    emptyStarred: "收藏里还没有收藏的 skill。",
    emptyDiscover: "当前发现条件下没有匹配结果。",
    emptyTags: "当前还没有可统计的标签。",
    emptyLocal: "当前条件下没有本地 skill。",
    discoverEmptyHint: "选择一个发现页 skill 查看来源、热度、仓库和安装信息。",
    saveChanges: "保存修改",
    discardChanges: "取消修改",
    savingChanges: "保存中",
    editing: "正在编辑",
    switchingVersion: "正在切换版本...",
    clearRecordsConfirm: "清空记录",
    updatedAt: "更新",
    size: "大小",
    lines: "行数",
    currentCopy: "当前副本",
    uninstallSource: "卸载来源",
    installStatus: "安装状态",
    version: "版本",
    weeklyActivity: "近 8 周活跃",
    rank: "排名",
    basicInfo: "基本信息",
    installMethod: "安装方式",
    summary: "摘要",
    loadingSummary: "正在从 skills.sh 加载摘要...",
    noSummary: "这个 skill 暂时没有提供摘要。",
    skillContent: "SKILL 内容",
    noSkillContent: "正在加载或暂无 SKILL.md 内容。",
    discoverDescriptionFallback: "来自 {source} 的 {name}。安装后会出现在已安装中，可以继续查看 SKILL.md、目录结构和历史版本。",
    updatedPrefix: "更新",
    skillDirectory: "Skill 目录",
    directoryName: "目录名",
    fileNameMd: "文件名.md",
    added: "新增",
    removed: "删除",
    changedLines: "行变化",
    noContentDiff: "无内容差异",
    noDirectoryDiff: "这个版本与当前目录没有内容差异。",
    changedFiles: "变更文件",
    binaryDiffOnly: "二进制或大文件，仅记录文件状态变化。",
    current: "当前",
    activeIn: "使用中",
    switchVersion: "切换",
    deleteSelected: "删除选中",
    latest: "最新",
    latestVersionTitle: "点击切换到最新版本 {version}",
    notLatestVersionLabel: "不是最新版本，最新为 {version}",
    selectSkillHint: "选择一个 skill 查看完整内容、目录结构、来源和标签。",
    revealDirectoryTitle: "点击定位目录",
    addFile: "+ 文件",
    addDirectory: "+ 目录",
    addFileTitle: "在当前目录新增文件",
    addDirectoryTitle: "在当前目录新增目录",
    editMode: "编辑模式",
    readMode: "阅读模式",
    copyRelativePath: "复制相对路径",
    copyAbsolutePath: "复制绝对路径",
    createFileHere: "在此新增文件",
    createDirectoryHere: "在此新增目录",
    rename: "重命名",
    unsavedChangesPrompt: "当前文件有未保存修改，切换前请选择处理方式。",
    saveAndSwitch: "保存并切换",
    discardAndSwitch: "放弃修改",
    continueEditing: "继续编辑",
    noSyncTargets: "没有可同步的其它 Agent。",
    submittedSync: "已提交同步到 {count} 个 Agent。",
    unknown: "未知",
    directoryLabel: "目录",
    fileLabel: "文件",
    addEntryNameRequired: "请输入要新增的{name}名称。",
    renameRequired: "请输入新的名称。",
    deleteItemsConfirm: "确认删除 {count} 个项目？",
    deleteItemsConfirmNote: "删除后可在发布版本前的历史版本中找回，但当前工作目录会移除它。",
    copiedPath: "已复制{type}路径：{path}",
    absolutePath: "绝对",
    relativePath: "相对",
    copyFailed: "复制失败：{message}",
    chooseVersionConfirm: "将 {client} 的 {skill} 选择为 {version}？\n当前目录会先自动保存为一个可回滚版本。",
    deleteHistoryConfirm: "确认删除 {client} 选中的 {count} 个历史版本？\n当前正在使用的版本不会被删除。",
    deleteHistoryGlobalConfirm: "确认删除 {count} 个历史版本？\n删除后不可恢复，当前正在使用的版本不会被删除。",
    activeVersions: "个正在使用",
    missingVersions: "个已不存在",
    deletedVersionsSummary: "已删除 {deleted} 个版本，跳过 {skipped}的版本。",
    saveBeforePublish: "请先保存或取消当前修改，再发布版本。",
    noContentChangeForClient: "{client} 无内容改动，不能发布版本。",
    noContentChange: "无内容改动",
    noAgentChanges: "所有 Agent 都没有内容改动，不能发布版本。",
    unsavedBeforeExitEdit: "当前文件有未保存修改，退出编辑前请选择处理方式。",
    unsavedBeforeSwitch: "当前文件有未保存修改，切换前请选择处理方式。",
    historyTitle: "{name} · 历史版本",
    historyVersionCount: "{client} · {count} 个历史目录版本",
    clearAll: "清除全部",
    close: "关闭",
    noHistory: "还没有历史版本。保存 skill 后会自动创建目录版本。",
    currentVersion: "当前版本",
    compareCurrentWith: "对比当前目录与 {version}",
    historyVersion: "历史版本",
    chooseThisVersion: "选择此版本",
    selectHistoryHint: "选择一个历史版本查看更改。",
    confirmPublishTitle: "{name} · 确认发布版本",
    perAgentPublish: "每个 Agent 独立发布自己的版本",
    publishForAgents: "为 {count} 个 Agent 发布版本",
    publishingDots: "发布中...",
    publishDiffNotice: "{client}发布前后差异。确认后会写入 SKILL.md version，并创建新的 skill 版本。",
    generatingPublishDiff: "正在生成发布差异。",
    publishMessage: "发布备注",
    publishMessagePlaceholder: "可填写本次发布说明；留空时会自动生成。",
    autoPublishMessage: "发布 {name} {version}，包含 {count} 个文件变更。",
    historyMessageFallback: "无备注",
    notFound: "未发现",
    githubTrending: "GitHub 趋势",
    updatingNow: "更新中",
    trendsUnavailable: "趋势暂不可用",
    loadingAppVersion: "读取中",
    jsonObjectRequired: "配置必须是 JSON object。",
    syncFrom: "从 {source} 同步",
    currentWriting: "当前",
    incomingWriting: "待写入",
    tagLabel: "标签：{tag}",
    tagAndTitle: "必须同时包含所有已选标签",
    tagOrTitle: "包含任意一个已选标签即可",
    uninstallConfirm: "卸载 {name}？\n不会真正删除，会移动到 Uninstalled，之后可以恢复安装。",
    submittedUninstall: "{name} 已提交后台卸载。",
    submitFailed: "提交失败：{message}",
    agentRecords: "{count} 个 Agent 记录",
    clearUninstalledConfirm: "确认清空 {count} 条 Uninstalled 记录？\n删除后不可恢复，也不会影响当前已安装的 skill。",
    clearUninstalledDone: "已清空 {count} 条 Uninstalled 记录。",
    clearFailed: "清空失败：{message}",
    versionUnknownNoCompare: "任一方版本未知，不会自动判断新旧。",
    possibleDowngrade: "待写入版本低于当前版本，可能降级。",
    directoryDiffAlertTitle: "目录差异：{client}",
    modified: "修改",
    noTextDiff: "没有发现文本文件差异。",
    diffFailed: "差异查看失败：{message}",
    submittedBackground: "{name} 已提交后台执行。",
    deleteUninstalledConfirm: "确认删除 {count} 个 Uninstalled 记录？\n删除后不可恢复，也不会影响当前已安装的 skill。",
    deletedUninstalledDone: "已删除 {count} 个 Uninstalled 记录。",
    deleteFailed: "删除失败：{message}",
    recoverMissing: "{name} 的 Uninstalled 目录已不存在，列表已刷新。",
    recoverDone: "{name} 已恢复安装。",
    recoverFailed: "恢复失败：{message}",
    alreadyInstalled: "{name} 已经安装在目标 Agent。",
    installDone: "{name} 已安装到本地。",
    installFailed: "安装失败：{message}",
    installOrUpdateDone: "{name} 已{action}到 {count} 个 Agent。",
    installedToAgents: "{name} 已安装到 {count} 个 Agent。",
    recoveredToAgents: "{name} 已安装到 {count} 个 Agent。",
    uninstallSelectedConfirm: "卸载选中的 {count} 个安装副本？\n不会真正删除，会移动到 Uninstalled。",
    uninstalledCopiesDone: "已卸载 {count} 个安装副本。",
    uninstallFailed: "卸载失败：{message}",
    settingsSaved: "设置成功",
    settingsSaveFailed: "设置保存失败：{message}",
    discoverCacheFallback: "skills.sh 暂时不可用，正在显示缓存{suffix}",
    discoverLoadFailed: "Discover 加载失败：{message}",
    statusQueued: "排队中",
    statusRunning: "执行中",
    statusSuccess: "成功",
    statusFailed: "失败",
    statusDone: "完成",
    statusSkipped: "已跳过",
    statusMissing: "已丢失",
    typeInstall: "安装",
    typeUninstall: "卸载",
    typeRestore: "恢复",
    typeRecover: "恢复",
    typeUpdate: "更新",
    typeSync: "同步",
    typeSettings: "设置",
    typePublish: "发布版本",
    typeDelete: "删除",
    typeUnknown: "操作",
    eventCurrentStarting: "开始执行",
    eventCurrentDone: "完成",
    eventCurrentFailed: "失败",
    logMovedUninstalled: "已移动到 Uninstalled。",
    logRestoredInstall: "已恢复安装。",
    logCopiedInstall: "已复制安装到指定 Agent。",
    logInstalledTarget: "已安装到指定 Agent。",
    logGitZipInstalled: "git 失败后，已通过 GitHub zip 安装到指定 Agent。",
    logOriginalMissingSkipUninstall: "原目录不存在，已跳过卸载。",
    logUninstalledMissingSkipRestore: "Uninstalled 目录不存在，已跳过恢复。",
    logTargetExistsSkipped: "目标 Agent 已存在同名 skill，已按选择跳过。",
    logTargetExists: "目标 Agent 已存在同名 skill。",
    logTargetIsCurrent: "目标 Agent 已经是当前目录。",
    logLocalMissingSkipInstall: "本地 skill 目录不存在，已跳过安装。",
    logSwitchedVersion: "已切换到 {version}。",
    logDeletedHistory: "已删除 {count} 个历史版本。",
    logSkippedCurrentMissingVersions: "跳过 {count} 个当前使用或不存在的版本。",
    logPublishedVersion: "已发布版本 {version}。",
    logSyncedTo: "已同步到 {target}。"
  },
  en: {
    appSubtitle: "Local multi-client skill manager",
    language: "Language",
    zh: "中文",
    en: "English",
    library: "Library",
    discover: "Discover",
    installed: "Installed",
    uninstalled: "Uninstalled",
    starred: "Starred",
    tags: "Tags",
    agents: "Agents",
    allAgents: "All Agents",
    events: "Events",
    logs: "Logs",
    settings: "Settings",
    loading: "Loading",
    scanning: "Scanning",
    preparing: "Preparing",
    matches: "matches",
    searchConfig: "Search settings",
    rescan: "Rescan",
    sortOrder: "Order",
    sortUpdated: "Updated",
    sortAlpha: "A-Z",
    tagFilter: "Tags",
    selectedTags: "Select tags",
    clear: "Clear",
    relation: "Match",
    all: "All",
    source: "Source",
    installedLabel: "Installed",
    totalInstalls: "Total",
    recentEightWeeks: "Last 8 weeks",
    install: "Install",
    installSkills: "Install Skills",
    skillsLeaderboard: "Skills Leaderboard",
    skillsLeaderboardDesc: "Public leaderboard from skills.sh",
    localInstall: "Local import",
    localInstallDesc: "Import a local directory or zip archive that contains SKILL.md",
    remoteInstall: "Remote install",
    remoteInstallDesc: "Install from Git / URL / archive",
    importLocal: "Import local",
    importLocalTitle: "Import local skill",
    importLocalDesc: "Choose or enter a directory or zip archive that contains SKILL.md. It will be copied into the selected Agents.",
    chooseDirectory: "Choose dir/zip",
    localSkillPath: "Local skill directory or zip",
    localSkillPathPlaceholder: "~/work/my-skill or ~/Downloads/my-skill.zip",
    importLocalInvalid: "Import failed: {message}",
    remoteSkillUrl: "Remote URL",
    remoteSkillUrlPlaceholder: "https://github.com/owner/repo or https://example.com/skill.zip",
    remoteSkillName: "Skill name (optional)",
    remoteSkillNamePlaceholder: "Use when a repository contains multiple skills",
    remoteInstallHint: "Supports GitHub, Git URLs, and zip archives. Add a skill name when the repo contains multiple skills.",
    remoteInstallInvalid: "Remote install failed: {message}",
    uninstall: "Uninstall",
    update: "Update",
    recover: "Recover",
    sync: "Sync",
    delete: "Delete",
    cancel: "Cancel",
    confirm: "Confirm",
    processing: "Processing",
    installing: "Installing",
    publishVersion: "Publish version",
    publishing: "Publishing",
    confirmPublish: "Confirm publish",
    edit: "Edit",
    cancelEdit: "Cancel edit",
    history: "History",
    clearRecords: "Clear records",
    cancelSelection: "Deselect",
    refresh: "Refresh",
    clearLogs: "Clear logs",
    clearEvents: "Clear events",
    operationLogs: "Operation Logs",
    operationEvents: "Operation Events",
    operationLogsDesc: "Review recent install, uninstall, recover, and settings operation results.",
    operationEventsDesc: "Track background install, uninstall, update, and recover status and progress.",
    logFilter: "Type",
    allTypes: "All types",
    selectNoTypes: "Select none",
    searchLogs: "Search title, message, detail",
    noLogs: "No operation logs yet.",
    noEvents: "No operation events yet.",
    settingsDesc: "Manage install targets, agent names, and skill directory display rules.",
    saveSettings: "Save settings",
    discardSettings: "Discard changes",
    unsavedSettings: "View changes",
    viewSettingChanges: "Changes",
    settingsChanges: "Setting changes",
    settingChangeCount: "{count} changes",
    noSettingChanges: "No setting changes.",
    before: "Before",
    after: "After",
    directoryMissing: "Directory missing",
    saving: "Saving",
    visual: "Visual",
    json: "JSON",
    appVersion: "App version",
    packagedApp: "Packaged app",
    devMode: "Development mode",
    jsonSettings: "JSON settings",
    jsonSettingsDesc: "Edit the full settings object. Saving validates JSON and applies defaults and source filters.",
    localApi: "Local API",
    localApiDesc: "For CLI, agents, and automation scripts. It only listens on 127.0.0.1.",
    enableLocalApi: "Enable Local API",
    configuredPort: "Configured port",
    currentPort: "Current port",
    apiBaseUrl: "API URL",
    apiStopped: "Stopped",
    apiConnectivity: "Connectivity",
    refreshApi: "Refresh API",
    testApi: "Test",
    apiTesting: "Connecting",
    apiConnected: "Connected",
    apiDisconnected: "Disconnected",
    apiRefreshing: "Refreshing",
    apiRefreshFailed: "Refresh failed: {message}",
    defaultInstallTarget: "Default install target",
    defaultInstallTargetDesc: "Discover installs and Uninstalled recovery use this target by default.",
    installToAgent: "Install to agent",
    installDialogDefault: "Install dialog default",
    rememberLast: "Remember last selection",
    alwaysDefault: "Always use default agent",
    mergeAllAgents: "Merge same-name skills under All Agents",
    retention: "Retention",
    retentionDesc: "Events and Logs are kept forever by default. Set days to prune older records.",
    retentionDays: "Days",
    forever: "Forever",
    customDays: "Custom days",
    ignoreTitle: "Directory Ignore",
    ignoreDesc: "Similar to gitignore. Matched files are hidden from the skill tree.",
    agentsDesc: "Configure left-side Agents names and each agent's skills directory.",
    dragToReorder: "Drag to reorder",
    moveUp: "Move up",
    moveDown: "Move down",
    addAgent: "Add agent",
    moreAgents: "More agents ({count})",
    collapseAgents: "Collapse agents",
    newAgent: "New Agent",
    newAgentSkills: "New Agent Skills",
    duplicateAgentName: "Agent name already exists: {name}",
    enabled: "Enabled",
    disabled: "Disabled",
    enabledStatus: "Enabled",
    detectedDisabled: "Detected but disabled",
    name: "Name",
    description: "Description",
    directory: "Directory",
    openDirectory: "Open directory",
    remove: "Remove",
    removeAgentConfirm: "Remove Agent \"{name}\"? This removes its configuration from Skill Manager.",
    chooseInstallAgent: "Choose install agents",
    chooseUninstallAgent: "Choose uninstall agents",
    chooseUpgradeAgent: "Choose publish-version agents",
    chooseSyncAgent: "Choose sync targets",
    chooseRecoverAgent: "Choose recover targets",
    chooseDeleteUninstalled: "Choose Uninstalled records to delete",
    chooseUpdateAgent: "Choose update agents",
    selectAll: "Select all",
    deselectAll: "Deselect all",
    snapshot: "Snapshot",
    notInstalled: "Not installed",
    searchScope: "Search scope",
    searchName: "Name",
    searchDescription: "Description",
    searchTags: "Tags",
    searchPath: "Path",
    searchContent: "Content",
    customSearch: "customizable",
    sourceFilter: "Source",
    allSources: "All sources",
    noSource: "None",
    selectTagHint: "Select a tag to view all skills with it.",
    tagContains: "skills include this tag",
    noDescription: "No description",
    clearLogsConfirm: "Clear all Operation Logs? This cannot be undone.",
    clearEventsConfirm: "Clear all Operation Events? This cannot be undone.",
    selectedCount: "Selected",
    submit: "Submit",
    submitting: "Submitting",
    back: "Back",
    viewDiff: "View diff",
    unknownVersion: "unknown version",
    installedVersion: "installed",
    snapshotVersion: "snapshot",
    skip: "Skip",
    replace: "Replace",
    conflictHint: "The target agent already has a skill with the same name. Choose how to handle each conflict.",
    conflictNote: "Discover installs cannot be diffed before the remote directory exists; the current directory is archived before replacement.",
    installConflict: "Install conflict",
    updateConflict: "Update conflict",
    recoverConflict: "Recover conflict",
    star: "Star",
    unstar: "Unstar",
    repository: "Repository",
    openOn: "Open on",
    localScanning: "Scanning local skills",
    discoverScanning: "Loading skills.sh",
    emptyUninstalled: "No recoverable skills in Uninstalled.",
    emptyStarred: "No starred skills yet.",
    emptyDiscover: "No results match the current Discover filters.",
    emptyTags: "No tags to summarize yet.",
    emptyLocal: "No local skills match the current filters.",
    discoverEmptyHint: "Select a Discover skill to view source, popularity, repository, and install information.",
    saveChanges: "Save changes",
    discardChanges: "Discard changes",
    savingChanges: "Saving",
    editing: "Editing",
    switchingVersion: "Switching version...",
    clearRecordsConfirm: "Clear records",
    updatedAt: "Updated",
    size: "Size",
    lines: "Lines",
    currentCopy: "Current copy",
    uninstallSource: "Uninstalled from",
    installStatus: "Install status",
    version: "Version",
    weeklyActivity: "8W Activity",
    rank: "Rank",
    basicInfo: "Basic info",
    installMethod: "Install method",
    summary: "Summary",
    loadingSummary: "Loading Summary from skills.sh...",
    noSummary: "This skill has not provided a Summary yet.",
    skillContent: "SKILL content",
    noSkillContent: "Loading or no SKILL.md content yet.",
    discoverDescriptionFallback: "{name} from {source}. After installation, it appears in Installed, where you can inspect SKILL.md, the directory tree, and version history.",
    updatedPrefix: "Updated",
    skillDirectory: "Skill directory",
    directoryName: "Directory name",
    fileNameMd: "File name.md",
    added: "added",
    removed: "removed",
    changedLines: "changed lines",
    noContentDiff: "No content diff",
    noDirectoryDiff: "This version has no content differences from the current directory.",
    changedFiles: "Changed files",
    binaryDiffOnly: "Binary or large file. Only file status changes are recorded.",
    current: "Current",
    activeIn: "Active in",
    switchVersion: "Switch",
    deleteSelected: "Delete selected",
    latest: "Latest",
    latestVersionTitle: "Switch to latest version {version}",
    notLatestVersionLabel: "Not latest. Latest is {version}",
    selectSkillHint: "Select a skill to inspect content, directory tree, source, and tags.",
    revealDirectoryTitle: "Reveal directory",
    addFile: "+ File",
    addDirectory: "+ Directory",
    addFileTitle: "Add file in current directory",
    addDirectoryTitle: "Add directory in current directory",
    editMode: "Edit mode",
    readMode: "Read mode",
    copyRelativePath: "Copy relative path",
    copyAbsolutePath: "Copy absolute path",
    createFileHere: "New file here",
    createDirectoryHere: "New directory here",
    rename: "Rename",
    unsavedChangesPrompt: "This file has unsaved changes. Choose what to do before switching.",
    saveAndSwitch: "Save and switch",
    discardAndSwitch: "Discard changes",
    continueEditing: "Keep editing",
    noSyncTargets: "No other agents available to sync.",
    submittedSync: "Submitted sync to {count} agents.",
    unknown: "Unknown",
    directoryLabel: "directory",
    fileLabel: "file",
    addEntryNameRequired: "Enter a {name} name.",
    renameRequired: "Enter a new name.",
    deleteItemsConfirm: "Delete {count} items?",
    deleteItemsConfirmNote: "You can recover them from history before publishing, but they will be removed from the working directory.",
    copiedPath: "Copied {type} path: {path}",
    absolutePath: "absolute",
    relativePath: "relative",
    copyFailed: "Copy failed: {message}",
    chooseVersionConfirm: "Switch {client}'s {skill} to {version}?\nThe current directory will be saved as a rollback version first.",
    deleteHistoryConfirm: "Delete {count} selected history versions for {client}?\nThe currently active version will not be deleted.",
    deleteHistoryGlobalConfirm: "Delete {count} history versions?\nThis cannot be undone. The currently active version will not be deleted.",
    activeVersions: "active",
    missingVersions: "missing",
    deletedVersionsSummary: "Deleted {deleted} versions and skipped {skipped} versions.",
    saveBeforePublish: "Save or cancel the current edit before publishing a version.",
    noContentChangeForClient: "{client} has no content changes and cannot publish a version.",
    noContentChange: "No content changes",
    noAgentChanges: "No Agent has content changes, so a version cannot be published.",
    unsavedBeforeExitEdit: "This file has unsaved changes. Choose what to do before leaving edit mode.",
    unsavedBeforeSwitch: "This file has unsaved changes. Choose what to do before switching.",
    historyTitle: "{name} · History",
    historyVersionCount: "{client} · {count} directory versions",
    clearAll: "Clear all",
    close: "Close",
    noHistory: "No history yet. Saving a skill will create directory versions automatically.",
    currentVersion: "Current version",
    compareCurrentWith: "Compare current directory with {version}",
    historyVersion: "history version",
    chooseThisVersion: "Choose this version",
    selectHistoryHint: "Select a history version to view changes.",
    confirmPublishTitle: "{name} · Confirm publish",
    perAgentPublish: "each Agent publishes its own version",
    publishForAgents: "Publish version for {count} Agents",
    publishingDots: "Publishing...",
    publishDiffNotice: "{client} diff before publish. Confirming writes SKILL.md version and creates a new skill version.",
    generatingPublishDiff: "Generating publish diff.",
    publishMessage: "Release note",
    publishMessagePlaceholder: "Optional note for this publish. Leave empty to generate one.",
    autoPublishMessage: "Publish {name} {version} with {count} file changes.",
    historyMessageFallback: "No note",
    notFound: "Not found",
    githubTrending: "GitHub trending",
    updatingNow: "Updating",
    trendsUnavailable: "Trends unavailable",
    loadingAppVersion: "Loading",
    jsonObjectRequired: "Settings must be a JSON object.",
    syncFrom: "Sync from {source}",
    currentWriting: "Current",
    incomingWriting: "Incoming",
    tagLabel: "Tag: {tag}",
    tagAndTitle: "Must include all selected tags",
    tagOrTitle: "Can include any selected tag",
    uninstallConfirm: "Uninstall {name}?\nIt will be moved to Uninstalled instead of permanently deleted, so you can recover it later.",
    submittedUninstall: "{name} has been submitted for background uninstall.",
    submitFailed: "Submit failed: {message}",
    agentRecords: "{count} Agent records",
    clearUninstalledConfirm: "Clear {count} Uninstalled records?\nThis cannot be undone and will not affect currently installed skills.",
    clearUninstalledDone: "Cleared {count} Uninstalled records.",
    clearFailed: "Clear failed: {message}",
    versionUnknownNoCompare: "At least one version is unknown, so recency will not be inferred automatically.",
    possibleDowngrade: "The incoming version is lower than the current version and may be a downgrade.",
    directoryDiffAlertTitle: "Directory diff: {client}",
    modified: "modified",
    noTextDiff: "No text file differences found.",
    diffFailed: "Diff failed: {message}",
    submittedBackground: "{name} has been submitted for background processing.",
    deleteUninstalledConfirm: "Delete {count} Uninstalled records?\nThis cannot be undone and will not affect currently installed skills.",
    deletedUninstalledDone: "Deleted {count} Uninstalled records.",
    deleteFailed: "Delete failed: {message}",
    recoverMissing: "{name}'s Uninstalled directory no longer exists. The list has been refreshed.",
    recoverDone: "{name} has been recovered.",
    recoverFailed: "Recover failed: {message}",
    alreadyInstalled: "{name} is already installed in the target Agent.",
    installDone: "{name} has been installed locally.",
    installFailed: "Install failed: {message}",
    installOrUpdateDone: "{name} has been {action} to {count} Agents.",
    installedToAgents: "{name} has been installed to {count} Agents.",
    recoveredToAgents: "{name} has been installed to {count} Agents.",
    uninstallSelectedConfirm: "Uninstall {count} selected installed copies?\nThey will be moved to Uninstalled instead of permanently deleted.",
    uninstalledCopiesDone: "Uninstalled {count} installed copies.",
    uninstallFailed: "Uninstall failed: {message}",
    settingsSaved: "Saved",
    settingsSaveFailed: "Settings save failed: {message}",
    discoverCacheFallback: "skills.sh is temporarily unavailable. Showing cache{suffix}",
    discoverLoadFailed: "Discover failed to load: {message}",
    statusQueued: "Queued",
    statusRunning: "Running",
    statusSuccess: "Success",
    statusFailed: "Failed",
    statusDone: "Done",
    statusSkipped: "Skipped",
    statusMissing: "Missing",
    typeInstall: "Install",
    typeUninstall: "Uninstall",
    typeRestore: "Restore",
    typeRecover: "Recover",
    typeUpdate: "Update",
    typeSync: "Sync",
    typeSettings: "Settings",
    typePublish: "Publish version",
    typeDelete: "Delete",
    typeUnknown: "Operation",
    eventCurrentStarting: "Starting",
    eventCurrentDone: "Done",
    eventCurrentFailed: "Failed",
    logMovedUninstalled: "Moved to Uninstalled.",
    logRestoredInstall: "Recovered installation.",
    logCopiedInstall: "Copied and installed to the selected Agent.",
    logInstalledTarget: "Installed to the selected Agent.",
    logGitZipInstalled: "git failed, then GitHub zip fallback installed to the selected Agent.",
    logOriginalMissingSkipUninstall: "Original directory was missing, so uninstall was skipped.",
    logUninstalledMissingSkipRestore: "Uninstalled directory was missing, so recovery was skipped.",
    logTargetExistsSkipped: "The target Agent already has a skill with the same name, so it was skipped.",
    logTargetExists: "The target Agent already has a skill with the same name.",
    logTargetIsCurrent: "The target Agent is already the current directory.",
    logLocalMissingSkipInstall: "Local skill directory was missing, so install was skipped.",
    logSwitchedVersion: "Switched to {version}.",
    logDeletedHistory: "Deleted {count} history versions.",
    logSkippedCurrentMissingVersions: "Skipped {count} active or missing versions.",
    logPublishedVersion: "Published version {version}.",
    logSyncedTo: "Synced to {target}."
  }
};

function useI18n() {
  return useContext(I18nContext);
}

function createTranslator(lang) {
  return (key) => messages[lang]?.[key] ?? messages.zh[key] ?? key;
}

function sourceFilterLabel(value, t) {
  if (value === "discover") return t("discover");
  if (value === "installed") return t("installed");
  if (value === "uninstalled") return t("uninstalled");
  return value;
}

function remoteSkillNameFromUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const cleaned = raw.replace(/[#?].*$/, "").replace(/\/+$/, "");
  const githubMatch = cleaned.match(/github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i);
  if (githubMatch) return githubMatch[2].replace(/\.git$/i, "");
  const last = cleaned.split("/").filter(Boolean).pop() || "";
  return last.replace(/\.(git|zip|tar|tgz|tar\.gz)$/i, "") || "remote-skill";
}

function remoteInstallMethodFromUrl(value) {
  const raw = String(value || "").trim();
  if (/\.zip(?:[#?].*)?$/i.test(raw)) return "remote-archive";
  return "remote-git";
}

function readStoredJson(primaryKey, legacyKey, fallback) {
  const primary = localStorage.getItem(primaryKey);
  const legacy = primary === null && legacyKey ? localStorage.getItem(legacyKey) : null;
  const raw = primary ?? legacy;
  if (raw === null) return fallback;
  try {
    const value = JSON.parse(raw);
    if (legacy !== null) localStorage.setItem(primaryKey, raw);
    return value;
  } catch {
    return fallback;
  }
}

function readSettingsMode() {
  return localStorage.getItem(settingsModeStorageKey) === "json" ? "json" : "visual";
}

function formatDate(value) {
  return value ? fmt.format(new Date(value)) : "-";
}

function settingFieldLabel(key, t) {
  const labels = {
    language: t("language"),
    installSourceId: t("defaultInstallTarget"),
    installTargetMode: t("installDialogDefault"),
    mergeDuplicateSkills: t("mergeAllAgents"),
    logRetentionDays: `${t("operationLogs")} ${t("retentionDays")}`,
    eventRetentionDays: `${t("operationEvents")} ${t("retentionDays")}`,
    apiEnabled: t("enableLocalApi"),
    apiPort: t("configuredPort"),
    ignorePatterns: t("ignoreTitle"),
    client: t("name"),
    label: t("description"),
    root: t("directory"),
    enabled: t("enabled")
  };
  return labels[key] || key;
}

function displaySettingValue(value, t) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? t("enabled") : t("disabled");
  if (Array.isArray(value)) return value.length ? value.join("\n") : "-";
  return String(value);
}

function settingsDiffRows(before = {}, after = {}, t = (key) => key) {
  const rows = [];
  const push = (group, label, oldValue, newValue) => {
    if (JSON.stringify(oldValue ?? null) !== JSON.stringify(newValue ?? null)) {
      rows.push({ group, label, before: displaySettingValue(oldValue, t), after: displaySettingValue(newValue, t) });
    }
  };
  push(t("settings"), settingFieldLabel("language", t), before.language, after.language);
  push(t("settings"), settingFieldLabel("installSourceId", t), before.installSourceId, after.installSourceId);
  push(t("settings"), settingFieldLabel("installTargetMode", t), before.installTargetMode, after.installTargetMode);
  push(t("settings"), settingFieldLabel("mergeDuplicateSkills", t), before.mergeDuplicateSkills, after.mergeDuplicateSkills);
  push(t("retention"), settingFieldLabel("logRetentionDays", t), before.logRetentionDays, after.logRetentionDays);
  push(t("retention"), settingFieldLabel("eventRetentionDays", t), before.eventRetentionDays, after.eventRetentionDays);
  push(t("localApi"), settingFieldLabel("apiEnabled", t), before.apiEnabled, after.apiEnabled);
  push(t("localApi"), settingFieldLabel("apiPort", t), before.apiPort, after.apiPort);
  push(t("ignoreTitle"), settingFieldLabel("ignorePatterns", t), before.ignorePatterns || [], after.ignorePatterns || []);
  const beforeOrder = (before.sources || []).map((source) => source.id);
  const afterOrder = (after.sources || []).map((source) => source.id);
  if (JSON.stringify(beforeOrder) !== JSON.stringify(afterOrder)) {
    const beforeNames = (before.sources || []).map((source) => source.client || source.id);
    const afterNames = (after.sources || []).map((source) => source.client || source.id);
    push(t("agents"), t("sortOrder"), beforeNames, afterNames);
  }
  const beforeSources = new Map((before.sources || []).map((source) => [source.id, source]));
  const afterSources = new Map((after.sources || []).map((source) => [source.id, source]));
  const ids = [...new Set([...beforeSources.keys(), ...afterSources.keys()])];
  ids.forEach((id) => {
    const oldSource = beforeSources.get(id);
    const newSource = afterSources.get(id);
    const group = `${t("agents")} · ${newSource?.client || oldSource?.client || id}`;
    if (!oldSource) rows.push({ group, label: t("addAgent"), before: "-", after: [newSource?.client, newSource?.label, newSource?.root, displaySettingValue(Boolean(newSource?.enabled), t)].filter(Boolean).join("\n") });
    else if (!newSource) rows.push({ group, label: t("remove"), before: [oldSource.client, oldSource.label, oldSource.root, displaySettingValue(Boolean(oldSource.enabled), t)].filter(Boolean).join("\n"), after: "-" });
    else ["client", "label", "root", "enabled"].forEach((key) => push(group, settingFieldLabel(key, t), oldSource[key], newSource[key]));
  });
  return rows;
}

function formatSettingsJson(value = {}) {
  return JSON.stringify(value || {}, null, 2);
}

function SettingsJsonDiff({ before, after }) {
  const { t } = useI18n();
  const rows = useMemo(() => buildLineDiff(before, after), [before, after]);
  const pairs = useMemo(() => {
    const next = [];
    for (let index = 0; index < rows.length;) {
      if (rows[index].type === "same") {
        next.push({ before: rows[index], after: rows[index] });
        index += 1;
        continue;
      }
      const removed = [];
      const added = [];
      while (rows[index] && rows[index].type !== "same") {
        if (rows[index].type === "removed") removed.push(rows[index]);
        if (rows[index].type === "added") added.push(rows[index]);
        index += 1;
      }
      const count = Math.max(removed.length, added.length);
      for (let pairIndex = 0; pairIndex < count; pairIndex += 1) {
        next.push({
          before: removed[pairIndex] || { type: "empty", line: "" },
          after: added[pairIndex] || { type: "empty", line: "" }
        });
      }
    }
    return next;
  }, [rows]);
  return (
    <div className="settings-json-diff">
      <div className="settings-json-diff-head">
        <span>{t("before")}</span>
        <span>{t("after")}</span>
      </div>
      <div className="settings-json-diff-scroll">
        {pairs.map((pair, index) => (
          <div className="settings-json-diff-row" key={index}>
            <JsonDiffLine row={pair.before} marker="-" side="before" />
            <JsonDiffLine row={pair.after} marker="+" side="after" />
          </div>
        ))}
      </div>
    </div>
  );
}

function JsonDiffLine({ row, marker, side }) {
  const lineNumber = side === "before" ? row.oldLine : row.newLine;
  return (
    <code className={`json-diff-line ${row.type}`}>
      <span>{lineNumber || ""}</span>
      <b>{row.type === "removed" || row.type === "added" ? marker : " "}</b>
      <em>{row.line || " "}</em>
    </code>
  );
}

function formatVersionLocalDate(value, { compact = false } = {}) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  if (compact) return `${parts.year}${parts.month}${parts.day}`;
  return `${parts.year}${parts.month}${parts.day}.${parts.hour}${parts.minute}${parts.second}`;
}

function normalizeLocalVersionLabel(label = "", { compact = false } = {}) {
  const value = String(label || "").trim();
  const legacyLocal = value.match(/^local\s+(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/i);
  if (legacyLocal) {
    const date = `${legacyLocal[1]}${legacyLocal[2]}${legacyLocal[3]}`;
    const time = `${legacyLocal[4] || ""}${legacyLocal[5] || ""}${legacyLocal[6] || ""}`;
    return compact || !time ? `v.${date}` : `v.${date}.${time}`;
  }
  const oldCompactLocal = value.match(/^v\.local\.(\d{8})(?:\.?(\d{4,6}))?$/i);
  if (oldCompactLocal) {
    return compact || !oldCompactLocal[2] ? `v.${oldCompactLocal[1]}` : `v.${oldCompactLocal[1]}.${oldCompactLocal[2]}`;
  }
  const newLocal = value.match(/^v\.(\d{8})(?:\.(\d{4,6}))?$/i);
  if (newLocal) {
    return compact || !newLocal[2] ? `v.${newLocal[1]}` : `v.${newLocal[1]}.${newLocal[2]}`;
  }
  return "";
}

function displayVersionLabel(label = "") {
  const value = String(label || "").trim();
  const local = normalizeLocalVersionLabel(value);
  if (local) return local;
  return value && !/^v/i.test(value) ? `v${value}` : value;
}

function compactVersionLabel(label = "") {
  const value = String(label || "").trim();
  const local = normalizeLocalVersionLabel(value, { compact: true });
  if (local) return local;
  return value && !/^v/i.test(value) ? `v${value}` : value;
}

function localVersionLabelFromDate(value) {
  const stamp = formatVersionLocalDate(value);
  return stamp ? `v.${stamp}` : "";
}

function isGeneratedLocalVersionLabel(label = "") {
  const value = String(label || "").trim();
  return /^local\b/i.test(value) || /^v\.local\./i.test(value) || /^v\.\d{8}(?:\.\d{4,6})?$/i.test(value);
}

function shortPath(path) {
  return path?.replace(/^\/Users\/[^/]+/, "~") || "";
}

function settingsPathKey(value = "") {
  return String(value || "").trim().replace(/^["']|["']$/g, "").replace(/^～(?=$|\/|\\)/, "~");
}

function parentPath(filePath = "") {
  const normalized = String(filePath || "").replace(/\/+$/, "");
  const index = normalized.lastIndexOf("/");
  return index > 0 ? normalized.slice(0, index) : normalized;
}

function copyRelativePath(copy, filePath) {
  if (!copy?.dir || !filePath) return "SKILL.md";
  const root = copy.dir.replace(/\/+$/, "");
  if (!filePath.startsWith(root)) return "SKILL.md";
  return filePath.slice(root.length).replace(/^\/+/, "") || "SKILL.md";
}

function starKey(type, item) {
  return `${type}:${item?.id || item?.filePath || item?.dir || item?.url || item?.name}`;
}

function normalizeStarType(type, item = {}) {
  const value = String(type || "").trim().toLowerCase();
  if (value === "discover" || value === "discovered" || value === "skillssh" || item.source === "skillssh") return "discover";
  if (value === "uninstalled" || value === "uninstall") return "uninstalled";
  return "installed";
}

function starSnapshot(type, item) {
  const normalizedType = normalizeStarType(type, item);
  return {
    type: normalizedType,
    key: starKey(normalizedType, item),
    createdAt: new Date().toISOString(),
    item
  };
}

function starGroupKey(type, item) {
  const normalizedType = normalizeStarType(type, item);
  const key = normalizedType === "discover"
    ? normalizeSkillName(item?.name || item?.fullName || item?.url || item?.id)
    : skillGroupKey(item);
  return `${normalizedType}:${key}`;
}

function skillJoinTime(skill) {
  return skill?.uninstallMeta?.uninstalledAt
    || skill?.createdAt
    || skill?.starredAt
    || skill?.updatedAt
    || "";
}

function groupedJoinTime(item) {
  const times = (item?.installations || [item])
    .map(skillJoinTime)
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);
  return times.length ? Math.max(...times) : 0;
}

function skillTags(item = {}) {
  const base = item.tags || item.item?.tags || [];
  if (base.length) return base;
  if (item.source === "skillssh" || item.sourceLabel || item.sourceName || item.language) {
    return [item.sourceName, item.sourceLabel, item.language, item.source === "skillssh" ? "discover" : item.source]
      .filter(Boolean);
  }
  return [];
}

function normalizeSkillName(value = "") {
  return String(value).trim().toLowerCase();
}

function normalizeDiscoverSource(value = "") {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/^https?:\/\/www\.skills\.sh\//i, "")
    .replace(/^https?:\/\/skills\.sh\//i, "")
    .replace(/\.git$/i, "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}

function discoverInstallKey(item = {}) {
  const source = normalizeDiscoverSource(item.originMeta?.sourceName || item.originMeta?.fullName || item.sourceName || item.fullName || item.repositoryUrl || item.url);
  const name = normalizeSkillName(item.originMeta?.name || item.name || item.slug || item.frontmatter?.name);
  return source && name ? `${source}:${name}` : "";
}

function isDiscoverUpdateAvailable(item, installedSkills = []) {
  if (!installedSkills.length) return false;
  const remoteVersion = skillVersion(item);
  if (!remoteVersion) return false;
  return installedSkills.some((skill) => {
    const localVersion = skillVersion(skill);
    return localVersion && localVersion !== remoteVersion;
  });
}

function uniqueInstalledSkills(skills = []) {
  const map = new Map();
  skills.forEach((skill) => {
    const key = skill.sourceId || skill.client || skill.dir || skill.id;
    const existing = map.get(key);
    if (!existing || new Date(skill.updatedAt || 0) > new Date(existing.updatedAt || 0)) {
      map.set(key, skill);
    }
  });
  return [...map.values()].sort((a, b) => String(a.client || "").localeCompare(String(b.client || "")));
}

function installedAgentVersionLabel(skill) {
  const version = skillVersion(skill);
  return `${skill.client}${version ? ` v${version}` : ""}`;
}

function compactAgentSummary(names = []) {
  const agents = [...new Set(names.filter(Boolean))];
  if (!agents.length) return "";
  if (agents.length === 1) return agents[0];
  return `${agents.slice(0, 2).join(", ")}${agents.length > 2 ? "…" : ""} · ${agents.length} agents`;
}

function skillVersion(item = {}) {
  const value = item.version
    || item.latestVersion
    || item.metadata?.version
    || item.frontmatter?.version
    || item.frontmatter?.Version
    || item.frontmatter?.metadata?.version
    || "";
  return value === undefined || value === null ? "" : String(value).trim();
}

function skillVersionLabel(item = {}) {
  const explicit = skillVersion(item);
  if (explicit) return `v${explicit}`;
  const storedLabel = item.uninstallMeta?.versionLabel
    || item.versionInfo?.currentLabel
    || item.versionInfo?.activeLabel
    || "";
  if (isGeneratedLocalVersionLabel(storedLabel)) {
    return localVersionLabelFromDate(item.updatedAt || item.uninstallMeta?.uninstalledAt) || storedLabel;
  }
  if (storedLabel) return storedLabel;
  const localTime = item.updatedAt || item.uninstallMeta?.uninstalledAt || item.createdAt || "";
  const localLabel = localVersionLabelFromDate(localTime);
  if (localLabel && (item.dir || item.sourceId === "uninstalled")) return localLabel;
  return "";
}

function targetVersionLabel(target = {}) {
  const label = target.versionLabel
    || (target.skill ? skillVersionLabel(target.skill) : "")
    || (target.version ? `v${target.version}` : "");
  return label ? displayVersionLabel(label) : "";
}

function compareVersionAsc(a = "", b = "") {
  const left = String(a || "").replace(/^v/i, "").split(".").map((part) => Number.parseInt(part, 10));
  const right = String(b || "").replace(/^v/i, "").split(".").map((part) => Number.parseInt(part, 10));
  if (!left.every(Number.isFinite) || !right.every(Number.isFinite)) return null;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const delta = (left[index] || 0) - (right[index] || 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

function formatNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toLocaleString() : "0";
}

function matchesSearchFields(values, query) {
  if (!query) return true;
  return values.filter(Boolean).join(" ").toLowerCase().includes(query);
}

function localSkillSearchValues(skill, options) {
  const values = [];
  if (options.name) values.push(skill.name, skill.slug);
  if (options.description) values.push(skill.description);
  if (options.tags) values.push(skill.client, skill.sourceLabel, skill.tags?.join(" "));
  if (options.path) values.push(skill.filePath, skill.dir);
  if (options.content) values.push(skill.content, skill.raw, skill.excerpt);
  return values;
}

function discoverSearchValues(item, options) {
  const values = [];
  if (options.name) values.push(item.name, item.fullName, item.sourceName);
  if (options.description) values.push(item.description);
  if (options.tags) values.push(item.language, item.sourceLabel, item.installsLabel, item.weeklyLabel);
  if (options.path) values.push(item.url, item.repositoryUrl);
  return values;
}

function skillGroupKey(skill) {
  return normalizeSkillName(skill?.frontmatter?.name || skill?.name || skill?.slug || skill?.dir);
}

function mergeSkillCopies(skills = []) {
  const groups = new Map();
  for (const skill of skills) {
    const key = skillGroupKey(skill);
    const list = groups.get(key) || [];
    list.push(skill);
    groups.set(key, list);
  }
  return [...groups.values()].map((copies) => {
    const sorted = [...copies].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    const primary = sorted[0];
    return {
      ...primary,
      id: `merged:${skillGroupKey(primary)}:${sorted.map((skill) => skill.id).join("|")}`,
      installations: sorted,
      installationCount: sorted.length,
      merged: sorted.length > 1
    };
  });
}

function frontmatterEntries(frontmatter = {}) {
  return Object.entries(frontmatter).filter(([, value]) => value !== "" && value !== null && value !== undefined);
}

function parseFrontmatterText(raw = "") {
  if (!raw.startsWith("---")) return { frontmatter: {}, body: raw };
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { frontmatter: {}, body: raw };
  const frontmatter = {};
  match[1].split(/\r?\n/).forEach((line) => {
    const pair = line.match(/^([^:#]+):\s*(.*)$/);
    if (pair) frontmatter[pair[1].trim()] = pair[2].trim().replace(/^["']|["']$/g, "");
  });
  return { frontmatter, body: raw.slice(match[0].length) };
}

function isMarkdownPath(filePath = "") {
  return /\.(md|markdown|mdx)$/i.test(filePath);
}

function codeLanguageFromPath(filePath = "") {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const map = {
    py: "python",
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    json: "json",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    css: "css",
    html: "html",
    yml: "yaml",
    yaml: "yaml",
    toml: "toml"
  };
  return map[ext] || "text";
}

function highlightCode(text = "", language = "text") {
  const source = String(text || "");
  const patterns = language === "python" ? [
    ["comment", /#.*/y],
    ["string", /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/y],
    ["keyword", /\b(?:and|as|assert|async|await|break|class|continue|def|del|elif|else|except|False|finally|for|from|global|if|import|in|is|lambda|None|nonlocal|not|or|pass|raise|return|True|try|while|with|yield)\b/y],
    ["number", /\b\d+(?:\.\d+)?\b/y],
    ["function", /\b[A-Za-z_][\w]*(?=\s*\()/y]
  ] : language === "json" ? [
    ["string", /"(?:\\.|[^"\\])*"(?=\s*:)?/y],
    ["number", /-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/iy],
    ["keyword", /\b(?:true|false|null)\b/y]
  ] : language === "bash" ? [
    ["comment", /#.*/y],
    ["string", /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y],
    ["keyword", /\b(?:if|then|else|elif|fi|for|while|do|done|case|esac|function|in|export|local)\b/y],
    ["number", /\b\d+\b/y]
  ] : [
    ["comment", /\/\/.*|\/\*[\s\S]*?\*\//y],
    ["string", /`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y],
    ["keyword", /\b(?:async|await|break|case|catch|class|const|continue|default|else|export|extends|finally|for|from|function|if|import|let|new|null|return|switch|throw|try|undefined|var|while|yield|true|false)\b/y],
    ["number", /\b\d+(?:\.\d+)?\b/y],
    ["function", /\b[A-Za-z_$][\w$]*(?=\s*\()/y]
  ];
  const parts = [];
  let index = 0;
  while (index < source.length) {
    let matched = null;
    for (const [type, regex] of patterns) {
      regex.lastIndex = index;
      const match = regex.exec(source);
      if (match && match.index === index) {
        matched = { type, text: match[0] };
        break;
      }
    }
    if (matched) {
      parts.push(<span key={index} className={`tok-${matched.type}`}>{matched.text}</span>);
      index += matched.text.length;
    } else {
      parts.push(source[index]);
      index += 1;
    }
  }
  return parts;
}

function flattenTreeNodes(items = []) {
  const result = [];
  function walk(nodes) {
    nodes.forEach((node) => {
      result.push(node);
      if (node.children?.length) walk(node.children);
    });
  }
  walk(items);
  return result;
}

function countTree(nodes = []) {
  return nodes.reduce((total, node) => total + 1 + countTree(node.children || []), 0);
}

function tagTone(tag = "") {
  const tones = [
    { bg: "#e9f7d7", border: "#9fcf4c", fg: "#355315" },
    { bg: "#e2f3ff", border: "#76b7df", fg: "#17465f" },
    { bg: "#fff0cc", border: "#dfb24e", fg: "#684712" },
    { bg: "#ffe4dc", border: "#e58d72", fg: "#7a2b1c" },
    { bg: "#e9e6ff", border: "#9a8de4", fg: "#31266f" },
    { bg: "#ddf7ef", border: "#63b99e", fg: "#14513e" },
    { bg: "#f4e5ff", border: "#bd8adc", fg: "#5a2574" },
    { bg: "#edf0d5", border: "#aab65b", fg: "#454d17" }
  ];
  const hash = String(tag).split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return tones[hash % tones.length];
}

function TagPill({ tag, as = "span", className = "", onClick, children }) {
  const Component = as;
  const tone = tagTone(tag);
  return (
    <Component
      className={`tag-pill ${className}`}
      style={{ "--tag-bg": tone.bg, "--tag-border": tone.border, "--tag-fg": tone.fg }}
      onClick={onClick}
    >
      {children || tag}
    </Component>
  );
}

function buildLineDiff(previous = "", current = "") {
  const oldLines = previous.split(/\r?\n/);
  const newLines = current.split(/\r?\n/);
  const dp = Array.from({ length: oldLines.length + 1 }, () => Array(newLines.length + 1).fill(0));
  for (let i = oldLines.length - 1; i >= 0; i -= 1) {
    for (let j = newLines.length - 1; j >= 0; j -= 1) {
      dp[i][j] = oldLines[i] === newLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const rows = [];
  let i = 0;
  let j = 0;
  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      rows.push({ type: "same", line: oldLines[i], oldLine: i + 1, newLine: j + 1 });
      i += 1;
      j += 1;
    } else if (j < newLines.length && (i === oldLines.length || dp[i][j + 1] >= dp[i + 1][j])) {
      rows.push({ type: "added", line: newLines[j], newLine: j + 1 });
      j += 1;
    } else {
      rows.push({ type: "removed", line: oldLines[i], oldLine: i + 1 });
      i += 1;
    }
  }
  return rows;
}

function renderInline(text) {
  const parts = String(text).split(/(`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

function parseMarkdownBlocks(text = "") {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: "code", lang, text: code.join("\n") });
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
      index += 1;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "ordered", items });
      continue;
    }

    if (line.startsWith(">")) {
      const quote = [];
      while (index < lines.length && lines[index].startsWith(">")) {
        quote.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "quote", text: quote.join(" ") });
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^(#{1,4})\s+/.test(lines[index]) && !lines[index].startsWith("```") && !/^\s*[-*]\s+/.test(lines[index]) && !/^\s*\d+\.\s+/.test(lines[index]) && !lines[index].startsWith(">")) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }
  return blocks;
}

function useSkillData() {
  const [data, setData] = useState(() => readStoredJson(scanCacheStorageKey, null, null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh(options = {}) {
    const silent = Boolean(options.silent);
    if (!silent) setLoading(true);
    setError("");
    try {
      const result = await window.skillStudio.scan();
      setData(result);
      localStorage.setItem(scanCacheStorageKey, JSON.stringify(result));
      return result;
    } catch (err) {
      setError(err.message || String(err));
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return { data, loading, error, refresh };
}

function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function useGithubTrends(source, searchQuery = "") {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const cacheRef = useRef(new Map());
  const pageCacheRef = useRef(new Map());
  const prefetchRef = useRef(new Map());
  const prefetchTimersRef = useRef(new Map());
  const requestSeqRef = useRef(0);
  const discoverModes = ["alltime", "trending", "hot"];

  function queryKey(query = searchQuery) {
    return String(query || "").trim().toLowerCase();
  }

  function pageCacheKey(targetSource, page, query = searchQuery) {
    return `${targetSource}:${queryKey(query)}:${page}`;
  }

  function metaWithoutItems(result = {}) {
    const { items: _items, ...nextMeta } = result;
    return nextMeta;
  }

  function mergeDiscoverItems(current = [], next = []) {
    const map = new Map(current.map((item) => [item.id, item]));
    next.forEach((item) => map.set(item.id, item));
    return [...map.values()].sort((a, b) => (a.rank || 999999) - (b.rank || 999999) || b.stars - a.stars);
  }

  function rememberDiscoverPage(targetSource, page, result, query = searchQuery) {
    if (Array.isArray(result)) return result;
    const key = pageCacheKey(targetSource, page, query);
    pageCacheRef.current.set(key, result);
    if (result.items?.length) {
      const previous = cacheRef.current.get(`${targetSource}:${queryKey(query)}`);
      const previousItems = previous?.items || [];
      const merged = mergeDiscoverItems(page === 0 ? result.items : previousItems, page === 0 ? previousItems : result.items);
      const resultMeta = metaWithoutItems(result);
      const nextMeta = Number(previous?.meta?.page || 0) > Number(resultMeta.page || 0)
        ? { ...resultMeta, ...previous.meta }
        : resultMeta;
      cacheRef.current.set(`${targetSource}:${queryKey(query)}`, { items: merged, meta: nextMeta });
    }
    return result;
  }

  async function fetchDiscoverPage(page, { prefetch = false, targetSource = source, query = searchQuery } = {}) {
    const key = pageCacheKey(targetSource, page, query);
    if (pageCacheRef.current.has(key)) return pageCacheRef.current.get(key);
    if (prefetchRef.current.has(key)) return prefetchRef.current.get(key);
    const request = window.skillStudio.githubTrends(targetSource, page, query)
      .then((result) => rememberDiscoverPage(targetSource, page, result, query))
      .finally(() => {
        prefetchRef.current.delete(key);
      });
    if (prefetch) prefetchRef.current.set(key, request);
    return request;
  }

  function prefetchNextPages(fromPage, hasMore = true, targetSource = source, query = searchQuery) {
    if (!hasMore) return;
    return Promise.all([1, 2].map((offset) => {
      const page = Number(fromPage || 0) + offset;
      const key = pageCacheKey(targetSource, page, query);
      if (pageCacheRef.current.has(key) || prefetchRef.current.has(key)) return Promise.resolve(null);
      return fetchDiscoverPage(page, { prefetch: true, targetSource, query }).catch(() => null);
    }));
  }

  function scheduleModePrefetch(fromPage, hasMore = true, targetSource = source, query = searchQuery) {
    if (!hasMore) return;
    const timerKey = `${targetSource}:${queryKey(query)}`;
    const existing = prefetchTimersRef.current.get(timerKey);
    if (existing) window.clearTimeout(existing);
    const timer = window.setTimeout(() => {
      prefetchTimersRef.current.delete(timerKey);
      prefetchNextPages(fromPage, hasMore, targetSource, query)?.catch(() => {});
    }, 260);
    prefetchTimersRef.current.set(timerKey, timer);
  }

  function applyActiveDiscoverResult(result, cacheKey) {
    if (Array.isArray(result)) {
      setItems(result);
      setMeta({});
      cacheRef.current.set(cacheKey, { items: result, meta: {} });
      return {};
    }
    const cached = cacheRef.current.get(cacheKey);
    const nextItems = cached?.items?.length ? cached.items : result.items;
    const resultMeta = metaWithoutItems(result);
    const nextMeta = Number(cached?.meta?.page || 0) > Number(resultMeta.page || 0)
      ? { ...resultMeta, ...cached.meta }
      : resultMeta;
    setItems((current) => nextItems?.length ? nextItems : current);
    setMeta(nextMeta);
    if (result.stale && result.error) setError(result.error);
    return nextMeta;
  }

  function warmDiscoverFirstPages(activeSource = source, query = searchQuery, requestId = requestSeqRef.current) {
    const activeCacheKey = `${activeSource}:${queryKey(query)}`;
    let activeRequest = Promise.resolve(null);
    discoverModes.forEach((targetSource) => {
      const request = fetchDiscoverPage(0, { prefetch: targetSource !== activeSource, targetSource, query })
        .then((result) => {
          if (!Array.isArray(result)) {
            const resultMeta = metaWithoutItems(result);
            scheduleModePrefetch(resultMeta.page || result.page || 0, resultMeta.hasMore ?? result.hasMore, targetSource, query);
          }
          if (targetSource === activeSource && requestId === requestSeqRef.current) {
            return applyActiveDiscoverResult(result, activeCacheKey);
          }
          return null;
        });
      if (targetSource === activeSource) {
        activeRequest = request;
      } else {
        request.catch(() => null);
      }
    });
    return activeRequest;
  }

  async function refresh() {
    const requestId = requestSeqRef.current + 1;
    requestSeqRef.current = requestId;
    setLoading(true);
    setError("");
    const cacheKey = `${source}:${queryKey()}`;
    setItems(cacheRef.current.get(cacheKey)?.items || []);
    setMeta(cacheRef.current.get(cacheKey)?.meta || {});
    try {
      await warmDiscoverFirstPages(source, searchQuery, requestId);
    } catch (err) {
      if (requestId === requestSeqRef.current) setError(err.message || String(err));
    } finally {
      if (requestId === requestSeqRef.current) setLoading(false);
    }
  }

  async function loadMore() {
    if (loading || loadingMore || !meta?.hasMore) return;
    const nextPage = Number(meta.page || 0) + 1;
    const hasPrefetchedPage = pageCacheRef.current.has(pageCacheKey(source, nextPage));
    setLoadingMore(!hasPrefetchedPage);
    setError("");
    try {
      const result = await fetchDiscoverPage(nextPage, { targetSource: source, query: searchQuery });
      if (!Array.isArray(result)) {
        if (!result.items?.length) {
          setMeta((current) => ({ ...current, ...result, hasMore: false, page: nextPage }));
          return;
        }
        setItems((current) => {
          const merged = mergeDiscoverItems(current, result.items || []);
          const nextMeta = metaWithoutItems(result);
          cacheRef.current.set(`${source}:${queryKey()}`, { items: merged, meta: nextMeta });
          return merged;
        });
        const nextMeta = metaWithoutItems(result);
        setMeta((current) => ({ ...current, ...nextMeta }));
        if (result.stale && result.error) setError(result.error);
        scheduleModePrefetch(result.page || nextPage, result.hasMore, source, searchQuery);
      }
    } catch (err) {
      setMeta((current) => ({ ...current, hasMore: false }));
      setError(err.message || String(err));
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [source, searchQuery]);

  useEffect(() => {
    return () => {
      prefetchTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      prefetchTimersRef.current.clear();
    };
  }, []);

  return { items, meta, error, loading, loadingMore, refresh, loadMore };
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="metric">
      <Icon size={17} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SourcePill({ source, diagnostic }) {
  const { t } = useI18n();
  const active = diagnostic?.status === "ok";
  return (
    <div className={`source-pill ${active ? "active" : "muted"}`}>
      <div>
        <strong>{source.client}</strong>
        <span>{source.label}</span>
      </div>
      <em>{active ? diagnostic.count : t("notFound")}</em>
    </div>
  );
}

function NavRow({ icon: Icon, label, count, active, onClick }) {
  return (
    <button className={`nav-row ${active ? "active" : ""}`} onClick={onClick}>
      <Icon size={15} />
      <span>{label}</span>
      {count !== "" ? <em>{count}</em> : null}
    </button>
  );
}

function CountRow({ label, count, active, onClick, logo }) {
  return (
    <button className={`count-row ${active ? "active" : ""}`} onClick={onClick}>
      {logo ? <span className="count-row-logo">{logo}</span> : null}
      <span>{label}</span>
      <em>{count}</em>
    </button>
  );
}

function StarButton({ active, onClick, className = "", label = false }) {
  const { t } = useI18n();
  return (
    <button className={`star-button ${className} ${active ? "active" : ""}`} onClick={onClick} title={active ? t("unstar") : t("star")}>
      <Star size={16} />
      {label ? <span>{active ? t("starred") : t("star")}</span> : null}
    </button>
  );
}

function MetaStrip({ items, className = "" }) {
  const visible = items.filter((item) => item?.value !== undefined && item?.value !== null && item?.value !== "");
  if (!visible.length) return null;
  return (
    <div className={`meta-strip ${className}`}>
      {visible.map((item) => (
        <span key={item.label}>
          <b>{item.label}</b>
          <em>{item.value}</em>
        </span>
      ))}
    </div>
  );
}

function SkillManagerLogo() {
  return (
    <svg className="skill-manager-logo" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="logoGradient" x1="18" y1="14" x2="48" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5FE0D4" />
          <stop offset="0.55" stopColor="#45BF87" />
          <stop offset="1" stopColor="#8B7CFF" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="15" className="logo-tile" />
      <path
        className="logo-s"
        d="M21.1 20.2c3.2-4.4 9.3-6.3 16.6-5 4.8.8 8.3 2.7 10.5 5l-4.5 6c-1.9-1.9-4.8-3.3-8.2-3.5-3.8-.2-6.7.6-7.9 2.3-1.1 1.6.1 3 4.6 4.3l4.8 1.4c7.7 2.2 11.7 6.1 10.7 12.1-1.1 6.6-7.8 10.1-16.2 8.7-6.1-1-10.8-3.7-13.7-7.5l4.9-5.8c2.1 2.6 5.2 4.5 9.3 5.2 4.4.8 7.5-.4 8.1-2.6.5-1.8-1.1-3.2-5.3-4.4l-4.8-1.4c-7.9-2.3-11.7-6-10.5-12 .2-1 .8-2 1.6-2.8Z"
      />
      <circle cx="44" cy="25.2" r="3" className="logo-dot green" />
      <circle cx="44" cy="25.2" r="1" className="logo-dot-core" />
      <circle cx="20.2" cy="40.6" r="2.7" className="logo-dot violet" />
      <circle cx="20.2" cy="40.6" r="0.9" className="logo-dot-core" />
    </svg>
  );
}

function AgentLogo({ source }) {
  const raw = `${source?.id || ""} ${source?.client || ""}`.toLowerCase();
  let brand = "agent";
  let label = String(source?.client || "A").trim().slice(0, 1).toUpperCase() || "A";
  if (raw.includes("github") || raw.includes("copilot")) {
    brand = "github";
    label = "GH";
  } else if (raw.includes("cursor")) {
    brand = "cursor";
    label = "C";
  } else if (raw.includes("opencode")) {
    brand = "opencode";
    label = "OC";
  } else if (raw.includes("qwen")) {
    brand = "qwen";
    label = "Q";
  } else if (raw.includes("kiro")) {
    brand = "kiro";
    label = "K";
  } else if (raw.includes("iflow")) {
    brand = "iflow";
    label = "iF";
  } else if (raw.includes("gemini")) {
    brand = "gemini";
    label = "✦";
  } else if (raw.includes("windsurf")) {
    brand = "windsurf";
    label = "W";
  } else if (raw.includes("grok")) {
    brand = "grok";
    label = "G";
  } else if (raw.includes("amp")) {
    brand = "amp";
    label = "A";
  } else if (raw.includes("antigravity")) {
    brand = "antigravity";
    label = "AG";
  } else if (raw.includes("hermes")) {
    brand = "hermes";
    label = "H";
  } else if (raw.includes("codex")) {
    brand = "codex";
    label = "◎";
  } else if (raw.includes("claude")) {
    brand = "claude";
    label = "✹";
  } else if (raw.includes("qoderwork")) {
    brand = "qoderwork";
    label = "QW";
  } else if (raw.includes("qoder")) {
    brand = "qoder";
    label = "Q";
  } else if (raw.includes("openclaw")) {
    brand = "openclaw";
    label = "OC";
  } else if (raw.includes("agents")) {
    brand = "agents";
    label = "A";
  }
  return <span className={`agent-logo agent-logo-${brand}`} aria-hidden="true">{label}</span>;
}

function SkillRow({ skill, index = 0, tone = "installed", selected, onSelect, actionLabel, onAction, busy, starred, onStar, sourceLabel, selectable = false, checked = false, onToggleSelect }) {
  const { t } = useI18n();
  const actionClass = actionLabel === t("uninstall") ? "action-uninstall" : "action-install";
  const copies = skill.installations || [skill];
  const copyAgents = [...new Set(copies.map((copy) => (
    skill.sourceId === "uninstalled"
      ? (copy.uninstallMeta?.sourceClient || copy.uninstallMeta?.sourceLabel || copy.client)
      : copy.client
  )))];
  const version = skill.merged ? "" : skillVersion(skill);
  return (
    <div
      className={`skill-row ${selectable ? "selectable" : ""} ${selected ? "selected" : ""} ${checked ? "checked" : ""}`}
      onClick={(event) => {
        if (selectable && (event.shiftKey || event.metaKey || event.ctrlKey)) {
          onToggleSelect?.(skill, event);
          return;
        }
        onSelect(skill, event);
      }}
    >
      <StarButton active={starred} className="row-star" onClick={(event) => { event.stopPropagation(); onStar(skill); }} />
      {selectable ? (
        <label className="row-select-corner" onClick={(event) => event.stopPropagation()}>
          <input
            className="row-select-check"
            type="checkbox"
            checked={checked}
            onClick={(event) => {
              event.stopPropagation();
              onToggleSelect?.(skill, event);
            }}
            onChange={() => {}}
          />
        </label>
      ) : null}
      <div className="row-main">
        <div className={`skill-glyph ${tone}`}>{index + 1}</div>
        <div>
          <div className="row-title">
            <strong>{skill.name}</strong>
            {version ? <span className="version-badge">v{version}</span> : null}
            {sourceLabel ? <span className="source-badge">{sourceLabel}</span> : null}
          </div>
          <div className="row-source">{skill.merged ? compactAgentSummary(copyAgents) : copyAgents[0]}</div>
          <p>{skill.description || t("noDescription")}</p>
        </div>
      </div>
      <div className="row-meta">
        <span>{t("updatedPrefix")} {formatDate(skill.updatedAt)}</span>
        {actionLabel && onAction ? (
          <button className={actionClass} disabled={busy} onClick={(event) => { event.stopPropagation(); onAction(skill); }}>
            {busy ? t("processing") : actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DiscoverRow({ item, index, selected, onSelect, onInstall, onUninstall, busy, starred, onStar, installedSkills = [] }) {
  const { t } = useI18n();
  const popularity = item.installsLabel ? `${t("totalInstalls")} ${item.installsLabel}` : `★ ${formatNumber(item.stars)}`;
  const sourceName = item.sourceName || item.fullName;
  const version = skillVersion(item);
  const installedCopies = uniqueInstalledSkills(installedSkills);
  const installedAgents = installedCopies.map((skill) => skill.client);
  const description = item.description && item.description !== `${item.name} from ${sourceName}` ? item.description : "";
  const updateAvailable = isDiscoverUpdateAvailable(item, installedCopies);
  const actionLabel = installedCopies.length ? (updateAvailable ? t("update") : t("uninstall")) : t("install");
  const actionClass = updateAvailable ? "action-update" : installedCopies.length ? "action-uninstall" : "action-install";
  return (
    <div className={`discover-row ${selected ? "selected" : ""}`} onClick={() => onSelect(item)}>
      <StarButton active={starred} className="row-star" onClick={(event) => { event.stopPropagation(); onStar(item); }} />
      <div className="row-main">
        <div className="skill-glyph installed">{index + 1}</div>
        <div>
          <div className="row-title">
            <strong>{item.name}</strong>
            {version ? <span className="version-badge">v{version}</span> : null}
          </div>
          <div className="row-source row-source-repo"><span>{t("source")}</span>{sourceName}</div>
          {installedAgents.length ? <div className="row-source row-source-sub"><span>{t("installedLabel")}</span>{compactAgentSummary(installedAgents)}</div> : null}
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      <div className="row-meta">
        <span>{popularity}{item.weeklyLabel ? ` · ${t("recentEightWeeks")} ${item.weeklyLabel}` : ""}</span>
        <button className={actionClass} disabled={busy} onClick={(event) => { event.stopPropagation(); installedCopies.length && !updateAvailable ? onUninstall(item, installedCopies) : onInstall(item, updateAvailable); }}>
          {busy ? t("processing") : actionLabel}
        </button>
      </div>
    </div>
  );
}

const loadingSayings = {
  zh: [
    "好 skill 值得多等半拍。",
    "正在翻目录，顺手把灰尘也吹掉。",
    "把散落在各个 Agent 里的 skill 排好队。",
    "本地知识正在集合，马上到齐。",
    "扫描中：只认一级目录里的 SKILL.md。",
    "给每个 skill 找到它真正住的地方。",
    "慢一点点，是为了少一点点误判。",
    "正在从 skills.sh 捞出新鲜线索。",
    "让目录树先跑一会儿。",
    "把版本、标签和来源捋顺中。"
  ],
  en: [
    "A good skill is worth a tiny pause.",
    "Reading directories and keeping the dust out.",
    "Lining up skills across every Agent.",
    "Local knowledge is gathering itself.",
    "Scanning only first-level folders with SKILL.md.",
    "Finding where each skill actually lives.",
    "A little patience buys fewer false positives.",
    "Pulling fresh signals from skills.sh.",
    "Letting the directory tree warm up.",
    "Sorting versions, tags, and sources."
  ]
};

function randomLoadingSaying(seed = "", lang = "zh") {
  const sayings = loadingSayings[lang] || loadingSayings.zh;
  let hash = 0;
  for (const char of seed) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  const randomPart = Math.floor(Math.random() * sayings.length);
  return sayings[Math.abs(hash + randomPart) % sayings.length];
}

function LoadingMoment({ title, seed = "", compact = false }) {
  const { lang } = useI18n();
  const saying = useMemo(() => randomLoadingSaying(seed, lang), [seed, lang]);
  return (
    <div className={`loading-moment ${compact ? "compact" : ""}`}>
      <div className="loading-orbit" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div>
        <strong>{title}</strong>
        <p>{saying}</p>
      </div>
    </div>
  );
}

function EmptyList({ mode, scanning = false }) {
  const { t } = useI18n();
  if (scanning && mode === "installed") {
    return <LoadingMoment title={t("localScanning")} seed="installed-scan" />;
  }
  if (scanning && mode === "discover") {
    return <LoadingMoment title={t("discoverScanning")} seed="discover-scan" />;
  }
  const text = mode === "uninstalled"
    ? t("emptyUninstalled")
    : mode === "starred"
      ? t("emptyStarred")
      : mode === "discover"
        ? t("emptyDiscover")
        : mode === "tags"
          ? t("emptyTags")
          : t("emptyLocal");
  return <div className="list-empty">{text}</div>;
}

function DiscoverDetail({ item, onInstall, onUninstall, busy, starred, onStar, installedSkills = [] }) {
  const { t } = useI18n();
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!item) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetail(null);
    window.skillStudio.discoverDetail(item)
      .then((result) => {
        if (!cancelled) setDetail(result || {});
      })
      .catch(() => {
        if (!cancelled) setDetail({});
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [item?.id]);

  if (!item) {
    return (
      <section className="detail empty">
        <Sparkles size={34} />
        <p>{t("discoverEmptyHint")}</p>
      </section>
    );
  }
  const sourceName = item.sourceName || item.fullName;
  const summaryLead = detail?.summaryLead || item.description || "";
  const summaryItems = detail?.summaryItems || [];
  const installCommand = detail?.installCommand || item.installCommand || `git clone --depth 1 ${item.url}`;
  const installedCopies = uniqueInstalledSkills(installedSkills);
  const installedAgents = installedCopies.map(installedAgentVersionLabel);
  const updateAvailable = isDiscoverUpdateAvailable(item, installedCopies);
  const version = skillVersion(item);

  return (
    <section className="detail discover-detail">
      <div className="detail-header">
        <div className="detail-icon github-icon"><Github size={24} /></div>
        <div>
          <h2>{item.name}</h2>
          <p>{item.description || t("noDescription")}</p>
          <div className="detail-source-line">
            <span>{sourceName}</span>
            <span>skills.sh</span>
          </div>
        </div>
      </div>
      <div className="detail-actions">
        <button className="action-install" onClick={() => onInstall(item)} disabled={busy}>
          <FileCode2 size={16} />
          {busy ? t("installing") : t("install")}
        </button>
        {installedCopies.length ? (
          <button className={updateAvailable ? "action-update" : "action-uninstall"} onClick={() => updateAvailable ? onInstall(item, true) : onUninstall(item, installedCopies)} disabled={busy}>
            <RotateCcw size={16} />
            {busy ? t("processing") : updateAvailable ? t("update") : t("uninstall")}
          </button>
        ) : null}
        <StarButton active={starred} className="detail-star" label onClick={(event) => { event.stopPropagation(); onStar?.(item); }} />
        <button className="soft-button" onClick={() => window.skillStudio.open(item.repositoryUrl || item.url)}>
          <Github size={16} />
          {t("repository")}
        </button>
        <button className="soft-button" onClick={() => window.skillStudio.open(item.url)}>
          <ExternalLink size={16} />
          {t("openOn")} {item.sourceLabel || "GitHub"}
        </button>
      </div>
      <MetaStrip
        className="discover-meta"
        items={[
          { label: t("installStatus"), value: installedAgents.length ? installedAgents.join(", ") : t("notInstalled") },
          { label: t("version"), value: version ? `v${version}` : "" },
          { label: t("source"), value: sourceName },
          { label: item.installsLabel ? t("totalInstalls") : t("starred"), value: item.installsLabel || formatNumber(item.stars) },
          { label: t("weeklyActivity"), value: item.weeklyLabel || "-" },
          { label: t("rank"), value: item.rank ? `#${item.rank}` : "-" }
        ]}
      />
      <div className="detail-tags">
        {[sourceName, item.sourceLabel || "skills.sh", item.language || "Mixed", "discover"].map((tag) => (
          <TagPill key={tag} tag={tag} />
        ))}
      </div>
      <section className="discover-info-panel">
        <div>
          <h3>{t("basicInfo")}</h3>
          <p>{item.description || t("discoverDescriptionFallback").replace("{source}", item.sourceLabel || "GitHub").replace("{name}", item.name)}</p>
        </div>
        <div>
          <h3>{t("installMethod")}</h3>
          <div className="code-block">
            <pre>{installCommand}</pre>
          </div>
        </div>
        <div>
          <h3>{t("summary")}</h3>
          {detailLoading ? (
            <p>{t("loadingSummary")}</p>
          ) : (
            <div className="summary-box">
              {summaryLead ? <p><strong>{summaryLead}</strong></p> : <p>{t("noSummary")}</p>}
              {summaryItems.length ? (
                <ul>
                  {summaryItems.map((summaryItem, index) => <li key={index}>{summaryItem}</li>)}
                </ul>
              ) : null}
            </div>
          )}
        </div>
        <div>
          <h3>{t("skillContent")}</h3>
          <div className="skill-md-preview">
            <pre>{detail?.skillMdText || detail?.skillMdLead || t("noSkillContent")}</pre>
          </div>
        </div>
      </section>
    </section>
  );
}

function InstallSourceDetail({ mode }) {
  const { t } = useI18n();
  const isLocal = mode === "local";
  return (
    <section className="detail install-source-detail">
      <div className="detail-header">
        <div className="detail-icon source-detail-icon">
          {isLocal ? <FolderOpen size={24} /> : <Github size={24} />}
        </div>
        <div>
          <h2>{isLocal ? t("localInstall") : t("remoteInstall")}</h2>
          <p>{isLocal ? t("localInstallDesc") : t("remoteInstallHint")}</p>
        </div>
      </div>
      <div className="source-guide-grid">
        <div>
          <strong>{isLocal ? t("localSkillPath") : t("remoteSkillUrl")}</strong>
          <span>{isLocal ? t("localSkillPathPlaceholder") : t("remoteSkillUrlPlaceholder")}</span>
        </div>
        <div>
          <strong>{t("install")}</strong>
          <span>{isLocal ? t("importLocalDesc") : t("remoteInstallDesc")}</span>
        </div>
      </div>
    </section>
  );
}

function GithubTrendPanel({ trends }) {
  const { t } = useI18n();
  return (
    <div className="github-trends">
      <div className="section-label">
        <Github size={15} />
        {t("githubTrending")}
        {trends.loading ? <em>{t("updatingNow")}</em> : null}
      </div>
      {trends.error ? <p className="trend-error">{t("trendsUnavailable")}</p> : null}
      <div className="github-list">
        {trends.items.slice(0, 7).map((repo, index) => (
          <button key={repo.id} className="github-item" onClick={() => window.skillStudio.open(repo.url)}>
            <span>{index + 1}</span>
            <div>
              <strong>{repo.fullName}</strong>
              <em>{repo.language} · ★ {repo.stars.toLocaleString()}</em>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function DiffFileTreeNode({ node, activePath, onSelect }) {
  const [open, setOpen] = useState(true);
  const selected = activePath === node.path;
  return (
    <div className="diff-tree-node">
      <button
        className={`diff-tree-item ${node.type} ${selected ? "selected" : ""}`}
        onClick={() => {
          if (node.type === "directory") {
            setOpen(!open);
          } else {
            onSelect(node.file);
          }
        }}
      >
        {node.type === "directory" ? <FolderOpen size={13} /> : <FileText size={13} />}
        <span>{node.name}</span>
        {node.file?.type ? <em>{node.file.type}</em> : null}
      </button>
      {node.type === "directory" && open ? (
        <div className="diff-tree-children">
          {(node.children || []).map((child) => (
            <DiffFileTreeNode key={child.path} node={child} activePath={activePath} onSelect={onSelect} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function buildDiffTree(files = []) {
  const rootNode = { name: "skill", path: ".", type: "directory", children: [] };
  const root = rootNode.children;
  const directories = new Map();
  function ensureDir(parts, pathPrefix) {
    const key = pathPrefix.join("/");
    if (directories.has(key)) return directories.get(key);
    const parent = pathPrefix.length > 1 ? ensureDir(parts.slice(0, -1), pathPrefix.slice(0, -1)) : { children: root };
    const node = { name: parts[parts.length - 1], path: key, type: "directory", children: [] };
    parent.children.push(node);
    directories.set(key, node);
    return node;
  }

  files.forEach((file) => {
    const parts = file.path.split("/").filter(Boolean);
    if (!parts.length) return;
    const parent = parts.length > 1 ? ensureDir(parts.slice(0, -1), parts.slice(0, -1)) : { children: root };
    parent.children.push({ name: parts[parts.length - 1], path: file.path, type: "file", file });
  });

  function sort(nodes) {
    nodes.sort((a, b) => Number(b.type === "directory") - Number(a.type === "directory") || a.name.localeCompare(b.name));
    nodes.forEach((node) => node.children && sort(node.children));
    return nodes;
  }
  sort(root);
  return [rootNode];
}

function TreeDraftInput({ draft, onChange, onSubmit, onCancel }) {
  const { t } = useI18n();
  return (
    <form
      className="tree-draft-input"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      {draft.type === "directory" ? <FolderOpen size={13} /> : <FileText size={13} />}
      <input
        autoFocus
        value={draft.name}
        placeholder={draft.type === "directory" ? t("directoryName") : t("fileNameMd")}
        onChange={(event) => onChange?.(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel?.();
        }}
      />
    </form>
  );
}

function TreeNode({ node, activePath, selectedDirPath, selectedPaths, onNodeClick, onOpenFile, onSelectDirectory, onContextMenu, draft, onDraftChange, onDraftSubmit, onDraftCancel }) {
  const [open, setOpen] = useState(true);
  const isDirectory = node.type === "directory";
  const selected = activePath === node.path;
  const multiSelected = selectedPaths?.includes(node.path);
  const directorySelected = isDirectory && selectedDirPath === node.path;
  const isRenameDraft = draft?.mode === "rename" && draft.path === node.path;
  const isCreateDraft = draft?.mode === "create" && draft.baseDir === node.path;
  return (
    <div className="tree-node">
      {isRenameDraft ? (
        <TreeDraftInput draft={draft} onChange={onDraftChange} onSubmit={onDraftSubmit} onCancel={onDraftCancel} />
      ) : (
        <button
          className={`tree-item ${node.type} ${selected || directorySelected ? "selected" : ""} ${multiSelected ? "multi-selected" : ""}`}
          onContextMenu={(event) => onContextMenu?.(event, node)}
          onClick={(event) => {
            onNodeClick?.(event, node);
            if (isDirectory) {
              onSelectDirectory?.(node.path);
              setOpen(!open);
            } else {
              onOpenFile(node);
            }
          }}
        >
          {isDirectory ? <FolderOpen size={13} /> : <FileText size={13} />}
          <span>{node.name}</span>
        </button>
      )}
      {isDirectory && (open || isCreateDraft) ? (
        <div className="tree-children">
          {isCreateDraft ? (
            <TreeDraftInput draft={draft} onChange={onDraftChange} onSubmit={onDraftSubmit} onCancel={onDraftCancel} />
          ) : null}
          {(node.children || []).map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              activePath={activePath}
              selectedDirPath={selectedDirPath}
              selectedPaths={selectedPaths}
              onNodeClick={onNodeClick}
              onOpenFile={onOpenFile}
              onSelectDirectory={onSelectDirectory}
              onContextMenu={onContextMenu}
              draft={draft}
              onDraftChange={onDraftChange}
              onDraftSubmit={onDraftSubmit}
              onDraftCancel={onDraftCancel}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DirectoryTree({ skill, activePath, selectedDirPath, selectedPaths, onNodeClick, onOpenFile, onSelectDirectory, onContextMenu, draft, onDraftChange, onDraftSubmit, onDraftCancel }) {
  const { t } = useI18n();
  const items = skill.directoryTree || [];
  const total = skill.directoryCount ?? countTree(items);
  const rootCreateDraft = draft?.mode === "create" && draft.baseDir === skill.dir;
  const rootNode = { name: skill.slug, path: skill.dir, relPath: ".", type: "directory" };
  return (
    <aside
      className="directory-pane"
      onContextMenu={(event) => {
        if (event.target.closest(".tree-item, .tree-draft-input")) return;
        onContextMenu?.(event, rootNode);
      }}
    >
      <div className="reader-label">
        <span>
          <ListTree size={15} />
          {t("skillDirectory")}
        </span>
        <em>{total}</em>
      </div>
      <div className="tree-list">
        <button
          className={`tree-item root ${selectedDirPath === skill.dir ? "selected" : ""}`}
          onClick={() => onSelectDirectory?.(skill.dir)}
          onContextMenu={(event) => onContextMenu?.(event, rootNode)}
        >
          <FolderOpen size={14} />
          <span>{skill.slug}</span>
        </button>
        {rootCreateDraft ? (
          <TreeDraftInput draft={draft} onChange={onDraftChange} onSubmit={onDraftSubmit} onCancel={onDraftCancel} />
        ) : null}
        {items.map((item) => (
          <TreeNode
            key={item.path}
            node={item}
            activePath={activePath}
            selectedDirPath={selectedDirPath}
            selectedPaths={selectedPaths}
            onNodeClick={onNodeClick}
            onOpenFile={onOpenFile}
            onSelectDirectory={onSelectDirectory}
            onContextMenu={onContextMenu}
            draft={draft}
            onDraftChange={onDraftChange}
            onDraftSubmit={onDraftSubmit}
            onDraftCancel={onDraftCancel}
          />
        ))}
      </div>
    </aside>
  );
}

function CodeBlock({ code, language = "text", plain = false }) {
  const normalizedLanguage = language || "text";
  return (
    <div className={`code-block syntax-block ${plain ? "plain-file" : ""}`}>
      {normalizedLanguage !== "text" ? <div className="code-lang">{normalizedLanguage}</div> : null}
      <pre>{highlightCode(code, normalizedLanguage)}</pre>
    </div>
  );
}

function HighlightedEditor({ value, language, onChange }) {
  const highlightRef = useRef(null);
  const gutterRef = useRef(null);
  const lineNumbers = useMemo(() => {
    const count = Math.max(1, String(value || "").split(/\r?\n/).length);
    return Array.from({ length: count }, (_, index) => index + 1).join("\n");
  }, [value]);
  return (
    <div className="highlight-editor">
      <pre className="highlight-gutter" ref={gutterRef} aria-hidden="true">{lineNumbers}</pre>
      <pre ref={highlightRef} aria-hidden="true">{highlightCode(value || " ", language)}</pre>
      <textarea
        className="file-editor highlight-input"
        value={value}
        onChange={onChange}
        onScroll={(event) => {
          if (!highlightRef.current) return;
          highlightRef.current.scrollTop = event.currentTarget.scrollTop;
          highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
          if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop;
        }}
        spellCheck={false}
      />
    </div>
  );
}

function SkillReader({ file }) {
  const parsed = useMemo(() => parseFrontmatterText(file.content), [file.content]);
  const markdownText = file.isSkillFile ? parsed.body : file.content;
  const blocks = useMemo(() => parseMarkdownBlocks(markdownText), [markdownText]);
  const meta = file.isSkillFile ? frontmatterEntries(parsed.frontmatter) : [];
  const language = codeLanguageFromPath(file.path || file.name);

  if (!file.isMarkdown) {
    return (
      <article className="skill-reader">
        <CodeBlock code={file.content} language={language} plain />
      </article>
    );
  }

  return (
    <article className="skill-reader">
      {meta.length ? (
        <div className="frontmatter-panel">
          {meta.map(([key, value]) => (
            <span key={key}>
              <b>{key}</b>
              {Array.isArray(value) ? value.join(", ") : String(value)}
            </span>
          ))}
        </div>
      ) : null}

      <div className="markdown-flow">
        {blocks.map((block, index) => {
          if (block.type === "heading") {
            const Heading = `h${Math.min(block.level + 1, 4)}`;
            return <Heading key={index}>{block.text}</Heading>;
          }
          if (block.type === "code") {
            return <CodeBlock key={index} code={block.text} language={block.lang || "text"} />;
          }
          if (block.type === "list") {
            return <ul key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}</ul>;
          }
          if (block.type === "ordered") {
            return <ol key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}</ol>;
          }
          if (block.type === "quote") {
            return <blockquote key={index}>{renderInline(block.text)}</blockquote>;
          }
          return <p key={index}>{renderInline(block.text)}</p>;
        })}
      </div>
    </article>
  );
}

function DiffViewer({ detail }) {
  const { t } = useI18n();
  const rows = useMemo(() => buildLineDiff(detail.content, detail.current), [detail]);
  const added = rows.filter((row) => row.type === "added").length;
  const removed = rows.filter((row) => row.type === "removed").length;
  const changed = added + removed;

  return (
    <>
      <div className="diff-summary">
        <span className="added">+{added} {t("added")}</span>
        <span className="removed">-{removed} {t("removed")}</span>
        <span>{changed ? `${changed} ${t("changedLines")}` : t("noContentDiff")}</span>
      </div>
      <div className="diff-list">
        {rows.map((row, index) => (
          <div key={index} className={`diff-line ${row.type}`}>
            <span className="diff-line-no">{row.type === "removed" ? row.oldLine : row.newLine}</span>
            <b>{row.type === "added" ? "+" : row.type === "removed" ? "-" : " "}</b>
            <code>{row.line || " "}</code>
          </div>
        ))}
      </div>
    </>
  );
}

function DirectoryDiffViewer({ detail }) {
  const { t } = useI18n();
  const files = detail?.files || [];
  const [selectedPath, setSelectedPath] = useState("");
  const [treeWidth, setTreeWidth] = useState(210);
  useEffect(() => {
    setSelectedPath(files[0]?.path || "");
  }, [detail?.version?.id, files[0]?.path]);
  const tree = useMemo(() => buildDiffTree(files), [files]);
  const selectedFile = files.find((file) => file.path === selectedPath) || files[0];
  if (!files.length) return <div className="diff-empty">{t("noDirectoryDiff")}</div>;
  return (
    <div className="directory-diff-view" style={{ "--diff-tree-width": `${treeWidth}px` }}>
      <aside className="diff-file-tree">
        <div className="diff-file-tree-head">
          <span>{t("changedFiles")}</span>
          <em>{files.length}</em>
        </div>
        <div className="diff-file-tree-list">
          {tree.map((node) => (
            <DiffFileTreeNode key={node.path} node={node} activePath={selectedFile?.path} onSelect={(file) => setSelectedPath(file.path)} />
          ))}
        </div>
      </aside>
      <div
        className="history-resizer vertical"
        onMouseDown={(event) => {
          event.preventDefault();
          const startX = event.clientX;
          const startWidth = treeWidth;
          const move = (moveEvent) => {
            setTreeWidth(Math.max(150, Math.min(360, startWidth + moveEvent.clientX - startX)));
          };
          const up = () => {
            window.removeEventListener("mousemove", move);
            window.removeEventListener("mouseup", up);
          };
          window.addEventListener("mousemove", move);
          window.addEventListener("mouseup", up);
        }}
      />
      <section className="file-diff-card">
        <div className="file-diff-head">
          <strong>{selectedFile.path}</strong>
          <span>{selectedFile.type}</span>
        </div>
        {selectedFile.binary ? (
          <div className="diff-empty">{t("binaryDiffOnly")}</div>
        ) : (
          <DiffViewer detail={{ content: selectedFile.content, current: selectedFile.current }} />
        )}
      </section>
    </div>
  );
}

function SkillVersionPicker({ copy, onActivate, onDelete, busy, showAllVersions = true }) {
  const { t } = useI18n();
  const allVersions = copy?.versionInfo?.versions || [];
  const currentVersion = skillVersion(copy);
  const currentLabel = copy?.versionInfo?.currentLabel || (currentVersion ? `v${currentVersion}` : skillVersionLabel(copy) || copy?.versionInfo?.activeLabel || "");
  const unmanaged = Boolean(copy?.versionInfo?.unmanaged || !currentVersion);
  const versions = showAllVersions ? allVersions : allVersions.filter((version) => (
    version.sourceId === copy?.sourceId
    || (version.sourceIds || []).includes(copy?.sourceId)
    || version.id === copy?.versionInfo?.activeArchiveId
    || (version.duplicateIds || []).includes(copy?.versionInfo?.activeArchiveId)
  ));
  const [versionMenuOpen, setVersionMenuOpen] = useState(false);
  const [selectedVersionIds, setSelectedVersionIds] = useState([]);
  const pickerRef = useRef(null);
  const currentArchive = versions.find((version) => (
    version.hash === copy?.versionInfo?.currentHash && (!currentLabel || version.label === currentLabel)
  ));
  const selectedId = currentArchive?.id || copy?.versionInfo?.activeArchiveId || "";
  const latestVersion = versions[0] || null;
  const isSelectedVersion = (version) => version?.id === selectedId || (version?.duplicateIds || []).includes(selectedId);
  const stale = Boolean(latestVersion?.id && selectedId && !isSelectedVersion(latestVersion));
  const deletableVersions = versions.filter((version) => !isSelectedVersion(version) && !version.active);
  const selectedVersionEntry = versions.find((version) => (
    version.id === selectedId || (version.duplicateIds || []).includes(selectedId)
  ));
  const selectedVersionLabel = selectedVersionEntry?.label || currentLabel || t("currentVersion");
  const compactSelectedVersionLabel = compactVersionLabel(selectedVersionLabel);
  useEffect(() => {
    setSelectedVersionIds((current) => current.filter((id) => deletableVersions.some((version) => version.id === id)));
  }, [copy?.id, selectedId, versions.length]);
  useEffect(() => {
    if (!versionMenuOpen) return undefined;
    const closeOnOutside = (event) => {
      if (!pickerRef.current?.contains(event.target)) {
        setVersionMenuOpen(false);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setVersionMenuOpen(false);
    };
    window.addEventListener("pointerdown", closeOnOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [versionMenuOpen]);
  function toggleVersionDelete(id) {
    setSelectedVersionIds((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  }
  function deleteSelectedVersions() {
    if (!selectedVersionIds.length) return;
    const selectedIds = versions
      .filter((version) => selectedVersionIds.includes(version.id))
      .flatMap((version) => version.duplicateIds?.length ? version.duplicateIds : [version.id]);
    onDelete?.(selectedIds, () => {
      setSelectedVersionIds([]);
      setVersionMenuOpen(false);
    });
  }
  if (!copy) return null;
  if (unmanaged) {
    if (!currentLabel) return null;
    const fullLabel = displayVersionLabel(currentLabel);
    return (
      <div ref={pickerRef} className="version-picker readonly unmanaged-version-picker">
        <button className="version-dropdown-trigger compact-version-trigger" type="button" aria-label={`${t("version")} ${fullLabel}`}>
          <strong>{compactVersionLabel(currentLabel)}</strong>
        </button>
        <div className="unmanaged-version-popover" role="tooltip">
          <strong>{fullLabel}</strong>
        </div>
      </div>
    );
  }
  if (!versions.length) {
    if (!currentLabel) return null;
    const fullLabel = displayVersionLabel(currentLabel);
    return (
      <div ref={pickerRef} className="version-picker readonly">
        <button className="version-dropdown-trigger compact-version-trigger" type="button" aria-label={`${t("version")} ${fullLabel}`}>
          <strong>{compactVersionLabel(currentLabel)}</strong>
        </button>
      </div>
    );
  }
  return (
    <div ref={pickerRef} className={`version-picker ${stale ? "stale" : ""}`}>
      <button className="version-dropdown-trigger compact-version-trigger" onClick={() => setVersionMenuOpen((open) => !open)} disabled={busy} aria-label={stale ? t("notLatestVersionLabel").replace("{version}", latestVersion?.label || latestVersion?.id) : selectedVersionLabel}>
        <strong>{compactSelectedVersionLabel}</strong>
      </button>
      {versionMenuOpen ? (
        <div className="version-dropdown-menu">
          <div className="version-dropdown-list">
            {versions.map((version) => {
              const active = isSelectedVersion(version);
              const protectedVersion = active || version.active;
              const checked = selectedVersionIds.includes(version.id);
              return (
                <div key={version.id} className={`version-dropdown-row ${active ? "active" : ""}`}>
                  <label>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={busy || protectedVersion}
                      onChange={() => toggleVersionDelete(version.id)}
                    />
                    <strong title={version.label || version.id}>{displayVersionLabel(version.label || version.id)}</strong>
                    <small>{active ? t("current") : version.active ? `${t("activeIn")}: ${(version.activeClients || []).join(", ")}` : formatDate(version.createdAt)}</small>
                  </label>
                  <button
                    disabled={busy || active}
                    onClick={() => {
                      setVersionMenuOpen(false);
                      onActivate(version);
                    }}
                  >
                    {active ? t("current") : t("switchVersion")}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="version-dropdown-actions">
            <button onClick={() => setSelectedVersionIds(deletableVersions.map((version) => version.id))} disabled={busy || !deletableVersions.length}>{t("selectAll")}</button>
            <button onClick={() => setSelectedVersionIds([])} disabled={busy || !selectedVersionIds.length}>{t("clear")}</button>
            <button className="danger" onClick={deleteSelectedVersions} disabled={busy || !selectedVersionIds.length}>
              {t("deleteSelected")} {selectedVersionIds.length ? `(${selectedVersionIds.length})` : ""}
            </button>
          </div>
        </div>
      ) : null}
      {stale && !versionMenuOpen ? (
        <button
          className="version-stale-badge"
          onClick={() => onActivate(latestVersion)}
          disabled={busy}
          title={t("latestVersionTitle").replace("{version}", latestVersion.label || latestVersion.id)}
        >
          {t("latest")}
        </button>
      ) : null}
    </div>
  );
}

function Detail({
  skill,
  onSaved,
  starred,
  onStar,
  onInstall,
  onUninstall,
  onDeleteRecords,
  agentScope = "all",
  installTargets = [],
  topInstallLabel = "Install",
  readOnly = false,
  hideTopInstall = false,
  hideHistory = false,
  hideVersionActions = false,
  hideTopEdit = true,
  cardActionLabel = "",
  onCardAction = null
}) {
  const { t } = useI18n();
  const [activeFile, setActiveFile] = useState(null);
  const [activeCopyId, setActiveCopyId] = useState("");
  const [syncPending, setSyncPending] = useState(null);
  const [syncTargetIds, setSyncTargetIds] = useState([]);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState("view");
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedHistoryVersionIds, setSelectedHistoryVersionIds] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [versionDetail, setVersionDetail] = useState(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeDetail, setUpgradeDetail] = useState(null);
  const [upgradeDetails, setUpgradeDetails] = useState({});
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [upgradeTargetPending, setUpgradeTargetPending] = useState(null);
  const [upgradeTargetCopyIds, setUpgradeTargetCopyIds] = useState([]);
  const [upgradeCopy, setUpgradeCopy] = useState(null);
  const [upgradeCopies, setUpgradeCopies] = useState([]);
  const [upgradeMessage, setUpgradeMessage] = useState("");
  const [versionSwitching, setVersionSwitching] = useState(false);
  const [selectedDirPath, setSelectedDirPath] = useState("");
  const [treeMenu, setTreeMenu] = useState(null);
  const [createEntryDraft, setCreateEntryDraft] = useState(null);
  const [copyOverrides, setCopyOverrides] = useState({});
  const [selectedTreePaths, setSelectedTreePaths] = useState([]);
  const [lastTreePath, setLastTreePath] = useState("");
  const [dirtyCopyIds, setDirtyCopyIds] = useState({});
  const [historyListWidth, setHistoryListWidth] = useState(190);
  const [fileError, setFileError] = useState("");
  const [fileNotice, setFileNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const pendingDeletedPathsRef = useRef(new Set());

  useEffect(() => {
    if (!readOnly) return;
    setMode("view");
    setPendingNavigation(null);
    setCreateEntryDraft(null);
    setTreeMenu(null);
  }, [readOnly, skill?.id]);

  async function loadHistory(filePath) {
    try {
      const entries = await window.skillStudio.fileHistory(filePath);
      setHistory(entries);
      return entries;
    } catch {
      setHistory([]);
      return [];
    }
  }

  function markCopyDirty(copy = activeCopy) {
    if (!copy?.id) return;
    setDirtyCopyIds((current) => ({
      ...current,
      [copy.id]: true
    }));
  }

  function clearCopiesDirty(copies = []) {
    const ids = copies.map((copy) => copy?.id).filter(Boolean);
    if (!ids.length) return;
    setDirtyCopyIds((current) => {
      const next = { ...current };
      ids.forEach((id) => delete next[id]);
      return next;
    });
  }

  async function openHistoryPanel() {
    if (!activeCopy) return;
    setHistoryOpen(true);
    setSelectedHistoryVersionIds([]);
    const entries = historicalVersions(activeCopy);
    setHistory(entries);
    if (entries.length) {
      await selectVersion(entries[0]);
    } else {
      setSelectedVersion(null);
      setVersionDetail(null);
      setSelectedHistoryVersionIds([]);
    }
  }

  function applyRefreshedCopy(scanResult, copy = activeCopy) {
    const fresh = (scanResult?.skills || []).find((item) => item.id === copy?.id)
      || (scanResult?.skills || []).find((item) => item.sourceId === copy?.sourceId && item.dir === copy?.dir);
    if (fresh?.id) {
      setCopyOverrides((current) => ({
        ...current,
        [copy.id]: (() => {
          const existing = current[copy.id] || copy;
          return {
            ...existing,
            ...fresh,
            id: copy.id,
            sourceId: copy.sourceId,
            client: copy.client,
            sourceLabel: copy.sourceLabel,
            root: copy.root,
            dir: copy.dir,
            version: skillVersion(fresh) || skillVersion(existing),
            latestVersion: fresh.latestVersion || existing.latestVersion,
            metadata: fresh.metadata || existing.metadata,
            frontmatter: fresh.frontmatter || existing.frontmatter,
            raw: fresh.raw || existing.raw,
            directoryTree: fresh.detailLoaded ? fresh.directoryTree : existing.directoryTree,
            directoryCount: fresh.detailLoaded ? fresh.directoryCount : existing.directoryCount,
            directoryTruncated: fresh.detailLoaded ? fresh.directoryTruncated : existing.directoryTruncated,
            detailLoaded: fresh.detailLoaded || existing.detailLoaded
          };
        })()
      }));
    }
    return fresh || null;
  }

  function withoutPendingDeletedNodes(tree = []) {
    const targets = pendingDeletedPathsRef.current;
    if (!targets.size) return tree;
    const isRemoved = (nodePath = "") => [...targets].some((targetPath) => (
      nodePath === targetPath || nodePath.startsWith(`${targetPath.replace(/\/+$/, "")}/`)
    ));
    return tree
      .filter((node) => !isRemoved(node.path))
      .map((node) => ({ ...node, children: withoutPendingDeletedNodes(node.children || []) }));
  }

  function loadFullSkillDetail(copy) {
    if (!copy?.dir || (copy.detailLoaded && copy.versionInfo)) return;
    window.skillStudio.skillDetail?.({
      skillDir: copy.dir,
      source: {
        id: copy.sourceId,
        client: copy.client,
        label: copy.sourceLabel,
        root: copy.root
      }
    }).then((fresh) => {
      if (fresh?.missing) return;
      if (!fresh?.id) return;
      const safeTree = withoutPendingDeletedNodes(fresh.directoryTree || []);
      setCopyOverrides((current) => ({
        ...current,
        [copy.id]: {
          ...copy,
          ...fresh,
          id: copy.id,
          sourceId: copy.sourceId,
          client: copy.client,
          sourceLabel: copy.sourceLabel,
          root: copy.root,
          dir: copy.dir,
          directoryTree: safeTree,
          directoryCount: countTree(safeTree)
        }
      }));
      if (historyOpen && copy.id === activeCopyId) {
        const refreshedCopy = { ...copy, ...fresh, directoryTree: safeTree, directoryCount: countTree(safeTree) };
        const entries = historicalVersions(refreshedCopy);
        setHistory(entries);
        if (entries.length) selectVersionForCopy(entries[0], refreshedCopy);
      }
    }).catch(() => {});
  }

  function applyCopySnapshot(snapshot, copy = activeCopy) {
    if (!snapshot?.id || !copy?.id) return null;
    const nextCopy = {
      ...copy,
      ...snapshot,
      id: copy.id,
      sourceId: copy.sourceId,
      client: copy.client,
      sourceLabel: copy.sourceLabel,
      root: copy.root,
      dir: copy.dir
    };
    setCopyOverrides((current) => ({
      ...current,
      [copy.id]: nextCopy
    }));
    const file = {
      path: nextCopy.filePath,
      name: "SKILL.md",
      content: nextCopy.raw || "",
      isMarkdown: true,
      isSkillFile: true,
      size: nextCopy.bytes,
      updatedAt: nextCopy.updatedAt
    };
    setActiveCopyId(copy.id);
    setActiveFile(file);
    setSelectedDirPath(nextCopy.dir);
    setDraft(file.content);
    setMode("view");
    setCreateEntryDraft(null);
    setTreeMenu(null);
    setPendingNavigation(null);
    setHistoryOpen(false);
    setSelectedVersion(null);
    setVersionDetail(null);
    setSelectedHistoryVersionIds([]);
    setSelectedTreePaths([]);
    setLastTreePath("");
    loadHistory(file.path);
    return nextCopy;
  }

  function refreshCopyInBackground(copy = activeCopy) {
    Promise.resolve(onSaved?.())
      .then((refreshed) => applyRefreshedCopy(refreshed, copy))
      .catch(() => {});
  }

  function updateActiveCopyOverride(patch) {
    if (!activeCopy?.id) return;
    setCopyOverrides((current) => ({
      ...current,
      [activeCopy.id]: {
        ...activeCopy,
        ...(current[activeCopy.id] || {}),
        ...patch
      }
    }));
  }

  function insertTreeNodeOptimistic(result, baseDir) {
    if (!activeCopy?.dir || !result?.path) return;
    const root = activeCopy.dir.replace(/\/+$/, "");
    const relPath = result.path.startsWith(`${root}/`) ? result.path.slice(root.length + 1) : result.name;
    const parts = relPath.split("/").filter(Boolean);
    if (!parts.length) return;
    const nextTree = structuredClone(activeCopy.directoryTree || []);

    function sortNodes(nodes) {
      nodes.sort((a, b) => Number(b.type === "directory") - Number(a.type === "directory") || a.name.localeCompare(b.name));
      return nodes;
    }

    function ensure(nodes, index, currentDir) {
      const name = parts[index];
      const nodePath = `${currentDir.replace(/\/+$/, "")}/${name}`;
      const isLeaf = index === parts.length - 1;
      let node = nodes.find((item) => item.name === name && item.path === nodePath);
      if (!node) {
        node = {
          name,
          path: nodePath,
          relPath: parts.slice(0, index + 1).join("/"),
          depth: index,
          type: isLeaf ? result.type : "directory",
          children: []
        };
        nodes.push(node);
        sortNodes(nodes);
      }
      if (!isLeaf) {
        node.type = "directory";
        node.children = node.children || [];
        ensure(node.children, index + 1, node.path);
      }
    }

    ensure(nextTree, 0, root);
    updateActiveCopyOverride({
      directoryTree: nextTree,
      directoryCount: Math.max((activeCopy.directoryCount || countTree(activeCopy.directoryTree || [])) + 1, countTree(nextTree)),
      updatedAt: new Date().toISOString()
    });
  }

  function selectableTreeNodes() {
    return flattenTreeNodes(activeCopy?.directoryTree || []).filter((node) => node.path !== activeCopy?.filePath);
  }

  function handleTreeNodeClick(event, node) {
    if (!node || node.path === activeCopy?.filePath) {
      setSelectedTreePaths([]);
      setLastTreePath(node?.path || "");
      return;
    }
    const selectable = selectableTreeNodes();
    if (event.shiftKey && lastTreePath) {
      const start = selectable.findIndex((item) => item.path === lastTreePath);
      const end = selectable.findIndex((item) => item.path === node.path);
      if (start >= 0 && end >= 0) {
        const [from, to] = start < end ? [start, end] : [end, start];
        setSelectedTreePaths(selectable.slice(from, to + 1).map((item) => item.path));
      } else {
        setSelectedTreePaths([node.path]);
      }
    } else if (event.metaKey || event.ctrlKey) {
      setSelectedTreePaths((current) => (
        current.includes(node.path) ? current.filter((item) => item !== node.path) : [...current, node.path]
      ));
      setLastTreePath(node.path);
    } else {
      setSelectedTreePaths([node.path]);
      setLastTreePath(node.path);
    }
  }

  function renameTreeNodeOptimistic(oldPath, result) {
    if (!activeCopy?.dir || !oldPath || !result?.path) return;
    const nextTree = structuredClone(activeCopy.directoryTree || []);
    const oldPrefix = `${oldPath.replace(/\/+$/, "")}/`;
    const newPrefix = `${result.path.replace(/\/+$/, "")}/`;

    function updateDescendantPaths(node) {
      if (node.path === oldPath) {
        node.path = result.path;
      } else if (node.path?.startsWith(oldPrefix)) {
        node.path = `${newPrefix}${node.path.slice(oldPrefix.length)}`;
      }
      const root = activeCopy.dir.replace(/\/+$/, "");
      node.relPath = node.path?.startsWith(`${root}/`) ? node.path.slice(root.length + 1) : node.relPath;
      (node.children || []).forEach(updateDescendantPaths);
    }

    function renameIn(nodes) {
      for (const node of nodes) {
        if (node.path === oldPath) {
          node.name = result.name;
          node.path = result.path;
          node.type = result.type;
          updateDescendantPaths(node);
          return true;
        }
        if (renameIn(node.children || [])) {
          node.children.sort((a, b) => Number(b.type === "directory") - Number(a.type === "directory") || a.name.localeCompare(b.name));
          return true;
        }
      }
      return false;
    }

    if (renameIn(nextTree)) {
      nextTree.sort((a, b) => Number(b.type === "directory") - Number(a.type === "directory") || a.name.localeCompare(b.name));
      updateActiveCopyOverride({
        directoryTree: nextTree,
        updatedAt: new Date().toISOString()
      });
    }
  }

  function removeTreeNodeOptimistic(targetPath) {
    removeTreeNodesOptimistic([targetPath]);
  }

  function removeTreeNodesOptimistic(paths = []) {
    const targets = new Set(paths.filter(Boolean));
    if (!activeCopy?.dir || !targets.size) return;
    const nextTree = structuredClone(activeCopy.directoryTree || []);

    function removeFrom(nodes) {
      return nodes
        .filter((node) => !targets.has(node.path))
        .map((node) => ({ ...node, children: removeFrom(node.children || []) }));
    }

    const filteredTree = removeFrom(nextTree);
    updateActiveCopyOverride({
      directoryTree: filteredTree,
      directoryCount: Math.max(0, countTree(filteredTree)),
      updatedAt: new Date().toISOString()
    });
    const activeDeleted = [...targets].some((targetPath) => (
      activeFile?.path === targetPath || activeFile?.path?.startsWith(`${targetPath.replace(/\/+$/, "")}/`)
    ));
    if (activeDeleted) {
      openSkillCopyNow(activeCopy, "view", { skipDetailLoad: true });
    }
    setSelectedTreePaths((current) => current.filter((item) => !targets.has(item)));
  }

  function historicalVersions(copy) {
    const info = copy?.versionInfo || {};
    const versions = (info.versions || []).filter((version) => (
      version.sourceId === copy?.sourceId
      || (version.sourceIds || []).includes(copy?.sourceId)
      || version.id === info.activeArchiveId
      || (version.duplicateIds || []).includes(info.activeArchiveId)
    ));
    return versions;
  }

  function isActiveHistoryVersion(entry, copy = activeCopy) {
    const info = copy?.versionInfo || {};
    const currentLabel = info.currentLabel || (skillVersion(copy) ? `v${skillVersion(copy)}` : info.activeLabel || "");
    return entry?.id === info.activeArchiveId
      || (entry?.duplicateIds || []).includes(info.activeArchiveId)
      || (entry?.hash === info.currentHash && (!currentLabel || entry?.label === currentLabel));
  }

  async function selectVersionForCopy(entry, copy = activeCopy) {
    if (!copy) return;
    setSelectedVersion(entry);
    setFileError("");
    try {
      setVersionDetail(await window.skillStudio.skillVersionDiff({
        skillDir: copy.dir,
        archiveId: entry.id
      }));
    } catch (err) {
      setFileError(err.message || String(err));
    }
  }

  async function selectVersion(entry) {
    return selectVersionForCopy(entry, activeCopy);
  }

  function hasUnsavedChanges() {
    return mode === "edit" && activeFile && draft !== activeFile.content;
  }

  async function runPendingNavigation(pending = pendingNavigation) {
    if (!pending) return;
    setPendingNavigation(null);
    if (pending.type === "copy") {
      await openSkillCopyNow(pending.copy, pending.nextMode);
    } else if (pending.type === "file") {
      await openTreeFileNow(pending.item);
    } else if (pending.type === "mode") {
      setDraft(activeFile?.content || "");
      setMode(pending.nextMode);
    }
  }

  function exitEditMode() {
    if (hasUnsavedChanges()) {
      setPendingNavigation({ type: "mode", nextMode: "view" });
      return;
    }
    setMode("view");
    setPendingNavigation(null);
  }

  async function openSkillCopy(copy, nextMode = mode) {
    if (hasUnsavedChanges()) {
      setPendingNavigation({ type: "copy", copy, nextMode });
      return;
    }
    await openSkillCopyNow(copy, nextMode);
  }

  async function openSkillCopyNow(copy, nextMode = "view", options = {}) {
    if (!copy) return;
    setFileError("");
    let content = copy.raw || "";
    let size = copy.bytes;
    let updatedAt = copy.updatedAt;
    try {
      if (!content) {
        const result = await window.skillStudio.readFile(copy.filePath);
        content = result.content;
        size = result.size;
        updatedAt = result.updatedAt;
      }
    } catch (err) {
      setFileError(err.message || String(err));
      return;
    }
    const file = {
      path: copy.filePath,
      name: "SKILL.md",
      content,
      isMarkdown: true,
      isSkillFile: true,
      size,
      updatedAt
    };
    setActiveCopyId(copy.id);
    setActiveFile(file);
    setSelectedDirPath(copy.dir);
    setCreateEntryDraft(null);
    setTreeMenu(null);
    setDraft(file.content);
    setMode(nextMode);
    setPendingNavigation(null);
    setFileError("");
    setSelectedVersion(null);
    setVersionDetail(null);
    if (historyOpen && !hideHistory) {
      const entries = historicalVersions(nextCopy);
      setHistory(entries);
      if (entries.length) await selectVersionForCopy(entries[0], nextCopy);
    } else {
      loadHistory(file.path);
    }
    if (!options.skipDetailLoad) loadFullSkillDetail(copy);
  }

  useEffect(() => {
    if (!skill) return;
    const copies = skill.installations || [skill];
    const current = copies.find((copy) => copy.id === activeCopyId);
    if (current) {
      setActiveCopyId(current.id);
      return;
    }
    const preferred = copies[0] || skill;
    if (activeFile?.path?.startsWith(`${preferred.dir}/`)) {
      setActiveCopyId(preferred.id);
      openTreeFileNow({
        path: activeFile.path,
        name: activeFile.name || activeFile.path.split("/").pop(),
        type: "file"
      });
    } else {
      openSkillCopy(preferred);
    }
  }, [skill]);

  useEffect(() => {
    if (!skill) return;
    const copies = skill.installations || [skill];
    copies.forEach((copy) => {
      if (!copyOverrides[copy.id]?.versionInfo && !copy.versionInfo) {
        loadFullSkillDetail(copy);
      }
    });
  }, [skill]);

  useEffect(() => {
    if (!treeMenu) return undefined;
    const close = () => setTreeMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", close);
    };
  }, [treeMenu]);

  async function openTreeFile(item) {
    if (hasUnsavedChanges()) {
      setPendingNavigation({ type: "file", item });
      return;
    }
    await openTreeFileNow(item);
  }

  async function openTreeFileNow(item) {
    setFileError("");
    try {
      const result = await window.skillStudio.readFile(item.path);
      const file = {
        path: item.path,
        name: item.name,
        content: result.content,
        isMarkdown: isMarkdownPath(item.path),
        isSkillFile: item.path === activeCopy.filePath,
        size: result.size,
        updatedAt: result.updatedAt
      };
      setActiveFile(file);
      setSelectedDirPath(parentPath(item.path));
      setCreateEntryDraft(null);
      setTreeMenu(null);
      setDraft(file.content);
      setPendingNavigation(null);
      setHistoryOpen(false);
      setSelectedVersion(null);
      setVersionDetail(null);
      loadHistory(file.path);
    } catch (err) {
      setFileError(err.message || String(err));
    }
  }

  function beginCreateEntry(type, baseDir = selectedDirPath || (activeFile?.path ? parentPath(activeFile.path) : activeCopy?.dir)) {
    if (!activeCopy?.dir) return;
    setTreeMenu(null);
    setCreateEntryDraft({
      mode: "create",
      type,
      baseDir: baseDir || activeCopy.dir,
      name: ""
    });
  }

  function beginRenameEntry(node) {
    if (!node?.path || node.path === activeCopy?.dir) return;
    setTreeMenu(null);
    setCreateEntryDraft({
      mode: "rename",
      type: node.type,
      path: node.path,
      baseDir: parentPath(node.path),
      name: node.name
    });
  }

  async function submitTreeDraft() {
    if (!createEntryDraft) return;
    if (createEntryDraft.mode === "rename") {
      await renameDirectoryEntry(createEntryDraft.path, createEntryDraft.name, createEntryDraft.type);
      return;
    }
    await createDirectoryEntry(createEntryDraft.type, createEntryDraft.baseDir, createEntryDraft.name);
  }

  async function createDirectoryEntry(type, baseDir, name) {
    if (!activeCopy?.dir) return;
    const label = type === "directory" ? t("directoryLabel") : t("fileLabel");
    const targetBaseDir = baseDir || selectedDirPath || (activeFile?.path ? parentPath(activeFile.path) : activeCopy.dir);
    const entryName = String(name || "").trim();
    if (!entryName) {
      setFileError(t("addEntryNameRequired").replace("{name}", label));
      return;
    }
    setSaving(true);
    setFileError("");
    try {
      const result = await window.skillStudio.createFileEntry({
        baseDir: targetBaseDir,
        type,
        name: entryName,
        skillDir: activeCopy.dir,
        sourceInfo: {
          sourceId: activeCopy.sourceId,
          client: activeCopy.client,
          sourceLabel: activeCopy.sourceLabel
        }
      });
      setCreateEntryDraft(null);
      markCopyDirty(activeCopy);
      insertTreeNodeOptimistic(result, targetBaseDir);
      if (result.type === "file") {
        const file = {
          path: result.path,
          name: result.name,
          content: "",
          isMarkdown: isMarkdownPath(result.path),
          isSkillFile: result.path === activeCopy.filePath,
          size: 0,
          updatedAt: new Date().toISOString()
        };
        setActiveFile(file);
        setSelectedDirPath(parentPath(result.path));
        setDraft("");
        setPendingNavigation(null);
        setHistoryOpen(false);
        setSelectedVersion(null);
        setVersionDetail(null);
        setSelectedTreePaths([result.path]);
        setLastTreePath(result.path);
        setMode("edit");
      } else {
        setSelectedDirPath(result.path);
        setSelectedTreePaths([result.path]);
        setLastTreePath(result.path);
      }
      setSaving(false);
      refreshCopyInBackground(activeCopy);
    } catch (err) {
      setFileError(err.message || String(err));
      const refreshed = await onSaved?.();
      applyRefreshedCopy(refreshed);
    } finally {
      setSaving(false);
    }
  }

  async function renameDirectoryEntry(filePath, name, type) {
    if (!activeCopy?.dir) return;
    const entryName = String(name || "").trim();
    if (!entryName) {
      setFileError(t("renameRequired"));
      return;
    }
    setSaving(true);
    setFileError("");
    try {
      const wasActive = activeFile?.path === filePath;
      const activeWasInsideDirectory = type === "directory" && activeFile?.path?.startsWith(`${filePath}/`);
      const result = await window.skillStudio.renameFileEntry({
        path: filePath,
        name: entryName,
        skillDir: activeCopy.dir,
        sourceInfo: {
          sourceId: activeCopy.sourceId,
          client: activeCopy.client,
          sourceLabel: activeCopy.sourceLabel
        }
      });
      setCreateEntryDraft(null);
      markCopyDirty(activeCopy);
      renameTreeNodeOptimistic(filePath, result);
      const refreshed = await onSaved?.();
      applyRefreshedCopy(refreshed);
      if (result.type === "file" && wasActive) {
        await openTreeFileNow({ path: result.path, name: result.name, type: "file" });
      } else if (activeWasInsideDirectory) {
        const nextPath = `${result.path}${activeFile.path.slice(filePath.length)}`;
        await openTreeFileNow({ path: nextPath, name: activeFile.name, type: "file" });
      } else if (type === "directory") {
        setSelectedDirPath(result.path);
      }
    } catch (err) {
      setFileError(err.message || String(err));
      const refreshed = await onSaved?.();
      applyRefreshedCopy(refreshed);
    } finally {
      setSaving(false);
    }
  }

  async function deleteDirectoryEntry(node) {
    if (!activeCopy?.dir || !node?.path || node.path === activeCopy.dir) return;
    const nodesByPath = new Map(flattenTreeNodes(activeCopy.directoryTree || []).map((item) => [item.path, item]));
    const selectedSet = new Set(selectedTreePaths);
    const rawTargets = (selectedSet.has(node.path) ? selectedTreePaths : [node.path])
      .map((itemPath) => nodesByPath.get(itemPath) || (itemPath === node.path ? node : null))
      .filter((item) => item && item.path !== activeCopy.dir && item.path !== activeCopy.filePath);
    const targets = rawTargets.filter((item) => (
      !rawTargets.some((other) => other.path !== item.path && item.path.startsWith(`${other.path.replace(/\/+$/, "")}/`))
    ));
    if (!targets.length) return;
    const preview = targets.slice(0, 8).map((item) => `- ${shortPath(item.path)}`).join("\n");
    const confirmed = window.confirm(`${t("deleteItemsConfirm").replace("{count}", targets.length)}\n${preview}${targets.length > 8 ? "\n..." : ""}\n\n${t("deleteItemsConfirmNote")}`);
    if (!confirmed) return;
    setTreeMenu(null);
    setSaving(true);
    setFileError("");
    const targetPaths = targets.map((target) => target.path);
    markCopyDirty(activeCopy);
    targetPaths.forEach((targetPath) => pendingDeletedPathsRef.current.add(targetPath));
    removeTreeNodesOptimistic(targetPaths);
    try {
      await Promise.all(targets.map((target) => (
        window.skillStudio.deleteFileEntry({
          path: target.path,
          skillDir: activeCopy.dir
        })
      )));
      const refreshed = await onSaved?.();
      applyRefreshedCopy(refreshed);
      const freshDetail = await window.skillStudio.skillDetail?.({
        skillDir: activeCopy.dir,
        source: {
          id: activeCopy.sourceId,
          client: activeCopy.client,
          label: activeCopy.sourceLabel,
          root: activeCopy.root
        }
      });
      if (freshDetail?.id) {
        setCopyOverrides((current) => ({
          ...current,
          [activeCopy.id]: {
            ...(current[activeCopy.id] || activeCopy),
            ...freshDetail,
            id: activeCopy.id
          }
        }));
      }
      targetPaths.forEach((targetPath) => pendingDeletedPathsRef.current.delete(targetPath));
    } catch (err) {
      targetPaths.forEach((targetPath) => pendingDeletedPathsRef.current.delete(targetPath));
      setFileError(err.message || String(err));
      const refreshed = await onSaved?.();
      applyRefreshedCopy(refreshed);
    } finally {
      setSaving(false);
    }
  }

  function openTreeContextMenu(event, node) {
    event.preventDefault();
    event.stopPropagation();
    setTreeMenu({
      x: event.clientX,
      y: event.clientY,
      node
    });
  }

  async function copyTreePath(node, absolute = false) {
    if (!node) return;
    const value = absolute ? node.path : (node.relPath || copyRelativePath(activeCopy, node.path));
    try {
      await window.skillStudio.copyText?.(value);
      setFileNotice(t("copiedPath").replace("{type}", absolute ? t("absolutePath") : t("relativePath")).replace("{path}", value));
      window.setTimeout(() => setFileNotice(""), 1400);
      setTreeMenu(null);
    } catch (err) {
      setFileError(t("copyFailed").replace("{message}", err.message || String(err)));
    }
  }

  async function saveDraft() {
    if (!activeFile) return false;
    setSaving(true);
    setFileError("");
    try {
      const result = await window.skillStudio.saveFile(activeFile.path, draft, {
        skillDir: activeCopy.dir,
        sourceInfo: {
          sourceId: activeCopy.sourceId,
          client: activeCopy.client,
          sourceLabel: activeCopy.sourceLabel
        }
      });
      const savedContent = result.content ?? draft;
      setActiveFile({ ...activeFile, content: savedContent, size: result.size, updatedAt: result.updatedAt });
      setDraft(savedContent);
      if (savedContent !== activeFile.content) {
        markCopyDirty(activeCopy);
      }
      await loadHistory(activeFile.path);
      setSelectedVersion(null);
      setVersionDetail(null);
      onSaved?.();
      return true;
    } catch (err) {
      setFileError(err.message || String(err));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function restoreVersion(versionId) {
    if (!activeCopy) return;
    setVersionSwitching(true);
    setFileError("");
    try {
      const result = await window.skillStudio.activateSkillVersion({
        skillDir: activeCopy.dir,
        archiveId: versionId,
        sourceInfo: {
          sourceId: activeCopy.sourceId,
          client: activeCopy.client,
          sourceLabel: activeCopy.sourceLabel
        }
      });
      const nextCopy = applyCopySnapshot(result.skill, activeCopy) || activeCopy;
      refreshCopyInBackground(nextCopy);
    } catch (err) {
      setFileError(err.message || String(err));
    } finally {
      setVersionSwitching(false);
    }
  }

  async function activateSkillPackageVersion(version, copy = activeCopy) {
    if (!copy || !version) return;
    const confirmed = window.confirm(t("chooseVersionConfirm")
      .replace("{client}", copy.client)
      .replace("{skill}", skill.name)
      .replace("{version}", version.label || version.id));
    if (!confirmed) return;
    setVersionSwitching(true);
    setFileError("");
    try {
      const result = await window.skillStudio.activateSkillVersion({
        skillDir: copy.dir,
        archiveId: version.id,
        sourceInfo: {
          sourceId: copy.sourceId,
          client: copy.client,
          sourceLabel: copy.sourceLabel
        }
      });
      const nextCopy = copy.id === activeCopy?.id
        ? applyCopySnapshot(result.skill, copy) || copy
        : applyRefreshedCopy({ skills: [result.skill] }, copy) || copy;
      if (historyOpen && copy.id === activeCopy?.id) {
        const entries = historicalVersions(nextCopy);
        setHistory(entries);
        const activeEntry = entries.find((entry) => isActiveHistoryVersion(entry, nextCopy)) || entries[0] || null;
        setSelectedVersion(activeEntry);
        if (activeEntry) await selectVersionForCopy(activeEntry, nextCopy);
        else setVersionDetail(null);
      }
      refreshCopyInBackground(nextCopy);
    } catch (err) {
      setFileError(err.message || String(err));
    } finally {
      setVersionSwitching(false);
    }
  }

  async function deleteSkillPackageVersions(versionIds, afterDelete, copy = activeCopy, skipConfirm = false) {
    if (!copy || !versionIds?.length) return;
    const confirmed = skipConfirm || window.confirm(t("deleteHistoryConfirm")
      .replace("{client}", copy.client)
      .replace("{count}", versionIds.length));
    if (!confirmed) return;
    setVersionSwitching(true);
    setFileError("");
    try {
      const result = await window.skillStudio.deleteSkillVersions({
        skillDir: copy.dir,
        archiveIds: versionIds
      });
      setCopyOverrides((current) => ({
        ...current,
        [copy.id]: {
          ...(current[copy.id] || copy),
          versionInfo: {
            ...(copy.versionInfo || {}),
            versions: result.versions || []
          }
        }
      }));
      afterDelete?.();
      if (historyOpen && copy.id === activeCopy?.id) {
        const nextHistory = historicalVersions({ ...copy, versionInfo: { ...(copy.versionInfo || {}), versions: result.versions || [] } });
        setHistory(nextHistory);
        setSelectedHistoryVersionIds([]);
        if (nextHistory.length) await selectVersionForCopy(nextHistory[0], copy);
        else {
          setSelectedVersion(null);
          setVersionDetail(null);
        }
      }
      refreshCopyInBackground(copy);
      if (result.skipped?.length) {
        const activeCount = result.skipped.filter((item) => item.reason === "active").length;
        const missingCount = result.skipped.filter((item) => item.reason === "missing").length;
        const parts = [];
        if (activeCount) parts.push(`${activeCount} ${t("activeVersions")}`);
        if (missingCount) parts.push(`${missingCount} ${t("missingVersions")}`);
        setFileError(t("deletedVersionsSummary").replace("{deleted}", result.deleted?.length || 0).replace("{skipped}", parts.join(", ")));
      }
    } catch (err) {
      setFileError(err.message || String(err));
    } finally {
      setVersionSwitching(false);
    }
  }

  async function deleteSelectedHistoryVersions(ids = selectedHistoryVersionIds) {
    const targetIds = ids.filter((id) => history.some((entry) => entry.id === id));
    if (!targetIds.length) return;
    const confirmed = window.confirm(t("deleteHistoryGlobalConfirm").replace("{count}", targetIds.length));
    if (!confirmed) return;
    await deleteSkillPackageVersions(targetIds, null, activeCopy, true);
  }

  function buildDefaultUpgradeMessage(copies = [], details = {}) {
    const targetCopies = copies.length ? copies : [upgradeCopy || activeCopy].filter(Boolean);
    const names = targetCopies.map((copy) => copy?.client).filter(Boolean).join(", ");
    const version = targetCopies.length === 1
      ? (details[targetCopies[0]?.id]?.toVersion || upgradeDetail?.toVersion || "")
      : targetCopies.map((copy) => details[copy.id]?.toVersion).filter(Boolean).join(", ");
    const fileCount = targetCopies.reduce((total, copy) => total + (details[copy.id]?.files?.length || 0), 0) || upgradeDetail?.files?.length || 0;
    return t("autoPublishMessage")
      .replace("{name}", names || skill.name)
      .replace("{version}", version ? `v${version}` : "")
      .replace("{count}", fileCount);
  }

  function closeUpgradePanel() {
    setUpgradeOpen(false);
    setUpgradeDetail(null);
    setUpgradeDetails({});
    setUpgradeCopy(null);
    setUpgradeCopies([]);
    setUpgradeMessage("");
  }

  async function prepareUpgradePreview(copy = activeCopy, copies = [copy]) {
    if (!copy) return;
    if (hasUnsavedChanges()) {
      setFileError(t("saveBeforePublish"));
      return;
    }
    setUpgradeBusy(true);
    setFileError("");
    try {
      const targetCopies = copies.filter(Boolean);
      const previews = await Promise.all(targetCopies.map(async (targetCopy) => {
        const detail = await window.skillStudio.previewSkillUpgrade({
          skillDir: targetCopy.dir,
          activeArchiveId: targetCopy.versionInfo?.activeArchiveId,
          forceContentChanges: Boolean(dirtyCopyIds[targetCopy.id]),
          sourceInfo: {
            sourceId: targetCopy.sourceId,
            client: targetCopy.client,
            sourceLabel: targetCopy.sourceLabel
          }
        });
        return { copy: targetCopy, detail };
      }));
      const changedPreviews = previews.filter(({ detail }) => detail.hasContentChanges);
      if (!changedPreviews.length) {
        setFileError(t("noContentChangeForClient").replace("{client}", copy.client));
        return;
      }
      const detailMap = Object.fromEntries(changedPreviews.map(({ copy: targetCopy, detail }) => [targetCopy.id, detail]));
      const previewCopy = changedPreviews.find(({ copy: targetCopy }) => targetCopy.id === copy.id)?.copy || changedPreviews[0].copy;
      setUpgradeDetails(detailMap);
      setUpgradeDetail(detailMap[previewCopy.id] || changedPreviews[0].detail);
      setUpgradeCopy(previewCopy);
      setUpgradeCopies(changedPreviews.map(({ copy: targetCopy }) => targetCopy));
      setUpgradeMessage(buildDefaultUpgradeMessage(changedPreviews.map(({ copy: targetCopy }) => targetCopy), detailMap));
      setUpgradeOpen(true);
    } catch (err) {
      setFileError(err.message || String(err));
    } finally {
      setUpgradeBusy(false);
    }
  }

  async function openUpgradePreview() {
    if (!activeCopy) return;
    if (installations.length > 1 && agentScope === "all") {
      setUpgradeBusy(true);
      setFileError("");
      let targets = [];
      try {
        const statuses = await Promise.all(installations.map(async (copy) => {
          try {
            const detail = await window.skillStudio.previewSkillUpgrade({
              skillDir: copy.dir,
              activeArchiveId: copy.versionInfo?.activeArchiveId,
              forceContentChanges: Boolean(dirtyCopyIds[copy.id]),
              sourceInfo: {
                sourceId: copy.sourceId,
                client: copy.client,
                sourceLabel: copy.sourceLabel
              }
            });
            return { copy, hasContentChanges: Boolean(detail.hasContentChanges) };
          } catch {
            return { copy, hasContentChanges: false };
          }
        }));
        targets = statuses.map(({ copy, hasContentChanges }) => ({
          id: copy.id,
          client: copy.client,
          root: copy.dir,
          dir: copy.dir,
          skill: copy,
          installed: true,
          version: skillVersion(copy),
          versionLabel: skillVersionLabel(copy),
          disabled: !hasContentChanges,
          disabledReason: hasContentChanges ? "" : t("noContentChange")
        }));
      } finally {
        setUpgradeBusy(false);
      }
      const remembered = readStoredJson(versionTargetsStorageKey, null, []);
      const enabledTargetIds = targets.filter((target) => !target.disabled).map((target) => target.id);
      if (!enabledTargetIds.length) {
        setFileError(t("noAgentChanges"));
        return;
      }
      const validRemembered = remembered.filter((id) => enabledTargetIds.includes(id));
      setUpgradeTargetCopyIds(validRemembered.length ? validRemembered : (enabledTargetIds.includes(activeCopy.id) ? [activeCopy.id] : [enabledTargetIds[0]]));
      setUpgradeTargetPending({
        type: "upgrade",
        item: skill,
        targets
      });
      return;
    }
    await prepareUpgradePreview(activeCopy, [activeCopy]);
  }

  async function confirmSkillUpgrade() {
    const targetCopies = upgradeCopies.length ? upgradeCopies : [upgradeCopy || activeCopy].filter(Boolean);
    if (!targetCopies.length || !upgradeDetail) return;
    setUpgradeBusy(true);
    setFileError("");
    try {
      const results = [];
      for (const targetCopy of targetCopies) {
        const previewVersion = upgradeDetails[targetCopy.id]?.toVersion || upgradeDetail?.toVersion || "";
        results.push(await window.skillStudio.commitSkillUpgrade({
          skillDir: targetCopy.dir,
          nextVersion: previewVersion,
          message: upgradeMessage.trim() || buildDefaultUpgradeMessage(targetCopies, upgradeDetails),
          sourceInfo: {
            sourceId: targetCopy.sourceId,
            client: targetCopy.client,
            sourceLabel: targetCopy.sourceLabel
          }
        }));
      }
      localStorage.setItem(versionTargetsStorageKey, JSON.stringify(targetCopies.map((copy) => copy.id)));
      const result = results.find((item, index) => targetCopies[index]?.id === activeCopy?.id) || results[0];
      clearCopiesDirty(targetCopies);
      closeUpgradePanel();
      results.forEach((item, index) => {
        const targetCopy = targetCopies[index];
        if (item?.skill && targetCopy) {
          applyCopyPatch(targetCopy, item.skill);
        }
      });
      if (activeFile?.path === result.path) {
        const nextFile = {
          ...activeFile,
          content: result.content,
          size: result.size,
          updatedAt: result.updatedAt
        };
        setActiveFile(nextFile);
        setDraft(result.content);
      }
      Promise.resolve(onSaved?.())
        .then((refreshed) => {
          targetCopies.forEach((targetCopy) => applyRefreshedCopy(refreshed, targetCopy));
        })
        .catch(() => {});
    } catch (err) {
      setFileError(err.message || String(err));
    } finally {
      setUpgradeBusy(false);
    }
  }

  if (!skill) {
    return (
      <section className="detail empty">
        <Command size={34} />
        <p>{t("selectSkillHint")}</p>
      </section>
    );
  }
  const installations = (skill.installations || [skill]).map((copy) => copyOverrides[copy.id] ? { ...copy, ...copyOverrides[copy.id] } : copy);
  const activeCopy = installations.find((copy) => copy.id === activeCopyId) || installations[0] || skill;
  const allAgentsScope = agentScope === "all" && installations.length > 1;
  const installationAgents = [...new Set(installations.map((copy) => copy.client))];
  const isUninstalledSkill = skill.sourceId === "uninstalled";
  const uninstallSource = skill.uninstallMeta?.sourceClient || skill.uninstallMeta?.sourceLabel || t("unknown");
  const copyClientLabel = (copy) => isUninstalledSkill
    ? (copy.uninstallMeta?.sourceClient || copy.uninstallMeta?.sourceLabel || copy.client)
    : copy.client;

  function applyCopyPatch(copy, patch) {
    if (!copy?.id || !patch?.id) return null;
    const nextCopy = {
      ...copy,
      ...patch,
      id: copy.id,
      sourceId: copy.sourceId,
      client: copy.client,
      sourceLabel: copy.sourceLabel,
      root: copy.root,
      dir: copy.dir
    };
    setCopyOverrides((current) => ({
      ...current,
      [copy.id]: {
        ...(current[copy.id] || copy),
        ...nextCopy
      }
    }));
    return nextCopy;
  }

  function beginSyncCopy(sourceCopy) {
    const installedBySource = new Map(installations.map((copy) => [copy.sourceId, copy]));
    const availableTargets = installTargets.length
      ? installTargets
      : installations.map((copy) => ({
        id: copy.sourceId || copy.id,
        client: copy.client,
        label: copy.sourceLabel,
        root: copy.root || copy.dir
      }));
    const targets = availableTargets
      .filter((target) => target.id !== sourceCopy.sourceId && target.client !== sourceCopy.client)
      .map((target) => {
        const installedCopy = installedBySource.get(target.id)
          || installations.find((copy) => copy.client === target.client);
        return {
          id: target.id,
          client: target.client,
          root: target.root || installedCopy?.root || installedCopy?.dir,
          dir: installedCopy?.dir,
          sourceId: target.id,
          sourceLabel: target.label || installedCopy?.sourceLabel,
          skill: installedCopy || null,
          installed: Boolean(installedCopy),
          version: installedCopy ? skillVersion(installedCopy) : "",
          versionLabel: installedCopy ? skillVersionLabel(installedCopy) : ""
        };
      });
    if (!targets.length) {
      setFileError(t("noSyncTargets"));
      return;
    }
    const notInstalledTargetIds = targets.filter((target) => !target.installed).map((target) => target.id);
    setSyncTargetIds(notInstalledTargetIds.length ? notInstalledTargetIds : targets.map((target) => target.id));
    setSyncPending({ type: "sync", item: sourceCopy, sourceCopy, targets });
  }

  async function confirmSyncCopy() {
    if (!syncPending?.sourceCopy) return;
    const targets = (syncPending.targets || []).filter((target) => syncTargetIds.includes(target.id));
    if (!targets.length) return;
    setSaving(true);
    setFileError("");
    try {
      await window.skillStudio.submitEvent({
        type: "sync-skill",
        title: syncPending.sourceCopy.name || skill.name,
        sourceDir: syncPending.sourceCopy.dir,
        skillName: syncPending.sourceCopy.name || skill.name,
        targets: targets.map((target) => ({
          dir: target.dir,
          sourceId: target.skill?.sourceId || target.sourceId || target.id,
          client: target.client,
          sourceLabel: target.skill?.sourceLabel || target.sourceLabel,
          root: target.skill?.root || target.root
        }))
      });
      setSyncPending(null);
      setSyncTargetIds([]);
      setFileNotice(t("submittedSync").replace("{count}", targets.length));
      window.setTimeout(() => setFileNotice(""), 1600);
    } catch (err) {
      setFileError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="detail">
      <div className="detail-header">
        <div className="detail-icon">{skill.name.slice(0, 1).toUpperCase()}</div>
        <div>
          <h2>{skill.name}</h2>
          <p>{skill.description || t("noDescription")}</p>
        </div>
        {!hideHistory ? <button className="history-top-button" onClick={openHistoryPanel}>
          <History size={16} />
          {t("history")}
        </button> : null}
      </div>
      <div className="detail-actions">
        {onInstall && !hideTopInstall ? <button className="action-install" onClick={() => onInstall?.(skill)}>
          <FileCode2 size={16} />
          {topInstallLabel}
        </button> : null}
        {onUninstall ? (
        <button className="action-uninstall" onClick={() => onUninstall(skill, installations)}>
          <RotateCcw size={16} />
          {t("uninstall")}
        </button>
        ) : null}
        {!hideVersionActions ? <button className={`action-baseline action-upgrade ${upgradeBusy || upgradeOpen ? "is-busy" : ""}`} onClick={openUpgradePreview} disabled={upgradeBusy || upgradeOpen}>
          <History size={16} />
          {upgradeBusy ? t("publishing") : upgradeOpen ? t("confirmPublish") : t("publishVersion")}
        </button> : null}
        {onDeleteRecords ? (
          <button className="action-uninstall" onClick={() => onDeleteRecords(skill)}>
            <Trash2 size={16} />
            {t("clearRecordsConfirm")}
          </button>
        ) : null}
        <StarButton active={starred} className="detail-star" label onClick={(event) => { event.stopPropagation(); onStar?.(skill); }} />
      </div>
      <MetaStrip
        items={[
          { label: isUninstalledSkill ? t("uninstallSource") : t("installedLabel"), value: isUninstalledSkill ? [...new Set(installations.map(copyClientLabel))].join(", ") : installationAgents.join(", ") },
          ...(allAgentsScope ? [{ label: t("currentCopy"), value: copyClientLabel(activeCopy) }] : []),
          { label: t("lines"), value: activeCopy.lines },
          { label: t("size"), value: `${Math.round((activeCopy.bytes || 0) / 1024)} KB` },
          { label: t("updatedAt"), value: formatDate(activeCopy.updatedAt) }
        ]}
      />
      <div className={`installations-panel ${installations.length === 1 ? "single" : ""}`}>
        {(installations.length > 1 ? installations : [activeCopy]).map((copy) => {
          const readonlyVersionLabel = readOnly ? skillVersionLabel(copy) : "";
          const readonlyVersionFullLabel = readonlyVersionLabel ? displayVersionLabel(readonlyVersionLabel) : "";
          return (
            <div
              key={copy.id}
              className={`installation-card ${copy.id === activeCopy.id ? "active" : ""}`}
              onClick={() => openSkillCopy(copy)}
            >
              <div className="copy-card-main">
                <strong>{copyClientLabel(copy)}</strong>
                {!hideVersionActions ? <div className="copy-version-picker" onClick={(event) => event.stopPropagation()}>
                  <SkillVersionPicker
                    copy={copy}
                    onActivate={(version) => activateSkillPackageVersion(version, copy)}
                    onDelete={(versionIds, afterDelete) => deleteSkillPackageVersions(versionIds, afterDelete, copy)}
                    busy={versionSwitching}
                    showAllVersions={false}
                  />
                </div> : null}
                {readonlyVersionLabel ? (
                  <span className="copy-version-readonly" aria-label={`${t("version")} ${readonlyVersionFullLabel}`} onClick={(event) => event.stopPropagation()}>
                    <em className="copy-version">{compactVersionLabel(readonlyVersionLabel)}</em>
                    <span className="copy-version-popover" role="tooltip">
                      <strong>{readonlyVersionFullLabel}</strong>
                    </span>
                  </span>
                ) : null}
                {!readOnly ? (
                  <button onClick={(event) => { event.stopPropagation(); beginSyncCopy(copy); }}>
                    {t("sync")}
                  </button>
                ) : null}
                {!readOnly ? <button onClick={(event) => { event.stopPropagation(); copy.id === activeCopy.id && mode === "edit" ? exitEditMode() : openSkillCopy(copy, "edit"); }}>
                  {copy.id === activeCopy.id && mode === "edit" ? t("cancelEdit") : t("edit")}
                </button> : null}
                {cardActionLabel && onCardAction ? (
                  <button onClick={(event) => { event.stopPropagation(); onCardAction(copy); }}>
                    {cardActionLabel}
                  </button>
                ) : null}
              </div>
              {readOnly && !isUninstalledSkill ? (
                <div className="copy-path-row">{shortPath(copy.dir)}</div>
              ) : (
                <button className="copy-path-row" onClick={(event) => { event.stopPropagation(); window.skillStudio.reveal(copy.dir); }} title={t("revealDirectoryTitle")}>
                  {shortPath(copy.dir)}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {versionSwitching ? <div className="version-switching-note">{t("switchingVersion")}</div> : null}
      {pendingNavigation ? (
        <div className="pending-edit-panel">
          <span>{pendingNavigation.type === "mode" ? t("unsavedBeforeExitEdit") : t("unsavedBeforeSwitch")}</span>
          <button
            onClick={async () => {
              const saved = await saveDraft();
              if (saved) await runPendingNavigation();
            }}
            disabled={saving}
          >
            {t("saveAndSwitch")}
          </button>
          <button className="soft-button" onClick={() => runPendingNavigation()} disabled={saving}>
            {t("discardAndSwitch")}
          </button>
          <button className="soft-button" onClick={() => setPendingNavigation(null)} disabled={saving}>
            {t("continueEditing")}
          </button>
        </div>
      ) : null}
      <InstallTargetDialog
        pending={syncPending}
        targets={syncPending?.targets || []}
        selectedTargets={syncTargetIds}
        onChangeTargets={setSyncTargetIds}
        onCancel={() => setSyncPending(null)}
        onConfirm={confirmSyncCopy}
        busy={saving}
      />
      <div className="detail-tags">
        {(skill.tags || []).length ? skill.tags.map((tag) => <TagPill key={tag} tag={tag} />) : <TagPill tag="untagged" />}
      </div>
      {fileNotice ? <div className="file-notice">{fileNotice}</div> : null}
      {fileError ? <div className="file-error">{fileError}</div> : null}
      <div className="reader-shell">
        <DirectoryTree
          skill={activeCopy}
          activePath={activeFile?.path}
          selectedDirPath={selectedDirPath}
          selectedPaths={selectedTreePaths}
          onNodeClick={handleTreeNodeClick}
          onOpenFile={openTreeFile}
          onSelectDirectory={(dirPath) => {
            setSelectedDirPath(dirPath);
            setCreateEntryDraft((current) => current ? { ...current, baseDir: dirPath } : current);
          }}
          onContextMenu={readOnly ? undefined : openTreeContextMenu}
          draft={createEntryDraft}
          onDraftChange={(name) => setCreateEntryDraft((current) => current ? { ...current, name } : current)}
          onDraftSubmit={submitTreeDraft}
          onDraftCancel={() => setCreateEntryDraft(null)}
        />
        <section className="content-pane">
          <div className="reader-label">
            <FileText size={15} />
            <span className="reader-file-title">
              <strong>{activeFile?.name || "SKILL.md"}</strong>
              <small>{shortPath(activeFile?.path)}</small>
            </span>
            {!readOnly ? <button title={t("addFileTitle")} onClick={() => beginCreateEntry("file")}>{t("addFile")}</button> : null}
            {!readOnly ? <button title={t("addDirectoryTitle")} onClick={() => beginCreateEntry("directory")}>{t("addDirectory")}</button> : null}
            {mode === "edit" ? (
              <div className="reader-edit-actions" title={`${t("editing")} ${activeCopy.client} · ${shortPath(activeFile?.path)}`}>
                <button className="reader-save-button" onClick={saveDraft} disabled={saving || draft === activeFile?.content}>
                  <Save size={13} />
                  {saving ? t("savingChanges") : t("saveChanges")}
                </button>
                <button className="reader-discard-button" onClick={() => { setDraft(activeFile?.content || ""); setPendingNavigation(null); }} disabled={draft === activeFile?.content}>
                  <RotateCcw size={13} />
                  {t("discardChanges")}
                </button>
              </div>
            ) : null}
            {!readOnly ? <button className={`reader-mode-toggle ${mode === "edit" ? "active" : ""}`} onClick={() => mode === "edit" ? exitEditMode() : setMode("edit")}>
              {mode === "edit" ? t("editMode") : t("readMode")}
            </button> : null}
          </div>
          {mode === "edit" ? (
            <HighlightedEditor
              value={draft}
              language={codeLanguageFromPath(activeFile?.path || activeFile?.name)}
              onChange={(event) => setDraft(event.target.value)}
            />
          ) : activeFile ? (
            <SkillReader file={activeFile} />
          ) : null}
        </section>
      </div>
      {treeMenu ? (
        <div className="tree-context-menu" style={{ left: treeMenu.x, top: treeMenu.y }} onClick={(event) => event.stopPropagation()}>
          <button onClick={() => copyTreePath(treeMenu.node, false)}>{t("copyRelativePath")}</button>
          <button onClick={() => copyTreePath(treeMenu.node, true)}>{t("copyAbsolutePath")}</button>
          {treeMenu.node.type === "directory" ? (
            <>
              <hr />
              <button onClick={() => beginCreateEntry("file", treeMenu.node.path)}>{t("createFileHere")}</button>
              <button onClick={() => beginCreateEntry("directory", treeMenu.node.path)}>{t("createDirectoryHere")}</button>
            </>
          ) : null}
          {treeMenu.node.path !== activeCopy?.dir ? (
            <>
              <hr />
              <button onClick={() => beginRenameEntry(treeMenu.node)}>{t("rename")}</button>
              {treeMenu.node.path !== activeCopy?.filePath ? (
                <button onClick={() => deleteDirectoryEntry(treeMenu.node)}>{t("delete")}</button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
      {historyOpen ? (
        <div className="history-overlay">
          <div className="history-panel">
            <div className="history-head">
              <div>
                <h3>{t("historyTitle").replace("{name}", skill.name)}</h3>
                <p>{t("historyVersionCount").replace("{client}", activeCopy?.client || "").replace("{count}", history.length)}</p>
              </div>
              <div className="modal-actions">
                <button className="soft-button" onClick={() => deleteSelectedHistoryVersions()} disabled={!selectedHistoryVersionIds.length || versionSwitching}>
                  {t("deleteSelected")}{selectedHistoryVersionIds.length ? ` (${selectedHistoryVersionIds.length})` : ""}
                </button>
                <button className="soft-button" onClick={() => deleteSelectedHistoryVersions(history.map((entry) => entry.id))} disabled={!history.length || versionSwitching}>
                  {t("clearAll")}
                </button>
                <button onClick={() => setHistoryOpen(false)}>{t("close")}</button>
              </div>
            </div>
            <div className="history-body" style={{ "--history-list-width": `${historyListWidth}px` }}>
              <div className="history-list">
                {history.length ? history.map((entry) => (
                  <div key={entry.id} className={`history-list-row ${selectedVersion?.id === entry.id ? "selected" : ""}`}>
                    <input
                      type="checkbox"
                      checked={selectedHistoryVersionIds.includes(entry.id)}
                      disabled={isActiveHistoryVersion(entry)}
                      onChange={(event) => {
                        setSelectedHistoryVersionIds((current) => (
                          event.target.checked ? [...current, entry.id] : current.filter((id) => id !== entry.id)
                        ));
                      }}
                    />
                    <button onClick={() => selectVersion(entry)}>
                      <strong>{entry.label || entry.id}</strong>
                      <span>{isActiveHistoryVersion(entry) ? t("currentVersion") : entry.reason} · {formatDate(entry.createdAt)}</span>
                    </button>
                  </div>
                )) : <p>{t("noHistory")}</p>}
              </div>
              <div
                className="history-resizer"
                onMouseDown={(event) => {
                  event.preventDefault();
                  const startX = event.clientX;
                  const startWidth = historyListWidth;
                  const move = (moveEvent) => {
                    setHistoryListWidth(Math.max(150, Math.min(320, startWidth + moveEvent.clientX - startX)));
                  };
                  const up = () => {
                    window.removeEventListener("mousemove", move);
                    window.removeEventListener("mouseup", up);
                  };
                  window.addEventListener("mousemove", move);
                  window.addEventListener("mouseup", up);
                }}
              />
              <div className="diff-pane">
                {versionDetail ? (
                  <>
                    <div className="diff-toolbar">
                      <span>{t("compareCurrentWith").replace("{version}", versionDetail.version?.label || selectedVersion?.label || t("historyVersion"))}</span>
                      <button
                        onClick={() => activateSkillPackageVersion(selectedVersion, activeCopy)}
                        disabled={saving || versionSwitching || !selectedVersion || isActiveHistoryVersion(selectedVersion)}
                      >
                        <RotateCcw size={13} />
                        {t("chooseThisVersion")}
                      </button>
                    </div>
                    <div className="history-version-note">
                      <span>{t("publishMessage")}</span>
                      <p>{selectedVersion?.message || t("historyMessageFallback")}</p>
                    </div>
                    <DirectoryDiffViewer detail={versionDetail} />
                  </>
                ) : (
                  <div className="diff-empty">{t("selectHistoryHint")}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <InstallTargetDialog
        pending={upgradeTargetPending}
        targets={upgradeTargetPending?.targets || []}
        selectedTargets={upgradeTargetCopyIds}
        onChangeTargets={setUpgradeTargetCopyIds}
        onCancel={() => setUpgradeTargetPending(null)}
        onConfirm={async () => {
          const enabledTargets = upgradeTargetPending?.targets?.filter((target) => target.installed && !target.disabled) || [];
          const selectedCopies = installations.filter((item) => upgradeTargetCopyIds.includes(item.id) && enabledTargets.some((target) => target.id === item.id));
          const previewCopy = activeCopy;
          setUpgradeTargetPending(null);
          await prepareUpgradePreview(previewCopy, selectedCopies.length ? selectedCopies : [previewCopy]);
        }}
        busy={upgradeBusy}
      />
      {upgradeOpen ? (
        <div className="history-overlay">
          <div className={`history-panel upgrade-panel ${upgradeBusy ? "is-upgrading" : ""}`}>
            <div className="history-head">
              <div>
                <h3>{t("confirmPublishTitle").replace("{name}", skill.name)}</h3>
                <p>
                  {(upgradeCopies.length ? upgradeCopies : [upgradeCopy || activeCopy]).map((copy) => copy?.client).filter(Boolean).join(", ")}
                  {upgradeCopies.length > 1
                    ? ` · ${t("perAgentPublish")}`
                    : ` · ${upgradeDetail?.fromVersion || "-"} -> ${upgradeDetail?.toVersion || "-"}`}
                </p>
              </div>
              <div className="modal-actions">
                <button className="soft-button" onClick={closeUpgradePanel} disabled={upgradeBusy}>{t("cancel")}</button>
                <button className={upgradeBusy ? "upgrade-confirm-busy" : ""} onClick={confirmSkillUpgrade} disabled={upgradeBusy || !upgradeDetail?.files?.length}>
                  {upgradeBusy ? t("publishingDots") : t("publishForAgents").replace("{count}", upgradeCopies.length || 1)}
                </button>
              </div>
            </div>
            <div className={`upgrade-body ${upgradeCopies.length > 1 ? "has-tabs" : ""}`}>
              {upgradeDetail ? (
                <>
                  {upgradeCopies.length > 1 ? (
                    <div className="upgrade-agent-tabs">
                      {upgradeCopies.map((copy) => {
                        const detail = upgradeDetails[copy.id];
                        const active = copy.id === upgradeCopy?.id;
                        return (
                          <button
                            key={copy.id}
                            className={active ? "active" : ""}
                            onClick={() => {
                              setUpgradeCopy(copy);
                              setUpgradeDetail(detail || null);
                            }}
                            title={shortPath(copy.dir)}
                          >
                            <strong>{copy.client}</strong>
                            <span>{detail?.fromVersion || "-"} → {detail?.toVersion || "-"}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  <label className="publish-message-box">
                    <span>{t("publishMessage")}</span>
                    <textarea
                      value={upgradeMessage}
                      onChange={(event) => setUpgradeMessage(event.target.value)}
                      placeholder={t("publishMessagePlaceholder")}
                      rows={2}
                    />
                  </label>
                  <div className="diff-toolbar">
                    <span>{t("publishDiffNotice").replace("{client}", upgradeCopy?.client ? `${upgradeCopy.client} · ` : "")}</span>
                  </div>
                  <DirectoryDiffViewer detail={upgradeDetail} />
                </>
              ) : (
                <div className="diff-empty">{t("generatingPublishDiff")}</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SettingsPage({ settings, onSave, onDraftChange }) {
  const { t } = useI18n();
  const fallbackSettings = {
    sources: [],
    ignorePatterns: [],
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
  const [draft, setDraft] = useState(settings || {
    sources: [],
    ignorePatterns: [],
    installSourceId: "agents",
    installTargetMode: "remember-last",
    language: "zh",
    mergeDuplicateSkills: true,
    skillVersionRetentionDays: 30,
    logRetentionDays: null,
    eventRetentionDays: null,
    apiEnabled: true,
    apiPort: 19010
  });
  const [settingsMode, setSettingsMode] = useState(readSettingsMode);
  const [jsonText, setJsonText] = useState(JSON.stringify(settings || fallbackSettings, null, 2));
  const [jsonError, setJsonError] = useState("");
  const [ignoreText, setIgnoreText] = useState((settings?.ignorePatterns || []).join("\n"));
  const [appInfo, setAppInfo] = useState(null);
  const [draggedSourceId, setDraggedSourceId] = useState("");
  const [dragOverSourceId, setDragOverSourceId] = useState("");
  const [editingSourceId, setEditingSourceId] = useState("");
  const [editingPathId, setEditingPathId] = useState("");
  const [agentNameError, setAgentNameError] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [showSettingsDiff, setShowSettingsDiff] = useState(false);
  const [pathStatus, setPathStatus] = useState({});
  const [pathNoticeId, setPathNoticeId] = useState("");
  const [retentionText, setRetentionText] = useState({});
  const [retentionBaseline, setRetentionBaseline] = useState({});
  const [settingsSaveNotice, setSettingsSaveNotice] = useState("");
  const [apiBusy, setApiBusy] = useState(false);
  const [apiConnection, setApiConnection] = useState({ state: "unknown", message: "" });
  const [editingApiPort, setEditingApiPort] = useState(false);
  const [editingAgentText, setEditingAgentText] = useState({ sourceId: "", field: "" });
  const [editingIgnore, setEditingIgnore] = useState(false);
  const [showAgentOverflow, setShowAgentOverflow] = useState(false);
  const agentNameRefs = useRef({});
  const agentLabelRefs = useRef({});
  const agentPathRefs = useRef({});
  const apiPortRef = useRef(null);
  const settingsJsonGutterRef = useRef(null);
  const autoSaveTimerRef = useRef(0);

  useEffect(() => {
    if (!settings) return;
    if (settingsDiffRows(settings, normalizeVisualSettings(draft)).length) return;
    setDraft(settings);
    setIgnoreText((settings.ignorePatterns || []).join("\n"));
    setJsonText(JSON.stringify(settings, null, 2));
    setJsonError("");
    setRetentionText({});
    setRetentionBaseline({});
  }, [settings]);

  useEffect(() => {
    const nextLanguage = settings?.language === "en" ? "en" : "zh";
    setDraft((current) => {
      if ((current.language || "zh") === nextLanguage) return current;
      const next = { ...current, language: nextLanguage };
      setJsonText(JSON.stringify(normalizeVisualSettings(next), null, 2));
      return next;
    });
  }, [settings?.language]);

  useEffect(() => {
    if (!settingsSaveNotice) return undefined;
    const timer = window.setTimeout(() => setSettingsSaveNotice(""), 1000);
    return () => window.clearTimeout(timer);
  }, [settingsSaveNotice]);

  useEffect(() => {
    if (!showAgentOverflow) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setShowAgentOverflow(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showAgentOverflow]);

  useEffect(() => {
    let alive = true;
    refreshAppInfo({ aliveRef: () => alive }).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function testApiConnection(port = appInfo?.apiPort) {
    if (!window.skillStudio.testApi) return null;
    setApiConnection({ state: "testing", message: "" });
    const startedAt = Date.now();
    const result = await window.skillStudio.testApi(port).catch((error) => ({ ok: false, message: error.message || String(error) }));
    const elapsed = Date.now() - startedAt;
    if (elapsed < 450) {
      await new Promise((resolve) => window.setTimeout(resolve, 450 - elapsed));
    }
    setApiConnection({ state: result?.ok ? "connected" : "failed", message: result?.message || "" });
    return result;
  }

  async function refreshAppInfo(options = {}) {
    const info = await window.skillStudio.getAppInfo?.();
    if (options.aliveRef && !options.aliveRef()) return info;
    setAppInfo(info);
    if (info?.apiEnabled && info?.apiPort) await testApiConnection(info.apiPort);
    else setApiConnection({ state: "failed", message: "" });
    return info;
  }

  async function refreshLocalApi() {
    if (!window.skillStudio.restartApi || apiBusy) return;
    let nextSettings = normalizeVisualSettings(draft);
    if (settingsMode === "json") {
      try {
        const parsed = JSON.parse(jsonText);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(t("jsonObjectRequired"));
        nextSettings = parsed;
        setJsonError("");
      } catch (error) {
        setJsonError(error.message || String(error));
        return;
      }
    }
    setApiBusy(true);
    setApiConnection({ state: "testing", message: "" });
    try {
      const result = await window.skillStudio.restartApi(nextSettings);
      if (result?.settings) {
        setDraft(result.settings);
        setIgnoreText((result.settings.ignorePatterns || []).join("\n"));
        setJsonText(JSON.stringify(result.settings, null, 2));
      }
      setAppInfo(result?.info || null);
      setApiConnection({
        state: result?.connection?.ok ? "connected" : "failed",
        message: result?.connection?.message || ""
      });
      setShowSettingsDiff(false);
    } catch (error) {
      setApiConnection({ state: "failed", message: error.message || String(error) });
    } finally {
      setApiBusy(false);
    }
  }

  useEffect(() => {
    let alive = true;
    if (!window.skillStudio.pathExists) return () => {};
    const roots = [...new Set((draft.sources || []).map((source) => settingsPathKey(source.root)).filter(Boolean))];
    Promise.all(roots.map(async (root) => {
      const exists = await window.skillStudio.pathExists(root).catch(() => null);
      return [root, exists === null ? null : Boolean(exists)];
    })).then((entries) => {
      if (!alive) return;
      setPathStatus(Object.fromEntries(entries.filter(([, exists]) => exists !== null)));
    });
    return () => {
      alive = false;
    };
  }, [draft.sources]);

  useEffect(() => {
    const missingEnabledIds = (draft.sources || [])
      .filter((source) => source.enabled && pathStatus[settingsPathKey(source.root)] === false)
      .map((source) => source.id);
    if (!missingEnabledIds.length) return;
    setDraft((current) => {
      const missingSet = new Set(missingEnabledIds);
      const next = {
        ...current,
        sources: current.sources.map((source) => missingSet.has(source.id) ? { ...source, enabled: false } : source)
      };
      setJsonText(JSON.stringify(normalizeVisualSettings(next), null, 2));
      return next;
    });
  }, [pathStatus]);

  function normalizeVisualSettings(value, nextIgnoreText = ignoreText) {
    return {
      ...value,
      ignorePatterns: nextIgnoreText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    };
  }

  function updateVisualDraft(updater, _delay = 0, nextIgnoreText = ignoreText) {
    setDraft((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      const normalized = normalizeVisualSettings(next, nextIgnoreText);
      setJsonText(JSON.stringify(normalized, null, 2));
      onDraftChange?.(normalized);
      return next;
    });
  }

  function switchSettingsMode(mode) {
    if (mode === settingsMode) return;
    if (mode === "json") {
      const synced = {
        ...draft,
        ignorePatterns: ignoreText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
      };
      setJsonText(JSON.stringify(synced, null, 2));
      setJsonError("");
    } else {
      try {
        const parsed = JSON.parse(jsonText);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(t("jsonObjectRequired"));
        setJsonError("");
        setDraft(parsed);
        setIgnoreText((parsed.ignorePatterns || []).join("\n"));
      } catch (error) {
        setJsonError(error.message || String(error));
        return;
      }
    }
    setSettingsMode(mode);
    localStorage.setItem(settingsModeStorageKey, mode);
  }

  function duplicateAgentNameMessage(name) {
    return t("duplicateAgentName").replace("{name}", String(name || "").trim() || "-");
  }

  function findDuplicateAgentName(sources = []) {
    const seen = new Map();
    for (const source of sources) {
      const name = String(source.client || "").trim();
      const normalized = name.toLowerCase();
      if (!normalized) continue;
      if (seen.has(normalized)) return name;
      seen.set(normalized, true);
    }
    return "";
  }

  function nextAgentName(sources = []) {
    const existing = new Set(sources.map((source) => String(source.client || "").trim().toLowerCase()).filter(Boolean));
    const base = t("newAgent");
    let name = base;
    let index = 2;
    while (existing.has(name.toLowerCase())) {
      name = `${base} ${index}`;
      index += 1;
    }
    return name;
  }

  function updateSource(id, patch, delay = 0) {
    if (Object.prototype.hasOwnProperty.call(patch, "enabled") && patch.enabled) {
      const target = draft.sources.find((source) => source.id === id);
      const rootKey = settingsPathKey(target?.root);
      if (!rootKey || pathStatus[rootKey] !== true) return;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "client")) {
      const nextName = String(patch.client || "").trim();
      const duplicate = draft.sources.some((source) => source.id !== id && String(source.client || "").trim().toLowerCase() === nextName.toLowerCase());
      if (nextName && duplicate) {
        setAgentNameError(duplicateAgentNameMessage(nextName));
        return;
      }
      setAgentNameError("");
    }
    updateVisualDraft((current) => ({
      ...current,
      sources: current.sources.map((source) => source.id === id ? { ...source, ...patch } : source)
    }), delay);
  }

  function addSource() {
    const id = `custom-${Date.now()}`;
    updateVisualDraft((current) => ({
      ...current,
      sources: [
        ...current.sources,
        { id, client: nextAgentName(current.sources), label: t("newAgentSkills"), root: "~/skills", enabled: false }
      ],
      installSourceId: current.installSourceId || id
    }));
    setAgentNameError("");
    setEditingSourceId(id);
    window.setTimeout(() => {
      agentNameRefs.current[id]?.focus?.();
      agentNameRefs.current[id]?.select?.();
    }, 0);
  }

  function removeSource(id) {
    const target = draft.sources.find((source) => source.id === id);
    const name = target?.client || id;
    if (!window.confirm(t("removeAgentConfirm").replace("{name}", name))) return;
    updateVisualDraft((current) => {
      const sources = current.sources.filter((source) => source.id !== id);
      return {
        ...current,
        sources,
        installSourceId: current.installSourceId === id ? (sources.find((source) => source.enabled)?.id || "agents") : current.installSourceId
      };
    });
  }

  function updateJsonText(value) {
    setJsonText(value);
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(t("jsonObjectRequired"));
      const duplicateName = findDuplicateAgentName(parsed.sources || []);
      if (duplicateName) throw new Error(duplicateAgentNameMessage(duplicateName));
      setJsonError("");
      setDraft(parsed);
      setIgnoreText((parsed.ignorePatterns || []).join("\n"));
    } catch (error) {
      setJsonError(error.message || String(error));
    }
  }

  const installable = draft.sources.filter((source) => source.enabled);
  const setRetention = (key, value) => {
    updateVisualDraft((current) => ({
      ...current,
      [key]: value === "forever" ? null : Math.max(1, Number(current[key]) || 30)
    }));
    setRetentionText((current) => ({
      ...current,
      [key]: value === "forever" ? "" : String(draft[key] || 30)
    }));
    setRetentionBaseline((current) => ({
      ...current,
      [key]: value === "forever" ? "" : String(draft[key] || 30)
    }));
  };
  const beginRetentionEdit = (key) => {
    setRetentionBaseline((current) => ({
      ...current,
      [key]: String(draft[key] || 30)
    }));
  };
  const setRetentionDays = (key, value) => {
    setRetentionText((current) => ({ ...current, [key]: value }));
    if (!value.trim()) return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    updateVisualDraft((current) => ({
      ...current,
      [key]: Math.max(1, Math.floor(parsed))
    }), 500);
  };
  const commitRetentionDays = (key) => {
    const previousValue = retentionBaseline[key] || String(draft[key] || 30);
    setRetentionText((current) => {
      const value = current[key];
      if (value === undefined) return current;
      const parsed = Number(value);
      if (value.trim() && Number.isFinite(parsed) && parsed >= 1) {
        return { ...current, [key]: String(Math.max(1, Math.floor(parsed))) };
      }
      return { ...current, [key]: previousValue };
    });
    const currentValue = retentionText[key];
    const parsed = Number(currentValue);
    if (!String(currentValue || "").trim() || !Number.isFinite(parsed) || parsed < 1) {
      updateVisualDraft((current) => ({
        ...current,
        [key]: Math.max(1, Math.floor(Number(previousValue) || 30))
      }));
    }
    setRetentionBaseline((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  function reorderSource(sourceId, targetIndex) {
    updateVisualDraft((current) => {
      const fromIndex = current.sources.findIndex((source) => source.id === sourceId);
      return { ...current, sources: moveItem(current.sources, fromIndex, targetIndex) };
    });
  }

  function openAgentDirectory(root) {
    if (!root) return;
    const key = settingsPathKey(root);
    if (pathStatus[key] === false) {
      setPathStatus((current) => ({ ...current, [key]: false }));
      setPathNoticeId(key);
      window.setTimeout(() => setPathNoticeId((current) => current === key ? "" : current), 1600);
      return;
    }
    window.skillStudio.open?.(key).catch?.(() => {
      setPathStatus((current) => ({ ...current, [key]: false }));
      setPathNoticeId(key);
      window.setTimeout(() => setPathNoticeId((current) => current === key ? "" : current), 1600);
    });
  }

  function editAgentPath(sourceId) {
    setEditingSourceId(sourceId);
    setEditingPathId(sourceId);
    window.setTimeout(() => {
      agentPathRefs.current[sourceId]?.focus?.();
      agentPathRefs.current[sourceId]?.select?.();
    }, 0);
  }

  function editAgentLabel(sourceId) {
    setEditingSourceId(sourceId);
    setEditingAgentText({ sourceId, field: "label" });
    window.setTimeout(() => {
      agentLabelRefs.current[sourceId]?.focus?.();
      agentLabelRefs.current[sourceId]?.select?.();
    }, 0);
  }

  function editAgentName(sourceId) {
    setEditingSourceId(sourceId);
    setEditingAgentText({ sourceId, field: "client" });
    window.setTimeout(() => {
      agentNameRefs.current[sourceId]?.focus?.();
      agentNameRefs.current[sourceId]?.select?.();
    }, 0);
  }

  function editApiPort() {
    setEditingApiPort(true);
    window.setTimeout(() => {
      apiPortRef.current?.focus?.();
      apiPortRef.current?.select?.();
    }, 0);
  }

  function closeAgentTextEdit(sourceId, field) {
    setEditingAgentText((current) => (
      current.sourceId === sourceId && current.field === field ? { sourceId: "", field: "" } : current
    ));
  }

  const normalizedDraftSettings = normalizeVisualSettings(draft);
  const settingChanges = settingsDiffRows(settings || fallbackSettings, normalizedDraftSettings, t);
  const hasSettingChanges = settingChanges.length > 0;
  const settingsJsonBefore = formatSettingsJson(settings || fallbackSettings);
  const settingsJsonAfter = formatSettingsJson(normalizedDraftSettings);
  const settingChangeGroups = useMemo(() => {
    const groups = new Map();
    for (const row of settingChanges) {
      if (!groups.has(row.group)) groups.set(row.group, []);
      groups.get(row.group).push(row);
    }
    return Array.from(groups.entries()).map(([group, rows]) => ({ group, rows }));
  }, [settingChanges]);

  useEffect(() => {
    window.clearTimeout(autoSaveTimerRef.current);
    if (!hasSettingChanges || savingDraft || jsonError || agentNameError) return undefined;
    autoSaveTimerRef.current = window.setTimeout(() => {
      saveDraftSettings();
    }, settingsMode === "json" ? 900 : 650);
    return () => window.clearTimeout(autoSaveTimerRef.current);
  }, [hasSettingChanges, settingsJsonAfter, settingsMode, savingDraft, jsonError, agentNameError]);

  async function saveDraftSettings() {
    let nextSettings = normalizeVisualSettings(draft);
    if (settingsMode === "json") {
      try {
        const parsed = JSON.parse(jsonText);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(t("jsonObjectRequired"));
        const duplicateName = findDuplicateAgentName(parsed.sources || []);
        if (duplicateName) throw new Error(duplicateAgentNameMessage(duplicateName));
        nextSettings = parsed;
        setJsonError("");
      } catch (error) {
        setJsonError(error.message || String(error));
        return;
      }
    } else {
      const duplicateName = findDuplicateAgentName(nextSettings.sources || []);
      if (duplicateName) {
        setAgentNameError(duplicateAgentNameMessage(duplicateName));
        return;
      }
    }
    setSavingDraft(true);
    try {
      const saved = await onSave(nextSettings);
      if (saved) {
        setDraft(saved);
        setIgnoreText((saved.ignorePatterns || []).join("\n"));
        setJsonText(JSON.stringify(saved, null, 2));
      }
      setAgentNameError("");
      setShowSettingsDiff(false);
      setSettingsSaveNotice(t("settingsSaved"));
      refreshAppInfo().catch(() => {});
    } finally {
      setSavingDraft(false);
    }
  }

  function discardDraftSettings() {
    const reset = settings || fallbackSettings;
    setDraft(reset);
    setIgnoreText((reset.ignorePatterns || []).join("\n"));
    setJsonText(JSON.stringify(reset, null, 2));
    setJsonError("");
    setAgentNameError("");
    setRetentionText({});
    setRetentionBaseline({});
    setShowSettingsDiff(false);
  }

  return (
    <section className="settings-page">
      <div className="settings-head">
        <div>
          <h2>{t("settings")}</h2>
          <p>{t("settingsDesc")}</p>
        </div>
        <div className="settings-head-actions">
          <span className={`settings-autosave-state ${savingDraft ? "saving" : settingsSaveNotice ? "saved" : hasSettingChanges ? "dirty" : ""}`}>
            {savingDraft ? t("saving") : settingsSaveNotice ? t("settingsSaved") : hasSettingChanges ? t("unsavedSettings") : ""}
          </span>
          <div className="settings-mode-switch">
            <button className={settingsMode === "visual" ? "on" : ""} onClick={() => switchSettingsMode("visual")}>{t("visual")}</button>
            <button className={settingsMode === "json" ? "on" : ""} onClick={() => switchSettingsMode("json")}>{t("json")}</button>
          </div>
        </div>
      </div>

      <div className="settings-body">
      <section className="settings-version-card">
        <div>
          <span>{t("appVersion")}</span>
          <strong>{appInfo?.version ? `v${appInfo.version}` : t("loadingAppVersion")}</strong>
        </div>
        <p>{appInfo?.name || "Skill Manager"} · {appInfo?.isPackaged ? t("packagedApp") : t("devMode")}</p>
      </section>

      {showSettingsDiff && hasSettingChanges ? (
        <aside className="settings-diff-panel">
          <div className="settings-diff-head">
            <div>
              <h3>{t("settingsChanges")}</h3>
              <p>{settingChanges.length ? t("settingChangeCount").replace("{count}", settingChanges.length) : t("noSettingChanges")}</p>
            </div>
            <button className="settings-diff-close" onClick={() => setShowSettingsDiff(false)} aria-label={t("cancel")} title={t("cancel")}>
              <X size={15} />
            </button>
          </div>
          {settingChanges.length ? (
            settingsMode === "json" ? (
              <SettingsJsonDiff before={settingsJsonBefore} after={settingsJsonAfter} />
            ) : (
              <div className="settings-diff-list">
                {settingChangeGroups.map((group) => (
                  <section className="settings-diff-group" key={group.group}>
                    <div className="settings-diff-group-head">
                      <strong>{group.group}</strong>
                      <span>{group.rows.length}</span>
                    </div>
                    {group.rows.map((row) => (
                      <div className="settings-diff-row" key={`${row.group}:${row.label}`}>
                        <strong>{row.label}</strong>
                        <div className="settings-diff-values">
                          <code className="before">{row.before}</code>
                          <span className="settings-diff-arrow">→</span>
                          <code className="after">{row.after}</code>
                        </div>
                      </div>
                    ))}
                  </section>
                ))}
              </div>
            )
          ) : <div className="list-empty compact">{t("noSettingChanges")}</div>}
        </aside>
      ) : null}

      {settingsMode === "json" ? (
        <section className="settings-card settings-json-card">
          <div className="settings-card-head">
            <h3>{t("jsonSettings")}</h3>
            <p>{t("jsonSettingsDesc")}</p>
          </div>
          <div className={`settings-json-editor-shell ${jsonError ? "has-error" : ""}`}>
            <div className="settings-json-editor-head">
              <span>settings.json</span>
              <em>{jsonText.split(/\r?\n/).length} lines</em>
            </div>
            <div className="settings-json-editor-body">
              <pre className="settings-json-gutter" ref={settingsJsonGutterRef} aria-hidden="true">
                {Array.from({ length: Math.max(1, jsonText.split(/\r?\n/).length) }, (_, index) => index + 1).join("\n")}
              </pre>
              <textarea
                className="settings-json-editor"
                value={jsonText}
                onChange={(event) => updateJsonText(event.target.value)}
                onScroll={(event) => {
                  if (settingsJsonGutterRef.current) settingsJsonGutterRef.current.scrollTop = event.currentTarget.scrollTop;
                }}
                spellCheck={false}
              />
            </div>
          </div>
          {jsonError ? <div className="json-error">{jsonError}</div> : null}
        </section>
      ) : (
      <div className="settings-grid">
        <section className={`settings-card wide agents-settings-card ${showAgentOverflow ? "show-agent-overflow" : ""}`}>
          <div className="settings-card-head row">
            <div>
              <h3>Agents</h3>
              <p>{t("agentsDesc")}</p>
            </div>
            <button className="soft-button" onClick={addSource}>{t("addAgent")}</button>
          </div>
          {agentNameError ? <div className="settings-inline-error">{agentNameError}</div> : null}
          {showAgentOverflow ? (
            <div className="agent-overflow-head">
              <div>
                <strong>{t("agents")}</strong>
                <span>{draft.sources.length}</span>
              </div>
              <button
                type="button"
                className="soft-button"
                onClick={() => setShowAgentOverflow(false)}
              >
                {t("collapseAgents")}
              </button>
            </div>
          ) : null}
          <div className="agent-editor-list">
            {draft.sources.map((source, index) => (
              (() => {
                const rootKey = settingsPathKey(source.root);
                const missing = pathStatus[rootKey] === false;
                const pathExists = pathStatus[rootKey] === true;
                const cannotEnable = !rootKey || !pathExists;
                const statusLabel = missing
                  ? t("directoryMissing")
                  : pathExists
                    ? (source.enabled ? t("enabledStatus") : t("detectedDisabled"))
                    : t("notInstalled");
                const statusClass = missing
                  ? "missing"
                  : pathExists
                    ? (source.enabled ? "enabled" : "detected")
                    : "not-installed";
                return (
              <div
                className={`agent-editor-row ${dragOverSourceId === source.id ? "drag-over" : ""} ${editingSourceId === source.id ? "editing" : ""}`}
                key={source.id}
                onFocusCapture={() => setEditingSourceId(source.id)}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (draggedSourceId && draggedSourceId !== source.id) setDragOverSourceId(source.id);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggedSourceId && draggedSourceId !== source.id) reorderSource(draggedSourceId, index);
                  setDraggedSourceId("");
                  setDragOverSourceId("");
                }}
              >
                <div className="agent-reorder-controls">
                  <button
                    className="agent-drag-handle"
                    draggable
                    title={t("dragToReorder")}
                    aria-label={t("dragToReorder")}
                    onDragStart={(event) => {
                      setDraggedSourceId(source.id);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", source.id);
                    }}
                    onDragEnd={() => {
                      setDraggedSourceId("");
                      setDragOverSourceId("");
                    }}
                  >
                    <GripVertical size={15} />
                  </button>
                </div>
                <label className={`toggle-field ${cannotEnable ? "disabled" : ""}`} aria-label={source.enabled ? t("disabled") : t("enabled")}>
                  <input
                    className="agent-enable-input"
                    type="checkbox"
                    checked={Boolean(source.enabled) && !missing}
                    disabled={cannotEnable}
                    title={missing ? t("directoryMissing") : t("enabled")}
                    onChange={(event) => {
                      if (cannotEnable) return;
                      updateSource(source.id, { enabled: event.target.checked });
                    }}
                  />
                  <span className={`agent-enable-mark ${missing ? "missing" : ""} ${source.enabled && !missing ? "checked" : ""}`}>
                    {missing ? <X size={11} /> : source.enabled && !missing ? "✓" : ""}
                  </span>
                </label>
                <AgentLogo source={source} />
                <label>
                  <span>{t("name")}</span>
                  <input
                    ref={(node) => { agentNameRefs.current[source.id] = node; }}
                    className={editingAgentText.sourceId === source.id && editingAgentText.field === "client" ? "editing-agent-text" : ""}
                    value={source.client}
                    readOnly={!(editingAgentText.sourceId === source.id && editingAgentText.field === "client")}
                    title={t("name")}
                    onDoubleClick={() => editAgentName(source.id)}
                    onChange={(event) => updateSource(source.id, { client: event.target.value }, 500)}
                    onBlur={() => closeAgentTextEdit(source.id, "client")}
                  />
                </label>
                <span className={`agent-status-badge ${statusClass}`}>{statusLabel}</span>
                <label>
                  <span>{t("description")}</span>
                  <input
                    ref={(node) => { agentLabelRefs.current[source.id] = node; }}
                    className={editingAgentText.sourceId === source.id && editingAgentText.field === "label" ? "editing-agent-text" : ""}
                    value={source.label}
                    readOnly={!(editingAgentText.sourceId === source.id && editingAgentText.field === "label")}
                    title={t("description")}
                    onDoubleClick={() => editAgentLabel(source.id)}
                    onChange={(event) => updateSource(source.id, { label: event.target.value }, 500)}
                    onBlur={() => closeAgentTextEdit(source.id, "label")}
                  />
                </label>
                <label className="agent-path-field">
                  <span>{t("directory")}</span>
                  <input
                    ref={(node) => { agentPathRefs.current[source.id] = node; }}
                    className={`${missing ? "missing-path" : ""} ${editingPathId === source.id ? "editing-path" : ""}`}
                    value={source.root}
                    title={source.root}
                    readOnly={editingPathId !== source.id}
                    onDoubleClick={() => openAgentDirectory(source.root)}
                    onChange={(event) => updateSource(source.id, { root: event.target.value }, 500)}
                    onBlur={() => setEditingPathId((current) => current === source.id ? "" : current)}
                  />
                  <button type="button" className="agent-path-edit" title={t("edit")} aria-label={t("edit")} onClick={() => editAgentPath(source.id)}>
                    <Edit3 size={13} />
                  </button>
                  <button type="button" className="agent-path-open" title={t("openDirectory")} aria-label={t("openDirectory")} onClick={() => openAgentDirectory(source.root)}>
                    <FolderOpen size={13} />
                  </button>
                  {missing ? <em className="agent-path-missing">{t("directoryMissing")}</em> : null}
                  {pathNoticeId === rootKey ? <em className="agent-path-popover">{t("directoryMissing")}</em> : null}
                </label>
                <button
                  type="button"
                  className="tiny-danger"
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeSource(source.id);
                  }}
                >
                  {t("remove")}
                </button>
              </div>
                );
              })()
            ))}
          </div>
          {draft.sources.length > 12 ? (
            <button
              type="button"
              className="more-agents-button"
              onClick={() => setShowAgentOverflow((current) => !current)}
            >
              {showAgentOverflow ? t("collapseAgents") : t("moreAgents").replace("{count}", draft.sources.length - 12)}
            </button>
          ) : null}
        </section>

        <section className="settings-card">
          <div className="settings-card-head">
            <h3>{t("defaultInstallTarget")}</h3>
            <p>{t("defaultInstallTargetDesc")}</p>
          </div>
          <label className="settings-field">
            <span>{t("installToAgent")}</span>
            <select value={draft.installSourceId || "agents"} onChange={(event) => updateVisualDraft({ ...draft, installSourceId: event.target.value })}>
              {installable.map((source) => (
                <option key={source.id} value={source.id}>{source.client} · {shortPath(source.root)}</option>
              ))}
            </select>
          </label>
          <label className="settings-field">
            <span>{t("installDialogDefault")}</span>
            <select value={draft.installTargetMode || "remember-last"} onChange={(event) => updateVisualDraft({ ...draft, installTargetMode: event.target.value })}>
              <option value="remember-last">{t("rememberLast")}</option>
              <option value="always-default">{t("alwaysDefault")}</option>
            </select>
          </label>
          <label className="settings-field">
            <span>{t("language")}</span>
            <select value={draft.language || "zh"} onChange={(event) => updateVisualDraft({ ...draft, language: event.target.value })}>
              <option value="zh">{t("zh")}</option>
              <option value="en">{t("en")}</option>
            </select>
          </label>
          <label className="toggle-field settings-toggle">
            <input type="checkbox" checked={draft.mergeDuplicateSkills !== false} onChange={(event) => updateVisualDraft({ ...draft, mergeDuplicateSkills: event.target.checked })} />
            {t("mergeAllAgents")}
          </label>
        </section>

        <section className="settings-card">
          <div className="settings-card-head">
            <h3>{t("localApi")}</h3>
            <p>{t("localApiDesc")}</p>
          </div>
          <div className="api-panel">
            <div className="api-panel-top">
              <label className="toggle-field settings-toggle api-toggle">
                <input type="checkbox" checked={draft.apiEnabled !== false} onChange={(event) => updateVisualDraft({ ...draft, apiEnabled: event.target.checked })} />
                {t("enableLocalApi")}
              </label>
              <strong className={`api-connection-state ${apiConnection.state}`}>
                {apiConnection.state === "testing" ? t("apiTesting") : apiConnection.state === "connected" ? t("apiConnected") : t("apiDisconnected")}
              </strong>
            </div>
            <div className="api-port-row">
              <label>
                <span>{t("configuredPort")}</span>
              </label>
              <input
                ref={apiPortRef}
                className={editingApiPort ? "editing-api-port" : ""}
                type="number"
                min="1024"
                max="65535"
                value={draft.apiPort || 19010}
                readOnly={!editingApiPort}
                onMouseDown={() => {
                  if (!editingApiPort) editApiPort();
                }}
                onClick={editApiPort}
                onChange={(event) => updateVisualDraft({ ...draft, apiPort: Number(event.target.value) || 19010 }, 500)}
                onBlur={() => setEditingApiPort(false)}
              />
              <button
                type="button"
                className="agent-path-edit api-port-edit"
                title={t("edit")}
                aria-label={t("edit")}
                onClick={editApiPort}
              >
                <Edit3 size={13} />
              </button>
              <button className="soft-button api-mini-button" onClick={refreshLocalApi} disabled={apiBusy || Boolean(jsonError)}>
                <RefreshCcw size={13} />
                {apiBusy ? t("apiRefreshing") : t("refreshApi")}
              </button>
            </div>
            <div className="api-status-card">
              <div>
                <span>{t("currentPort")}</span>
                <strong>{appInfo?.apiEnabled ? (appInfo?.apiPort || t("apiStopped")) : t("apiStopped")}</strong>
              </div>
              <div>
                <span>{t("apiBaseUrl")}</span>
                <code>{appInfo?.apiBaseUrl || "-"}</code>
              </div>
              <button className="soft-button api-test-button" onClick={() => testApiConnection(appInfo?.apiPort)} disabled={apiBusy || !appInfo?.apiPort}>
                {t("testApi")}
              </button>
            </div>
            {apiConnection.message ? <em>{apiConnection.message}</em> : null}
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-head">
            <h3>{t("retention")}</h3>
            <p>{t("retentionDesc")}</p>
          </div>
          <label className="settings-field retention-field">
            <span>{t("operationEvents")}</span>
            <select value={draft.eventRetentionDays ? "custom" : "forever"} onChange={(event) => setRetention("eventRetentionDays", event.target.value)}>
              <option value="forever">{t("forever")}</option>
              <option value="custom">{t("customDays")}</option>
            </select>
            <input
              type="number"
              min="1"
              disabled={!draft.eventRetentionDays}
              value={retentionText.eventRetentionDays ?? (draft.eventRetentionDays || 30)}
              onFocus={() => beginRetentionEdit("eventRetentionDays")}
              onChange={(event) => setRetentionDays("eventRetentionDays", event.target.value)}
              onBlur={() => commitRetentionDays("eventRetentionDays")}
            />
          </label>
          <label className="settings-field retention-field">
            <span>{t("operationLogs")}</span>
            <select value={draft.logRetentionDays ? "custom" : "forever"} onChange={(event) => setRetention("logRetentionDays", event.target.value)}>
              <option value="forever">{t("forever")}</option>
              <option value="custom">{t("customDays")}</option>
            </select>
            <input
              type="number"
              min="1"
              disabled={!draft.logRetentionDays}
              value={retentionText.logRetentionDays ?? (draft.logRetentionDays || 30)}
              onFocus={() => beginRetentionEdit("logRetentionDays")}
              onChange={(event) => setRetentionDays("logRetentionDays", event.target.value)}
              onBlur={() => commitRetentionDays("logRetentionDays")}
            />
          </label>
        </section>

        <section className="settings-card">
          <div className="settings-card-head row">
            <div>
              <h3>{t("ignoreTitle")}</h3>
              <p>{t("ignoreDesc")}</p>
            </div>
            <button
              type="button"
              className={`soft-button icon-soft-button ${editingIgnore ? "active" : ""}`}
              onClick={() => setEditingIgnore((value) => !value)}
              title={t("edit")}
              aria-label={t("edit")}
            >
              <Edit3 size={14} />
            </button>
          </div>
          <textarea
            className={`ignore-editor ${editingIgnore ? "editing" : ""}`}
            value={ignoreText}
            readOnly={!editingIgnore}
            onChange={(event) => {
              const value = event.target.value;
              setIgnoreText(value);
              updateVisualDraft((current) => current, 500, value);
            }}
            spellCheck={false}
          />
        </section>

      </div>
      )}
      </div>
    </section>
  );
}

function InstallTargetDialog({ pending, targets, selectedTargets, onChangeTargets, onCancel, onConfirm, busy }) {
  const { t } = useI18n();
  if (!pending) return null;
  const name = pending.item?.name || pending.item?.slug || "skill";
  const isUninstall = pending.type === "uninstall";
  const isUpgrade = pending.type === "upgrade";
  const isSync = pending.type === "sync";
  const isRestore = pending.type === "uninstalled";
  const isDeleteUninstalled = pending.type === "delete-uninstalled";
  const isUpdate = pending.forceUpdate;
  const actionClass = isUninstall || isDeleteUninstalled ? "danger" : isRestore || isSync ? "soft-accent" : "primary";
  const selectedSet = new Set(selectedTargets);
  const selectableTargets = targets.filter((target) => !target.disabled && (!isUpgrade || target.installed));
  const allSelected = selectableTargets.length > 0 && selectableTargets.every((target) => selectedSet.has(target.id));
  function toggleTarget(id) {
    const target = targets.find((item) => item.id === id);
    if (target?.disabled || (isUpgrade && !target.installed)) return;
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChangeTargets([...next]);
  }
  function selectAllTargets() {
    onChangeTargets(selectableTargets.map((target) => target.id));
  }
  function clearTargets() {
    onChangeTargets([]);
  }
  return (
    <div className="modal-overlay">
      <div className={`install-dialog target-dialog ${actionClass}`}>
        <div className="target-dialog-head">
          <div>
            <h3>{isUninstall ? t("chooseUninstallAgent") : isUpgrade ? t("chooseUpgradeAgent") : isSync ? t("chooseSyncAgent") : isRestore ? t("chooseRecoverAgent") : isDeleteUninstalled ? t("chooseDeleteUninstalled") : isUpdate ? t("chooseUpdateAgent") : t("chooseInstallAgent")}</h3>
            <p>{isSync ? t("syncFrom").replace("{source}", pending.sourceCopy?.client || name) : name}</p>
          </div>
          <div className="target-selected-chip">
            <span>{selectedTargets.length}</span>
            <em>/ {selectableTargets.length}</em>
          </div>
        </div>
        <div className="target-select-tools">
          <span>{t("selectedCount")}</span>
          <button className="soft-button" onClick={allSelected ? clearTargets : selectAllTargets} disabled={!selectableTargets.length || busy}>
            {allSelected ? t("deselectAll") : t("selectAll")}
          </button>
        </div>
        <div className="target-check-list">
          {targets.map((target) => (
            (() => {
              const versionLabel = targetVersionLabel(target);
              return (
                <label key={target.id} className={`target-check ${selectedSet.has(target.id) ? "selected" : ""} ${target.disabled || (isUpgrade && !target.installed) ? "disabled" : ""}`}>
                  <input type="checkbox" checked={selectedSet.has(target.id)} disabled={target.disabled || (isUpgrade && !target.installed)} onChange={() => toggleTarget(target.id)} />
                  <span>
                    <strong>{target.client}</strong>
                    <em>{shortPath(target.root || target.dir)}</em>
                    {target.disabledReason ? <em>{target.disabledReason}</em> : null}
                    {isDeleteUninstalled
                      ? (versionLabel ? <em>{t("snapshotVersion")} {versionLabel}</em> : null)
                      : target.installed && versionLabel
                        ? <em>{t("installedVersion")} {versionLabel}</em>
                        : target.installed
                          ? <em>{t("installedVersion")}</em>
                          : <em>{t("notInstalled")}</em>}
                    {isDeleteUninstalled && target.recordScope !== "skill" ? <em>{shortPath(target.dir || target.root)}</em> : null}
                  </span>
                </label>
              );
            })()
          ))}
        </div>
        <div className="dialog-actions">
          <button className="soft-button" onClick={onCancel} disabled={busy}>{t("cancel")}</button>
          <button className={`dialog-primary-action ${actionClass}`} onClick={onConfirm} disabled={busy || !selectedTargets.length}>{busy ? t("processing") : isUninstall ? t("uninstall") : isUpgrade ? t("publishVersion") : isSync ? t("sync") : isRestore ? t("recover") : isDeleteUninstalled ? t("delete") : isUpdate ? t("update") : t("install")}</button>
        </div>
      </div>
    </div>
  );
}

function InstallSourcePanel({
  mode,
  localPath,
  localError,
  localBusy,
  onLocalPathChange,
  onChooseLocal,
  onConfirmLocal,
  remoteUrl,
  remoteName,
  remoteError,
  remoteBusy,
  onRemoteUrlChange,
  onRemoteNameChange,
  onConfirmRemote
}) {
  const { t } = useI18n();
  if (mode === "leaderboard") return null;
  const isLocal = mode === "local";
  return (
    <div className="install-source-panel">
      <div className="install-source-card">
        <div className="install-source-card-head">
          <div className="source-icon-wrap">
            {isLocal ? <FolderOpen size={18} /> : <Github size={18} />}
          </div>
          <div>
            <h3>{isLocal ? t("localInstall") : t("remoteInstall")}</h3>
            <p>{isLocal ? t("localInstallDesc") : t("remoteInstallHint")}</p>
          </div>
        </div>
        {isLocal ? (
          <div className="install-source-form">
            <label>
              <span>{t("localSkillPath")}</span>
              <div className="inline-input-row">
                <input
                  value={localPath}
                  onChange={(event) => onLocalPathChange(event.target.value)}
                  placeholder={t("localSkillPathPlaceholder")}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") onConfirmLocal();
                  }}
                />
                <button className="soft-button" onClick={onChooseLocal} disabled={localBusy}>
                  <FolderOpen size={15} />
                  {t("chooseDirectory")}
                </button>
              </div>
            </label>
            {localError ? <div className="local-import-error">{localError}</div> : null}
            <div className="install-source-actions">
              <button onClick={onConfirmLocal} disabled={localBusy || !localPath.trim()}>
                {localBusy ? t("processing") : t("install")}
              </button>
            </div>
          </div>
        ) : (
          <div className="install-source-form">
            <label>
              <span>{t("remoteSkillUrl")}</span>
              <input
                value={remoteUrl}
                onChange={(event) => onRemoteUrlChange(event.target.value)}
                placeholder={t("remoteSkillUrlPlaceholder")}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onConfirmRemote();
                }}
              />
            </label>
            <label>
              <span>{t("remoteSkillName")}</span>
              <input
                value={remoteName}
                onChange={(event) => onRemoteNameChange(event.target.value)}
                placeholder={t("remoteSkillNamePlaceholder")}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onConfirmRemote();
                }}
              />
            </label>
            {remoteError ? <div className="local-import-error">{remoteError}</div> : null}
            <div className="install-source-actions">
              <button onClick={onConfirmRemote} disabled={remoteBusy || !remoteUrl.trim()}>
                {remoteBusy ? t("processing") : t("install")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LocalImportDialog({ open, pathValue, error, busy, onPathChange, onChooseDirectory, onCancel, onConfirm }) {
  const { t } = useI18n();
  if (!open) return null;
  return (
    <div className="modal-overlay">
      <div className="local-import-dialog">
        <div className="local-import-head">
          <div>
            <h3>{t("importLocalTitle")}</h3>
            <p>{t("importLocalDesc")}</p>
          </div>
          <button className="icon-button" onClick={onCancel} disabled={busy} aria-label={t("close")}>
            <X size={16} />
          </button>
        </div>
        <label className="local-import-field">
          <span>{t("localSkillPath")}</span>
          <div>
            <input
              value={pathValue}
              onChange={(event) => onPathChange(event.target.value)}
              placeholder={t("localSkillPathPlaceholder")}
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter") onConfirm();
                if (event.key === "Escape") onCancel();
              }}
            />
            <button className="soft-button" onClick={onChooseDirectory} disabled={busy}>
              <FolderOpen size={15} />
              {t("chooseDirectory")}
            </button>
          </div>
        </label>
        {error ? <div className="local-import-error">{error}</div> : null}
        <div className="dialog-actions">
          <button className="soft-button" onClick={onCancel} disabled={busy}>{t("cancel")}</button>
          <button onClick={onConfirm} disabled={busy || !pathValue.trim()}>{busy ? t("processing") : t("importLocal")}</button>
        </div>
      </div>
    </div>
  );
}

function InstallConflictDialog({ pending, conflicts, actions, onChangeAction, onViewDiff, onCancel, onConfirm, busy }) {
  const { t } = useI18n();
  if (!pending || !conflicts?.length) return null;
  const isUpdate = pending.type === "discover" && pending.forceUpdate;
  const title = pending.type === "uninstalled" ? t("recoverConflict") : isUpdate ? t("updateConflict") : t("installConflict");
  return (
    <div className="modal-overlay">
      <div className="install-dialog conflict-dialog">
        <div>
          <h3>{title}</h3>
          <p>{t("conflictHint")}</p>
        </div>
        <div className="conflict-list">
          {conflicts.map((conflict) => (
            <div key={conflict.id} className="conflict-row">
              <div>
                <strong>{conflict.client}</strong>
                <span>{conflict.sourceLabel}</span>
                <em>{t("currentWriting")} {conflict.currentVersion || t("unknownVersion")} · {t("incomingWriting")} {conflict.incomingVersion || t("unknownVersion")}</em>
                {conflict.warning ? <small>{conflict.warning}</small> : null}
              </div>
              <select value={actions[conflict.id] || conflict.defaultAction} onChange={(event) => onChangeAction(conflict.id, event.target.value)}>
                <option value="skip">{t("skip")}</option>
                <option value="replace">{t("replace")}</option>
              </select>
              <button className="conflict-diff-button" onClick={() => onViewDiff(conflict)} disabled={!conflict.canDiff}>
                {t("viewDiff")}
              </button>
            </div>
          ))}
        </div>
        <div className="conflict-note">{t("conflictNote")}</div>
        <div className="dialog-actions">
          <button className="soft-button" onClick={onCancel} disabled={busy}>{t("back")}</button>
          <button onClick={onConfirm} disabled={busy}>{busy ? t("submitting") : t("submit")}</button>
        </div>
      </div>
    </div>
  );
}

function OperationLogPage({ logs, onRefresh, onClear }) {
  const { t } = useI18n();
  const [selectedTypes, setSelectedTypes] = useState(null);
  const [query, setQuery] = useState("");
  const typeOptions = useMemo(() => [...new Set(logs.map((log) => normalizeOperationType(log.type)))], [logs]);
  const activeTypes = selectedTypes === null ? typeOptions : selectedTypes;
  const allTypeSelected = typeOptions.length > 0 && activeTypes.length === typeOptions.length && typeOptions.every((type) => activeTypes.includes(type));
  const filteredLogs = useMemo(() => logs.filter((log) => {
    if (!activeTypes.includes(normalizeOperationType(log.type))) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [log.type, log.status, log.title, log.message, log.detail].some((value) => String(value || "").toLowerCase().includes(q));
  }), [logs, activeTypes, query]);
  return (
    <section className="logs-page">
      <div className="settings-head">
        <div>
          <h2>{t("operationLogs")}</h2>
          <p>{t("operationLogsDesc")}</p>
        </div>
        <div className="log-actions">
          <input className="log-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchLogs")} />
          <details className="log-type-filter">
            <summary>
              <span>{t("logFilter")}</span>
            </summary>
            <div>
              <button className="soft-button compact-filter-toggle" onClick={() => setSelectedTypes(allTypeSelected ? [] : null)}>{allTypeSelected ? t("selectNoTypes") : t("selectAll")}</button>
              {typeOptions.map((type) => (
                <label key={type} className={operationTypeClass(type)}>
                  <input
                    type="checkbox"
                    checked={activeTypes.includes(type)}
                    onChange={(event) => {
                      const current = new Set(activeTypes);
                      if (event.target.checked) current.add(type);
                      else current.delete(type);
                      setSelectedTypes([...current]);
                    }}
                  />
                  <span>{operationTypeLabel(type, t)}</span>
                </label>
              ))}
            </div>
          </details>
          <button className="soft-button" onClick={onRefresh}>
            <RefreshCcw size={16} />
            {t("refresh")}
          </button>
          <button onClick={onClear}>{t("clearLogs")}</button>
        </div>
      </div>
      <div className="log-list">
        {filteredLogs.length ? filteredLogs.map((log) => (
          <article className={`log-entry ${log.status}`} key={log.id}>
            <div className="log-entry-head">
              <span className={operationTypeClass(log.type)}>{operationTypeLabel(log.type, t)}</span>
              <strong>{log.title || "-"}</strong>
              <em>{formatDate(log.createdAt)}</em>
            </div>
            <div className="event-status-row compact">
              <strong>{operationStatusLabel(log.status, t)}</strong>
            </div>
            <p>{operationMessageLabel(log.message, t)}</p>
            {log.detail ? <code>{shortPath(log.detail)}</code> : null}
          </article>
        )) : (
          <div className="list-empty">{t("noLogs")}</div>
        )}
      </div>
    </section>
  );
}

function OperationEventPage({ events, onRefresh, onClear }) {
  const { t } = useI18n();
  const [selectedTypes, setSelectedTypes] = useState(null);
  const [query, setQuery] = useState("");
  const stages = ["queued", "running", "success"];
  const typeOptions = useMemo(() => [...new Set(events.map((event) => normalizeOperationType(event.type)))], [events]);
  const activeTypes = selectedTypes === null ? typeOptions : selectedTypes;
  const allTypeSelected = typeOptions.length > 0 && activeTypes.length === typeOptions.length && typeOptions.every((type) => activeTypes.includes(type));
  const filteredEvents = useMemo(() => events.filter((event) => {
    if (!activeTypes.includes(normalizeOperationType(event.type))) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [event.type, event.status, event.title, event.detail, event.current, event.error].some((value) => String(value || "").toLowerCase().includes(q));
  }), [events, activeTypes, query]);
  function stageState(event, stage) {
    if (event.status === "failed") return stage === "success" ? "failed" : "done";
    const index = stages.indexOf(stage);
    const current = stages.indexOf(event.status);
    if (index < current) return "done";
    if (index === current) return "active";
    return "";
  }
  return (
    <section className="logs-page">
      <div className="settings-head">
        <div>
          <h2>{t("operationEvents")}</h2>
          <p>{t("operationEventsDesc")}</p>
        </div>
        <div className="log-actions">
          <input className="log-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchLogs")} />
          <details className="log-type-filter">
            <summary>
              <span>{t("logFilter")}</span>
            </summary>
            <div>
              <button className="soft-button compact-filter-toggle" onClick={() => setSelectedTypes(allTypeSelected ? [] : null)}>{allTypeSelected ? t("selectNoTypes") : t("selectAll")}</button>
              {typeOptions.map((type) => (
                <label key={type} className={operationTypeClass(type)}>
                  <input
                    type="checkbox"
                    checked={activeTypes.includes(type)}
                    onChange={(event) => {
                      const current = new Set(activeTypes);
                      if (event.target.checked) current.add(type);
                      else current.delete(type);
                      setSelectedTypes([...current]);
                    }}
                  />
                  <span>{operationTypeLabel(type, t)}</span>
                </label>
              ))}
            </div>
          </details>
          <button className="soft-button" onClick={onRefresh}>
            <RefreshCcw size={16} />
            {t("refresh")}
          </button>
          <button onClick={onClear}>{t("clearEvents")}</button>
        </div>
      </div>
      <div className="log-list">
        {filteredEvents.length ? filteredEvents.map((event) => {
          const percent = Math.round((event.progress / Math.max(1, event.total)) * 100);
          const eventDetail = operationDetailLabel(event.current || event.detail, t);
          return (
            <article className={`event-entry ${event.status}`} key={event.id}>
              <div className="log-entry-head">
                <span className={operationTypeClass(event.type)}>{operationTypeLabel(event.type, t)}</span>
                <strong>{event.title}</strong>
                <em>{formatDate(event.updatedAt)}</em>
              </div>
              <div className="event-status-row">
                <strong>{operationStatusLabel(event.status, t)}</strong>
                <b>{percent}%</b>
              </div>
              <div className="event-stage-flow">
                {stages.map((stage) => (
                  <div key={stage} className={stageState(event, stage)}>
                    <span />
                    <em>{operationStatusLabel(stage === "success" && event.status === "failed" ? "failed" : stage, t)}</em>
                  </div>
                ))}
              </div>
              <div className="event-progress">
                <div style={{ width: `${percent}%` }} />
              </div>
              <p>{operationStatusLabel(event.status, t)} · {event.progress}/{event.total}{eventDetail ? ` · ${eventDetail}` : ""}</p>
              {event.error ? <code>{event.error}</code> : event.detail ? <code>{event.detail}</code> : null}
            </article>
          );
        }) : (
          <div className="list-empty">{t("noEvents")}</div>
        )}
      </div>
    </section>
  );
}

function TagSkillPanel({ tag, skills, onOpenSkill }) {
  const { t } = useI18n();
  if (!tag) {
    return (
      <section className="detail empty">
        <Tags size={34} />
        <p>{t("selectTagHint")}</p>
      </section>
    );
  }
  return (
    <section className="tag-skill-panel">
      <div className="tag-skill-head">
        <TagPill tag={tag}>{t("tagLabel").replace("{tag}", tag)}</TagPill>
        <p>{skills.length} {t("tagContains")}</p>
      </div>
      <div className="tag-skill-list">
        {skills.map((skill) => (
          <button key={skill.id} className="tag-skill-card" onClick={() => onOpenSkill(skill)}>
            <div className="skill-glyph">{skill.name.slice(0, 1).toUpperCase()}</div>
            <span>
              <strong>{skill.name}</strong>
              <em>{skill.installationCount ? `${[...new Set((skill.installations || [skill]).map((copy) => copy.client))].join(", ")} · ${skill.installationCount} agents` : skill.client}</em>
              <small>{skill.description || t("noDescription")}</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function SearchConfig({ open, options, onChange }) {
  const { t } = useI18n();
  const fields = [
    ["name", t("searchName")],
    ["description", t("searchDescription")],
    ["tags", t("searchTags")],
    ["path", t("searchPath")],
    ["content", t("searchContent")]
  ];
  if (!open) return null;
  return (
    <div className="search-config-panel">
      <div className="search-config-title">{t("searchScope")}</div>
      {fields.map(([key, label]) => (
        <label key={key} className="search-check">
          <input
            type="checkbox"
            checked={Boolean(options[key])}
            onChange={(event) => onChange({ ...options, [key]: event.target.checked })}
          />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}

function searchPlaceholder(options, t) {
  const labels = [
    ["name", t("searchName")],
    ["description", t("searchDescription")],
    ["tags", t("tags")],
    ["path", t("searchPath")],
    ["content", t("searchContent")]
  ]
    .filter(([key]) => options[key])
    .map(([, label]) => label);
  const isEnglish = t("discover") === "Discover";
  const scope = labels.length ? labels.join(isEnglish ? ", " : "、") : t("searchName");
  return isEnglish ? `Search ${scope}, ${t("customSearch")}` : `搜索${scope}，${t("customSearch")}`;
}

function operationStatusLabel(status, t) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "queued") return t("statusQueued");
  if (normalized === "running") return t("statusRunning");
  if (normalized === "success") return t("statusSuccess");
  if (normalized === "failed") return t("statusFailed");
  if (normalized === "done") return t("statusDone");
  if (normalized === "skipped") return t("statusSkipped");
  if (normalized === "missing") return t("statusMissing");
  return status || t("typeUnknown");
}

function normalizeOperationType(type) {
  const normalized = String(type || "unknown").trim().toLowerCase();
  if (!normalized) return "unknown";
  if (normalized.includes("uninstall")) return "uninstall";
  if (normalized.includes("restore") || normalized.includes("recover")) return "recover";
  if (normalized.includes("update")) return "update";
  if (normalized.includes("sync")) return "sync";
  if (normalized.includes("settings") || normalized.includes("setting")) return "settings";
  if (normalized.includes("publish") || normalized.includes("version")) return "publish";
  if (normalized.includes("delete") || normalized.includes("clear")) return "delete";
  if (normalized.includes("install")) return "install";
  return normalized.replace(/[^a-z0-9-]+/g, "-") || "unknown";
}

function operationTypeClass(type) {
  return `op-type op-type-${normalizeOperationType(type)}`;
}

function operationTypeLabel(type, t) {
  const normalized = normalizeOperationType(type);
  if (normalized === "uninstall") return t("typeUninstall");
  if (normalized === "recover") return t("typeRecover");
  if (normalized === "update") return t("typeUpdate");
  if (normalized === "sync") return t("typeSync");
  if (normalized === "settings") return t("typeSettings");
  if (normalized === "publish") return t("typePublish");
  if (normalized === "delete") return t("typeDelete");
  if (normalized === "install") return t("typeInstall");
  return type || t("typeUnknown");
}

function operationDetailLabel(text, t) {
  if (!text) return "";
  if (text === "开始执行") return t("eventCurrentStarting");
  if (text === "完成") return t("eventCurrentDone");
  if (text === "失败") return t("eventCurrentFailed");
  return text;
}

function operationMessageLabel(message, t) {
  if (!message) return "";
  const exact = {
    "已移动到 Uninstalled。": "logMovedUninstalled",
    "已恢复安装。": "logRestoredInstall",
    "已复制安装到指定 Agent。": "logCopiedInstall",
    "已安装到指定 Agent。": "logInstalledTarget",
    "git 失败后，已通过 GitHub zip 安装到指定 Agent。": "logGitZipInstalled",
    "原目录不存在，已跳过卸载。": "logOriginalMissingSkipUninstall",
    "Uninstalled 目录不存在，已跳过恢复。": "logUninstalledMissingSkipRestore",
    "目标 Agent 已存在同名 skill，已按选择跳过。": "logTargetExistsSkipped",
    "目标 Agent 已存在同名 skill。": "logTargetExists",
    "目标 Agent 已经是当前目录。": "logTargetIsCurrent",
    "本地 skill 目录不存在，已跳过安装。": "logLocalMissingSkipInstall"
  };
  if (exact[message]) return t(exact[message]);
  let match = message.match(/^已切换到 (.+)。$/);
  if (match) return t("logSwitchedVersion").replace("{version}", match[1]);
  match = message.match(/^已删除 (\d+) 个历史版本。$/);
  if (match) return t("logDeletedHistory").replace("{count}", match[1]);
  match = message.match(/^跳过 (\d+) 个当前使用或不存在的版本。$/);
  if (match) return t("logSkippedCurrentMissingVersions").replace("{count}", match[1]);
  match = message.match(/^已发布版本 (.+)。$/);
  if (match) return t("logPublishedVersion").replace("{version}", match[1]);
  match = message.match(/^已同步到 (.+)。$/);
  if (match) return t("logSyncedTo").replace("{target}", match[1]);
  return message;
}

function App() {
  const { data, loading, error, refresh } = useSkillData();
  const [discoverSort, setDiscoverSort] = useState("alltime");
  const [installSourceMode, setInstallSourceMode] = useState("leaderboard");
  const discoverSource = discoverSort;
  const [uninstalledData, setUninstalledData] = useState(null);
  const [settings, setSettings] = useState(null);
  const [query, setQuery] = useState("");
  const [searchConfigOpen, setSearchConfigOpen] = useState(false);
  const searchConfigRef = useRef(null);
  const [searchOptions, setSearchOptions] = useState({
    name: true,
    description: true,
    tags: true,
    path: true,
    content: false
  });
  const [listMode, setListMode] = useState("installed");
  const discoverQuery = useDebouncedValue(listMode === "discover" && installSourceMode === "leaderboard" ? query.trim() : "", 260);
  const githubTrends = useGithubTrends(discoverSource, discoverQuery);
  const [localSort, setLocalSort] = useState("updated");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [tagCloudOpen, setTagCloudOpen] = useState(false);
  const tagFilterRef = useRef(null);
  const [activeTags, setActiveTags] = useState([]);
  const [tagMatchMode, setTagMatchMode] = useState("and");
  const [selected, setSelected] = useState(null);
  const [selectedUninstalledIds, setSelectedUninstalledIds] = useState([]);
  const [lastUninstalledSelectId, setLastUninstalledSelectId] = useState("");
  const [selectedDiscover, setSelectedDiscover] = useState(null);
  const [selectedStarred, setSelectedStarred] = useState(null);
  const [starSourceFilters, setStarSourceFilters] = useState(["all"]);
  const [starSourceOpen, setStarSourceOpen] = useState(false);
  const starSourceRef = useRef(null);
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedInstallTargets, setSelectedInstallTargets] = useState(["agents"]);
  const [dialogTargetIds, setDialogTargetIds] = useState(["agents"]);
  const [pendingInstall, setPendingInstall] = useState(null);
  const [pendingConflict, setPendingConflict] = useState(null);
  const [conflictActions, setConflictActions] = useState({});
  const [localImportOpen, setLocalImportOpen] = useState(false);
  const [localImportPath, setLocalImportPath] = useState("");
  const [localImportError, setLocalImportError] = useState("");
  const [localImportBusy, setLocalImportBusy] = useState(false);
  const [remoteInstallUrl, setRemoteInstallUrl] = useState("");
  const [remoteInstallName, setRemoteInstallName] = useState("");
  const [remoteInstallError, setRemoteInstallError] = useState("");
  const [remoteInstallBusy, setRemoteInstallBusy] = useState(false);
  const [starredMap, setStarredMap] = useState({});
  const [operationLogs, setOperationLogs] = useState([]);
  const [operationEvents, setOperationEvents] = useState([]);
  const [busyAction, setBusyAction] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeDuration, setNoticeDuration] = useState(1800);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [optimisticSources, setOptimisticSources] = useState(null);
  const lastSilentSkillRefreshRef = useRef(0);
  const lang = settings?.language === "en" ? "en" : "zh";
  const t = useMemo(() => createTranslator(lang), [lang]);
  const i18nValue = useMemo(() => ({ lang, t }), [lang, t]);

  function startWindowDrag(event) {
    if (event.button !== 0 || !window.skillStudio?.startWindowDrag) return;
    event.preventDefault();
    const toPoint = (mouseEvent) => ({ x: mouseEvent.screenX, y: mouseEvent.screenY });
    window.skillStudio.startWindowDrag(toPoint(event));
    const handleMove = (moveEvent) => {
      window.skillStudio?.moveWindowDrag?.(toPoint(moveEvent));
    };
    const handleEnd = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("blur", handleEnd);
      window.skillStudio?.endWindowDrag?.();
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("blur", handleEnd);
  }

  function toggleWindowMaximize(event) {
    if (!window.skillStudio?.toggleWindowMaximize) return;
    if (event.target.closest("button, input, select, textarea, a, details, summary, [data-no-drag]")) return;
    window.skillStudio.toggleWindowMaximize();
  }

  async function refreshAll(options = {}) {
    await refresh(options);
    try {
      setUninstalledData(await window.skillStudio.scanUninstalled());
    } catch {
      setUninstalledData({ skills: [] });
    }
    await refreshLogs();
  }

  async function refreshCurrentLists() {
    if (listMode === "discover") {
      await githubTrends.refresh?.();
      return;
    }
    await refreshAll();
  }

  async function refreshLogs() {
    try {
      setOperationLogs(await window.skillStudio.operationLogs());
    } catch {
      setOperationLogs([]);
    }
  }

  async function refreshEvents() {
    try {
      setOperationEvents(await window.skillStudio.operationEvents());
    } catch {
      setOperationEvents([]);
    }
  }

  async function clearLogs() {
    if (!window.confirm(t("clearLogsConfirm"))) return;
    await window.skillStudio.clearOperationLogs();
    setOperationLogs([]);
  }

  async function clearEvents() {
    if (!window.confirm(t("clearEventsConfirm"))) return;
    await window.skillStudio.clearOperationEvents();
    setOperationEvents([]);
  }

  useEffect(() => {
    setStarredMap(readStoredJson(starStorageKey, legacyStarStorageKey, {}));
    window.skillStudio.scanUninstalled().then(setUninstalledData).catch(() => setUninstalledData({ skills: [] }));
    refreshLogs();
    refreshEvents();
    window.skillStudio.getSettings().then((result) => {
      setSettings(result);
      setOptimisticSources(result.sources || null);
      const remembered = readStoredJson(installTargetsStorageKey, legacyInstallTargetsStorageKey, []);
      const initialTargets = result.installTargetMode === "remember-last" && remembered.length ? remembered : [result.installSourceId || "agents"];
      setSelectedInstallTargets(initialTargets);
      setDialogTargetIds(initialTargets);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!window.skillStudio.onLanguageChanged) return undefined;
    return window.skillStudio.onLanguageChanged((nextLanguage) => {
      setSettings((current) => ({
        ...(current || {}),
        language: nextLanguage === "en" ? "en" : "zh"
      }));
      setOptimisticSources((current) => current);
    });
  }, []);

  useEffect(() => {
    if (!window.skillStudio.onOpenSettings) return undefined;
    return window.skillStudio.onOpenSettings(() => {
      setListMode("settings");
    });
  }, []);

  useEffect(() => {
    if (!window.skillStudio.onSkillsChanged) return undefined;
    let timer = 0;
    const unsubscribe = window.skillStudio.onSkillsChanged(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        refreshAll({ silent: true });
        refreshEvents();
      }, 700);
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => {
      setNotice("");
      setNoticeDuration(1800);
    }, noticeDuration);
    return () => window.clearTimeout(timer);
  }, [notice, noticeDuration]);

  useEffect(() => {
    if (!starSourceOpen) return undefined;
    const close = (event) => {
      if (!starSourceRef.current?.contains(event.target)) setStarSourceOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [starSourceOpen]);

  useEffect(() => {
    if (!tagCloudOpen) return undefined;
    const close = (event) => {
      if (!tagFilterRef.current?.contains(event.target)) setTagCloudOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [tagCloudOpen]);

  useEffect(() => {
    if (!searchConfigOpen) return undefined;
    const close = (event) => {
      if (!searchConfigRef.current?.contains(event.target)) setSearchConfigOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [searchConfigOpen]);

  useEffect(() => {
    const closeOpenDetails = (event) => {
      document.querySelectorAll("details[open]").forEach((node) => {
        if (!node.contains(event.target)) node.removeAttribute("open");
      });
    };
    const closeOpenDetailsOnEscape = (event) => {
      if (event.key !== "Escape") return;
      document.querySelectorAll("details[open]").forEach((node) => node.removeAttribute("open"));
    };
    window.addEventListener("pointerdown", closeOpenDetails);
    window.addEventListener("keydown", closeOpenDetailsOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOpenDetails);
      window.removeEventListener("keydown", closeOpenDetailsOnEscape);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(async () => {
      await refreshEvents();
      const hasRunning = operationEvents.some((event) => event.status === "queued" || event.status === "running");
      const now = Date.now();
      if (hasRunning && now - lastSilentSkillRefreshRef.current > 6500) {
        lastSilentSkillRefreshRef.current = now;
        await refreshAll({ silent: true });
      }
    }, 1600);
    return () => window.clearInterval(timer);
  }, [operationEvents]);

  function saveStarred(next) {
    setStarredMap(next);
    localStorage.setItem(starStorageKey, JSON.stringify(next));
  }

  function pruneLocalStarred(next = starredMap) {
    const installedReady = !loading && Array.isArray(data?.skills);
    const uninstalledReady = Array.isArray(uninstalledData?.skills);
    if (!installedReady && !uninstalledReady) return next;
    const installedGroups = installedReady
      ? new Set((data.skills || []).map((skill) => skillGroupKey(skill)))
      : null;
    const uninstalledGroups = uninstalledReady
      ? new Set((uninstalledData.skills || []).map((skill) => skillGroupKey(skill)))
      : null;
    let changed = false;
    const pruned = {};
    Object.entries(next || {}).forEach(([key, entry]) => {
      const item = entry?.item || entry;
      const type = normalizeStarType(entry?.type, item);
      const group = skillGroupKey(item);
      const missingInstalled = type === "installed" && installedGroups && !installedGroups.has(group);
      const missingUninstalled = type === "uninstalled" && uninstalledGroups && !uninstalledGroups.has(group);
      if (missingInstalled || missingUninstalled) {
        changed = true;
        return;
      }
      pruned[key] = entry;
    });
    if (changed) saveStarred(pruned);
    return changed ? pruned : next;
  }

  function toggleStar(type, item) {
    const snapshot = starSnapshot(type, item);
    const next = { ...starredMap };
    const groupKey = starGroupKey(type, item);
    const matchedKeys = Object.values(next)
      .filter((entry) => entry.type === type && starGroupKey(entry.type, entry.item) === groupKey)
      .map((entry) => entry.key);
    if (next[snapshot.key] || matchedKeys.length) {
      [snapshot.key, ...matchedKeys].forEach((key) => delete next[key]);
    } else {
      next[snapshot.key] = snapshot;
    }
    saveStarred(next);
  }

  useEffect(() => {
    pruneLocalStarred(starredMap);
  }, [data?.skills, uninstalledData?.skills, loading]);

  function isStarred(type, item) {
    const directKey = starKey(type, item);
    if (starredMap[directKey]) return true;
    const groupKey = starGroupKey(type, item);
    return Object.values(starredMap).some((entry) => entry.type === type && starGroupKey(entry.type, entry.item) === groupKey);
  }

  function unstarEntry(entry) {
    const key = entry?.storageKey || entry?.key || starKey(entry?.type, entry?.item);
    const next = { ...starredMap };
    const keys = entry?.storageKeys?.length ? entry.storageKeys : [key];
    keys.forEach((itemKey) => delete next[itemKey]);
    saveStarred(next);
  }

  function toggleStarSourceFilter(source) {
    setStarSourceFilters((current) => {
      const allSources = starSourceOptions.map(([value]) => value);
      const allSelected = current.includes("all") || allSources.every((item) => current.includes(item));
      if (source === "all") return allSelected ? [] : ["all"];
      if (current.includes("all")) {
        const next = allSources.filter((item) => item !== source);
        return next.length === allSources.length ? ["all"] : next;
      }
      const withoutAll = current.filter((item) => item !== "all");
      const next = withoutAll.includes(source)
        ? withoutAll.filter((item) => item !== source)
        : [...withoutAll, source];
      if (next.length === allSources.length) return ["all"];
      return next;
    });
  }

  async function uninstallSkill(skill, skipConfirm = false) {
    const copies = skill.installations || [skill];
    const confirmed = skipConfirm || window.confirm(t("uninstallConfirm").replace("{name}", skill.name));
    if (!confirmed) return false;
    try {
      await window.skillStudio.submitEvent({
        type: "uninstall",
        title: skill.name,
        skills: copies.map((copy) => ({
          dir: copy.dir,
          client: copy.client,
          sourceId: copy.sourceId,
          sourceLabel: copy.sourceLabel
        }))
      });
      await refreshEvents();
      setNotice(t("submittedUninstall").replace("{name}", skill.name));
      return true;
    } catch (err) {
      setNotice(t("submitFailed").replace("{message}", err.message || String(err)));
      return false;
    }
  }

  function defaultTargetSelection() {
    if (settings?.installTargetMode === "always-default") return [settings.installSourceId || "agents"];
    return selectedInstallTargets.length ? selectedInstallTargets : [settings?.installSourceId || "agents"];
  }

  function openInstallDialog(type, item, targets = installTargets, extras = {}) {
    const preferredTargets = Array.isArray(extras.defaultTargetIds) && extras.defaultTargetIds.length
      ? extras.defaultTargetIds
      : defaultTargetSelection();
    const nextTargets = preferredTargets.filter((id) => targets.some((target) => target.id === id));
    setDialogTargetIds(nextTargets.length ? nextTargets : targets.slice(0, 1).map((target) => target.id));
    const { defaultTargetIds: _defaultTargetIds, ...dialogExtras } = extras;
    setPendingInstall({ type, item, targets, ...dialogExtras });
  }

  function installTargetsWithInstalledVersions(item) {
    const key = skillGroupKey(item);
    const installed = (data?.skills || []).filter((skill) => skillGroupKey(skill) === key);
    return installTargets.map((target) => {
      const match = installed.find((skill) => skill.sourceId === target.id || skill.client === target.client);
      return {
        ...target,
        installed: Boolean(match),
        skill: match || null,
        version: match ? skillVersion(match) : "",
        versionLabel: match ? skillVersionLabel(match) : ""
      };
    });
  }

  function beginInstallDiscover(item, forceUpdate = false) {
    const installed = installedForDiscover(item);
    const targets = installTargets.map((target) => {
      const match = installed.find((skill) => skill.sourceId === target.id || skill.client === target.client);
      return {
        ...target,
        installed: Boolean(match),
        skill: match || null,
        version: match ? skillVersion(match) : "",
        versionLabel: match ? skillVersionLabel(match) : ""
      };
    });
    openInstallDialog("discover", item, targets, { forceUpdate });
  }

  function beginRestoreSkill(skill) {
    const targets = installTargetsWithInstalledVersions(skill);
    const records = skill.installations || [skill];
    const defaultTargetIds = [...new Set(records.map((record) => {
      const sourceId = record.uninstallMeta?.sourceId || record.sourceId;
      const sourceClient = record.uninstallMeta?.sourceClient || record.uninstallMeta?.sourceLabel || record.client;
      const target = targets.find((item) => item.id === sourceId)
        || targets.find((item) => item.client === sourceClient);
      return target?.id;
    }).filter(Boolean))];
    openInstallDialog("uninstalled", skill, targets, { defaultTargetIds });
  }

  function beginRecoverOriginalAgent(skill) {
    const targets = installTargetsWithInstalledVersions(skill);
    const sourceId = skill.uninstallMeta?.sourceId || skill.sourceId;
    const sourceClient = skill.uninstallMeta?.sourceClient || skill.uninstallMeta?.sourceLabel || skill.client;
    const target = targets.find((item) => item.id === sourceId)
      || targets.find((item) => item.client === sourceClient)
      || targets[0];
    if (!target) return;
    openInstallDialog("uninstalled", skill, [target]);
    setDialogTargetIds([target.id]);
  }

  function beginInstallLocal(skill) {
    openInstallDialog("local", skill, installTargetsWithInstalledVersions(skill));
  }

  function openLocalImportDialog() {
    setLocalImportError("");
    setLocalImportOpen(true);
  }

  function closeLocalImportDialog() {
    if (localImportBusy) return;
    setLocalImportOpen(false);
    setLocalImportError("");
  }

  async function beginLocalImportFromItem(item) {
    if (!item?.dir) return;
    setLocalImportOpen(false);
    setLocalImportError("");
    beginInstallLocal({
      ...item,
      id: item.id || `local-import:${item.dir}`,
      description: item.description || t("noDescription")
    });
  }

  async function chooseLocalImportDirectory() {
    setLocalImportBusy(true);
    setLocalImportError("");
    try {
      const item = await window.skillStudio.chooseLocalSkillDirectory();
      if (!item) return;
      setLocalImportPath(item.originalPath || item.dir || "");
      await beginLocalImportFromItem(item);
    } catch (err) {
      setLocalImportError(t("importLocalInvalid").replace("{message}", err.message || String(err)));
    } finally {
      setLocalImportBusy(false);
    }
  }

  async function confirmLocalImportPath() {
    const nextPath = localImportPath.trim();
    if (!nextPath) return;
    setLocalImportBusy(true);
    setLocalImportError("");
    try {
      const item = await window.skillStudio.inspectLocalSkill(nextPath);
      await beginLocalImportFromItem(item);
    } catch (err) {
      setLocalImportError(t("importLocalInvalid").replace("{message}", err.message || String(err)));
    } finally {
      setLocalImportBusy(false);
    }
  }

  async function confirmRemoteInstall() {
    const url = remoteInstallUrl.trim();
    if (!url) return;
    setRemoteInstallBusy(true);
    setRemoteInstallError("");
    try {
      const name = (remoteInstallName.trim() || remoteSkillNameFromUrl(url)).trim();
      if (!name) throw new Error(t("remoteSkillName"));
      beginInstallDiscover({
        id: `remote:${url}:${name}`,
        name,
        fullName: url,
        description: `${name} from ${url}`,
        url,
        repositoryUrl: url,
        source: "remote",
        sourceLabel: "Remote",
        sourceName: url,
        sourceUrl: url,
        installCommand: `git clone --depth 1 ${url}`,
        installMethod: remoteInstallMethodFromUrl(url),
        stars: 0,
        language: "Agent skill",
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      setRemoteInstallError(t("remoteInstallInvalid").replace("{message}", err.message || String(err)));
    } finally {
      setRemoteInstallBusy(false);
    }
  }

  function beginUninstallMany(item, skills) {
    const targets = skills.map((skill) => ({
      id: skill.id,
      client: skill.client,
      root: skill.dir,
      dir: skill.dir,
      skill,
      installed: true,
      version: skillVersion(skill),
      versionLabel: skillVersionLabel(skill)
    }));
    const remembered = readStoredJson(uninstallTargetsStorageKey, null, []);
    const validRemembered = remembered.filter((id) => targets.some((target) => target.id === id));
    setDialogTargetIds(validRemembered.length ? validRemembered : targets.map((target) => target.id));
    setPendingInstall({ type: "uninstall", item, targets });
  }

  function beginDeleteUninstalledRecords(item, options = {}) {
    const items = Array.isArray(item) ? item : (item ? [item] : []);
    const targets = options.skillScope
      ? items.map((entry) => {
        const records = entry?.installations || (entry ? [entry] : []);
        return {
          id: entry.id || skillGroupKey(entry),
          client: entry.name,
          root: t("agentRecords").replace("{count}", records.length),
          dirs: records.map((record) => record.dir).filter(Boolean),
          skill: entry,
          recordScope: "skill",
          disabled: !records.length
        };
      })
      : items.flatMap((entry) => entry?.installations || (entry ? [entry] : [])).map((skill) => ({
        id: skill.id,
        client: skill.uninstallMeta?.sourceClient || skill.uninstallMeta?.sourceLabel || skill.client,
        root: skill.dir,
        dir: skill.dir,
        skill,
        version: skillVersion(skill),
        versionLabel: skillVersionLabel(skill)
      }));
    if (!targets.length) return;
    setDialogTargetIds(targets.map((target) => target.id));
    setPendingInstall({ type: "delete-uninstalled", item, targets });
  }

  function toggleUninstalledSelection(skill, event = {}) {
    if (!skill?.id) return;
    const ids = uninstalledFiltered.map((item) => item.id);
    setSelectedUninstalledIds((current) => {
      if (event.shiftKey && lastUninstalledSelectId) {
        const start = ids.indexOf(lastUninstalledSelectId);
        const end = ids.indexOf(skill.id);
        if (start >= 0 && end >= 0) {
          const [from, to] = start < end ? [start, end] : [end, start];
          const range = ids.slice(from, to + 1);
          return [...new Set([...(event.metaKey || event.ctrlKey ? current : []), ...range])];
        }
      }
      if (current.includes(skill.id)) return current.filter((id) => id !== skill.id);
      return [...current, skill.id];
    });
    setLastUninstalledSelectId(skill.id);
  }

  function selectedUninstalledItems() {
    return uninstalledFiltered.filter((skill) => selectedUninstalledIds.includes(skill.id));
  }

  async function clearUninstalledRecords(items) {
    const skillItems = (Array.isArray(items) ? items : (items ? [items] : []))
      .filter(Boolean);
    const records = skillItems
      .flatMap((entry) => entry?.installations || (entry ? [entry] : []));
    const dirs = records.map((record) => record.dir).filter(Boolean);
    if (!dirs.length) return;
    const confirmed = window.confirm(t("clearUninstalledConfirm").replace("{count}", skillItems.length));
    if (!confirmed) return;
    setBusyAction("delete-uninstalled:direct");
    try {
      await window.skillStudio.deleteUninstalledRecords(dirs);
      await refreshAll();
      setSelected(null);
      setSelectedUninstalledIds([]);
      setLastUninstalledSelectId("");
      setNotice(t("clearUninstalledDone").replace("{count}", skillItems.length));
    } catch (err) {
      setNotice(t("clearFailed").replace("{message}", err.message || String(err)));
    } finally {
      setBusyAction("");
    }
  }

  function restoreRecordForTarget(item, target) {
    const records = item?.installations || (item ? [item] : []);
    return records.find((record) => {
      const sourceId = record.uninstallMeta?.sourceId || record.sourceId;
      const sourceClient = record.uninstallMeta?.sourceClient || record.uninstallMeta?.sourceLabel || record.client;
      return sourceId === target?.id || sourceClient === target?.client;
    }) || null;
  }

  function buildInstallConflicts(pending, targetIds) {
    if (!["discover", "local", "uninstalled"].includes(pending?.type)) return [];
    const incomingVersion = skillVersion(pending.item);
    return (pending.targets || [])
      .filter((target) => targetIds.includes(target.id) && target.installed)
      .map((target) => {
        const restoreRecord = pending.type === "uninstalled" ? restoreRecordForTarget(pending.item, target) : null;
        const currentVersion = target.version || "";
        const targetIncomingVersion = restoreRecord ? skillVersion(restoreRecord) : incomingVersion;
        const currentVersionLabel = targetVersionLabel(target);
        const incomingVersionLabel = restoreRecord ? skillVersionLabel(restoreRecord) : (targetIncomingVersion ? `v${targetIncomingVersion}` : "");
        const versionCompare = targetIncomingVersion && currentVersion ? compareVersionAsc(targetIncomingVersion, currentVersion) : null;
        const existingDir = target.skill?.dir || "";
        const incomingDir = pending.type === "discover" ? "" : (restoreRecord?.dir || pending.item?.dir || "");
        const warning = !targetIncomingVersion || !currentVersion
          ? t("versionUnknownNoCompare")
          : versionCompare < 0
            ? t("possibleDowngrade")
            : "";
        return {
          ...target,
          currentVersion: currentVersionLabel || (currentVersion ? `v${currentVersion}` : ""),
          incomingVersion: incomingVersionLabel || (targetIncomingVersion ? `v${targetIncomingVersion}` : ""),
          warning,
          defaultAction: pending.type === "discover" && pending.forceUpdate ? "replace" : "skip",
          sourceLabel: pending.type === "uninstalled" ? "Recover" : pending.type === "discover" ? "Discover" : "Local",
          existingDir,
          incomingDir,
          canDiff: pending.type !== "discover" && Boolean(existingDir && incomingDir)
        };
      });
  }

  async function viewInstallConflictDiff(conflict) {
    if (!conflict?.canDiff) return;
    try {
      const result = await window.skillStudio.diffDirs({
        beforeDir: conflict.existingDir,
        afterDir: conflict.incomingDir
      });
      const files = result.files || [];
      const summary = files.reduce((acc, file) => {
        acc[file.type] = (acc[file.type] || 0) + 1;
        return acc;
      }, {});
      const preview = files.slice(0, 12).map((file) => `- ${file.type}: ${file.path}`).join("\n");
      window.alert(`${t("directoryDiffAlertTitle").replace("{client}", conflict.client)}\n${t("added")} ${summary.added || 0} · ${t("removed")} ${summary.deleted || 0} · ${t("modified")} ${summary.modified || 0}\n\n${preview || t("noTextDiff")}`);
    } catch (err) {
      setNotice(t("diffFailed").replace("{message}", err.message || String(err)));
    }
  }

  function eventPayloadForPending(pending, targetIds, actions = {}) {
    return pending.type === "discover" ? {
      type: "install-discover",
      title: pending.item.name,
      item: pending.item,
      targetIds,
      forceUpdate: pending.forceUpdate,
      conflictActions: actions
    } : pending.type === "local" ? {
      type: "install-local",
      title: pending.item.name,
      skillName: pending.item.name,
      skillDir: pending.item.dir,
      targetIds,
      conflictActions: actions
    } : pending.type === "uninstalled" ? {
      type: "restore",
      title: pending.item.name,
      skillName: pending.item.name,
      skillDir: pending.item.dir,
      targetIds,
      restoreRecords: Object.fromEntries(targetIds.map((targetId) => {
        const target = pending.targets?.find((item) => item.id === targetId);
        const record = restoreRecordForTarget(pending.item, target);
        return [targetId, record?.dir || ""];
      })),
      conflictActions: actions
    } : {
      type: "uninstall",
      title: pending.item.name,
      skills: pending.targets.filter((target) => targetIds.includes(target.id)).map((target) => ({
        dir: target.skill.dir,
        client: target.skill.client,
        sourceId: target.skill.sourceId,
        sourceLabel: target.skill.sourceLabel
      }))
    };
  }

  async function submitPendingOperation(pending, targetIds, actions = {}) {
    const eventPayload = eventPayloadForPending(pending, targetIds, actions);
    try {
      await window.skillStudio.submitEvent(eventPayload);
      if (pending.type === "uninstall") {
        localStorage.setItem(uninstallTargetsStorageKey, JSON.stringify(targetIds));
      } else if (settings?.installTargetMode !== "always-default") {
        setSelectedInstallTargets(targetIds);
        localStorage.setItem(installTargetsStorageKey, JSON.stringify(targetIds));
      }
      setPendingInstall(null);
      setPendingConflict(null);
      setConflictActions({});
      await refreshEvents();
      setNotice(t("submittedBackground").replace("{name}", pending.item.name));
    } catch (err) {
      setNotice(t("submitFailed").replace("{message}", err.message || String(err)));
    }
  }

  async function confirmPendingInstall() {
    if (!pendingInstall) return;
    const targetIds = dialogTargetIds.filter((id) => pendingInstall.targets?.some((target) => target.id === id));
    if (!targetIds.length) return;
    if (pendingInstall.type === "delete-uninstalled") {
      const targets = pendingInstall.targets?.filter((target) => targetIds.includes(target.id)) || [];
      const confirmed = window.confirm(t("deleteUninstalledConfirm").replace("{count}", targets.length));
      if (!confirmed) return;
      setBusyAction(`delete-uninstalled:${pendingInstall.item?.id || "batch"}`);
      try {
        const dirs = targets.flatMap((target) => target.dirs || target.dir || []).filter(Boolean);
        await window.skillStudio.deleteUninstalledRecords(dirs);
        setPendingInstall(null);
        await refreshAll();
        setSelected(null);
        setSelectedUninstalledIds([]);
        setLastUninstalledSelectId("");
        setNotice(t("deletedUninstalledDone").replace("{count}", dirs.length));
      } catch (err) {
        setNotice(t("deleteFailed").replace("{message}", err.message || String(err)));
      } finally {
        setBusyAction("");
      }
      return;
    }
    const conflicts = buildInstallConflicts(pendingInstall, targetIds);
    if (conflicts.length) {
      const defaults = Object.fromEntries(conflicts.map((conflict) => [conflict.id, conflict.defaultAction]));
      setConflictActions(defaults);
      setPendingConflict({ pending: pendingInstall, targetIds, conflicts });
      return;
    }
    await submitPendingOperation(pendingInstall, targetIds, {});
  }

  async function restoreSkill(skill, targetSourceId = selectedInstallTargets[0]) {
    setBusyAction(`restore:${skill.id}`);
    setNotice("");
    try {
      const result = await window.skillStudio.restoreSkill(skill.dir, targetSourceId);
      await refreshAll();
      setListMode("installed");
      setSelected(null);
      setNotice(result?.missing ? t("recoverMissing").replace("{name}", skill.name) : t("recoverDone").replace("{name}", skill.name));
    } catch (err) {
      setNotice(t("recoverFailed").replace("{message}", err.message || String(err)));
    } finally {
      setBusyAction("");
    }
  }

  async function installDiscover(item, targetSourceId = selectedInstallTargets[0]) {
    setBusyAction(`discover:${item.id}`);
    setNotice("");
    try {
      const result = await window.skillStudio.installDiscover(item, targetSourceId);
      await refreshAll();
      setNotice(result?.alreadyInstalled ? t("alreadyInstalled").replace("{name}", item.name) : t("installDone").replace("{name}", item.name));
    } catch (err) {
      setNotice(t("installFailed").replace("{message}", err.message || String(err)));
    } finally {
      setBusyAction("");
    }
  }

  async function installLocalSkill(skill, targetSourceId) {
    setBusyAction(`install-local:${skill.id}:${targetSourceId}`);
    setNotice("");
    try {
      const result = await window.skillStudio.installLocalSkill(skill.dir, targetSourceId);
      await refreshAll();
      setNotice(result?.alreadyInstalled ? t("alreadyInstalled").replace("{name}", skill.name) : t("installDone").replace("{name}", skill.name));
    } catch (err) {
      setNotice(t("installFailed").replace("{message}", err.message || String(err)));
    } finally {
      setBusyAction("");
    }
  }

  async function installDiscoverMany(item, targetIds, forceUpdate = false) {
    let ok = 0;
    setBusyAction(`discover:${item.id}`);
    setNotice("");
    try {
      for (const targetId of targetIds) {
        await window.skillStudio.installDiscover(item, targetId, forceUpdate);
        ok += 1;
      }
      await refreshAll();
      setNotice(t("installOrUpdateDone").replace("{name}", item.name).replace("{action}", forceUpdate ? t("update") : t("install")).replace("{count}", ok));
    } catch (err) {
      await refreshAll();
      setNotice(t("installFailed").replace("{message}", err.message || String(err)));
    } finally {
      setBusyAction("");
    }
  }

  async function installLocalMany(skill, targetIds) {
    let ok = 0;
    setBusyAction(`install-local:${skill.id}`);
    setNotice("");
    try {
      for (const targetId of targetIds) {
        await window.skillStudio.installLocalSkill(skill.dir, targetId);
        ok += 1;
      }
      await refreshAll();
      setNotice(t("installedToAgents").replace("{name}", skill.name).replace("{count}", ok));
    } catch (err) {
      await refreshAll();
      setNotice(t("installFailed").replace("{message}", err.message || String(err)));
    } finally {
      setBusyAction("");
    }
  }

  async function restoreSkillMany(skill, targetIds) {
    let ok = 0;
    setBusyAction(`restore:${skill.id}`);
    setNotice("");
    try {
      for (let index = 0; index < targetIds.length; index += 1) {
        const targetId = targetIds[index];
        const target = installTargets.find((item) => item.id === targetId);
        const record = restoreRecordForTarget(skill, target);
        if (record?.dir) await window.skillStudio.restoreSkill(record.dir, targetId);
        else await window.skillStudio.installLocalSkill(skill.dir, targetId);
        ok += 1;
      }
      await refreshAll();
      setListMode("installed");
      setSelected(null);
      setNotice(t("recoveredToAgents").replace("{name}", skill.name).replace("{count}", ok));
    } catch (err) {
      await refreshAll();
      setNotice(t("recoverFailed").replace("{message}", err.message || String(err)));
    } finally {
      setBusyAction("");
    }
  }

  async function uninstallMany(skills) {
    if (!skills.length) return;
    const confirmed = window.confirm(t("uninstallSelectedConfirm").replace("{count}", skills.length));
    if (!confirmed) return;
    setBusyAction(`uninstall-many:${skills.map((skill) => skill.id).join(",")}`);
    setNotice("");
    let ok = 0;
    try {
      for (const skill of skills) {
        await window.skillStudio.uninstallSkill(skill.dir, {
          client: skill.client,
          sourceId: skill.sourceId,
          sourceLabel: skill.sourceLabel
        });
        ok += 1;
      }
      await refreshAll();
      setSelected(null);
      setNotice(t("uninstalledCopiesDone").replace("{count}", ok));
    } catch (err) {
      await refreshAll();
      setNotice(t("uninstallFailed").replace("{message}", err.message || String(err)));
    } finally {
      setBusyAction("");
    }
  }

  async function saveSettings(nextSettings) {
    setSettingsSaving(true);
    setNotice("");
    try {
      const beforeSettings = settings;
      const saved = await window.skillStudio.saveSettings(nextSettings);
      setSettings(saved);
      setOptimisticSources(saved.sources || null);
      if (saved.installTargetMode === "always-default") {
        const defaults = [saved.installSourceId || "agents"];
        setSelectedInstallTargets(defaults);
        setDialogTargetIds(defaults);
      }
      refreshLogs();
      const needsSkillRefresh = JSON.stringify(beforeSettings?.sources || []) !== JSON.stringify(saved.sources || [])
        || JSON.stringify(beforeSettings?.ignorePatterns || []) !== JSON.stringify(saved.ignorePatterns || [])
        || beforeSettings?.mergeDuplicateSkills !== saved.mergeDuplicateSkills;
      if (needsSkillRefresh) refreshAll();
      return saved;
    } catch (err) {
      setNotice(t("settingsSaveFailed").replace("{message}", err.message || String(err)));
      throw err;
    } finally {
      setSettingsSaving(false);
    }
  }

  const agentCounts = useMemo(() => {
    const sources = optimisticSources?.length ? optimisticSources : settings?.sources?.length ? settings.sources : data?.sources || [];
    return orderedAgentCounts(sources, data?.skills || []);
  }, [optimisticSources, settings, data]);

  const installedFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (data?.skills || []).filter((skill) => {
      const sourceOk = sourceFilter === "all" || skill.client === sourceFilter;
      if (!sourceOk) return false;
      if (activeTags.length) {
        const skillTags = skill.tags || [];
        const tagOk = tagMatchMode === "or"
          ? activeTags.some((tag) => skillTags.includes(tag))
          : activeTags.every((tag) => skillTags.includes(tag));
        if (!tagOk) return false;
      }
      return matchesSearchFields(localSkillSearchValues(skill, searchOptions), q);
    });
    const visible = sourceFilter === "all" && settings?.mergeDuplicateSkills !== false ? mergeSkillCopies(matches) : matches;
    return visible.sort((a, b) => {
      if (localSort === "alpha") return a.name.localeCompare(b.name);
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
  }, [data, query, sourceFilter, activeTags, tagMatchMode, localSort, searchOptions, settings]);

  const tagCounts = useMemo(() => {
    const map = new Map();
    const source = listMode === "uninstalled"
      ? (uninstalledData?.skills || [])
      : listMode === "starred"
        ? Object.values(starredMap).map((entry) => entry.item).filter(Boolean)
        : (data?.skills || []);
    source.forEach((skill) => {
      if (listMode === "installed" && sourceFilter !== "all" && skill.client !== sourceFilter) return;
      skillTags(skill).forEach((tag) => {
        if (!tag) return;
        map.set(tag, (map.get(tag) || 0) + 1);
      });
    });
    return [...map.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [data, uninstalledData, starredMap, listMode, sourceFilter]);

  const allTagCounts = useMemo(() => {
    const map = new Map();
    (data?.skills || []).forEach((skill) => {
      (skill.tags || []).forEach((tag) => {
        if (!tag) return;
        map.set(tag, (map.get(tag) || 0) + 1);
      });
    });
    return [...map.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [data]);

  const selectedTagSkills = useMemo(() => {
    if (!selectedTag) return [];
    const matches = (data?.skills || []).filter((skill) => (skill.tags || []).includes(selectedTag));
    const visible = settings?.mergeDuplicateSkills !== false ? mergeSkillCopies(matches) : matches;
    return visible.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }, [data, selectedTag, settings]);

  const uninstalledFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (uninstalledData?.skills || []).filter((skill) => {
      if (activeTags.length) {
        const tags = skillTags(skill);
        const tagOk = tagMatchMode === "or"
          ? activeTags.some((tag) => tags.includes(tag))
          : activeTags.every((tag) => tags.includes(tag));
        if (!tagOk) return false;
      }
      return matchesSearchFields(localSkillSearchValues(skill, searchOptions), q);
    });
    const latestBySource = new Map();
    matches.forEach((skill) => {
      const sourceKey = skill.uninstallMeta?.sourceId || skill.uninstallMeta?.sourceClient || skill.client || skill.sourceId || "unknown";
      const key = `${skillGroupKey(skill)}:${sourceKey}`;
      const existing = latestBySource.get(key);
      if (!existing || new Date(skillJoinTime(skill) || 0) > new Date(skillJoinTime(existing) || 0)) latestBySource.set(key, skill);
    });
    const latest = [...latestBySource.values()];
    const visible = mergeSkillCopies(latest);
    return visible.sort((a, b) => groupedJoinTime(b) - groupedJoinTime(a));
  }, [uninstalledData, query, activeTags, tagMatchMode, searchOptions]);

  const discoverItems = useMemo(() => {
    return githubTrends.items
      .sort((a, b) => (a.rank || 999999) - (b.rank || 999999) || b.stars - a.stars);
  }, [githubTrends.items, discoverSource, discoverQuery]);

  const discoverInstalledMap = useMemo(() => {
    const map = new Map();
    (data?.skills || []).forEach((skill) => {
      const key = discoverInstallKey(skill);
      if (!key) return;
      const existing = map.get(key) || [];
      existing.push(skill);
      map.set(key, existing);
    });
    return map;
  }, [data]);

  function installedForDiscover(item) {
    return uniqueInstalledSkills(discoverInstalledMap.get(discoverInstallKey(item)) || []);
  }

  const visibleDiscoverItems = discoverItems;
  const starredItems = useMemo(() => Object.values(starredMap).map((entry) => {
    const item = entry.item || entry;
    return {
      ...entry,
      item,
      type: normalizeStarType(entry.type, item)
    };
  }), [starredMap]);
  const starredFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const groups = new Map();
    starredItems.forEach((entry) => {
      const key = starGroupKey(entry.type, entry.item);
      const group = groups.get(key) || [];
      group.push(entry);
      groups.set(key, group);
    });
    const refreshedEntries = [...groups.values()].flatMap((entries) => {
      const sortedEntries = [...entries].sort((a, b) => new Date(b.createdAt || skillJoinTime(b.item) || 0) - new Date(a.createdAt || skillJoinTime(a.item) || 0));
      const first = sortedEntries[0];
      const storageKeys = sortedEntries.map((entry) => entry.key).filter(Boolean);
      const createdAt = first.createdAt || skillJoinTime(first.item) || "";
      if (first.type === "discover") {
        return [{
          ...first,
          createdAt,
          storageKeys,
          item: first.item
        }];
      }
      const pool = first.type === "uninstalled" ? (uninstalledData?.skills || []) : (data?.skills || []);
      const groupKey = skillGroupKey(first.item);
      const matches = pool.filter((skill) => skillGroupKey(skill) === groupKey);
      const items = matches.length ? mergeSkillCopies(matches) : [first.item];
      return items.map((item) => ({
        ...first,
        createdAt,
        storageKeys,
        item
      }));
    });
    const filtered = refreshedEntries.filter((entry) => {
      if (!starSourceFilters.includes("all") && !starSourceFilters.includes(entry.type)) return false;
      if (activeTags.length) {
        const tags = skillTags(entry.item);
        const tagOk = tagMatchMode === "or"
          ? activeTags.some((tag) => tags.includes(tag))
          : activeTags.every((tag) => tags.includes(tag));
        if (!tagOk) return false;
      }
      if (!q) return true;
      const item = entry.item || {};
      const values = entry.type === "discover" ? discoverSearchValues(item, searchOptions) : localSkillSearchValues(item, searchOptions);
      return matchesSearchFields(values, q);
    });
    return filtered.map((entry, index) => ({
      ...entry,
      storageKey: entry.key,
      key: `${entry.type}:${skillGroupKey(entry.item)}:${entry.item?.id || index}`
    })).sort((a, b) => new Date(b.createdAt || groupedJoinTime(b.item) || 0) - new Date(a.createdAt || groupedJoinTime(a.item) || 0));
  }, [starredItems, query, activeTags, tagMatchMode, searchOptions, data, uninstalledData, starSourceFilters]);

  useEffect(() => {
    if (listMode === "settings" || listMode === "logs" || listMode === "events" || listMode === "tags") {
      setSelected(null);
      setSelectedDiscover(null);
      setSelectedStarred(null);
      if (listMode === "tags" && (!selectedTag || !allTagCounts.some((item) => item.tag === selectedTag))) {
        setSelectedTag(allTagCounts[0]?.tag || "");
      }
      return;
    }
    if (listMode === "starred") {
      setSelected(null);
      setSelectedDiscover(null);
      if (!starredFiltered.length) setSelectedStarred(null);
      else {
        const refreshedStarred = selectedStarred ? starredFiltered.find((entry) => entry.key === selectedStarred.key) : null;
        if (refreshedStarred && refreshedStarred !== selectedStarred) {
          setSelectedStarred(refreshedStarred);
        } else if (!selectedStarred || !refreshedStarred) {
          setSelectedStarred(starredFiltered[0]);
        }
      }
      return;
    }
    const activeList = listMode === "uninstalled" ? uninstalledFiltered : installedFiltered;
    if (listMode !== "discover") {
      setSelectedDiscover(null);
      setSelectedStarred(null);
      if (!activeList.length) {
        setSelected(null);
      } else {
        const refreshedSelected = selected ? activeList.find((skill) => skill.id === selected.id) : null;
        if (refreshedSelected && refreshedSelected !== selected) {
          setSelected(refreshedSelected);
        } else if (!selected || !refreshedSelected) {
          setSelected(activeList[0]);
        }
      }
    }
    if (listMode === "discover") {
      setSelected(null);
      setSelectedStarred(null);
      if ((!selectedDiscover || !discoverItems.some((item) => item.id === selectedDiscover.id)) && discoverItems.length) {
        setSelectedDiscover(discoverItems[0]);
      }
      if (!discoverItems.length) setSelectedDiscover(null);
    }
  }, [installedFiltered, uninstalledFiltered, discoverItems, starredFiltered, selected, selectedDiscover, selectedStarred, selectedTag, allTagCounts, listMode]);

  useEffect(() => {
    if (listMode === "logs") refreshLogs();
    if (listMode === "events") refreshEvents();
  }, [listMode]);

  useEffect(() => {
    const valid = new Set(uninstalledFiltered.map((skill) => skill.id));
    setSelectedUninstalledIds((current) => current.filter((id) => valid.has(id)));
  }, [uninstalledFiltered]);

  const installedCount = new Set((data?.skills || []).map((skill) => skillGroupKey(skill))).size;
  const uninstalledCount = new Set((uninstalledData?.skills || []).map((skill) => skillGroupKey(skill))).size;
  const isDiscoverLeaderboard = listMode === "discover" && installSourceMode === "leaderboard";
  const showGlobalSearch = ["discover", "installed", "uninstalled", "starred", "tags"].includes(listMode);
  const visibleCount = listMode === "discover"
    ? (isDiscoverLeaderboard ? discoverItems.length : 1)
    : listMode === "tags"
      ? allTagCounts.length
      : listMode === "starred"
        ? starredFiltered.length
        : listMode === "uninstalled"
          ? uninstalledFiltered.length
          : installedFiltered.length;
  const discoverTotalLabel = githubTrends.meta?.tabLabels?.alltime || githubTrends.meta?.totalLabel || githubTrends.items.length || 0;
  const discoverModeTotalLabel = githubTrends.meta?.totalLabel || (discoverSource === "alltime" ? discoverTotalLabel : "");
  const discoverMetaCount = installSourceMode === "local"
    ? t("localInstall")
    : installSourceMode === "remote"
      ? t("remoteInstall")
      : query.trim()
    ? `${visibleCount} ${t("matches")}`
    : `${discoverModeTotalLabel || visibleCount} ${t("matches")}`;
  const discoverMetaSubline = installSourceMode === "leaderboard"
    ? (githubTrends.meta?.cachedAt ? formatDate(githubTrends.meta.cachedAt) : "skills.sh")
    : "";
  const discoverTabLabels = githubTrends.meta?.tabLabels || {};
  const installTargets = useMemo(() => {
    const sources = settings?.sources?.length ? settings.sources : data?.sources || [];
    return sources.filter((source) => source.enabled);
  }, [settings, data]);

  function toggleActiveTag(tag) {
    setActiveTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
  }

  function renderTagFilter() {
    return (
      <div className="tag-filter-wrap" ref={tagFilterRef}>
        <button className={`tag-cloud-toggle ${tagCloudOpen ? "on" : ""}`} onClick={() => setTagCloudOpen((open) => !open)}>
          <Tags size={15} />
          {t("tagFilter")}
          {activeTags.length ? <em>{activeTags.length}</em> : null}
        </button>
        {tagCloudOpen ? (
          <div className="tag-cloud-panel">
            <div className="tag-cloud-head">
              <div>
                <span>{t("selectedTags")}</span>
                {activeTags.length ? <button onClick={() => setActiveTags([])}>{t("clear")}</button> : null}
              </div>
              <div>
                <span>{t("relation")}</span>
                <div className="tag-match-switch">
                  <button className={tagMatchMode === "and" ? "on" : ""} onClick={() => setTagMatchMode("and")} title={t("tagAndTitle")}>AND</button>
                  <button className={tagMatchMode === "or" ? "on" : ""} onClick={() => setTagMatchMode("or")} title={t("tagOrTitle")}>OR</button>
                </div>
              </div>
            </div>
            <div className="tag-cloud">
              {tagCounts.length ? tagCounts.slice(0, 80).map(({ tag, count }) => (
                <TagPill
                  key={tag}
                  tag={tag}
                  as="button"
                  className={`cloud-tag ${activeTags.includes(tag) ? "active" : ""}`}
                  onClick={() => toggleActiveTag(tag)}
                >
                  <i>{activeTags.includes(tag) ? "✓" : ""}</i>
                  <strong>{tag}</strong>
                  <em>{count}</em>
                </TagPill>
              )) : <span className="tag-cloud-empty">{t("noDescription")}</span>}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  useEffect(() => {
    if (!installTargets.length) return;
    const valid = selectedInstallTargets.filter((id) => installTargets.some((source) => source.id === id));
    if (!valid.length) {
      const fallback = [installTargets.find((source) => source.id === "agents")?.id || installTargets[0].id];
      setSelectedInstallTargets(fallback);
      setDialogTargetIds((current) => current.length ? current : fallback);
    } else if (valid.length !== selectedInstallTargets.length) {
      setSelectedInstallTargets(valid);
    }
  }, [installTargets, selectedInstallTargets]);

  useEffect(() => {
    if (showGlobalSearch) return;
    setSearchConfigOpen(false);
  }, [showGlobalSearch]);

  const listSearch = showGlobalSearch ? (
    <div className="result-search-row">
      <label className="search-box result-search-box">
        <Search size={16} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder(searchOptions, t)} />
      </label>
      <div className="search-config-wrap" ref={searchConfigRef}>
        <button
          className={`icon-button search-config-button ${searchOptions.content ? "active" : ""}`}
          onClick={() => setSearchConfigOpen((open) => !open)}
          title={t("searchConfig")}
        >
          <SlidersHorizontal size={16} />
        </button>
        <SearchConfig open={searchConfigOpen} options={searchOptions} onChange={setSearchOptions} />
      </div>
    </div>
  ) : null;

  return (
    <I18nContext.Provider value={i18nValue}>
    <main className="shell">
      <header className="topbar" role="presentation" onMouseDown={startWindowDrag} onDoubleClick={toggleWindowMaximize}>
        <span className="window-drag-strip" />
      </header>

      {error ? <div className="error">{error}</div> : null}
      {notice ? <div className="notice">{notice}</div> : null}

      <section className="dashboard">
        <aside className="left-rail">
          <div className="brand rail-brand" onMouseDown={startWindowDrag}>
            <div className="brand-mark"><SkillManagerLogo /></div>
            <div>
              <h1>Skill Manager</h1>
              <p>{t("appSubtitle")}</p>
            </div>
          </div>

          <div className="library-nav">
            <div className="section-label section-label-row">
              <span>{t("library")}</span>
              <button
                className="rail-refresh-button"
                onClick={refreshCurrentLists}
                disabled={loading || githubTrends.loading}
                title={t("rescan")}
              >
                <RefreshCcw size={13} />
              </button>
            </div>
            <NavRow icon={Github} label={t("discover")} count={discoverTotalLabel} active={listMode === "discover"} onClick={() => setListMode("discover")} />
            <NavRow icon={FileCode2} label={t("installed")} count={installedCount} active={listMode === "installed"} onClick={() => { setListMode("installed"); setSourceFilter("all"); }} />
            <NavRow icon={RotateCcw} label={t("uninstalled")} count={uninstalledCount} active={listMode === "uninstalled"} onClick={() => { setListMode("uninstalled"); setSourceFilter("all"); }} />
            <NavRow icon={Star} label={t("starred")} count={starredItems.length} active={listMode === "starred"} onClick={() => setListMode("starred")} />
            <NavRow icon={Tags} label={t("tags")} count={allTagCounts.length} active={listMode === "tags"} onClick={() => setListMode("tags")} />
          </div>

          <div className="agent-nav">
            <div className="section-label">{t("agents")}</div>
            <CountRow
              label={t("allAgents")}
              count={installedCount}
              active={listMode === "installed" && sourceFilter === "all"}
              onClick={() => { setListMode("installed"); setSourceFilter("all"); }}
              logo={<span className="agent-logo agent-logo-all" aria-hidden="true">A</span>}
            />
            {agentCounts.map((agent) => (
              <CountRow
                key={agent.id}
                label={agent.name}
                count={agent.count}
                active={listMode === "installed" && sourceFilter === agent.name}
                onClick={() => { setListMode("installed"); setSourceFilter(agent.name); }}
                logo={<AgentLogo source={agent.source || { id: agent.id, client: agent.name }} />}
              />
            ))}
          </div>
          <div className="settings-nav">
            <NavRow icon={Activity} label={t("events")} count={operationEvents.length} active={listMode === "events"} onClick={() => setListMode("events")} />
            <NavRow icon={Activity} label={t("logs")} count={operationLogs.length} active={listMode === "logs"} onClick={() => setListMode("logs")} />
            <NavRow icon={Settings2} label={t("settings")} count="" active={listMode === "settings"} onClick={() => setListMode("settings")} />
          </div>
        </aside>

        {listMode === "settings" ? (
          <SettingsPage settings={settings} onSave={saveSettings} onDraftChange={(nextSettings) => setOptimisticSources(nextSettings.sources || null)} />
        ) : listMode === "events" ? (
          <OperationEventPage events={operationEvents} onRefresh={refreshEvents} onClear={clearEvents} />
        ) : listMode === "logs" ? (
          <OperationLogPage logs={operationLogs} onRefresh={refreshLogs} onClear={clearLogs} />
        ) : (
        <>
        <section className={`results ${showGlobalSearch ? "has-list-search" : ""}`}>
          {listSearch}
          <div className={`result-head ${listMode === "discover" ? "discover-head" : ""}`}>
            <div className="result-summary">
              <div className="result-title-row">
                <h2>{listMode === "discover" ? t("installSkills") : listMode === "tags" ? t("tags") : listMode === "starred" ? t("starred") : listMode === "uninstalled" ? t("uninstalled") : t("installed")}</h2>
                <p className="result-meta">
                {listMode === "discover" ? (
                  <span className="result-meta-main">
                    <span>{discoverMetaCount}</span>
                    {discoverMetaSubline ? <span>{discoverMetaSubline}</span> : null}
                  </span>
                ) : (
                  <span className="result-meta-main">
                    <span>{visibleCount} {t("matches")}</span>
                    <span>{data?.scannedAt ? formatDate(data.scannedAt) : t("preparing")}</span>
                  </span>
                )}
                {((isDiscoverLeaderboard && githubTrends.loading) || (listMode !== "discover" && loading)) ? (
                  <span className="result-scan-state" aria-label={listMode === "discover" ? t("loading") : t("scanning")}>
                    <i aria-hidden="true"><b /><b /><b /></i>
                  </span>
                ) : null}
                </p>
              </div>
            </div>
            <div className="result-controls">
              {listMode === "installed" ? (
                <>
                  <select value={localSort} onChange={(event) => setLocalSort(event.target.value)}>
                    <option value="updated">{t("sortUpdated")}</option>
                    <option value="alpha">{t("sortAlpha")}</option>
                  </select>
                  {renderTagFilter()}
                  <button className="list-refresh-button" onClick={refreshCurrentLists} disabled={loading}>
                    <RefreshCcw size={14} />
                    <span>{t("refresh")}</span>
                  </button>
                </>
              ) : listMode === "discover" ? (
                <div className="discover-toolbar">
                  <div className="install-source-tabs">
                    <div
                      className={`install-source-tab leaderboard-source-tab ${installSourceMode === "leaderboard" ? "on" : ""}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setInstallSourceMode("leaderboard")}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") setInstallSourceMode("leaderboard");
                      }}
                    >
                      <span className="leaderboard-source-label">
                        <ListTree size={14} />
                        <span className="source-tab-text-full">{t("skillsLeaderboard")}</span>
                        <span className="source-tab-text-compact">{lang === "en" ? "Board" : "榜单"}</span>
                      </span>
                      {installSourceMode === "leaderboard" ? (
                        <details
                          className="leaderboard-sort-menu"
                          onClick={(event) => event.stopPropagation()}
                          onMouseDown={(event) => event.stopPropagation()}
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          <summary aria-label={t("skillsLeaderboard")}>
                            <span>{discoverSort === "trending" ? "Trend" : discoverSort === "hot" ? "Hot" : "All"}</span>
                            <em aria-hidden="true">⌄</em>
                          </summary>
                          <div className="leaderboard-sort-options">
                            {[
                              ["alltime", "All"],
                              ["trending", "Trend"],
                              ["hot", "Hot"]
                            ].map(([value, label]) => (
                              <button
                                key={value}
                                type="button"
                                className={discoverSort === value ? "on" : ""}
                                onClick={(event) => {
                                  event.currentTarget.closest("details")?.removeAttribute("open");
                                  setDiscoverSort(value);
                                }}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </details>
                      ) : null}
                    </div>
                    <button className={installSourceMode === "local" ? "on" : ""} onClick={() => setInstallSourceMode("local")}>
                      <FolderOpen size={14} />
                      <span className="source-tab-text-full">{t("localInstall")}</span>
                      <span className="source-tab-text-compact">{lang === "en" ? "Local" : "本地"}</span>
                    </button>
                    <button className={installSourceMode === "remote" ? "on" : ""} onClick={() => setInstallSourceMode("remote")}>
                      <Github size={14} />
                      <span className="source-tab-text-full">{t("remoteInstall")}</span>
                      <span className="source-tab-text-compact">{lang === "en" ? "Remote" : "远程"}</span>
                    </button>
                  </div>
                </div>
              ) : listMode === "starred" ? (
                <>
                  <div className="star-source-wrap" ref={starSourceRef}>
                    <button className={`star-source-toggle ${starSourceOpen ? "on" : ""}`} onClick={() => setStarSourceOpen((open) => !open)}>
                      <Star size={14} />
                      {t("sourceFilter")}
                      <em>{starSourceFilters.includes("all") ? t("all") : starSourceFilters.length ? starSourceFilters.length : t("noSource")}</em>
                    </button>
                    {starSourceOpen ? (
                      <div className="star-source-panel">
                        <label>
                          <input
                            type="checkbox"
                            checked={starSourceFilters.includes("all")}
                            onChange={() => toggleStarSourceFilter("all")}
                          />
                          <span>{t("allSources")}</span>
                        </label>
                        {starSourceOptions.map(([value]) => (
                          <label key={value}>
                            <input
                              type="checkbox"
                              checked={starSourceFilters.includes("all") || starSourceFilters.includes(value)}
                              onChange={() => toggleStarSourceFilter(value)}
                            />
                            <span>{sourceFilterLabel(value, t)}</span>
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {renderTagFilter()}
                  <button className="list-refresh-button" onClick={refreshCurrentLists} disabled={loading}>
                    <RefreshCcw size={14} />
                    <span>{t("refresh")}</span>
                  </button>
                </>
              ) : listMode === "uninstalled" ? (
                <div className="uninstalled-tools">
                  <div className="uninstalled-action-row">
                    {uninstalledFiltered.length ? (
                      <button
                        className={selectedUninstalledIds.length ? "compact-danger-button" : "compact-ghost-button"}
                        onClick={() => clearUninstalledRecords(selectedUninstalledIds.length ? selectedUninstalledItems() : uninstalledFiltered)}
                      >
                        {selectedUninstalledIds.length ? `${t("clear")} ${selectedUninstalledIds.length}` : t("clearRecords")}
                      </button>
                    ) : null}
                    {selectedUninstalledIds.length ? (
                      <button
                        className="tag-cloud-toggle uninstalled-cancel-toggle"
                        onClick={() => {
                          setSelectedUninstalledIds([]);
                          setLastUninstalledSelectId("");
                        }}
                      >
                        {t("cancelSelection")}
                      </button>
                    ) : renderTagFilter()}
                    <button className="list-refresh-button" onClick={refreshCurrentLists} disabled={loading}>
                      <RefreshCcw size={14} />
                      <span>{t("refresh")}</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          {["installed", "uninstalled", "starred"].includes(listMode) && activeTags.length ? (
            <div className="active-filter-row">
              {activeTags.map((tag) => (
                <TagPill key={tag} tag={tag} as="button" onClick={() => toggleActiveTag(tag)}>{t("tags")}：{tag}</TagPill>
              ))}
              <button onClick={() => setActiveTags([])}>{t("clear")}</button>
            </div>
          ) : null}
          <div
            className="skill-list"
            onScroll={(event) => {
              if (!isDiscoverLeaderboard) return;
              const element = event.currentTarget;
              if (element.scrollTop + element.clientHeight >= element.scrollHeight - 220) {
                githubTrends.loadMore?.();
              }
            }}
          >
            {isDiscoverLeaderboard && !githubTrends.loading && (githubTrends.error || githubTrends.meta?.stale) ? (
              <div className={`discover-status ${githubTrends.error ? "warn" : ""}`}>
                {githubTrends.meta?.stale
                  ? t("discoverCacheFallback").replace("{suffix}", githubTrends.meta?.cachedAt ? ` · ${formatDate(githubTrends.meta.cachedAt)}` : "")
                  : t("discoverLoadFailed").replace("{message}", githubTrends.error)}
              </div>
            ) : null}
            {visibleCount === 0 && (listMode !== "discover" || isDiscoverLeaderboard) ? <EmptyList mode={listMode} scanning={listMode === "discover" ? githubTrends.loading : loading} /> : null}
            {listMode === "tags" ? (
              <div className="tag-overview">
                {allTagCounts.map(({ tag, count }) => {
                  const max = Math.max(1, allTagCounts[0]?.count || 1);
                  const level = Math.min(6, Math.max(1, Math.ceil((count / max) * 6)));
                  return (
                    <TagPill
                      key={tag}
                      tag={tag}
                      as="button"
                      className={`tag-page-tag size-${level} ${selectedTag === tag ? "active" : ""}`}
                      onClick={() => setSelectedTag(tag)}
                    >
                      <strong>{tag}</strong>
                      <em>{count}</em>
                    </TagPill>
                  );
                })}
              </div>
            ) : listMode === "discover" && installSourceMode !== "leaderboard" ? (
              <InstallSourcePanel
                mode={installSourceMode}
                localPath={localImportPath}
                localError={localImportError}
                localBusy={localImportBusy}
                onLocalPathChange={(value) => {
                  setLocalImportPath(value);
                  setLocalImportError("");
                }}
                onChooseLocal={chooseLocalImportDirectory}
                onConfirmLocal={confirmLocalImportPath}
                remoteUrl={remoteInstallUrl}
                remoteName={remoteInstallName}
                remoteError={remoteInstallError}
                remoteBusy={remoteInstallBusy}
                onRemoteUrlChange={(value) => {
                  setRemoteInstallUrl(value);
                  setRemoteInstallError("");
                }}
                onRemoteNameChange={(value) => {
                  setRemoteInstallName(value);
                  setRemoteInstallError("");
                }}
                onConfirmRemote={confirmRemoteInstall}
              />
            ) : listMode === "discover" ? (
              <>
                {visibleDiscoverItems.map((item, index) => (
                  <DiscoverRow
                    key={item.id}
                    item={item}
                    index={item.rank ? item.rank - 1 : index}
                    selected={selectedDiscover?.id === item.id}
                    onSelect={setSelectedDiscover}
                    onInstall={beginInstallDiscover}
                    onUninstall={beginUninstallMany}
                    busy={busyAction === `discover:${item.id}` || installedForDiscover(item).some((skill) => busyAction === `uninstall:${skill.id}`)}
                    starred={isStarred("discover", item)}
                    onStar={(starItem) => toggleStar("discover", starItem)}
                    installedSkills={installedForDiscover(item)}
                  />
                ))}
                {githubTrends.loadingMore ? (
                  <div className="discover-load-more">
                    <LoadingMoment title={`${t("loading")} skills`} seed={`discover-more-${discoverSource}`} compact />
                  </div>
                ) : null}
              </>
            ) : listMode === "starred" ? starredFiltered.map((entry, index) => entry.type === "discover" ? (
              <DiscoverRow
                key={entry.key}
                item={entry.item}
                index={entry.item.rank ? entry.item.rank - 1 : index}
                selected={selectedStarred?.key === entry.key}
                onSelect={() => setSelectedStarred(entry)}
                onInstall={beginInstallDiscover}
                onUninstall={beginUninstallMany}
                busy={busyAction === `discover:${entry.item.id}` || installedForDiscover(entry.item).some((skill) => busyAction === `uninstall:${skill.id}`)}
                starred
                onStar={() => unstarEntry(entry)}
                installedSkills={installedForDiscover(entry.item)}
              />
            ) : (
              <SkillRow
                key={entry.key}
                skill={entry.item}
                index={index}
                tone="starred"
                selected={selectedStarred?.key === entry.key}
                onSelect={() => setSelectedStarred(entry)}
                actionLabel={entry.type === "installed" ? t("uninstall") : ""}
                onAction={entry.type === "installed" ? (skill) => beginUninstallMany(skill, skill.installations || [skill]) : null}
                busy={busyAction === `${entry.type === "uninstalled" ? "restore" : "uninstall"}:${entry.item.id}`}
                starred
                onStar={() => unstarEntry(entry)}
                sourceLabel={entry.type}
              />
            )) : listMode === "uninstalled" ? uninstalledFiltered.map((skill, index) => (
              <SkillRow
                key={skill.id}
                skill={skill}
                index={index}
                tone="uninstalled"
                selected={selected?.id === skill.id}
                onSelect={setSelected}
                selectable
                checked={selectedUninstalledIds.includes(skill.id)}
                onToggleSelect={toggleUninstalledSelection}
                busy={busyAction === `restore:${skill.id}`}
                starred={isStarred("uninstalled", skill)}
                onStar={(starItem) => toggleStar("uninstalled", starItem)}
              />
            )) : installedFiltered.map((skill, index) => (
              <SkillRow
                key={skill.id}
                skill={skill}
                index={index}
                tone="installed"
                selected={selected?.id === skill.id}
                onSelect={setSelected}
                actionLabel={t("uninstall")}
                onAction={(skill) => beginUninstallMany(skill, skill.installations || [skill])}
                busy={busyAction === `uninstall:${skill.id}`}
                starred={isStarred("installed", skill)}
                onStar={(starItem) => toggleStar("installed", starItem)}
              />
            ))}
          </div>
        </section>

        {listMode === "discover" ? (
          installSourceMode === "leaderboard" ? (
            <DiscoverDetail
              item={selectedDiscover}
              onInstall={beginInstallDiscover}
              onUninstall={beginUninstallMany}
              busy={selectedDiscover ? busyAction === `discover:${selectedDiscover.id}` || installedForDiscover(selectedDiscover).some((skill) => busyAction === `uninstall:${skill.id}`) : false}
              starred={selectedDiscover ? isStarred("discover", selectedDiscover) : false}
              onStar={(item) => toggleStar("discover", item)}
              installedSkills={selectedDiscover ? installedForDiscover(selectedDiscover) : []}
            />
          ) : (
            <InstallSourceDetail mode={installSourceMode} />
          )
        ) : listMode === "tags" ? (
          <TagSkillPanel
            tag={selectedTag}
            skills={selectedTagSkills}
            onOpenSkill={(skill) => {
              setActiveTags([]);
              setSourceFilter("all");
              setSelected(skill);
              setListMode("installed");
            }}
          />
        ) : listMode === "starred" ? (
          selectedStarred?.type === "discover" ? (
            <DiscoverDetail
              item={selectedStarred.item}
              onInstall={beginInstallDiscover}
              onUninstall={beginUninstallMany}
              busy={busyAction === `discover:${selectedStarred.item.id}` || installedForDiscover(selectedStarred.item).some((skill) => busyAction === `uninstall:${skill.id}`)}
              starred
              onStar={() => unstarEntry(selectedStarred)}
              installedSkills={installedForDiscover(selectedStarred.item)}
            />
          ) : (
            <Detail
              skill={selectedStarred?.item || null}
              onSaved={refresh}
              starred={Boolean(selectedStarred)}
              onStar={() => unstarEntry(selectedStarred)}
              onInstall={selectedStarred?.type === "uninstalled" ? beginRestoreSkill : null}
              topInstallLabel={selectedStarred?.type === "uninstalled" ? t("recover") : t("install")}
              hideTopInstall={selectedStarred?.type !== "uninstalled"}
              onUninstall={selectedStarred?.type === "uninstalled" ? null : beginUninstallMany}
              onDeleteRecords={selectedStarred?.type === "uninstalled" ? beginDeleteUninstalledRecords : null}
              agentScope={sourceFilter}
              installTargets={installTargets}
              readOnly={selectedStarred?.type === "uninstalled"}
              hideHistory={selectedStarred?.type === "uninstalled"}
              hideVersionActions={selectedStarred?.type === "uninstalled"}
              hideTopEdit={selectedStarred?.type === "uninstalled"}
              cardActionLabel={selectedStarred?.type === "uninstalled" ? t("recover") : ""}
              onCardAction={selectedStarred?.type === "uninstalled" ? beginRecoverOriginalAgent : null}
            />
          )
        ) : (
          <Detail
            skill={selected}
            onSaved={refresh}
            starred={selected ? isStarred(listMode === "uninstalled" ? "uninstalled" : "installed", selected) : false}
            onStar={(item) => toggleStar(listMode === "uninstalled" ? "uninstalled" : "installed", item)}
            onInstall={listMode === "uninstalled" ? beginRestoreSkill : null}
            topInstallLabel={listMode === "uninstalled" ? t("recover") : t("install")}
            hideTopInstall={listMode !== "uninstalled"}
            onUninstall={listMode === "uninstalled" ? null : beginUninstallMany}
            onDeleteRecords={listMode === "uninstalled" ? beginDeleteUninstalledRecords : null}
            agentScope={sourceFilter}
            installTargets={installTargets}
            readOnly={listMode === "uninstalled"}
            hideHistory={listMode === "uninstalled"}
            hideVersionActions={listMode === "uninstalled"}
            hideTopEdit={listMode === "uninstalled"}
            cardActionLabel={listMode === "uninstalled" ? t("recover") : ""}
            onCardAction={listMode === "uninstalled" ? beginRecoverOriginalAgent : null}
          />
        )}
        </>
        )}
      </section>
      <LocalImportDialog
        open={localImportOpen}
        pathValue={localImportPath}
        error={localImportError}
        busy={localImportBusy}
        onPathChange={(value) => {
          setLocalImportPath(value);
          setLocalImportError("");
        }}
        onChooseDirectory={chooseLocalImportDirectory}
        onCancel={closeLocalImportDialog}
        onConfirm={confirmLocalImportPath}
      />
      <InstallTargetDialog
        pending={pendingInstall}
        targets={pendingInstall?.targets || installTargets}
        selectedTargets={dialogTargetIds}
        onChangeTargets={setDialogTargetIds}
        onCancel={() => {
          setPendingInstall(null);
          setPendingConflict(null);
          setConflictActions({});
        }}
        onConfirm={confirmPendingInstall}
        busy={Boolean(busyAction)}
      />
      <InstallConflictDialog
        pending={pendingConflict?.pending}
        conflicts={pendingConflict?.conflicts || []}
        actions={conflictActions}
        onChangeAction={(id, action) => setConflictActions((current) => ({ ...current, [id]: action }))}
        onViewDiff={viewInstallConflictDiff}
        onCancel={() => {
          setPendingConflict(null);
          setConflictActions({});
        }}
        onConfirm={() => submitPendingOperation(pendingConflict.pending, pendingConflict.targetIds, conflictActions)}
        busy={Boolean(busyAction)}
      />
    </main>
    </I18nContext.Provider>
  );
}

createRoot(document.getElementById("root")).render(<App />);
