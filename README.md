# Skill Manager

[English](README.en.md) | 中文

Skill Manager 是一个本地桌面应用，用来管理不同 AI Agent 客户端里的 skills。它可以扫描本地已经安装的 `SKILL.md`，展示 skill 目录结构，支持阅读、编辑、历史版本、回滚、收藏，也可以从 skills.sh 发现热门 skill，并安装到一个或多个 Agent 目录。

项目基于 Electron、React 和 Vite 构建。

## 截图

### Discover Skills

浏览 skills.sh 排行榜，支持 All Time、Trending、Hot 排序，搜索 skill，查看仓库信息，并安装到指定 Agent。

![Discover skills](docs/screenshots/discover.png)

### 本地 Skill 详情

查看已安装或收藏的 skill，阅读 `SKILL.md`，浏览完整目录树，并查看当前 skill 安装到了哪些 Agent。

![Installed skills](docs/screenshots/installed-skills.jpg)

### 多 Agent 安装

安装、卸载、恢复、更新都支持选择多个 Agent 目录。应用可以记住上次选择，也可以使用设置里的默认安装目标。

![Choose install agents](docs/screenshots/install-agents_v2.png)

## 主要能力

- 从 skills.sh 发现 skill，支持 All Time、Trending、Hot 排序。
- 支持搜索本地和 Discover skill，搜索范围可配置。
- 管理多个 Agent 目录下的本地 skill。
- 支持标签浏览，按标签云查看和筛选相关 skill。
- 安装、卸载、恢复、更新通过后台事件执行，并展示进度和状态。
- 卸载时不会直接删除 skill，而是移动到应用数据目录，方便恢复。
- 以适合 skill 阅读的方式展示 `SKILL.md` 和完整目录树。
- 支持编辑本地 skill 文件，并提供历史版本、diff 和回滚。
- Discover、Installed、Uninstalled 都支持收藏。
- 支持配置 Agent、忽略规则、日志/事件保留时间、默认安装目标。
- 设置页支持可视化配置和 JSON 配置切换。

## 默认 Agent 来源

默认扫描以下目录：

- Codex: `~/.codex/skills`
- Agents: `~/.agents/skills`
- Claude: `~/.claude/skills`
- Qoder: `~/.qoder/skills`
- QoderWork: `~/.qoderwork/skills`
- OpenClaw: `~/.openclaw/skills`

这些目录可以在设置里修改、增加或删除。

## 应用数据目录

运行时数据保存在 Electron 的 app data 目录：

```text
~/Library/Application Support/skill-manager
```

主要内容：

- `settings.json`：设置、日志、事件、Agent 配置、忽略规则等。
- `history/`：编辑历史和可回滚版本。
- `managed-skills/uninstalled/`：卸载后移动过来的 skill。
- `managed-skills/skills/`：应用管理的复制 skill。

## 开发环境要求

开发需要：

- Node.js
- npm
- Git

Discover 安装功能在用户机器上需要：

- Node.js / `npx`
- Git
- 能访问 skills.sh 和 GitHub 的网络环境

## 安装依赖

```bash
npm install
```

如果本地 `package-lock.json` 指向内部 npm 源，分享给外部开发者前可以重新生成：

```bash
rm package-lock.json
npm install --registry=https://registry.npmjs.org/
```

## 本地开发

```bash
npm run start
```

这个命令会同时启动 Vite 和 Electron。

## 构建前端

```bash
npm run build
```

构建产物会输出到 `dist/`。

## 打包 macOS 应用

普通 macOS DMG 构建：

```bash
npm run dist:mac
```

输出示例：

```text
release/Skill Manager-<version>-arm64.dmg
```

应用图标配置在：

```text
build/icon.icns
```

macOS 构建已经配置 Developer ID 签名和 Apple 公证。当前签名身份：

```text
JUNDE WU (A8DZ968K75)
```

在已经安装证书的 Mac 上构建签名并公证的 DMG：

```bash
npm run dist:mac:signed
```

本地公证默认使用 Keychain profile：

```text
skill-manager-notary
```

Apple 签名和公证的完整配置说明见：

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

## 打包 Windows 应用

Windows 使用 NSIS 安装包，配置在 `package.json`。图标文件：

```text
build/icon.ico
```

在 Windows 机器上构建：

```bash
npm install
npm run dist:win
```

构建产物输出到 `release/`。

建议在 Windows 上重点验证：

- Agent 目录识别和路径处理。
- 安装、卸载、恢复、更新流程。
- 打开文件和定位目录。
- `npx skills add` 执行。
- Git 是否可用。
- 设置、日志和事件是否持久化。

未签名的 Windows 安装包可能触发 SmartScreen 提示。如需公开分发，建议配置 Windows 代码签名证书。

## 项目结构

```text
electron/
  main.cjs       Electron 主进程，处理文件系统、安装/卸载、事件等。
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

dist/            前端构建产物。
release/         本地打包输出。
docs/            文档和截图。
```

## 说明

- 卸载 skill 不会直接删除文件，而是移动到应用管理的 uninstalled 目录。
- 设置支持可视化编辑和 JSON 编辑。
- Logs 和 Events 支持配置保留时间，默认永久保留。
- 标签从本地 skill 元数据里计算，可用于浏览相关 skill。
- 当前主要体验聚焦 macOS，同时已配置 Windows 打包流程。
