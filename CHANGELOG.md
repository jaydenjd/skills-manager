# Changelog

本文件记录 Skill Manager 的主要提交变更与版本变更。

## v0.2.5 - 2026-07-13

### Changed

- 将全局搜索移动到第二栏顶部，仅在 Discover / Installed / Uninstalled / Starred / Tags 列表页展示。
- 将刷新入口移动到左侧 Library 标题右侧，缩短搜索与列表操作的视觉距离。
- 统一第二栏顶部区域、筛选控件、分割线和列表滚动空间，减少不同栏目切换时的视觉抖动。

## v0.2.4 - 2026-07-12

### Added

- 增加应用菜单中的 Settings 与 Language 入口，保留侧边栏 Settings 入口。
- 增加中英文菜单栏切换，支持从菜单直接切换语言并打开设置页。

### Changed

- Discover 加载策略调整为 All / Trending / Hot 首屏并发加载，每个 tab 独立预加载后两页，滚动后继续预热后续页面。
- skills.sh 请求增加 gzip / br / deflate 压缩解码，并在读取到 `initialSkills` 后提前解析，提升 Discover 加载速度。
- 优化英文长文案、版本下拉与 Uninstalled 操作按钮在双语环境下的布局稳定性。
- 顶部品牌区下移，避开 macOS 窗口控制按钮。

### Fixed

- 修复语言切换后部分页面文案混用的问题。
- 修复 Discover 分页缓存 key 不包含搜索词导致的潜在混用问题。

## v0.2.3 - 2026-07-11

### Added

- 增加冷启动启动页，避免首次打开时出现空白窗口。
- 增加 Installed / Discover 加载时的小动画与随机提示文案。
- 增加目录面板空白区域右键菜单，支持在 skill 根目录创建文件、创建目录、复制相对路径、复制绝对路径。
- 增加主进程剪贴板写入接口，提升复制路径稳定性。

### Changed

- 本地 Installed 首扫改为轻量扫描：只扫描一级 skill 目录并读取必要列表信息，详情页再懒加载完整目录树和版本信息。
- 扫描规则调整为只识别根目录下一级目录中的 `SKILL.md`，避免误扫深层目录。
- 标签生成改为优先使用 `SKILL.md` frontmatter 中的 `tags` / `keywords` / `categories` / `category`，没有显式标签时才自动推断。
- Discover 顶部切换区只保留排序按钮，加载动画移动到列表区域。
- 版本下拉支持点击外部自动关闭，最新版本提示改为更紧凑的非遮挡样式。

### Fixed

- 修复删除文件/目录后目录树延迟消失或被旧详情刷新短暂覆盖的问题。
- 修复复制相对路径/绝对路径不稳定的问题。
- 修复首次扫描中第二栏过早显示“没有本地 skill”的问题。

## v0.2.2 - 2026-07-11

### Added

- 在第二栏和详情页显示 skill 当前版本。
- Discover 详情展示 summary、安装方式、skill 内容等信息。

### Fixed

- 修复 Discover 进入后偶发空白的问题。
- 修复版本显示与 `SKILL.md` frontmatter 不一致的部分问题。

## v0.2.1 - 2026-07-11

### Changed

- Discover 加载策略调整为优先加载第一页和总量，减少一次性加载大量数据导致的等待。

## v0.2.0 - 2026-07-11

### Added

- 设置页增加 App 版本显示。
- 增加中文 README，并保留英文文档入口。

### Changed

- 默认 README 调整为中文项目介绍与本地构建说明。

## v0.1.9 - 2026-07-11

### Added

- 增加 Apple 公证配置文档。
- 增加 macOS 签名与 GitHub Actions 构建配置说明。

## v0.1.8 - 2026-07-11

### Added

- 增加 GitHub Actions 构建流程。
- 支持 macOS arm64、macOS Intel、Windows 安装包构建。

## v0.1.7 - 2026-07-11

### Added

- 初始可安装版本。
- 支持本地多 Agent skill 管理、Discover、Installed、Uninstalled、Starred、Settings 等基础功能。
