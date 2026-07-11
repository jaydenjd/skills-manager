# Skill Manager

中文 | [English](README.en.md)

Skill Manager 是一个本地桌面端的 **AI Agent Skill 管理器**。它把散落在不同客户端目录里的 `SKILL.md` 统一扫描、浏览、安装、卸载、恢复、收藏和版本管理，也可以直接从 [skills.sh](https://www.skills.sh/) 发现热门 skill 并安装到指定 Agent。

如果你同时使用 Codex、Claude、Qoder、Agents 等多个客户端，Skill Manager 的目标就是让 skill 不再变成一堆难找、难同步、难回滚的本地文件夹。

## 它解决什么问题

- **本地 skill 太分散**：不同 Agent 有不同目录，手动找 `SKILL.md` 很麻烦。
- **安装和卸载不透明**：不知道装到了哪个 Agent，也不知道是否能恢复。
- **修改后不好回滚**：skill 可能被自己或 Agent 改过，但缺少目录级历史。
- **发现新 skill 成本高**：需要自己去 GitHub 或 skills.sh 找，再手动安装。
- **多 Agent 同步困难**：同一个 skill 可能要装到多个客户端，还要知道各自版本。

## 截图

### Discover

Discover 对齐 skills.sh：支持 All / Trend / Hot 排名、搜索、安装量展示、本地已安装状态、来源仓库和一键安装。

![Discover skills](docs/screenshots/discover.png)

### 本地 Skill 详情

本地详情会展示 skill 的元信息、标签、安装到哪些 Agent、目录树、`SKILL.md` 阅读/编辑，以及每个 Agent 副本的版本。

![Installed skills](docs/screenshots/installed-skills.jpg)

### 多 Agent 安装

安装、卸载、恢复、同步和发布版本都支持选择多个 Agent。弹窗会显示目标 Agent 当前是否已安装，以及已安装版本。

![Choose install agents](docs/screenshots/install-agents_v2.png)

## 核心特性

### Discover skills.sh

- 默认来源为 skills.sh。
- 支持 All、Trend、Hot 排名。
- 搜索使用 skills.sh 的搜索接口，结果和官网搜索保持一致。
- 卡片展示来源仓库、本地安装 Agent、累计安装量和近 8 周安装量。
- 已安装的 skill 会显示安装位置，并支持卸载或更新。

### 本地多 Agent 管理

- 扫描多个 Agent 的 skills 目录。
- 只识别一级 skill 目录，并要求目录内存在 `SKILL.md`。
- All Agents 视图可合并同名 skill，并在详情里展示所有 Agent 副本。
- 支持 Installed、Uninstalled、Starred、Tags 多个视图。
- 标签优先读取 `SKILL.md` frontmatter 的 `tags` / `keywords` / `categories`，缺失时再自动推断。

### Skill 友好的阅读和编辑

- 默认展示 `SKILL.md` 内容。
- 左侧按真实目录树展示文件。
- 支持新增文件、目录、重命名、删除、复制相对路径、复制绝对路径。
- 阅读和编辑模式可切换；编辑模式下切换文件仍保持编辑状态。
- 代码文件支持更适合阅读的展示方式。

### 安装、卸载、恢复和同步

- Install / Uninstall / Recover / Sync 都支持多选 Agent。
- 操作走后台事件，不阻塞界面。
- Events 会展示状态流转和进度。
- Logs 记录操作结果。
- 卸载不会直接删除，而是移动到应用自己的数据目录，方便恢复。
- Uninstalled 以 skill 为维度展示最近卸载记录，恢复后记录会被清除。

### 版本和历史

- 每个 Agent 的 skill 版本独立管理。
- 如果 `SKILL.md` 有 `version`，优先使用真实版本。
- 如果没有版本，会根据目录内文件的最新修改时间显示临时版本。
- 通过应用“发布版本”后，会写入 `SKILL.md` version，并创建目录级版本快照。
- 历史版本按目录展示变更文件，支持查看 diff、选择版本、删除历史版本。
- 默认历史版本保留 30 天，可在 Settings 里修改。

### 设置

- 可视化配置和 JSON 配置可切换。
- 可配置 Agent 名称、目录、是否启用。
- 可配置默认安装 Agent、安装弹窗默认选择逻辑。
- 可配置 ignore 规则，类似 gitignore，例如默认忽略 `*.pyc`。
- 可配置 Logs / Events / Skill Versions 保留时间。

## 默认 Agent 目录

默认扫描以下目录：

| Agent | 目录 |
| --- | --- |
| Codex | `~/.codex/skills` |
| Agents | `~/.agents/skills` |
| Claude | `~/.claude/skills` |
| Qoder | `~/.qoder/skills` |
| QoderWork | `~/.qoderwork/skills` |
| OpenClaw | `~/.openclaw/skills` |

这些都可以在 Settings 里修改、禁用、删除或新增。

## 如何安装

### 下载安装包

从 GitHub Releases 下载对应平台安装包：

- macOS: `Skill Manager-<version>-arm64.dmg` 或 Intel 版本
- Windows: `Skill Manager Setup <version>.exe`

macOS 推荐使用已签名并公证的 DMG。未签名包可能被系统提示“已损坏”或无法直接打开。

### Discover 安装 skill 的运行要求

如果要从 Discover 安装远端 skill，用户机器需要：

- Node.js / `npx`
- Git
- 可访问 skills.sh 和 GitHub

当 Git 不可用或 Git clone 失败时，应用会尝试使用 GitHub zip 下载作为 fallback。

## 如何使用

1. 打开应用，等待左侧 Library 和 Agents 扫描完成。
2. 在 **Discover** 里搜索或浏览 skills.sh 榜单。
3. 点击 skill，查看来源、安装量、Summary 和 `SKILL.md` 内容。
4. 点击 **Install**，选择要安装到哪些 Agent。
5. 在 **Installed** 里查看本地 skill，按标签、Agent 或搜索筛选。
6. 进入详情后，可查看目录树、编辑文件、发布版本、查看历史版本。
7. 如果卸载，记录会进入 **Uninstalled**，之后可以 Recover。
8. 常用 skill 可以 Star，在 **Starred** 里统一查看。

## 本地开发

### 环境要求

- Node.js
- npm
- Git

### 安装依赖

```bash
npm install
```

如果本地 `package-lock.json` 指向内部 npm 源，分享给外部开发者前可以重新生成：

```bash
rm package-lock.json
npm install --registry=https://registry.npmjs.org/
```

### 启动开发环境

```bash
npm run start
```

这个命令会同时启动 Vite 和 Electron。

### 构建前端

```bash
npm run build
```

构建产物输出到 `dist/`。

## 打包

### macOS

普通 DMG：

```bash
npm run dist:mac
```

Apple Developer ID 签名和公证：

```bash
npm run dist:mac:signed
```

本地公证默认使用 Keychain profile：

```text
skill-manager-notary
```

Apple 签名和公证配置说明见：

[docs/apple-notarization.md](docs/apple-notarization.md)

验证 DMG：

```bash
hdiutil verify "release/Skill Manager-<version>-arm64.dmg"
```

验证 App 签名和 Gatekeeper 状态：

```bash
codesign --verify --deep --strict --verbose=2 "release/mac-arm64/Skill Manager.app"
spctl --assess --type execute --verbose "release/mac-arm64/Skill Manager.app"
```

### Windows

Windows 使用 NSIS 安装包，图标在 `build/icon.ico`。

建议在 Windows 机器上构建：

```bash
npm install
npm run dist:win
```

未签名的 Windows 安装包可能触发 SmartScreen 提示。公开分发建议配置 Windows 代码签名证书。

## 应用数据目录

运行时数据保存在 Electron app data 目录：

```text
~/Library/Application Support/skill-manager
```

主要内容：

- `settings.json`：设置、日志、事件、Agent 配置、ignore 规则等。
- `managed-skills/uninstalled/`：卸载后移动过来的 skill 快照。
- `managed-skills/versions/`：应用发布版本后的目录级版本快照。
- `managed-skills/skills/`：应用管理的 skill 复制数据。

## 项目结构

```text
electron/
  main.cjs       Electron 主进程，处理文件系统、安装/卸载、版本、事件等。
  preload.cjs    安全 IPC bridge，暴露给 React。
  scanner.cjs    本地 skill 扫描、默认来源、ignore 规则。

src/
  App.jsx        React 主应用。
  styles.css     UI 样式。

build/
  icon.svg       图标源文件。
  icon.png       运行时图标。
  icon.icns      macOS 应用图标。
  icon.ico       Windows 应用图标。

docs/
  screenshots/   README 截图。

dist/            前端构建产物。
release/         本地打包输出。
```

## 备注

- Skill Manager 不会把 `~/.agents/skills` 视为所有 Agent 都一定能加载的通用目录；每个 Agent 是否加载哪个目录，以 Settings 配置为准。
- 卸载记录是恢复用快照，不等同于长期版本库；如果清空 Uninstalled 记录，对应快照会被删除。
- 如果远端 skill 没有版本，应用不会凭空判断新旧；冲突时会提示用户选择跳过、替换或查看差异。
- 当前主要体验聚焦 macOS，同时已配置 Windows 打包流程。
